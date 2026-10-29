// Impostazioni di Touch OS: colore, forma, dimensione dei bersagli, gesti, Shelf, modalità tablet.
// Si apre dall'app Estensioni, con `gnome-extensions prefs touch-shell@touch-os`, o dal menu delle app
// («Impostazioni di Touch OS»), che funziona anche prima del primo nuovo accesso.
//
// I valori stanno nelle impostazioni dell'estensione (dconf): gesti e Shelf li leggono dal vivo. Per il tema ogni
// modifica rigenera i CSS (themegen.js) e fa ricaricare la Shell; le app GTK già aperte leggono il tema solo
// all'avvio, quindi vanno chiuse e riaperte. Il pannello usa il tema che configura: righe da 64px, interruttori
// da pollice, quindi si può usare anche toccando.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {ACCENTS, ACCENT_NAMES} from './palette.js';
import {THEME_KEYS, readConfig, renderTheme} from './themegen.js';

/** connect() che si stacca da solo quando il widget sparisce (qui non ci sono gli helper della Shell). */
function watch(source, detail, callback, widget) {
    const id = source.connect(detail, callback);
    widget.connect('destroy', () => source.disconnect(id));
}

const ACCENT_LABELS = {iris: 'Iris', sky: 'Cielo', mint: 'Menta', coral: 'Corallo', amber: 'Ambra', rose: 'Rosa'};

/** Tre caratteri per gli angoli: i raggi di finestre e controlli vanno insieme. */
const SHAPES = [
    {name: 'Compatti', note: 'Angoli piccoli: più contenuto sullo schermo', values: {'corner-radius': 10, 'control-radius': 8}},
    {name: 'Morbidi', note: 'Il carattere di Touch OS', values: {'corner-radius': 20, 'control-radius': 14}},
    {name: 'Tondi', note: 'Il più amichevole: quasi tutto a pillola', values: {'corner-radius': 28, 'control-radius': 20}},
];

export default class TouchPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._window = window;
        this._renderId = 0;
        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});

        window.set_default_size(720, 860);
        window.set_search_enabled(true);
        this._installSwatchCss();

        window.add(this._lookPage());
        window.add(this._gesturesPage());
        window.add(this._shelfPage());
        window.add(this._advancedPage());

        // Ogni modifica a una voce del tema rigenera i CSS, con un po' di calma.
        for (const key of THEME_KEYS)
            watch(this._settings, `changed::${key}`, () => this._scheduleRender(), window);
        window.connect('close-request', () => {
            if (this._renderId) {
                GLib.source_remove(this._renderId);
                this._renderId = 0;
                this._renderNow(false);
            }
            return false;
        });
    }

    // ── Tema: rigenerazione ──────────────────────────────────────────────────

    get _themeDir() {
        return GLib.build_filenamev([GLib.get_user_data_dir(), 'themes', 'Touch']);
    }

    _scheduleRender() {
        if (this._renderId)
            GLib.source_remove(this._renderId);
        this._renderId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
            this._renderId = 0;
            this._renderNow(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    _renderNow(toast) {
        try {
            const changed = renderTheme(this._themeDir, readConfig(this._settings));
            if (changed.length) {
                // il contatore fa ricaricare il tema alla Shell
                this._settings.set_int('theme-serial', this._settings.get_int('theme-serial') + 1);
                if (toast) {
                    this._window.add_toast(new Adw.Toast({
                        title: 'Tema aggiornato. Le app già aperte lo prendono al prossimo avvio.',
                        timeout: 3,
                    }));
                }
            }
        } catch (e) {
            this._window.add_toast(new Adw.Toast({title: `Non riesco a rigenerare il tema: ${e.message}`, timeout: 6}));
        }
    }

    // ── Componenti ───────────────────────────────────────────────────────────

    _installSwatchCss() {
        // Il tema (gtk.css dell'utente) dà ai pulsanti sfondo e margini suoi, anche allo stato :checked: qui lo si
        // supera con la stessa priorità ma più tardi e con un selettore più specifico.
        const css = ACCENT_NAMES.map(name => {
            const c = ACCENTS[name].dark;
            const sel = ['', ':checked', ':active', ':hover'].map(s => `button.touch-swatch.touch-swatch-${name}${s}`).join(',\n');
            return `${sel} { background-color: ${c.accent}; color: ${c.on}; }`;
        }).join('\n') + `
button.touch-swatch { border-radius: 999px; min-width: 48px; min-height: 48px; padding: 0; box-shadow: none; }
button.touch-swatch:checked { box-shadow: inset 0 0 0 3px alpha(white, 0.9); }`;
        const provider = new Gtk.CssProvider();
        provider.load_from_string(css);
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_USER + 1);
    }

    _switchRow(key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle: subtitle ?? ''});
        this._settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    /** Cursore su una chiave intera; `format` mostra il valore a destra. */
    _sliderRow(key, title, subtitle, min, max, step, format = v => String(v)) {
        const row = new Adw.ActionRow({title, subtitle: subtitle ?? ''});
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL, hexpand: true, valign: Gtk.Align.CENTER, draw_value: false,
            adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: step, page_increment: step * 2}),
        });
        scale.set_size_request(240, -1);
        const value = new Gtk.Label({css_classes: ['dim-label'], width_chars: 5, xalign: 1, valign: Gtk.Align.CENTER});
        const show = () => { value.label = format(this._settings.get_int(key)); };
        scale.set_value(this._settings.get_int(key));
        show();
        scale.connect('value-changed', () => {
            const v = Math.round(scale.get_value() / step) * step;
            if (v !== this._settings.get_int(key))
                this._settings.set_int(key, v);
        });
        watch(this._settings, `changed::${key}`, () => {
            if (Math.round(scale.get_value()) !== this._settings.get_int(key))
                scale.set_value(this._settings.get_int(key));
            show();
        }, scale);
        row.add_suffix(scale);
        row.add_suffix(value);
        return row;
    }

    // ── Pagine ───────────────────────────────────────────────────────────────

    _lookPage() {
        const page = new Adw.PreferencesPage({title: 'Aspetto', icon_name: 'applications-graphics-symbolic'});

        // colore: sei cerchi da 48px
        const colors = new Adw.PreferencesGroup({
            title: 'Colore',
            description: 'Un solo colore per ciò che è attivo: selezione, interruttori, azione principale.',
        });
        const row = new Adw.ActionRow({title: 'Accento', subtitle: 'Le icone seguono il colore al prossimo ./install.sh --accent'});
        const box = new Gtk.Box({spacing: 10, valign: Gtk.Align.CENTER, halign: Gtk.Align.END, hexpand: false, margin_top: 8, margin_bottom: 8});
        let first = null;
        const buttons = {};
        for (const name of ACCENT_NAMES) {
            const b = new Gtk.ToggleButton({tooltip_text: ACCENT_LABELS[name], css_classes: ['touch-swatch', `touch-swatch-${name}`]});
            if (first)
                b.set_group(first);
            else
                first = b;
            b.connect('toggled', () => {
                b.set_icon_name(b.active ? 'object-select-symbolic' : '');
                if (b.active)
                    this._settings.set_string('accent', name);
            });
            box.append(b);
            buttons[name] = b;
        }
        const syncAccent = () => { buttons[this._settings.get_string('accent')]?.set_active(true); };
        syncAccent();
        watch(this._settings, 'changed::accent', syncAccent, box);
        row.add_suffix(box);
        colors.add(row);
        page.add(colors);

        // forma e dimensione
        const shape = new Adw.PreferencesGroup({title: 'Forma e dimensione'});
        const presets = new Adw.ComboRow({
            title: 'Angoli',
            model: new Gtk.StringList({strings: [...SHAPES.map(c => c.name), 'Personalizzati']}),
        });
        const syncPreset = () => {
            const cur = SHAPES.findIndex(c => Object.entries(c.values).every(([k, v]) => this._settings.get_int(k) === v));
            presets.selected = cur >= 0 ? cur : SHAPES.length;
            presets.subtitle = SHAPES[cur]?.note ?? 'Raggi diversi da quelli predefiniti';
        };
        syncPreset();
        presets.connect('notify::selected', () => {
            const c = SHAPES[presets.selected];
            if (c)
                for (const [k, v] of Object.entries(c.values))
                    this._settings.set_int(k, v);
        });
        for (const k of ['corner-radius', 'control-radius'])
            watch(this._settings, `changed::${k}`, syncPreset, presets);
        shape.add(presets);
        shape.add(this._sliderRow('touch-scale', 'Dimensione dei bersagli',
            'Pulsanti, righe e tasti: 100% sono 48px per un pulsante e 64px per una riga', 80, 140, 5, v => `${v}%`));
        shape.add(this._textScaleRow());
        page.add(shape);

        const feel = new Adw.PreferencesGroup({title: 'Carattere'});
        feel.add(this._switchRow('shadows', 'Ombre morbide', 'Sotto menu, dialoghi, Shelf e tastiera: ciò che galleggia si stacca da ciò che sta sotto'));
        feel.add(this._switchRow('theme-animations', 'Transizioni', 'Dissolvenze brevi su pulsanti e righe'));
        page.add(feel);
        return page;
    }

    /** La dimensione del testo è del sistema (org.gnome.desktop.interface), non dell'estensione. */
    _textScaleRow() {
        const row = new Adw.ActionRow({
            title: 'Dimensione del testo',
            subtitle: 'Vale per tutto il sistema; su un portatile da 14" 110–125% è comodo da toccare',
        });
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL, hexpand: true, valign: Gtk.Align.CENTER, draw_value: false,
            adjustment: new Gtk.Adjustment({lower: 0.9, upper: 1.5, step_increment: 0.05, page_increment: 0.1}),
        });
        scale.set_size_request(240, -1);
        const value = new Gtk.Label({css_classes: ['dim-label'], width_chars: 5, xalign: 1, valign: Gtk.Align.CENTER});
        const show = () => { value.label = `${Math.round(this._interface.get_double('text-scaling-factor') * 100)}%`; };
        scale.set_value(this._interface.get_double('text-scaling-factor'));
        show();
        scale.connect('value-changed', () => {
            const v = Math.round(scale.get_value() * 20) / 20;
            if (Math.abs(v - this._interface.get_double('text-scaling-factor')) > 0.001)
                this._interface.set_double('text-scaling-factor', v);
        });
        watch(this._interface, 'changed::text-scaling-factor', () => {
            scale.set_value(this._interface.get_double('text-scaling-factor'));
            show();
        }, scale);
        row.add_suffix(scale);
        row.add_suffix(value);
        return row;
    }

    _gesturesPage() {
        const page = new Adw.PreferencesPage({title: 'Gesti', icon_name: 'input-touchpad-symbolic'});

        const bottom = new Adw.PreferencesGroup({
            title: 'Bordo inferiore',
            description: 'Dal bordo in basso: tirando su si apre la Home (finestre, poi app); scorrendo di lato si passa all\'app precedente o successiva.',
        });
        bottom.add(this._switchRow('home-gesture', 'Home dal bordo inferiore',
            'Spento: la tastiera su schermo si riprende il gesto di GNOME dal bordo inferiore'));
        bottom.add(this._switchRow('app-flip', 'Cambio app a scorrimento', 'Verso destra l\'app precedente, verso sinistra quella usata meno di recente'));
        bottom.add(this._switchRow('home-pill', 'Barretta Home', 'Il segno al centro del bordo inferiore; toccarla apre lo Shelf'));
        bottom.add(this._sliderRow('home-zone', 'Altezza della fascia', 'Quanto in alto parte il gesto dal bordo inferiore', 16, 56, 2, v => `${v} px`));
        page.add(bottom);

        const top = new Adw.PreferencesGroup({
            title: 'Bordo superiore',
            description: 'Tirando giù dalla metà destra le impostazioni rapide, dalla sinistra notifiche e calendario. ' +
                'Con questo gesto acceso, toccare la barra non sposta più la finestra massimizzata.',
        });
        top.add(this._switchRow('top-gesture', 'Menu dal bordo superiore', null));
        top.add(this._sliderRow('top-zone', 'Altezza della fascia', 'Quanto in basso parte il gesto dal bordo superiore', 12, 48, 2, v => `${v} px`));
        page.add(top);

        const wins = new Adw.PreferencesGroup({title: 'Finestre'});
        wins.add(this._switchRow('auto-maximize', 'Modalità tablet',
            'Le finestre nuove si aprono a schermo intero. Dialoghi, finestre piccole e a misura fissa restano come sono.'));
        page.add(wins);
        return page;
    }

    _shelfPage() {
        const page = new Adw.PreferencesPage({title: 'Shelf', icon_name: 'view-app-grid-symbolic'});

        const shelf = new Adw.PreferencesGroup({
            title: 'Shelf',
            description: 'Il dock che si tocca: le app preferite e quelle aperte, a un tocco dalla barretta Home. ' +
                'Si trascina per riordinare e si tiene premuto su un\'icona per il suo menu.',
        });
        shelf.add(this._switchRow('shelf', 'Shelf', 'Spento: nessun dock oltre a quello della panoramica'));
        shelf.add(this._switchRow('shelf-on-desktop', 'Aperto sul desktop vuoto', 'Finché non c\'è nessuna finestra lo Shelf resta lì, come una schermata home'));
        shelf.add(this._switchRow('shelf-keyboard-button', 'Tasto della tastiera', 'Mostra o nasconde la tastiera su schermo, per le app che non la chiamano da sole'));
        shelf.add(this._sliderRow('shelf-timeout', 'Chiusura automatica', 'Secondi senza toccarlo prima che si ritiri (0 = mai)', 0, 30, 1, v => v ? `${v} s` : 'mai'));
        page.add(shelf);

        const motion = new Adw.PreferencesGroup({title: 'Movimento'});
        motion.add(this._switchRow('motion', 'Animazioni di Touch OS', 'Shelf, barretta e cambio app. Spento: tutto appare e scompare di colpo'));
        motion.add(this._sliderRow('motion-speed', 'Velocità', '100% = normale, 200% = il doppio più veloci', 25, 250, 5, v => `${v}%`));
        page.add(motion);
        return page;
    }

    _advancedPage() {
        const page = new Adw.PreferencesPage({title: 'Avanzate', icon_name: 'emblem-system-symbolic'});
        const g = new Adw.PreferencesGroup({title: 'Tema'});

        const nautilus = new Adw.ActionRow({title: 'Chiudi Nautilus', subtitle: 'Le app GNOME leggono il tema solo all\'avvio; Nautilus resta in memoria'});
        const nb = new Gtk.Button({label: 'Chiudi', valign: Gtk.Align.CENTER});
        nb.connect('clicked', () => {
            GLib.spawn_command_line_async('nautilus -q');
            this._window.add_toast(new Adw.Toast({title: 'Nautilus chiuso: riaprilo per vedere il tema.', timeout: 3}));
        });
        nautilus.add_suffix(nb);
        g.add(nautilus);

        const regen = new Adw.ActionRow({title: 'Rigenera il tema', subtitle: 'Riscrive i CSS dai modelli e ricarica la Shell'});
        const rb = new Gtk.Button({label: 'Rigenera', valign: Gtk.Align.CENTER});
        rb.connect('clicked', () => {
            this._renderNow(false);
            this._settings.set_int('theme-serial', this._settings.get_int('theme-serial') + 1);
            this._window.add_toast(new Adw.Toast({title: 'Tema rigenerato.', timeout: 3}));
        });
        regen.add_suffix(rb);
        g.add(regen);

        const folder = new Adw.ActionRow({title: 'Cartella del tema', subtitle: this._themeDir.replace(GLib.get_home_dir(), '~'), activatable: true});
        folder.connect('activated', () =>
            Gio.AppInfo.launch_default_for_uri_async(`file://${this._themeDir}`, null, null, null));
        g.add(folder);
        page.add(g);

        const reset = new Adw.PreferencesGroup({title: 'Valori predefiniti'});
        const rr = new Adw.ActionRow({title: 'Ripristina i valori di Touch OS', subtitle: 'Colore, forma, gesti e Shelf tornano come all\'installazione'});
        const rbtn = new Gtk.Button({label: 'Ripristina', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
        rbtn.connect('clicked', () => {
            for (const key of this._settings.list_keys())
                if (key !== 'theme-serial')
                    this._settings.reset(key);
            this._window.add_toast(new Adw.Toast({title: 'Valori predefiniti ripristinati.', timeout: 3}));
        });
        rr.add_suffix(rbtn);
        reset.add(rr);
        page.add(reset);
        return page;
    }
}

// Generatore del tema: trasforma i modelli (*.css.in) in CSS veri, secondo palette e impostazioni.
//
// Usato da tre parti: l'installer (tools/render-theme.js), il pannello impostazioni (prefs.js)
// e il banco di prova. Non importa nulla della Shell, quindi gira in qualunque processo gjs.
//
// Sintassi dei modelli (i marcatori stanno dentro commenti o valori, così un modello resta leggibile):
//   {{bg}} {{accent}} {{fg2}}   colore della palette, nello schema del file che si sta generando
//   {{accent/18}}               stesso colore con alpha 0.18 → rgba(…)
//   {{D:surface}} {{L:surface}} colore di uno schema preciso (serve nel CSS GTK4, che ha tutti e due)
//   {{mix:bg,fg,30}}            mescola due colori (30% del secondo)
//   {{ansi0}} … {{ansi15}}      i 16 colori ANSI (terminali, editor); anche {{D:ansi3}}
//   {{scheme_name}}             dark o light (anche {{scheme_title}}: Dark, Light; {{scheme_id}}: touch / touch-dark)
//   {{radius}} {{r}} {{r-4}}    raggio finestre / controlli, con un'operazione opzionale ({{r*0.6}}…)
//   {{frame}}                   spessore dell'anello di fuoco da tastiera (px)
//   {{px:48}}                   misura «da pollice»: scala con la voce touch-scale (48 → 48 a 100%, 58 a 120%)
//   {{ms:160}}                  durata di una transizione (0ms se le animazioni sono spente)
//   {{shadow:md}}               ombra morbida a tre livelli (sm, md, lg); «none» se le ombre sono spente
//   {{pill}}                    raggio «a pillola» (999)
//   /*{{#shadows}}*/ … /*{{/shadows}}*/   blocco incluso solo se la voce booleana "shadows" è attiva
//   /*{{^shadows}}*/ … /*{{/shadows}}*/   blocco incluso solo se è spenta

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {ACCENT_NAMES, ANSI, palette, rgba, mix} from './palette.js';

const SCHEMA_ID = 'org.gnome.shell.extensions.touch-shell';

/** Valori predefiniti (devono coincidere con lo schema). */
export const DEFAULTS = {
    'accent': 'iris',
    'corner-radius': 20,
    'control-radius': 14,
    'frame-width': 2,
    'touch-scale': 100,
    'shadows': true,
    'theme-animations': true,
};

export const THEME_KEYS = Object.keys(DEFAULTS);

/** Modelli e file generati, relativi alla cartella del tema: [modello, destinazione, schema]. */
export const FILES = [
    ['templates/gtk-4.0/touch.css.in', 'gtk-4.0/touch.css', 'dark'],
    ['templates/gtk-3.0/touch-common.css.in', 'gtk-3.0/touch-common.css', 'dark'],
    ['templates/gtk-3.0/touch-scheme.css.in', 'gtk-3.0/touch-light.css', 'light'],
    ['templates/gtk-3.0/touch-scheme.css.in', 'gtk-3.0/touch-dark.css', 'dark'],
    // la Shell 50 ha un CSS di default chiaro e uno scuro e sceglie dallo schema di sistema: stesso per noi
    ['templates/gnome-shell/gnome-shell.css.in', 'gnome-shell/gnome-shell-dark.css', 'dark'],
    ['templates/gnome-shell/gnome-shell.css.in', 'gnome-shell/gnome-shell-light.css', 'light'],
    // extra: schemi per editor e terminali (l'installer li copia dove servono)
    ['templates/extras/gtksourceview.xml.in', 'extras/gtksourceview/touch-dark.xml', 'dark'],
    ['templates/extras/gtksourceview.xml.in', 'extras/gtksourceview/touch.xml', 'light'],
    ['templates/extras/alacritty.toml.in', 'extras/terminals/alacritty.toml', 'dark'],
    ['templates/extras/kitty.conf.in', 'extras/terminals/kitty.conf', 'dark'],
    ['templates/extras/foot.ini.in', 'extras/terminals/foot.ini', 'dark'],
    ['templates/extras/ghostty.in', 'extras/terminals/ghostty', 'dark'],
    ['templates/extras/ptyxis.palette.in', 'extras/terminals/Touch.palette', 'dark'],
];

// ── Impostazioni ─────────────────────────────────────────────────────────────

/** Apre le impostazioni dell'estensione da una cartella con gli schemi compilati (null se non ci sono). */
export function openSettings(extensionDir) {
    try {
        const source = Gio.SettingsSchemaSource.new_from_directory(
            GLib.build_filenamev([extensionDir, 'schemas']), Gio.SettingsSchemaSource.get_default(), false);
        const schema = source.lookup(SCHEMA_ID, false);
        return schema ? new Gio.Settings({settings_schema: schema}) : null;
    } catch (e) {
        return null;
    }
}

/** Legge la configurazione del tema (dai Gio.Settings se ci sono, altrimenti i predefiniti). */
export function readConfig(settings = null) {
    const cfg = {...DEFAULTS};
    if (!settings)
        return cfg;
    for (const key of THEME_KEYS) {
        switch (typeof DEFAULTS[key]) {
        case 'boolean': cfg[key] = settings.get_boolean(key); break;
        case 'number': cfg[key] = settings.get_int(key); break;
        default: cfg[key] = settings.get_string(key);
        }
    }
    if (!ACCENT_NAMES.includes(cfg.accent))
        cfg.accent = DEFAULTS.accent;
    return cfg;
}

/** Nome del colore d'accento di GNOME corrispondente al nostro (per le app che leggono quello di sistema). */
export const SYSTEM_ACCENT = {iris: 'purple', sky: 'blue', mint: 'teal', coral: 'orange', amber: 'yellow', rose: 'pink'};

// ── Motore dei modelli ───────────────────────────────────────────────────────

const num = v => String(Number(v.toFixed(3)));

function variables(cfg) {
    return {
        radius: cfg['corner-radius'],
        r: cfg['control-radius'],
        frame: cfg['frame-width'],
        scale: cfg['touch-scale'] / 100,
        animations: cfg['theme-animations'],
        accent: cfg['accent'],
        bools: {shadows: cfg['shadows'], animations: cfg['theme-animations']},
    };
}

function evaluate(expr, v, scheme) {
    let m;

    if ((m = expr.match(/^(?:([DL]):)?ansi(\d+)$/)))
        return ANSI[m[1] ? (m[1] === 'L' ? 'light' : 'dark') : scheme][parseInt(m[2], 10)];

    if (expr === 'scheme_name')
        return scheme;
    if (expr === 'scheme_id')
        return scheme === 'light' ? 'touch' : 'touch-dark';
    if (expr === 'scheme_title')
        return scheme === 'light' ? 'Light' : 'Dark';

    if ((m = expr.match(/^ms:([\d.]+)$/)))
        return v.animations ? `${Math.round(parseFloat(m[1]))}ms` : '0ms';

    if ((m = expr.match(/^px:([\d.]+)$/))) {
        const x = parseFloat(m[1]);
        return String(Math.round(x * v.scale));
    }

    if (expr === 'pill')
        return '999';

    // Elevazione: tre livelli di ombra morbida (piccola: tessere; media: menu e Shelf; grande: dialoghi, tastiera).
    // Nello schema chiaro le ombre sono più tenui e tirano al blu; con le ombre spente diventano `none`.
    if ((m = expr.match(/^shadow:(sm|md|lg)$/))) {
        if (!v.bools.shadows)
            return 'none';
        const [dy, blur, alpha] = {sm: [2, 8, 0.32], md: [8, 24, 0.40], lg: [18, 48, 0.50]}[m[1]];
        const shade = palette(scheme, v.accent).shade;
        return `0 ${dy}px ${blur}px ${rgba(shade, scheme === 'light' ? alpha * 0.5 : alpha)}`;
    }

    if ((m = expr.match(/^mix:(?:([DL]):)?(\w+),(?:([DL]):)?(\w+),([\d.]+)$/))) {
        const a = palette(m[1] ? (m[1] === 'L' ? 'light' : 'dark') : scheme, v.accent)[m[2]];
        const b = palette(m[3] ? (m[3] === 'L' ? 'light' : 'dark') : scheme, v.accent)[m[4]];
        if (!a || !b)
            throw new Error(`colore sconosciuto nel modello: {{${expr}}}`);
        return mix(a, b, parseFloat(m[5]) / 100);
    }

    if ((m = expr.match(/^(radius|r|frame)\s*(?:([+\-*])\s*([\d.]+))?$/))) {
        let value = v[m[1]];
        if (m[2]) {
            const n = parseFloat(m[3]);
            value = m[2] === '+' ? value + n : m[2] === '-' ? value - n : value * n;
        }
        return String(Math.max(0, Math.round(value)));
    }

    if ((m = expr.match(/^(?:([DL]):)?(\w+)(?:\/([\d.]+))?$/))) {
        const color = palette(m[1] ? (m[1] === 'L' ? 'light' : 'dark') : scheme, v.accent)[m[2]];
        if (color) {
            if (m[3] === undefined)
                return color;
            return rgba(color, parseFloat(m[3]) / 100);
        }
    }

    throw new Error(`espressione sconosciuta nel modello: {{${expr}}}`);
}

export function render(template, cfg, scheme = 'dark') {
    const v = variables(cfg);

    // blocchi condizionali
    let out = template.replace(/\/\*\{\{([#^])(\w+)\}\}\*\/([\s\S]*?)\/\*\{\{\/\2\}\}\*\//g, (_m, kind, name, body) => {
        const on = Boolean(v.bools[name]);
        return (kind === '#') === on ? body : '';
    });

    out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => evaluate(expr, v, scheme));
    return out;
}

function writeIfChanged(path, text) {
    const file = Gio.File.new_for_path(path);
    try {
        const [ok, bytes] = file.load_contents(null);
        if (ok && new TextDecoder().decode(bytes) === text)
            return false;
    } catch (e) {
        // non esiste ancora
    }
    GLib.mkdir_with_parents(file.get_parent().get_path(), 0o755);
    file.replace_contents(new TextEncoder().encode(text), null, false, Gio.FileCreateFlags.NONE, null);
    return true;
}

/**
 * Rigenera tutti i file del tema in `outDir`.
 * @param {string} themeDir  cartella del tema (contiene templates/)
 * @param {object} cfg       configurazione (vedi readConfig)
 * @param {string} outDir    dove scrivere (predefinito: la stessa cartella dei modelli)
 * @returns {string[]} file effettivamente modificati
 */
export function renderTheme(themeDir, cfg, outDir = themeDir) {
    const changed = [];
    for (const [tpl, dest, scheme] of FILES) {
        const [ok, bytes] = Gio.File.new_for_path(GLib.build_filenamev([themeDir, tpl])).load_contents(null);
        if (!ok)
            throw new Error(`modello mancante: ${tpl}`);
        const text = render(new TextDecoder().decode(bytes), cfg, scheme);
        if (writeIfChanged(GLib.build_filenamev([outDir, dest]), text))
            changed.push(dest);
    }
    return changed;
}

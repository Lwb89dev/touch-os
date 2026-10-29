// Carica il CSS della Shell generato dal tema (~/.local/share/themes/Touch/gnome-shell/gnome-shell-<variante>.css)
// sopra quello di default, e lo ricarica quando il pannello impostazioni lo rigenera o cambia lo schema chiaro/scuro.
//
// Si fa qui, e non con l'estensione User Themes, per due motivi: un'estensione in meno da scaricare,
// e il tema della Shell vive e muore con l'estensione che ne usa le classi (barretta, Shelf).
//
// La Shell 50 ha due CSS di default (chiaro e scuro) e sceglie da sola secondo lo schema di sistema; noi
// carichiamo la variante corrispondente. Con l'alto contrasso acceso la Shell usa il suo CSS dedicato e
// noi ci facciamo da parte.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function shellStylesheetPath(variant) {
    return GLib.build_filenamev([GLib.get_user_data_dir(), 'themes', 'Touch', 'gnome-shell', `gnome-shell-${variant}.css`]);
}

export class ThemeLoader {
    constructor(settings) {
        this._settings = settings;
        this._file = null;
        this._load();
        // Il pannello impostazioni rigenera i CSS e cambia questo contatore: qui si ricarica.
        this._settings.connectObject('changed::theme-serial', () => this._reload(), this);
        // Quando lo schema cambia la Shell ricarica il suo CSS di default (portandosi dietro il nostro, ormai sbagliato):
        // il suo gestore è collegato prima del nostro, quindi qui il tema nuovo c'è già.
        const st = St.Settings.get();
        st.connectObject(
            'notify::color-scheme', () => this._reload(),
            'notify::high-contrast', () => this._reload(),
            this);
    }

    _theme() {
        return St.ThemeContext.get_for_stage(global.stage).get_theme();
    }

    _variant() {
        return Main.getStyleVariant() || 'dark';
    }

    _load() {
        if (St.Settings.get().high_contrast)
            return;
        const file = Gio.File.new_for_path(shellStylesheetPath(this._variant()));
        if (!file.query_exists(null)) {
            console.warn(`Touch OS: manca ${file.get_path()} (esegui install.sh o tools/render-theme.js)`);
            return;
        }
        try {
            this._theme().load_stylesheet(file);
            this._file = file;
        } catch (e) {
            console.error(`Touch OS: CSS della Shell non valido: ${e.message}`);
        }
    }

    _unload() {
        // Può esserci una sola variante caricata, ma dopo un cambio di schema la Shell ha ricreato il tema con la
        // vecchia ancora dentro: si scaricano entrambe, con tolleranza (scaricare ciò che non c'è non è un errore).
        for (const variant of ['dark', 'light']) {
            try {
                this._theme().unload_stylesheet(Gio.File.new_for_path(shellStylesheetPath(variant)));
            } catch (e) {
                // già scaricato
            }
        }
        this._file = null;
    }

    _reload() {
        this._unload();
        this._load();
    }

    destroy() {
        this._settings.disconnectObject(this);
        St.Settings.get().disconnectObject(this);
        this._unload();
    }
}

// Modalità tablet: le finestre nuove nascono massimizzate.
//
// Su uno schermo che si tocca una finestra a metà schermo è soprattutto un bersaglio più difficile da colpire
// (e un bordo da ridimensionare con un dito). Qui ogni finestra normale nasce a tutto schermo; la si affianca a
// un'altra col trascinamento sul bordo, come sempre (GNOME ha il suo tiling).
//
// Non si toccano: dialoghi, finestre figlie di un'altra, finestre che non si possono massimizzare (calcolatrici,
// finestre a misura fissa), e quelle che l'app apre già a schermo intero.

import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

export class Tablet {
    constructor(ext) {
        this._settings = ext.settings;
        this._idle = new Map();
        this._sync();
        this._settings.connectObject('changed::auto-maximize', () => this._sync(), this);
    }

    _sync() {
        if (this._settings.get_boolean('auto-maximize'))
            global.display.connectObject('window-created', (_d, win) => this._onCreated(win), this);
        else
            global.display.disconnectObject(this);
    }

    _eligible(win) {
        return win.get_window_type() === Meta.WindowType.NORMAL &&
            !win.is_override_redirect() &&
            !win.get_transient_for() &&
            !win.is_attached_dialog() &&
            win.can_maximize() &&
            !win.is_maximized() &&
            !win.is_fullscreen();
    }

    _onCreated(win) {
        // alla creazione le proprietà dell'app (tipo, figlia di, misura fissa) non sono ancora tutte arrivate:
        // si guarda un istante dopo, prima del primo disegno
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._idle.delete(win);
            try {
                if (this._eligible(win))
                    win.maximize();
            } catch (e) {
                // la finestra è sparita nel frattempo
            }
            return GLib.SOURCE_REMOVE;
        });
        this._idle.set(win, id);
    }

    destroy() {
        this._settings.disconnectObject(this);
        global.display.disconnectObject(this);
        for (const id of this._idle.values())
            GLib.source_remove(id);
        this._idle.clear();
    }
}

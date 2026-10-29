// Lo Shelf: il dock che si tocca. Una mensola a scomparsa con le app preferite e quelle in esecuzione, e un'isola
// con le azioni che su uno schermo senza tastiera servono sempre (la tastiera su schermo).
//
// Dentro c'è il Dash vero di GNOME (ui/dash.js), non una copia: il riordino per trascinamento, il menu dell'app con
// la pressione lunga, i punti delle app aperte e la griglia delle app funzionano come nella panoramica. Qui si
// decide solo quando mostrarlo:
//
//   un tocco sulla barretta    lo apre o lo chiude
//   desktop vuoto              resta aperto (è la «schermata home» finché non c'è una finestra)
//   un tocco fuori, una app che si avvia o prende il fuoco, la panoramica, la tastiera, qualche secondo di
//   inattività             lo richiudono
//
// Entra dal basso con una salita morbida e una dissolvenza (senza rimbalzi): è un ospite, non una finestra.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';

import {keyboardVisible, ms} from './util.js';

const BOTTOM_GAP = 26;          // tra il bordo dello schermo e lo Shelf (sopra la barretta)
const SLIDE = 36;               // quanto sale entrando
const MAX_DASH_HEIGHT = 140;

export class Shelf {
    constructor(ext) {
        this._ext = ext;
        this._settings = ext.settings;
        this._visible = false;
        this._persistent = false;
        this._timer = 0;
        this._pillHit = null;
        this._tracked = [];
        this._wid = {};

        this._actor = new St.BoxLayout({
            name: 'touch-shelf',
            style_class: 'touch-shelf',
            reactive: true,
            visible: false,
            opacity: 0,
        });

        this._dash = new Dash.Dash();
        this._dash.showAppsButton.connectObject('notify::checked', () => {
            if (!this._dash.showAppsButton.checked)
                return;
            this._dash.showAppsButton.checked = false;
            this.hide();
            Main.overview.showApps();
        }, this);
        this._actor.add_child(this._dash);

        this._actions = new St.BoxLayout({style_class: 'touch-shelf-actions', y_align: Clutter.ActorAlign.CENTER});
        this._keyboard = new St.Button({
            style_class: 'touch-shelf-button',
            accessible_name: 'Tastiera',
            can_focus: false,
            y_align: Clutter.ActorAlign.CENTER,
            child: new St.Icon({icon_name: 'input-keyboard-symbolic'}),
        });
        this._keyboard.connect('clicked', () => this._toggleKeyboard());
        this._actions.add_child(this._keyboard);
        this._actor.add_child(this._actions);

        Main.layoutManager.addChrome(this._actor, {affectsStruts: false, trackFullscreen: true});

        this._actor.connectObject(
            'notify::width', () => this._place(),
            'notify::height', () => this._place(),
            'captured-event', () => this._touched(),
            this._actor);
        Main.layoutManager.connectObject('monitors-changed', () => this._relayout(), this._actor);
        Main.overview.connectObject(
            'showing', () => this.hide(true),
            'hidden', () => this._syncDesktop(),
            this._actor);
        global.display.connectObject('notify::focus-window', () => this._onFocus(), this._actor);
        global.workspace_manager.connectObject('active-workspace-changed', () => this._watchWorkspace(), this._actor);
        Main.keyboard?.connectObject('visibility-changed', () => {
            if (keyboardVisible())
                this.hide(true);
            else
                this._syncDesktop();
        }, this._actor);
        this._settings.connectObject(
            'changed::shelf', () => this._syncEnabled(),
            'changed::shelf-on-desktop', () => this._syncDesktop(),
            'changed::shelf-keyboard-button', () => this._syncActions(),
            'changed::shelf-timeout', () => { if (this._visible) this._armTimer(); },
            this._actor);

        // un tocco fuori dallo Shelf lo chiude, ma passa comunque all'app sotto (lo si ascolta, non lo si ferma)
        global.stage.connectObject('captured-event', (_s, event) => this._onStageEvent(event), this._actor);

        this._syncActions();
        this._relayout();
        this._watchWorkspace();
        this._syncDesktop();
    }

    /** La barretta Home: toccarla non deve contare come «tocco fuori». */
    setPillActor(actor) {
        this._pillHit = actor;
    }

    get visible() {
        return this._visible;
    }

    // ── Misure e posizione ───────────────────────────────────────────────────

    _relayout() {
        const mon = Main.layoutManager.primaryMonitor;
        if (!mon)
            return;
        const actions = this._actions.visible ? 110 : 0;
        this._dash.setMaxSize(Math.round(mon.width * 0.9) - actions, MAX_DASH_HEIGHT);
        this._place();
    }

    _place() {
        const mon = Main.layoutManager.primaryMonitor;
        if (!mon)
            return;
        const [w, h] = this._actor.get_size();
        this._actor.set_position(Math.round(mon.x + (mon.width - w) / 2), mon.y + mon.height - h - BOTTOM_GAP);
    }

    _syncActions() {
        this._actions.visible = this._settings.get_boolean('shelf-keyboard-button');
        this._relayout();
    }

    // ── Mostrare e nascondere ────────────────────────────────────────────────

    _enabled() {
        return this._settings.get_boolean('shelf') && !Main.overview.visible && !keyboardVisible() && !Main.sessionMode.isLocked;
    }

    show({persistent = false} = {}) {
        if (!this._enabled())
            return;
        if (persistent)
            this._persistent = true;
        if (this._visible) {
            this._armTimer();
            return;
        }
        this._visible = true;
        this._actor.show();
        this._relayout();
        this._actor.remove_all_transitions();
        this._actor.translation_y = SLIDE;
        this._actor.opacity = 0;
        this._actor.ease({
            translation_y: 0,
            opacity: 255,
            duration: ms(this._settings, 300),
            mode: Clutter.AnimationMode.EASE_OUT_QUART,
        });
        this._armTimer();
    }

    /** `force` chiude anche lo Shelf del desktop vuoto (la panoramica o la tastiera gli prendono il posto). */
    hide(force = false) {
        if (!this._visible)
            return;
        if (this._persistent && !force)
            return;
        this._visible = false;
        this._disarmTimer();
        this._actor.remove_all_transitions();
        this._actor.ease({
            translation_y: SLIDE * 0.6,
            opacity: 0,
            duration: ms(this._settings, 200),
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (!this._visible)
                    this._actor.hide();
            },
        });
    }

    toggle() {
        if (this._visible && !this._persistent)
            this.hide();
        else if (!this._visible)
            this.show();
    }

    _syncEnabled() {
        if (!this._settings.get_boolean('shelf')) {
            this._persistent = false;
            this.hide(true);
        } else {
            this._syncDesktop();
        }
    }

    // ── Desktop vuoto: lo Shelf resta aperto ─────────────────────────────────

    _watchWorkspace() {
        for (const [ws, id] of this._tracked)
            ws.disconnect(id);
        this._tracked = [];
        const ws = global.workspace_manager.get_active_workspace();
        const sync = () => this._syncDesktop();
        this._tracked.push([ws, ws.connect('window-added', sync)], [ws, ws.connect('window-removed', sync)]);
        this._syncDesktop();
    }

    _desktopIsEmpty() {
        const ws = global.workspace_manager.get_active_workspace();
        return !ws.list_windows().some(w => !w.skip_taskbar && !w.minimized && !w.is_override_redirect());
    }

    _syncDesktop() {
        const want = this._settings.get_boolean('shelf-on-desktop') && this._desktopIsEmpty() && this._enabled();
        if (want) {
            this.show({persistent: true});
        } else if (this._persistent) {
            this._persistent = false;
            this.hide();
        }
    }

    // ── Chiusura automatica ──────────────────────────────────────────────────

    _armTimer() {
        this._disarmTimer();
        const seconds = this._settings.get_int('shelf-timeout');
        if (!seconds || this._persistent)
            return;
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._timer = 0;
            // con un menu aperto (Main.modalCount) lo Shelf aspetta: il menu è suo
            if (Main.modalCount > 0)
                this._armTimer();
            else
                this.hide();
            return GLib.SOURCE_REMOVE;
        });
    }

    _disarmTimer() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
    }

    /** Un dito sullo Shelf: l'inattività riparte da zero. */
    _touched() {
        if (this._visible)
            this._armTimer();
        return Clutter.EVENT_PROPAGATE;
    }

    _onStageEvent(event) {
        if (!this._visible || this._persistent || Main.modalCount > 0)
            return Clutter.EVENT_PROPAGATE;
        const type = event.type();
        if (type !== Clutter.EventType.TOUCH_BEGIN && type !== Clutter.EventType.BUTTON_PRESS)
            return Clutter.EVENT_PROPAGATE;
        // «dentro» si decide con le coordinate: la sorgente di un evento di tocco non è un'indicazione affidabile
        const [x, y] = event.get_coords();
        const inside = actor => {
            if (!actor?.visible)
                return false;
            const [ax, ay] = actor.get_transformed_position();
            const [aw, ah] = actor.get_transformed_size();
            return x >= ax && x < ax + aw && y >= ay && y < ay + ah;
        };
        if (inside(this._actor) || inside(this._pillHit))
            return Clutter.EVENT_PROPAGATE;
        this.hide();
        return Clutter.EVENT_PROPAGATE;
    }

    _onFocus() {
        // una app che si avvia o viene riportata davanti: lo Shelf ha fatto il suo lavoro
        if (this._visible && !this._persistent && global.display.focus_window)
            this.hide();
    }

    // ── Azioni ───────────────────────────────────────────────────────────────

    _toggleKeyboard() {
        this.hide(true);
        if (keyboardVisible())
            Main.keyboard.close();
        else
            Main.keyboard?.open(Main.layoutManager.bottomIndex);
    }

    destroy() {
        this._disarmTimer();
        for (const [ws, id] of this._tracked)
            ws.disconnect(id);
        this._tracked = [];
        this._settings.disconnectObject(this._actor);
        global.stage.disconnectObject(this._actor);
        global.display.disconnectObject(this._actor);
        global.workspace_manager.disconnectObject(this._actor);
        Main.overview.disconnectObject(this._actor);
        Main.layoutManager.disconnectObject(this._actor);
        Main.keyboard?.disconnectObject(this._actor);
        this._dash.showAppsButton.disconnectObject(this);
        Main.layoutManager.removeChrome(this._actor);
        this._actor.destroy();
    }
}

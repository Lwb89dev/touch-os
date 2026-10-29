// Home: i gesti dal bordo inferiore e la barretta che li annuncia.
//
//   dal bordo, verso l'alto    la panoramica di GNOME (le finestre) che segue il dito: è la panoramica vera, guidata
//                              dallo stesso SwipeTracker, quindi stessa inerzia e stesse soglie; una seconda tirata,
//                              già dentro, arriva alla griglia delle app
//   dal bordo, di lato         passa all'app precedente (verso destra) o a quella usata meno di recente (verso
//                              sinistra); l'app attuale segue il dito e una scheda dice dove si va
//   un tocco sulla barretta    apre o chiude lo Shelf
//
// La fascia che risponde ai gesti è alta pochi pixel (impostazione «home-zone») lungo tutto il bordo, non solo
// attorno alla barretta: la barretta serve a far capire dove, il dito non deve mirarla. Un tocco che comincia lì
// e non si muove arriva comunque all'app sotto.
//
// Il bordo inferiore, in GNOME 50, è già della tastiera su schermo (tirando su la fa comparire). Qui lo si
// reclama: la tastiera compare da sola quando si tocca un campo di testo, e c'è un tasto nello Shelf.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SwipeTracker from 'resource:///org/gnome/shell/ui/swipeTracker.js';

import {inBottomZone, keyboardVisible, ms} from './util.js';

const PILL_W = 136;
const PILL_H = 5;
const PILL_GAP = 8;             // dal bordo dello schermo
const HIT_W = 220;
const HIT_H = 30;
const FLIP_BEGIN_PX = 22;       // movimento orizzontale prima che il gesto cominci
const FLIP_COMMIT = 0.16;       // frazione di larghezza dello schermo oltre la quale si cambia app
const FLIP_VELOCITY = 0.45;     // px/ms: uno scatto veloce basta anche se corto

export class Home {
    /**
     * @param {Extension} ext
     * @param {Shelf|null} shelf  lo Shelf si apre con un tocco sulla barretta
     */
    constructor(ext, shelf) {
        this._ext = ext;
        this._settings = ext.settings;
        this._shelf = shelf;
        this._tracker = null;
        this._flipGesture = null;
        this._flip = null;
        this._chip = null;
        this._pillSync = 0;

        this._buildPill();
        this._syncGestures();
        this._claimKeyboardEdge();

        this._settings.connectObject(
            'changed::home-gesture', () => this._syncGestures(),
            'changed::app-flip', () => this._syncGestures(),
            'changed::home-pill', () => this._syncPill(),
            this);
        Main.overview.connectObject(
            'showing', () => this._syncPill(),
            'hidden', () => this._syncPill(),
            this);
        Main.layoutManager.connectObject('monitors-changed', () => this._place(), this);
        Main.keyboard?.connectObject('visibility-changed', () => this._syncPill(), this);
    }

    // ── La barretta ──────────────────────────────────────────────────────────

    _buildPill() {
        this._hit = new St.Widget({
            name: 'touch-pill-hit',
            reactive: true,
            width: HIT_W,
            height: HIT_H,
            layout_manager: new Clutter.BinLayout(),
        });
        this._pill = new St.Widget({
            style_class: 'touch-pill',
            width: PILL_W,
            height: PILL_H,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            y_expand: true,
            x_expand: true,
            margin_bottom: PILL_GAP,
        });
        this._hit.add_child(this._pill);
        Main.layoutManager.addChrome(this._hit, {affectsStruts: false, trackFullscreen: true});

        const tap = new Clutter.ClickGesture();
        tap.connect('recognize', () => this._shelf?.toggle());
        this._hit.add_action(tap);
        this._tap = tap;

        this._place();
        this._syncPill();
    }

    _place() {
        const mon = Main.layoutManager.primaryMonitor;
        if (!mon)
            return;
        this._hit.set_position(Math.round(mon.x + (mon.width - HIT_W) / 2), mon.y + mon.height - HIT_H);
    }

    _syncPill() {
        const show = this._settings.get_boolean('home-pill') && !keyboardVisible();
        this._hit.reactive = show;
        this._pill.remove_all_transitions();
        this._pill.ease({
            opacity: show ? 255 : 0,
            duration: ms(this._settings, 160),
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    // ── Gesti ────────────────────────────────────────────────────────────────

    _syncGestures() {
        const home = this._settings.get_boolean('home-gesture');
        const flip = home && this._settings.get_boolean('app-flip');

        if (home && !this._tracker)
            this._buildTracker();
        else if (!home && this._tracker)
            this._destroyTracker();

        if (flip && !this._flipGesture)
            this._buildFlip();
        else if (!flip && this._flipGesture)
            this._destroyFlip();
    }

    get _zone() {
        return this._settings.get_int('home-zone');
    }

    _gestureAllowed() {
        return !keyboardVisible() && !Main.sessionMode.isLocked;
    }

    /**
     * Tirare su dal bordo guida la panoramica. SwipeTracker è quello che la Shell usa per il gesto a tre dita, ma
     * con `allowDrag` ascolta un dito solo: lo si limita alla fascia del bordo inferiore (filtrando da dove parte
     * il tocco) e lo si collega ai gestori della panoramica, che sanno già passare da «nascosta» a finestre a app.
     */
    _buildTracker() {
        const tracker = new SwipeTracker.SwipeTracker(global.stage, Clutter.Orientation.VERTICAL,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            {allowDrag: true, allowScroll: false, name: 'Touch home swipe', phase: Clutter.EventPhase.CAPTURE});

        // Il touchpad (tre dita) resta alla panoramica di GNOME: qui conta solo il dito sullo schermo.
        if (tracker._touchpadGesture)
            tracker._touchpadGesture.enabled = false;
        tracker._panGesture.connect('should-handle-sequence',
            (_g, event) => this._gestureAllowed() && inBottomZone(event, this._zone));

        const overview = Main.overview;
        tracker.connect('begin', t => {
            this._pill.add_style_class_name('pressed');
            this._shelf?.hide();
            overview._gestureBegin(t);
        });
        tracker.connect('update', (t, progress) => overview._gestureUpdate(t, progress));
        tracker.connect('end', (t, duration, endProgress) => {
            this._pill.remove_style_class_name('pressed');
            overview._gestureEnd(t, duration, endProgress);
        });
        this._tracker = tracker;
    }

    _destroyTracker() {
        this._tracker?.destroy();
        this._tracker = null;
        this._pill.remove_style_class_name('pressed');
    }

    /** L'altro gesto che la tastiera si prende dal bordo inferiore: si spegne finché c'è Touch Shell. */
    _claimKeyboardEdge() {
        const gesture = Main.keyboard?._bottomDragGesture;
        if (!gesture)
            return;
        this._osk = gesture;
        const claim = () => {
            const want = !this._settings.get_boolean('home-gesture') && !keyboardVisible();
            if (gesture.enabled !== want)
                gesture.enabled = want;
        };
        gesture.connectObject('notify::enabled', claim, this);
        this._settings.connectObject('changed::home-gesture', claim, this);
        claim();
    }

    _releaseKeyboardEdge() {
        if (!this._osk)
            return;
        this._osk.disconnectObject(this);
        this._osk.enabled = !keyboardVisible();
        this._osk = null;
    }

    // ── Scorrere lungo il bordo: cambio app ──────────────────────────────────

    _buildFlip() {
        const gesture = new Clutter.PanGesture({
            min_n_points: 1,
            max_n_points: 1,
            pan_axis: Clutter.PanAxis.X,
            begin_threshold: FLIP_BEGIN_PX,
        });
        gesture.connect('should-handle-sequence',
            (_g, event) => this._gestureAllowed() && inBottomZone(event, this._zone));
        gesture.connect('may-recognize', () => Main.actionMode === Shell.ActionMode.NORMAL && !Main.overview.visible);
        gesture.connect('recognize', g => this._flipBegin(g));
        gesture.connect('pan-update', g => this._flipUpdate(g));
        gesture.connect('end', g => this._flipEnd(g));
        gesture.connect('cancel', () => this._flipCancel());
        global.stage.add_action_full('touch-app-flip', Clutter.EventPhase.CAPTURE, gesture);
        this._flipGesture = gesture;
    }

    _destroyFlip() {
        this._flipCancel();
        if (this._flipGesture) {
            global.stage.remove_action(this._flipGesture);
            this._flipGesture = null;
        }
    }

    /** Le finestre normali, dalla più recente: la prima è quella in primo piano. */
    _windows() {
        return global.display.get_tab_list(Meta.TabList.NORMAL, null)
            .filter(w => !w.skip_taskbar && !w.is_override_redirect());
    }

    _flipBegin(gesture) {
        const list = this._windows();
        const actor = list[0]?.get_compositor_private();
        if (list.length < 2 || !actor) {
            this._flip = null;
            return;
        }
        this._shelf?.hide();
        this._pill.add_style_class_name('pressed');
        actor.remove_all_transitions();
        this._flip = {list, current: list[0], actor, dir: 0, target: null, width: Main.layoutManager.primaryMonitor.width};
    }

    _flipUpdate(gesture) {
        const f = this._flip;
        if (!f)
            return;
        const dx = gesture.get_accumulated_delta_abs().get_x();
        const dir = Math.sign(dx);
        f.dx = dx;
        // l'app attuale segue il dito con un po' di resistenza e sbiadisce
        f.actor.translation_x = dx * 0.6;
        f.actor.opacity = Math.round(255 - Math.min(150, Math.abs(dx) / f.width * 420));

        if (dir !== f.dir) {
            f.dir = dir;
            f.target = dir > 0 ? f.list[1] : f.list[f.list.length - 1];
            this._showChip(f.target);
        }
    }

    _flipEnd(gesture) {
        const f = this._flip;
        if (!f)
            return;
        const v = gesture.get_velocity_abs().get_x();
        const far = Math.abs(f.dx) > f.width * FLIP_COMMIT;
        const flick = Math.abs(v) > FLIP_VELOCITY && Math.sign(v) === Math.sign(f.dx);
        if (f.target && (far || flick))
            this._flipCommit(f);
        else
            this._flipCancel();
    }

    _flipCancel() {
        const f = this._flip;
        this._flip = null;
        this._pill.remove_style_class_name('pressed');
        this._hideChip();
        if (!f)
            return;
        f.actor.ease({
            translation_x: 0,
            opacity: 255,
            duration: ms(this._settings, 180),
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        });
    }

    /** L'app attuale esce nella direzione del dito, quella nuova entra dall'altra parte. */
    _flipCommit(f) {
        this._flip = null;
        this._pill.remove_style_class_name('pressed');
        this._hideChip();
        const dir = f.dir;
        const out = ms(this._settings, 130);
        const restore = () => {
            f.actor.remove_all_transitions();
            f.actor.translation_x = 0;
            f.actor.opacity = 255;
        };

        f.actor.ease({
            translation_x: dir * f.width * 0.22,
            opacity: 0,
            duration: out,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                const incoming = f.target.get_compositor_private();
                if (incoming) {
                    incoming.remove_all_transitions();
                    incoming.translation_x = -dir * f.width * 0.08;
                    incoming.opacity = 0;
                }
                Main.activateWindow(f.target);
                if (!incoming) {
                    restore();
                    return;
                }
                // la vecchia finestra resta trasparente finché la nuova non è entrata: nessun lampo di mezzo
                incoming.ease({
                    translation_x: 0,
                    opacity: 255,
                    duration: ms(this._settings, 240),
                    mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
                    onComplete: restore,
                });
            },
        });
    }

    // ── La scheda «dove sto andando» ─────────────────────────────────────────

    _showChip(win) {
        this._hideChip(true);
        const app = Shell.WindowTracker.get_default().get_window_app(win);
        const box = new St.BoxLayout({style_class: 'touch-flip', reactive: false, opacity: 0});
        box.add_child(new St.Icon({gicon: app?.get_icon(), icon_size: 36, y_align: Clutter.ActorAlign.CENTER}));
        box.add_child(new St.Label({text: app?.get_name() ?? win.get_title() ?? '', y_align: Clutter.ActorAlign.CENTER}));
        Main.uiGroup.add_child(box);

        const mon = Main.layoutManager.primaryMonitor;
        const [w, h] = box.get_size();
        box.set_position(Math.round(mon.x + (mon.width - w) / 2), mon.y + mon.height - h - 72);
        box.translation_y = 12;
        box.ease({
            opacity: 255,
            translation_y: 0,
            duration: ms(this._settings, 160),
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        });
        this._chip = box;
    }

    _hideChip(immediate = false) {
        const chip = this._chip;
        this._chip = null;
        if (!chip)
            return;
        chip.remove_all_transitions();
        if (immediate) {
            chip.destroy();
            return;
        }
        chip.ease({
            opacity: 0,
            duration: ms(this._settings, 120),
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => chip.destroy(),
        });
    }

    destroy() {
        this._settings.disconnectObject(this);
        Main.overview.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        Main.keyboard?.disconnectObject(this);
        this._releaseKeyboardEdge();
        this._destroyFlip();
        this._destroyTracker();
        this._hideChip(true);
        this._hit.remove_action(this._tap);
        Main.layoutManager.removeChrome(this._hit);
        this._hit.destroy();
    }
}

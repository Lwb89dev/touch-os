// I gesti dal bordo superiore: tirando giù si aprono i due menu della barra.
//
//   dalla metà destra    le impostazioni rapide (rete, suono, luminosità, batteria, spegni)
//   dalla metà sinistra  notifiche e calendario
//
// Il gesto parte da una fascia di pochi pixel lungo il bordo e si riconosce solo dopo un breve trascinamento
// verso il basso: un tocco secco sulla barra continua ad azionare i suoi pulsanti. Il menu si apre con la sua
// animazione normale (non segue il dito) e si chiude toccando fuori, come sempre.
//
// La barra della Shell, di suo, tratta un tocco su di sé come l'inizio del trascinamento della finestra massimizzata
// (la sposta e la de-massimizza), e Mutter si prende il resto del gesto. Con un dito, tirare giù dall'alto deve aprire
// un menu, non strappare via la finestra: per i tocchi quel comportamento si spegne (col mouse resta com'è).

import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';

import {inTopZone, touchOrigin} from './util.js';

const BEGIN_PX = 18;

export class TopEdge {
    constructor(ext) {
        this._settings = ext.settings;
        this._gesture = null;
        this._panelDrag = null;
        this._settings.connectObject('changed::top-gesture', () => this._sync(), this);
        this._sync();
    }

    _sync() {
        const on = this._settings.get_boolean('top-gesture');
        if (on && !this._gesture) {
            this._build();
            this._claimPanel();
        } else if (!on && this._gesture) {
            this._release();
        }
    }

    _build() {
        const gesture = new Clutter.PanGesture({
            min_n_points: 1,
            max_n_points: 1,
            pan_axis: Clutter.PanAxis.Y,
            begin_threshold: BEGIN_PX,
        });
        gesture.connect('should-handle-sequence',
            (_g, event) => !Main.sessionMode.isLocked && inTopZone(event, this._settings.get_int('top-zone')));
        // con un menu già aperto, o nella panoramica, il tocco appartiene a quello; la panoramica ha la sua barra
        gesture.connect('may-recognize', () => Main.actionMode === Shell.ActionMode.NORMAL);
        gesture.connect('recognize', g => this._open(g));
        global.stage.add_action_full('touch-top-edge', Clutter.EventPhase.CAPTURE, gesture);
        this._gesture = gesture;
    }

    /** I tocchi sulla barra non iniziano più il trascinamento della finestra massimizzata. */
    _claimPanel() {
        const drag = Main.panel._clickGesture;
        if (!drag || this._panelDrag)
            return;
        this._panelDrag = [drag, drag.connect('should-handle-sequence', (_g, event) => !touchOrigin(event))];
    }

    _open(gesture) {
        // il gesto ha già deciso «giù»: se il dito sale non si fa nulla
        if (gesture.get_delta_abs().get_y() < 0)
            return;
        const x = gesture.get_begin_centroid().x;
        const mon = Main.layoutManager.monitors.find(m => x >= m.x && x < m.x + m.width) ?? Main.layoutManager.primaryMonitor;
        const right = x > mon.x + mon.width * 0.5;
        const item = Main.panel.statusArea[right ? 'quickSettings' : 'dateMenu'];
        // apre l'uno e, se c'era l'altro aperto, lo chiude
        const other = Main.panel.statusArea[right ? 'dateMenu' : 'quickSettings'];
        other?.menu.close(BoxPointer.PopupAnimation.NONE);
        item?.menu.open(BoxPointer.PopupAnimation.FULL);
    }

    _release() {
        if (this._panelDrag) {
            const [drag, id] = this._panelDrag;
            drag.disconnect(id);
            this._panelDrag = null;
        }
        if (this._gesture) {
            global.stage.remove_action(this._gesture);
            this._gesture = null;
        }
    }

    destroy() {
        this._settings.disconnectObject(this);
        this._release();
    }
}

// Piccoli attrezzi condivisi dai moduli dei gesti.

import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/** Durata di un'animazione in ms, scalata dalla velocità scelta; 0 con il movimento spento. */
export function ms(settings, base) {
    if (!settings.get_boolean('motion'))
        return 0;
    return Math.max(1, Math.round(base * 100 / settings.get_int('motion-speed')));
}

/**
 * Dove è iniziato questo tocco? Solo le dita su un touchscreen contano: il puntatore e il touchpad hanno i loro
 * gesti (angolo attivo, tre dita) e non devono scambiarsi con questi.
 * @returns {{x: number, y: number, monitor: object}|null}
 */
export function touchOrigin(event) {
    const device = event.get_source_device?.() ?? event.get_device();
    if (device?.get_device_type() !== Clutter.InputDeviceType.TOUCHSCREEN_DEVICE)
        return null;
    const [x, y] = event.get_coords();
    const monitor = Main.layoutManager.monitors.find(m =>
        x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height);
    return monitor ? {x, y, monitor} : null;
}

/** Il tocco è iniziato nella fascia di `size` px lungo il bordo inferiore di uno schermo? */
export function inBottomZone(event, size) {
    const o = touchOrigin(event);
    return !!o && o.y >= o.monitor.y + o.monitor.height - size;
}

/** … lungo il bordo superiore? */
export function inTopZone(event, size) {
    const o = touchOrigin(event);
    return !!o && o.y < o.monitor.y + size;
}

/** La tastiera su schermo è aperta? (copre il bordo inferiore: i gesti da lì non hanno senso) */
export function keyboardVisible() {
    return !!Main.keyboard?.visible;
}

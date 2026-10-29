// Due promesse del README: tirando oltre la panoramica si arriva alla griglia delle app, e la pressione lunga su
// un'icona dello Shelf apre il menu dell'app.
import Clutter from 'gi://Clutter';

export async function run(t) {
    const {Main} = t;
    const out = t.GLib.getenv('SHOT_OUT');
    const W = global.stage.width, H = global.stage.height;
    const ext = t.ext('touch-shell@touch-os');
    const log = s => console.log(`[steps] ${s}`);
    const controls = () => Main.overview._overview.controls;

    await t.sleep(2500);
    Main.overview.hide();
    await t.sleep(1200);
    t.spawn('gnome-text-editor --new-window');
    for (let i = 0; i < 60 && t.windows().length < 1; i++) await t.sleep(150);
    await t.sleep(2500);

    // 1. una salita lunga: stato 0 = nascosta, 1 = finestre, 2 = griglia delle app
    t.touch.down(0, W * 0.5, H - 8); await t.sleep(60);
    for (let k = 1; k <= 30; k++) { t.touch.move(0, W * 0.5, H - 8 - 30 * k); await t.sleep(14); }
    log(`a salita finita, dito ancora giù: stato=${controls()._stateAdjustment.value.toFixed(2)}`);
    t.touch.up(0);
    await t.sleep(1400);
    log(`dopo il rilascio: stato=${controls()._stateAdjustment.value.toFixed(2)} griglia=${controls().dash.showAppsButton.checked} (atteso 2 / true)`);
    // la seconda tirata, già dentro la panoramica: dalle finestre alla griglia
    t.touch.down(0, W * 0.5, H - 8); await t.sleep(60);
    for (let k = 1; k <= 22; k++) { t.touch.move(0, W * 0.5, H - 8 - 30 * k); await t.sleep(14); }
    t.touch.up(0);
    await t.sleep(1500);
    log(`dopo la seconda tirata: stato=${controls()._stateAdjustment.value.toFixed(2)} griglia=${controls().dash.showAppsButton.checked} (atteso 2 / true)`);
    await t.shot(`${out}/deep-grid.png`);
    // e una discesa dal bordo non deve fare nulla di strano (il gesto parte solo dal bordo e solo verso l'alto)
    t.touch.down(0, W * 0.5, H - 8); await t.sleep(60);
    for (let k = 1; k <= 6; k++) { t.touch.move(0, W * 0.5, H - 8 + 0 * k); await t.sleep(14); }
    t.touch.up(0);
    await t.sleep(500);
    log(`tocco fermo sul bordo dentro la panoramica: visibile=${Main.overview.visible}`);
    Main.overview.hide();
    await t.sleep(1000);

    // 2. pressione lunga su un'icona dello Shelf
    t.touch.down(0, W / 2, H - 12); await t.sleep(80); t.touch.up(0);
    await t.sleep(1000);
    const icons = ext.shelf._dash._box.get_children().filter(c => c.child?._delegate?.app);
    const icon = icons[0]?.child;
    const [ix, iy] = icon.get_transformed_position();
    const [iw, ih] = icon.get_transformed_size();
    log(`icone nello Shelf: ${icons.length}, prima: ${icon._delegate.app.get_name()} @${Math.round(ix)},${Math.round(iy)} ${Math.round(iw)}x${Math.round(ih)}`);
    t.touch.down(0, ix + iw / 2, iy + ih / 2);
    await t.sleep(1100);
    log(`dopo 1,1 s premuto: modali=${Main.modalCount} shelf visibile=${ext.shelf.visible} (atteso modali>0, shelf visibile)`);
    await t.shot(`${out}/deep-menu.png`);
    t.touch.up(0);
    await t.sleep(500);
    t.key(Clutter.KEY_Escape);
    await t.sleep(600);
    log(`dopo Esc: modali=${Main.modalCount}`);
}

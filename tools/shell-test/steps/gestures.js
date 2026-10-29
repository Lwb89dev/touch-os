// I gesti dai bordi, con un touchscreen virtuale (tocchi veri: gli stessi eventi di un dito sul vetro).
export async function run(t) {
    const {Main} = t;
    const out = t.GLib.getenv('SHOT_OUT');
    const W = global.stage.width, H = global.stage.height;
    const ext = t.ext('touch-shell@touch-os');
    const log = s => console.log(`[steps] ${s}`);
    const focus = () => global.display.focus_window?.get_wm_class() ?? '—';
    const state = tag => log(`${tag}: ${t.windows().map(w => `${w.app.split('.').pop()} ${w.w}x${w.h}`).join(' | ')}`);

    await t.sleep(2500);
    Main.overview.hide();
    await t.sleep(1200);

    // due app, per poter passare dall'una all'altra
    t.spawn('gnome-text-editor --new-window');
    for (let i = 0; i < 60 && t.windows().length < 1; i++) await t.sleep(150);
    await t.sleep(1800);
    t.spawn('nautilus --new-window');
    for (let i = 0; i < 60 && t.windows().length < 2; i++) await t.sleep(150);
    await t.sleep(2500);
    log(`finestre: ${t.windows().map(w => `${w.app} ${w.w}x${w.h}`).join(' | ')}  in primo piano: ${focus()}`);

    // un dito: parte da (x, y0), fa `steps` passi di (dx, dy) ogni `gap` ms, poi si stacca
    const drag = async (x, y0, dx, dy, steps = 12, gap = 16, probe = null) => {
        t.touch.down(0, x, y0);
        await t.sleep(60);
        for (let k = 1; k <= steps; k++) {
            t.touch.move(0, x + dx * k, y0 + dy * k);
            await t.sleep(gap);
            probe?.(k);
        }
        t.touch.up(0);
        await t.sleep(60);
    };

    // 1. tocco sulla barretta: apre lo Shelf
    log(`shelf prima del tocco: ${ext.shelf.visible}`);
    t.touch.down(0, W / 2, H - 12); await t.sleep(80); t.touch.up(0);
    await t.sleep(900);
    log(`shelf dopo il tocco sulla barretta: ${ext.shelf.visible} (atteso true)`);
    await t.shot(`${out}/g1-shelf.png`);
    t.touch.down(0, W / 2, H - 12); await t.sleep(80); t.touch.up(0);
    await t.sleep(700);
    log(`shelf dopo il secondo tocco: ${ext.shelf.visible} (atteso false)`);

    // 2. tirare su dal bordo: la panoramica segue il dito, poi si completa
    const before = focus();
    await drag(W * 0.3, H - 8, 0, -22, 12, 16, k => {
        if (k === 6) log(`a metà salita: panoramica visibile=${Main.overview.visible} progresso stato=${Main.overview._overview?.controls?._stateAdjustment?.value?.toFixed(2)}`);
    });
    await t.sleep(1100);
    log(`dopo il gesto verso l'alto: panoramica visibile=${Main.overview.visible} (atteso true)`);
    await t.shot(`${out}/g2-overview.png`);
    Main.overview.hide();
    await t.sleep(900);

    // 3. scorrere lungo il bordo verso destra: l'app precedente
    log(`prima del cambio app: ${focus()}`);
    await drag(W * 0.35, H - 10, 26, 0, 14, 16, k => {
        if (k === 7) t.shot(`${out}/g3-flip-mid.png`);
    });
    await t.sleep(1100);
    log(`dopo lo scorrimento a destra: ${focus()} (atteso diverso da ${before})`);
    await t.shot(`${out}/g3-flip-done.png`);
    // e di nuovo: torna indietro
    await drag(W * 0.35, H - 10, 26, 0, 14, 16);
    await t.sleep(1100);
    log(`dopo un secondo scorrimento: ${focus()} (atteso ${before})`);

    state('finestre dopo i cambi app');
    // 4. dall'alto: a destra le impostazioni rapide, a sinistra notifiche e calendario
    const qs = Main.panel.statusArea.quickSettings.menu, dm = Main.panel.statusArea.dateMenu.menu;
    await drag(W * 0.85, 6, 0, 22, 8, 16);
    await t.sleep(900);
    state('finestre dopo il gesto dall\'alto');
    log(`tirando giù da destra: quick settings aperte=${qs.isOpen} calendario=${dm.isOpen} (atteso true / false)`);
    await t.shot(`${out}/g4-top-right.png`);
    qs.close(); await t.sleep(500);
    await drag(W * 0.3, 6, 0, 22, 8, 16);
    await t.sleep(900);
    log(`tirando giù da sinistra: quick settings aperte=${qs.isOpen} calendario=${dm.isOpen} (atteso false / true)`);
    await t.shot(`${out}/g4-top-left.png`);
    dm.close(); await t.sleep(500);

    // 5. un tocco secco in cima (sul pulsante dell'orologio) NON deve contare come gesto
    t.touch.down(0, W / 2, 8); await t.sleep(70); t.touch.up(0);
    await t.sleep(700);
    log(`tocco secco sull'orologio: calendario aperto=${dm.isOpen} (atteso true: è il pulsante che risponde)`);
    dm.close(); await t.sleep(400);

    // 6. un tocco secco nel bordo in basso dentro l'app NON deve aprire nulla di Home
    log(`panoramica prima del tocco in basso: ${Main.overview.visible}`);
    t.touch.down(0, W * 0.2, H - 6); await t.sleep(70); t.touch.up(0);
    await t.sleep(600);
    log(`dopo un tocco secco in basso: panoramica=${Main.overview.visible} (atteso false)`);
}

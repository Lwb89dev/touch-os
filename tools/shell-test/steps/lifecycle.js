// Attivare e disattivare l'estensione più volte non deve lasciare nulla: attori, azioni sullo stage, gesti ripresi.
export async function run(t) {
    const {Main} = t;
    const uuid = 'touch-shell@touch-os';
    const log = s => console.log(`[steps] ${s}`);
    await t.sleep(2500);
    // all'avvio l'estensione può metterci un attimo: si aspetta che sia accesa prima di fotografare lo stato
    for (let i = 0; i < 60 && Main.extensionManager.lookup(uuid)?.state !== 1; i++) await t.sleep(250);
    log(`stato iniziale dell'estensione: ${Main.extensionManager.lookup(uuid)?.state} (1 = accesa)`);
    Main.overview.hide();
    await t.sleep(1000);

    const snapshot = () => ({
        ui: Main.uiGroup.get_n_children(),
        chrome: Main.layoutManager._trackedActors.length,
        actions: global.stage.get_actions().length,
        osk: Main.keyboard?._bottomDragGesture?.enabled,
        panelGestureHandlers: 'n/d',
    });
    const before = snapshot();
    log(`prima:  ${JSON.stringify(before)}`);

    for (let i = 1; i <= 4; i++) {
        Main.extensionManager.disableExtension(uuid);
        await t.sleep(700);
        const off = snapshot();
        Main.extensionManager.enableExtension(uuid);
        await t.sleep(1100);
        const on = snapshot();
        const ext = Main.extensionManager.lookup(uuid);
        log(`giro ${i}: spenta ${JSON.stringify(off)}  accesa ${JSON.stringify(on)}  stato=${ext.state} errore=${ext.error ?? 'nessuno'}`);
    }
    const after = snapshot();
    log(`dopo:   ${JSON.stringify(after)}`);
    log(`uiGroup: ${before.ui} → ${after.ui}, chrome: ${before.chrome} → ${after.chrome}, azioni: ${before.actions} → ${after.actions} (devono coincidere)`);

    // con l'estensione spenta la tastiera deve riavere il suo gesto, e la barra il suo trascinamento anche col dito
    Main.extensionManager.disableExtension(uuid);
    await t.sleep(700);
    log(`estensione spenta: gesto bordo inferiore della tastiera attivo=${Main.keyboard?._bottomDragGesture?.enabled}`);
    Main.extensionManager.enableExtension(uuid);
    await t.sleep(900);

    // le finestre non devono restare spostate/sbiadite dopo un cambio app interrotto dallo spegnimento
    t.spawn('gnome-text-editor --new-window');
    for (let i = 0; i < 60 && t.windows().length < 1; i++) await t.sleep(150);
    await t.sleep(2500);
    t.spawn('nautilus --new-window');
    for (let i = 0; i < 60 && t.windows().length < 2; i++) await t.sleep(150);
    await t.sleep(2500);
    const W = global.stage.width, H = global.stage.height;
    t.touch.down(0, W * 0.4, H - 10); await t.sleep(60);
    for (let k = 1; k <= 8; k++) { t.touch.move(0, W * 0.4 + 24 * k, H - 10); await t.sleep(16); }
    // il dito è ancora giù: si spegne l'estensione a metà gesto
    Main.extensionManager.disableExtension(uuid);
    await t.sleep(300);
    t.touch.up(0);
    await t.sleep(800);
    const odd = global.get_window_actors().filter(a => a.translation_x !== 0 || a.opacity !== 255);
    log(`finestre rimaste spostate o sbiadite dopo lo spegnimento a metà gesto: ${odd.length} (atteso 0)`);
    Main.extensionManager.enableExtension(uuid);
    await t.sleep(900);
    log(`estensione di nuovo accesa: stato=${Main.extensionManager.lookup(uuid).state}`);
}

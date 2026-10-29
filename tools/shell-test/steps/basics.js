// Il desktop com'è appena si entra: Shelf aperto sul desktop vuoto, poi un'app (massimizzata da sola), poi i menu.
export async function run(t) {
    const {Main} = t;
    const out = t.GLib.getenv('SHOT_OUT');
    await t.sleep(2500);
    // GNOME parte nella panoramica: la si chiude per vedere il desktop vuoto
    Main.overview.hide();
    await t.sleep(1500);
    await t.shot(`${out}/b1-empty.png`);
    const ext = t.ext('touch-shell@touch-os');
    console.log(`[steps] shelf visibile=${ext?.shelf?.visible} (atteso true sul desktop vuoto)`);

    t.spawn('gnome-text-editor --new-window');
    for (let i = 0; i < 60 && t.windows().length < 1; i++) await t.sleep(150);
    await t.sleep(2500);
    const w = t.windows()[0];
    console.log(`[steps] finestra ${w?.app} ${w?.w}x${w?.h} @${w?.x},${w?.y} (schermo ${global.stage.width}x${global.stage.height})`);
    console.log(`[steps] shelf visibile=${ext?.shelf?.visible} (atteso false con una finestra)`);
    await t.shot(`${out}/b2-app.png`);

    Main.panel.statusArea.quickSettings.menu.open();
    await t.sleep(900);
    await t.shot(`${out}/b3-quick.png`);
    Main.panel.statusArea.quickSettings.menu.close();
    await t.sleep(400);
    Main.panel.statusArea.dateMenu.menu.open();
    await t.sleep(900);
    await t.shot(`${out}/b4-date.png`);
    Main.panel.statusArea.dateMenu.menu.close();
}

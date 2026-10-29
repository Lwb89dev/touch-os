// La serie di immagini per la documentazione, in un'unica sessione. SHOT_TAG = prefisso (dark / light),
// SHOT_FILE = file da aprire nell'editor.
import Clutter from 'gi://Clutter';

export async function run(t) {
    const {Main} = t;
    const out = t.GLib.getenv('SHOT_OUT');
    const tag = t.GLib.getenv('SHOT_TAG') ?? 'dark';
    const file = t.GLib.getenv('SHOT_FILE') ?? '';
    const W = global.stage.width, H = global.stage.height;
    const ext = t.ext('touch-shell@touch-os');
    const log = s => console.log(`[steps] ${s}`);

    await t.sleep(2500);
    for (let i = 0; i < 60 && t.ext('touch-shell@touch-os')?.shelf === undefined; i++) await t.sleep(250);
    Main.overview.hide();
    await t.sleep(1600);
    await t.shot(`${out}/${tag}-home.png`);

    t.spawn(`gnome-text-editor --new-window ${file}`);
    for (let i = 0; i < 60 && t.windows().length < 1; i++) await t.sleep(150);
    await t.sleep(2200);
    t.spawn('nautilus --new-window');
    for (let i = 0; i < 60 && t.windows().length < 2; i++) await t.sleep(150);
    await t.sleep(2500);
    // Files davanti, Editor dietro
    await t.shot(`${out}/${tag}-app.png`);

    // un tocco sulla barretta: lo Shelf sopra l'app
    t.touch.down(0, W / 2, H - 12); await t.sleep(80); t.touch.up(0);
    await t.sleep(1000);
    await t.shot(`${out}/${tag}-shelf.png`);
    t.touch.down(0, W / 2, H - 12); await t.sleep(80); t.touch.up(0);
    await t.sleep(700);

    const drag = async (x, y0, dx, dy, steps, gap, mid = null) => {
        t.touch.down(0, x, y0); await t.sleep(60);
        for (let k = 1; k <= steps; k++) {
            t.touch.move(0, x + dx * k, y0 + dy * k);
            await t.sleep(gap);
            if (mid && k === mid.at) await mid.run();
        }
        t.touch.up(0); await t.sleep(60);
    };

    // cambio app: a metà del gesto
    await drag(W * 0.35, H - 10, 30, 0, 12, 20, {at: 7, run: () => t.shot(`${out}/${tag}-flip.png`)});
    await t.sleep(1200);

    // la Home che segue il dito
    await drag(W * 0.3, H - 8, 0, -26, 14, 20, {at: 8, run: () => t.shot(`${out}/${tag}-pull.png`)});
    await t.sleep(1300);
    await t.shot(`${out}/${tag}-overview.png`);
    Main.overview.hide();
    await t.sleep(900);
    Main.overview.showApps();
    await t.sleep(1800);
    await t.shot(`${out}/${tag}-apps.png`);
    Main.overview.hide();
    await t.sleep(900);

    // dall'alto: impostazioni rapide e calendario
    await drag(W * 0.85, 6, 0, 22, 8, 18);
    await t.sleep(1000);
    await t.shot(`${out}/${tag}-quick.png`);
    Main.panel.statusArea.quickSettings.menu.close();
    await t.sleep(500);
    await drag(W * 0.3, 6, 0, 22, 8, 18);
    await t.sleep(1000);
    await t.shot(`${out}/${tag}-calendar.png`);
    Main.panel.statusArea.dateMenu.menu.close();
    await t.sleep(500);

    // tastiera su schermo
    t.touch.down(0, W / 2, H / 2); await t.sleep(60); t.touch.up(0);
    new (await import('gi://Gio')).default.Settings({schema_id: 'org.gnome.desktop.a11y.applications'}).set_boolean('screen-keyboard-enabled', true);
    await t.sleep(800);
    Main.keyboard.open(Main.layoutManager.bottomIndex);
    await t.sleep(1500);
    await t.shot(`${out}/${tag}-keyboard.png`);
    log('fine serie');
}

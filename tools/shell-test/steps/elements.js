// Gli elementi della Shell che non sono la barra: notifica, OSD, Alt+Tab, dialogo, tastiera su schermo, griglia delle app.
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

export async function run(t) {
    const {Main} = t;
    const out = t.GLib.getenv('SHOT_OUT');
    const tag = t.GLib.getenv('SHOT_TAG') ?? 'el';
    const W = global.stage.width, H = global.stage.height;
    await t.sleep(2500);
    Main.overview.hide();
    await t.sleep(1200);
    t.spawn('gnome-text-editor --new-window');
    for (let i = 0; i < 60 && t.windows().length < 1; i++) await t.sleep(150);
    await t.sleep(2200);
    t.spawn('nautilus --new-window');
    for (let i = 0; i < 60 && t.windows().length < 2; i++) await t.sleep(150);
    await t.sleep(2200);

    // notifica
    Main.notify('Messaggio da Touch OS', 'Le notifiche sono carte larghe e morbide: si leggono e si scartano con un dito.');
    await t.sleep(1300);
    await t.shot(`${out}/${tag}-notify.png`);
    await t.sleep(6000);

    // OSD volume
    Main.osdWindowManager.showAll(Gio.ThemedIcon.new('audio-volume-high-symbolic'), 'Volume', 0.62, 1);
    await t.sleep(700);
    await t.shot(`${out}/${tag}-osd.png`);
    await t.sleep(2500);

    // Alt+Tab
    t.keyDown(Clutter.KEY_Alt_L);
    await t.sleep(100);
    t.key(Clutter.KEY_Tab);
    await t.sleep(900);
    await t.shot(`${out}/${tag}-switcher.png`);
    t.keyUp(Clutter.KEY_Alt_L);
    await t.sleep(700);

    // dialogo modale
    const ModalDialog = await import('resource:///org/gnome/shell/ui/modalDialog.js');
    const Dialog = await import('resource:///org/gnome/shell/ui/dialog.js');
    const d = new ModalDialog.ModalDialog({destroyOnClose: true});
    d.contentLayout.add_child(new Dialog.MessageDialogContent({title: 'Chiudere la sessione?', description: 'Le finestre aperte verranno chiuse e le modifiche non salvate andranno perse.'}));
    d.addButton({label: 'Annulla', action: () => d.close(), default: false});
    d.addButton({label: 'Esci', action: () => d.close(), default: true});
    d.open();
    await t.sleep(900);
    await t.shot(`${out}/${tag}-dialog.png`);
    d.close();
    await t.sleep(500);

    // tastiera su schermo: nella sessione headless la «modalità touch» non scatta da sola, la si accende dall'accessibilità
    t.touch.down(0, W / 2, H / 2); await t.sleep(60); t.touch.up(0);
    new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.applications'}).set_boolean('screen-keyboard-enabled', true);
    await t.sleep(800);
    Main.keyboard.open(Main.layoutManager.bottomIndex);
    await t.sleep(1500);
    console.log(`[steps] tastiera visibile=${Main.keyboard.visible}`);
    await t.shot(`${out}/${tag}-osk.png`);
    Main.keyboard.close();
    await t.sleep(900);

    // panoramica con le finestre, poi la griglia delle app
    Main.overview.show();
    await t.sleep(1500);
    await t.shot(`${out}/${tag}-overview.png`);
    Main.overview.hide();
    await t.sleep(900);
    Main.overview.showApps();
    await t.sleep(1800);
    await t.shot(`${out}/${tag}-apps.png`);
}

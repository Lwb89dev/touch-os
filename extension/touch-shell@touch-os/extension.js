import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ThemeLoader} from './theme.js';
import {Shelf} from './shelf.js';
import {Home} from './home.js';
import {TopEdge} from './top.js';
import {Tablet} from './tablet.js';

export default class TouchShell extends Extension {
    enable() {
        this.settings = this.getSettings();
        this.theme = new ThemeLoader(this.settings);
        this.shelf = new Shelf(this);
        this.home = new Home(this, this.shelf);
        this.shelf.setPillActor(this.home._hit);
        this.top = new TopEdge(this);
        this.tablet = new Tablet(this);
    }

    disable() {
        this.tablet?.destroy();
        this.tablet = null;
        this.top?.destroy();
        this.top = null;
        this.home?.destroy();
        this.home = null;
        this.shelf?.destroy();
        this.shelf = null;
        this.theme?.destroy();
        this.theme = null;
        this.settings = null;
    }
}

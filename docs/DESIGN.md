# Design notes

Touch OS is a GNOME desktop for fingers. These notes explain the decisions so they can be argued with, and record the traps
found while building it, because most of them were not in any documentation.

## 1. What it starts from

GNOME 50 already has most of what a touch desktop needs: a paged overview you can drag, a dash with long-press menus, an
on-screen keyboard, edge gestures in the Shell. What it lacks is a *coherent grammar for touch*: its controls are sized for
a pointer, its menus open from small targets in the corners, and the bottom edge is used for exactly one thing (the
keyboard). So Touch OS does two jobs:

1. **A theme** that resizes and re-skins everything for a finger (GTK4/libadwaita, GTK3, GNOME Shell, light and dark).
2. **An extension** that gives the screen's edges a small, consistent vocabulary, by wiring gestures to GNOME's own objects
   instead of replacing them.

The structure of the repository (one palette → templates → generated CSS, an installer with a backup of every setting, a
headless test bench) is shared with the sibling projects Glassy and Outkast OS. The look, the gestures and the code of the
interface are this project's own.

## 2. Scale

The rule is **nothing you aim at with a finger is smaller than 44px**; everything else follows from that. `touch-scale`
(80–140%) multiplies every size below through the `{{px:N}}` helper of the template engine.

| Thing | Size | Notes |
|---|---|---|
| Button, entry, dropdown | 44–48px | 52px for `pill` buttons |
| List row, preference row | 64px | 52px in sidebars, 48px in menus and popovers |
| Header bar | 56px | its buttons 44px; the window buttons are 40px circles |
| Top bar | 44px | panel buttons are 36px pills inside it |
| Switch | ~70×38 | a 26px knob; the GTK slider decides the size |
| Check, radio | 26px | |
| Slider | 8px trough, 28px knob | the knob is the target, so it is the biggest part |
| Calendar day | 44px | |
| Quick-settings tile | 176×68px | |
| Dash/Shelf icon | 64px on a 76px tile | picked by the Dash from the available height |
| Window close in Home | 44px | shown by long-pressing a window (GNOME's gesture) |

System **text** is 1.1× by default (`text-scaling-factor`), set by the installer and restored by the uninstaller. Target
size and text size are two separate controls: a 14" 1920×1200 screen wants bigger targets *and* slightly bigger text, but
which of the two you want more is a matter of eyes and fingers.

## 3. Color

One source of truth, `extension/touch-shell@touch-os/palette.js`; every stylesheet is generated from it. The name in code is
*Ink & Iris*: at night an ink blue-black whose surfaces get lighter as they rise, by day a cool cloud with white cards. The
greys lean slightly blue, which softens them and keeps warm accents (coral, amber) from looking dirty.

| Token | Dark | Light | Role |
|---|---|---|---|
| `view` | `#111218` | `#ffffff` | the well under text and lists |
| `bg` | `#15161d` | `#f3f4f9` | window background |
| `surface` | `#1e2029` | `#ffffff` | cards, rows |
| `dialog` | `#1f212b` | `#ffffff` | dialogs and popovers (one step above) |
| `field` | `#252734` | `#e7e9f3` | entries, off switches, segments: filled, no border |
| `raised` | `#2a2d3b` | `#e4e7f1` | pressed, or on top of a card |
| `fg` … `fg4` | `#f3f4f9` … `#656b82` | `#171923` … `#979db2` | text, from primary to faint |
| `accent` | `#8f9bff` (iris) | `#4756e0` | the signal |
| `red green amber blue rose` | `#ff6f80 #5fd39b #ffb94f #6cabff #ff7eaa` | darker twins | semantic colors |

**One signal.** The accent marks what is *active* or *selected*: a switch that is on, the row you are in, the primary action,
today in the calendar, the key that is down. Five alternatives exist (`sky`, `mint`, `coral`, `amber`, `rose`); each has a dark
and a light value, chosen so the text on top of the accent (`on`) keeps at least a 4.5:1 contrast.

GNOME 50 ships a light and a dark Shell stylesheet and picks one from the system color scheme, so Touch OS generates both
(`gnome-shell-dark.css`, `gnome-shell-light.css`) and the extension loads the matching one, swapping it live when the scheme
changes. With *high contrast* on, the Shell uses its own sheet and Touch OS steps aside.

## 4. Shape and depth

- **Concentric corners.** Windows 20px, controls 14px, and anything inside a card is smaller than the card (`radius-2`, `r*0.55`
  for check boxes). Two presets (*compact* 10/8, *round* 28/20) are one click in the settings; `0` is allowed.
- **Fills, not outlines.** An input is a filled `field` with no border; a card is `surface` with no border. The only 1px lines
  are the header bar's separator and the Dash's hairline.
- **Elevation is three shadows.** `sm` (a knob, a chip), `md` (menus, the Shelf), `lg` (dialogs, the keyboard). In the light
  scheme they are halved and tinted blue (`shade`); with *Soft shadows* off they become `none`. The template helper
  `{{shadow:md}}` does all of it; in GTK4 the same thing is `--t-shade-lo/md/hi`.
- **The shadow is also the resize zone.** A GTK window is resized from its (invisible) shadow, so the window shadow is
  deliberately wide: a finger can grab an edge it cannot see.
- **Keyboard focus is a ring, never a fill.** A single 2px ring on the widget that actually holds the focus. After a tap a
  button must not stay looking pressed, so a focused top-bar button draws a ring, not the hover fill.

## 5. States

A finger has no hover. The state that matters is `:active` (the finger is down), so every control answers it with a visible
change (a tinted fill, in the accent) and `:hover` exists only for the pointer. This is why selection is a soft accent fill
(22%) and not the bar-on-the-left of a desktop theme, and why the on-screen keyboard keys light up completely when pressed:
on glass, light is the only feedback.

## 6. Gestures

The grammar is small on purpose, and every gesture starts at an **edge**, because an edge is the one place on a touch screen
you can hit without aiming.

| Gesture | Does | Why there |
|---|---|---|
| Up from the bottom edge | Home (GNOME's overview, finger-following) | the bottom is reachable with a thumb of either hand; "up from the bottom" is what a phone or tablet user already does |
| Along the bottom edge | previous / next app | same place, other axis: "go sideways" |
| Tap the pill | Shelf | a pill that does nothing when tapped would be a lie |
| Down from the top edge, right | quick settings | they are in the top-right corner of the bar |
| Down from the top edge, left | notifications and calendar | the clock is in the middle, notifications are "above" the screen |

The bottom edge being Home has a cost: GNOME 50 uses it to pull up the on-screen keyboard. The keyboard already appears when a
text field is focused, and it has a button in the Shelf, so the trade is cheap, but it is a trade, and *Home from the bottom
edge* can be turned off to give the edge back.

### How they are built

- **Only fingers.** Every gesture is a `Clutter.PanGesture` on the stage, in the capture phase, whose
  `should-handle-sequence` handler answers `true` only if the touch **starts** inside the edge zone and comes from a
  touchscreen device (`util.js`). A touch that starts elsewhere never enters the gesture; one that starts in the zone and
  doesn't move is an ordinary tap and reaches the app.
- **Home reuses the overview's own machinery.** GNOME's `SwipeTracker` is what drives the overview with three fingers. With
  `allowDrag: true` it listens for one finger; Touch OS builds one, filters its pan gesture with the edge zone, disables its
  touchpad half (that belongs to GNOME), and connects `begin/update/end` to the overview's own `_gestureBegin/Update/End`,
  which already know how to go *hidden → windows → app grid* with inertia and snapping (one pull from the bottom reaches the
  windows, a second pull inside Home reaches the app grid). The finger drives the real overview; nothing is animated twice.
- **App flip is a second pan gesture**, on the X axis, with the same filter. The current window follows the finger
  (`translation_x`, opacity), a chip names the destination, and on release (more than 16% of the screen, or faster than
  0.45 px/ms in the same direction) the old window leaves, the new one is raised and enters from the opposite side. The old
  window stays transparent until the new one has arrived, so there is no flash between them.
- **The top edge** opens `statusArea.quickSettings.menu` or `statusArea.dateMenu.menu` by where the touch began.

### Traps found on the way

1. **The top bar steals the gesture.** The Shell's panel has a `ClickGesture` with `recognize_on_press` that starts *moving the
   maximized window* the instant you touch the bar; Mutter then owns the rest of the touch, so the stage never sees it and the
   window is un-maximized under your finger. The fix is to give that gesture a `should-handle-sequence` that refuses
   touchscreen sequences (mouse behavior unchanged). This one cost the most time, because the symptom was "my gesture never
   fires" and the evidence was a window changing size.
2. **The keyboard owns the bottom edge.** `KeyboardManager` creates a `Shell.EdgeDragGesture` on the bottom and re-enables it
   whenever the keyboard's visibility changes. Touch OS keeps it off (and hands it back on disable) by reacting to its
   `notify::enabled`.
3. **`event.get_source()` is not reliable for touches.** The Shelf used it to decide "was that tap inside me?", which made the
   pill's own tap close and immediately reopen the Shelf. The check is done on coordinates now.
4. **User CSS beats libadwaita's maximized rule.** `~/.config/gtk-4.0/gtk.css` has USER priority, which wins over libadwaita's
   `window.maximized { --window-radius: 0 }` no matter the specificity, so a theme that sets a window radius gets rounded
   corners on maximized windows unless it re-declares the zero.
5. **St details.** `max-width: none` is not a length (use a big number). The dash tile style belongs on `.overview-icon`, not on
   `.overview-tile` (the tile also contains the running-app dot and overflows the dock). Dialog default buttons are marked with
   the **pseudo-class** `:default`, not the class `.default`. A node draws a shadow *or* a ring, never both.
6. **Re-enabling an extension reloads the test extension too**, which made the test bench run its steps twice. The bench
   guards against it now.

## 7. The Shelf

The dock is the real `Dash` from `ui/dash.js`, instantiated a second time and parked in a floating container; so reordering by
dragging, the long-press app menu, the running-app dots and the grid button are GNOME's. What Touch OS adds is *when it
shows*: a tap on the pill, or any time the workspace has no windows; and *when it leaves*: a tap outside, an app starting or
taking focus, Home opening, the keyboard opening, or a few seconds of not being touched (paused while a menu is open, since a
long-press menu is the Shelf's own).

A second island holds the keyboard button, because a touch-only machine needs a way to ask for the keyboard from apps that
don't ask by themselves (terminals, some Electron apps).

## 8. Tablet mode

New `NORMAL` windows are maximized on creation unless they are transient, an attached dialog, fixed-size or already
fullscreen. It is the single most useful thing for a touch screen after the gestures: a window that is not full size is a
target that moves and an edge that has to be grabbed. Two apps side by side are GNOME's edge tiling.

## 9. Motion

Nothing bounces and nothing scales from the centre; entrances are slower than exits.

| Event | What happens | Time / curve |
|---|---|---|
| Shelf in | rises 36px and fades in | 300 ms, ease-out-quart |
| Shelf out | sinks 22px and fades out | 200 ms, ease-in-quad |
| App flip, following | the window follows the finger at 60% and fades | follows the finger |
| App flip, commit | old window leaves (22% of the width), new one enters (8% of the width) | 130 ms out, 240 ms in |
| App flip, cancel | the window returns | 180 ms |
| Flip chip | rises 12px and fades in | 160 ms |
| Pill | fades with the keyboard and Home; turns accent while a gesture is on | 160 ms |
| Home, menus | GNOME's own | |

The `Speed` setting scales every duration; with *Touch OS animations* off everything is immediate (the theme's transitions have
their own switch).

## 10. What it deliberately does not do

- **No custom launcher.** Home is the overview; it does not exist twice.
- **No gesture that needs two hands or a precise start.** Everything starts at an edge and moves in one direction.
- **No blur and no transparency in the Shell.** Surfaces are solid so text is always readable over any wallpaper or window.
- **It does not take over the three-finger gestures** (overview, workspaces), nor anything the touchpad or the mouse does.
- **It does not style the lock screen**: the extension is off while the session is locked.

#!/usr/bin/env gjs

/*##############################################################
  # Context menu constructed via CLI args.
  # Thomas Carmichael (carmanaught) https://gitlab.com/carmanaught
  #
  # Developed for and used in conjunction with menu-engine.lua - context-menu for mpv.
  # See menu-engine.lua for more info.
  #
  # 2017-08-06 - Version 0.1 - Initial version
  # 2018-06-23 - Version 0.2 - Split the argument list on the ASCII unit separator
  # 2019-08-10 - Version 0.3 - Configure the font by parsing arguments
  # 2020-11-28 - Version 0.4 - Rename file as part of moving into the script folder
  # 2024-03-16 - Version 0.5 - Rewrite the menu builder to be able to parse JSON and build
  #                            the menu from the data passed through.
  #
  ##############################################################*/

imports.gi.versions.Gtk = '3.0';
const Gtk = imports.gi.Gtk;
imports.gi.versions.Gdk = '3.0';
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const System = imports.system;

const CANCEL = -1;

// This call is necessary to be sure that GTK3 is avaible and capable of showing some UI
Gtk.init(null);

/**
 * Send Gtk.main_quit() when the menu is deactivated or an item is clicked
 */
function closeMenu() { Gtk.main_quit() }

// Get the argument list that has been passed to the script
let menuData = {}
if (ARGV.length < 1) {
    print("Usage: menu-build-tk.tcl {{\"JSON\":\"DATA\"}}");
    System.exit(1);
} else {
    menuData = JSON.parse(ARGV[0])
}

let posX = menuData.x
let posY = menuData.y
let first = true
let fontFace = menuData.fontFace !== "" ? menuData.fontFace : "Source Code Pro"
let fontSize = menuData.fontSize !== "" ? menuData.fontSize : 9
let itemClicked = false
let errorValue = "errorValue"

/**
 * Print a JSON object to stdout with values to be used by the menu-engine. Also identify an item has been clicked. While this is also called by the deactivate, it is called after the itemClicked check.
 * @param {string} menuName The menu name for the menu where an item was clicked.
 * @param {number} index The menu index for the menu items that was clicked.
 * @param {string} menuPath The path to the menu. Redundant for this menu for now, but included for uniformity with the Tcl/Tk script.
 * @param {string} errorValue An error value that can be provided back to the calling process.
 */
function done(menuName, index, menuPath, errorValue) {
    print("{\"x\":\"" + posX + "\", \"y\":\"" + posY + "\", \"menuname\":\"" + menuName + "\", \"index\":\"" + index + "\", \"menupath\":\"" + menuPath + "\", \"errorvalue\":\"" + errorValue + "\"}\n");
    itemClicked = true;
}

let maxLabel = {};
let maxAccel = {};
// Iterate through all non-cascade items and get the maximum length of the label and the
// accelerator for each separate menu to be used when combining the items for the menu
// item labels.
for (const [key, val] of Object.entries(menuData.menu)) {
    if (typeof(menuData.menu[key]) === "object") {
        let subMenu = menuData.menu[key];

        for (const [subKey, subVal] of Object.entries(subMenu)) {
            let itemType = subVal.itemType;
            let accel = "";
            let label = "";

            if (itemType !== "separator") { label = subVal?.label || "" }

            if (itemType !== "cascade" && itemType !== "separator") {
                accel = subVal?.accelerator || ""
            }

            if (!maxLabel[key]) {
                maxLabel[key] = label.length;
            } else {
                if (label.length > maxLabel[key]) {
                    maxLabel[key] = label.length;
                }
            }

            if (!maxAccel[key]) {
                maxAccel[key] = accel.length;
            } else {
                if (accel.length > maxAccel[key]) {
                    maxAccel[key] = accel.length;
                }
            }
        }
    }
}

/**
 * Use the maxLabel/maxAccel when necessary to combine label and accelerator into the one label text. This is done to avoid use GTK accelerators and requires that the font in use is a monospace font.
 * @param {string} curMenuName The current menu name to make the label for. Works with the max[label|accel] arrays to access lengths.
 * @param {string} lblText The label text to add to the label.
 * @param {string} lblAccel The accelerator text to add to the label.
 * @returns Return a label value for use with a monospace font, giving the appearance of a right-aligned accerator.
 */
function makeLabel(curMenuName, lblText, lblAccel) {
    let labelVal = "";
    if (lblAccel === "" || lblAccel === undefined) {
        labelVal = lblText + "   ";
    } else {
        let spacesCount = maxLabel[curMenuName] + 4 + maxAccel[curMenuName];
        spacesCount = spacesCount - lblText.length - lblAccel.length;
        let menuSpaces = " ".repeat(spacesCount);
        labelVal = lblText + menuSpaces + lblAccel;
    }

    return labelVal;
}

let menu = {};
let mItem = {};
let preMenu = "";
let curMenu = "";
let baseMenuName = menuData.menuName;
let baseMenu = menu[baseMenuName] = new Gtk.Menu();
mItem[baseMenuName] = {};
let menuLimit = menuData.menuLimit;

/**
 * Build the menu from the JSON here, iterating through the JSON structure to build the menu before displaying the it.
 * @param {string} curMenu The name value of the menu to build.
 * @param {number} mLvl Menu level value to prevent infite recursion while building menus.
 */
function buildMenu(curMenu, menuLvl) {
    let thisMenu = menuData.menu[curMenu];

    // Limit the number of sub-menus that can be recursed through to prevent infinite recursion.
    if (menuLvl <= menuLimit) {
        for (const [key, val] of Object.entries(thisMenu)) {
            let itemType = val.itemType;
            let label = "";
            let accel = "";
            let itemState = undefined;
            let itemDisable = false;
            let abActive = false;
            let abInconsistent = false;
            let mIndex = key - 1;

            if (val.hasOwnProperty("labelVal")) {
                label = val.labelVal;
            } else if (val.hasOwnProperty("label")) {
                label = val.label;
            } else { label = ""; }

            if (val.hasOwnProperty("acceleratorVal")) {
                accel = val.acceleratorVal;
            } else if (val.hasOwnProperty("accelerator")) {
                accel = val.accelerator;
            } else { accel = ""; }

            if (val.hasOwnProperty("itemStateVal")) {
                itemState = val.itemStateVal;
            } else if (val.hasOwnProperty("itemState")) {
                itemState = val.itemState;
            } else { itemState = true; }

            if (val.hasOwnProperty("itemDisableVal")) {
                itemDisable = val.itemDisableVal;
            } else if (val.hasOwnProperty("itemDisable")) {
                itemDisable = val.itemDisable;
            } else { itemDisable = true; }

            if (itemType === "cascade") {
                let nextMenu = accel
                if (!menu[nextMenu]) { menu[nextMenu] = new Gtk.Menu() }
                if (!mItem[nextMenu]) { mItem[nextMenu] = {} }
                mItem[curMenu][mIndex] = new Gtk.MenuItem ({
                    label: makeLabel(curMenu, label),
                    visible: true,
                    sensitive: !itemDisable,
                    submenu: menu[nextMenu]
                });
                menu[curMenu].append(mItem[curMenu][mIndex])

                menuLvl++
                buildMenu(nextMenu, menuLvl);
                menuLvl--

                continue
            }

            if (itemType === "separator") {
                mItem[curMenu][mIndex] = new Gtk.SeparatorMenuItem()
                menu[curMenu].append(mItem[curMenu][mIndex])

                continue
            }

            if (itemType === "ab-button") {
                if (typeof(itemState) !== "boolean") {
                    abInconsistent = itemState === "a"
                    abActive = itemState === "b"
                }
            }

            // Command menu items are a regular MenuItem, but the remaining menu items all use CheckMenuItem
            if (itemType === "command") {
                mItem[curMenu][mIndex] = new Gtk.MenuItem();
            } else {
                mItem[curMenu][mIndex] = new Gtk.CheckMenuItem();
            }

            // There are common properties between all remaining menu items
            mItem[curMenu][mIndex].label = makeLabel(curMenu, label, accel);
            mItem[curMenu][mIndex].visible = true;
            mItem[curMenu][mIndex].sensitive = !itemDisable

            // Specific property changes for the A-B looping
            mItem[curMenu][mIndex].active = itemType === "ab-button" ? abActive : true;
            mItem[curMenu][mIndex].inconsistent = itemType === "ab-button" ? abInconsistent : false;

            if (itemType === "radiobutton") {
                mItem[curMenu][mIndex].draw_as_radio = true;
            }

            if (itemType === "checkbutton" || itemType === "radiobutton"){
                mItem[curMenu][mIndex].active = itemState;
            }

            // For each of the regularly clickable menu items (not cascades or separators), we
            // connect to the button-release-event signal, calling the done command.
            mItem[curMenu][mIndex].connect("button_release_event", () =>
                done(curMenu, key, baseMenuName, errorValue)
            );

            menu[curMenu].append(mItem[curMenu][mIndex]);
        }
    }
}

buildMenu(baseMenuName, 1);

let cssProv;

/**
 * Load the styling and popup the menu, starting the main loop.
 */
function show_menu() {
    // Use a Gtk.CssProvider to load CSS information and apply that to all items in the menu.
    cssProv = new Gtk.CssProvider();
    cssProv.load_from_data(" * { font-family: " + fontFace + "; font-size: " + fontSize + "pt; font-weight: 500; }")
    Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), cssProv, 800);

    // Show all menu items and launch the popup.
    baseMenu.show_all();
    baseMenu.popup(null, null, null, 0, Gtk.get_current_event_time());
    // Start the main application loop.
    Gtk.main();
};

// Connect to the 'deactivate' signal and if no item has been clicked, pass the CANCEL value
// back so that the menu-engine knows nothing has been clicked.
baseMenu.connect("deactivate", function() {
    if (itemClicked === false) {
        done(baseMenuName, CANCEL, baseMenuName, errorValue);
    }
    Gtk.StyleContext.remove_provider_for_screen(Gdk.Screen.get_default(), cssProv);
    closeMenu();
});

// After everything that's not inside a function has been built, call the show_menu function
// to show the menu.
show_menu();

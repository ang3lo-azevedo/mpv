/*
 * Context menu engine for mpv.
 * Originally by Avi Halachmi (:avih) https://github.com/avih
 * Extended by Thomas Carmichael (carmanaught) https://gitlab.com/carmanaught
 *
 * Features:
 * - Comprehensive sub-menus providing access to various mpv functionality
 * - Dynamic menu items and commands, disabled items, separators.
 * - Reasonably well behaved/integrated considering it's an external application.
 * - Configurable options for some values (changes visually in menu too)
 *
 * Setup/Requirements:
 * - Check https://github.com/carmanaught/mpvcontextmenu for further setup instructions
 *
 * 2017-02-02 - Version 0.1 - Initial version (avih)
 * 2017-07-19 - Version 0.2 - Extensive rewrite (carmanught)
 * 2017-07-20 - Version 0.3 - Add/remove/update menus and include zenity bindings (carmanught)
 * 2017-07-22 - Version 0.4 - Reordered context_menu items, changed table length check, modify
 *                            menu build iterator slightly and add options (carmanaught)
 * 2017-07-27 - Version 0.5 - Added function (with recursion) to build menus (allows dynamic
 *                            menus of up to 6 levels (top level + 5 sub-menu levels)) and
 *                            add basic menu that will work when nothing is playing.
 * 2017-08-01 - Version 0.6 - Add back the menu rebuild functionality.
 * 2017-08-04 - Version 0.7 - Separation of menu building from definitions.
 * 2017-08-07 - Version 0.8 - Updated to better support an additional menu builder.
 * 2018-04-30 - Version 0.9 - Modify dialog calls to work with new gui-dialogs.lua.
 * 2018-06-23 - Version 1.0 - Change argument delimiter to use the ASCII unit separator.
 * 2019-08-10 - Version 1.1 - Add option to configure font face and size.
 * 2020-11-28 - Version 1.2 - Change menuscript paths to use the mp.get_script_directory()
 *                            functionality in mpv 0.33.0.
 * 2021-05-29 - Version 1.3 - Properly identify script that was run when subprocess fails and
 *                            handle subprocess failure better.
 * 2021-05-29 - Version 1.4 - Use the file_loaded_menu value from the menuList to ensure that
 *                            the menu is shown in the pseudo-gui.
 * 2023-07-07 - version 1.5 - Enable use of the script when mpv is inside a flatpak by checking
 *                            environment variables and use the host system executables.
 * 2024-03-16 - Version 1.6 - Converted from LUA to JavaScript. Change approach to building the
 *                            menus by passing JSON to the subprocesses and handling JSON in
 *                            the menu builder.
 */

var flatpakCheck = require("./flatpak-check");

var utils = mp.utils;
var verbose = false  // true -> Dump console messages also without -v
function info(x) { verbose ? mp.msg.info(x) : mp.msg.verbose(x); }
function mpdebug(x) { mp.msg.info(x); } // For printing other debug without verbose

// Set options
var options = mp.options;
var opt = {
    // Default font to use for menus. A check should be done that the font used here
    // will be accepted by the menu builder used.
    fontFace: "Source Code Pro",
    // Play > Seek - Seconds
    fontSize: "9",
}
options.read_options(opt, "menu-engine");

// Use tables to specify the interpreter and menuscript to allow for multiple menu
// builders along with the associated logic changes to handle them.
var interpreter = {};
var scriptfile = {};
var menuscript = {};

interpreter["tk"] = "wish";  // tclsh/wish/full-path
scriptfile["tk"] = "menu-builder-tk.tcl";
menuscript["tk"] = mp.get_script_directory() + "/" + scriptfile["tk"];

interpreter["gtk"] = "gjs";  // gjs/full-path
scriptfile["gtk"] = "menu-builder-gtk.js";
menuscript["gtk"] = mp.get_script_directory() + "/" + scriptfile["gtk"];


// Set some constant values. These must match what's used with the menu definitions.
var SEP = "separator";
var CASCADE = "cascade";
var COMMAND = "command";
var CHECK = "checkbutton";
var RADIO = "radiobutton";
var AB = "ab-button";

var menuBuilder = "";

/**
 * Get the length of an object.
 * @param {object} object The object to get the length of.
 * @returns Returns a value with the length of the object
 */
function len(object) {
    return Object.keys(object).length;
}

/**
 * Build the menu structure and call the relevant subprocess to actually build the menu.
 * @param {object} menuList The menu list object to build the menu from.
 * @param {string} menuName The menu name to build (can have nested submenus).
 * @param {number} x The X axis mouse coordinate. A value of -1 indicates to get the current X axis position.
 * @param {number} y The Y axis mouse coordinate. A value of -1 indicates to get the current Y axis position.
 * @param {string} menuPaths The menu paths for rebuilding the menu.
 * @param {string} menuIndexes The menu indexes for rebuilding the menu.
 */
function doMenu(menuList, menuName, x, y, menuPaths, menuIndexes) {
    var mousepos = {};
    mousepos.x, mousepos.y = mp.get_mouse_pos();
    if (x === -1 && menuBuilder !== "tk") { x = String(mousepos.x); }
    if (y === -1 && menuBuilder !== "tk") { y = String(mousepos.y); }
    menuPaths = (menuPaths !== undefined) ? String(menuPaths) : "";
    menuIndexes = (menuIndexes !== undefined) ? String(menuIndexes) : "";

    // We'll send the x/y location to spawn the menu along with the name of the base menu and
    // any menu paths and menu indexes if there are any (used to re'post' a menu). We'll also
    // send the font face and font size along with a maximum menu cascade limit.
    var jsonArg = {
        x: x,
        y: y,
        menu: menuList,
        menuName: menuName,
        menuLimit: 10,
        menuPaths: menuPaths,
        menuIndexes: menuIndexes,
        fontFace: String(opt.fontFace),
        fontSize: String(opt.fontSize)
    }

    var stopCreate = false;

    var menuStruct = {}

    /**
     * Build a list of the menu indexes as they exist relative to the main menu.
     * @param {object} menuList The menu object to build the list of indexes for.
     * @param {string} menuName The main menu to use as the basis for building the indexes.
     * @param {number} menuLevel The current menu level (used to limit recursion).
     * @returns Returns from the function to prevent infinite recursion.
     */
    function buildIndexes(menuList, menuName, menuLevel) {
        // We limit the number of sub-menus that can be recursed through to prevent
        // infinite recursion.
        for (var i = 1; i <= len(menuList[menuName]); i++) {
            if (menuLevel <= jsonArg.menuLimit) {
                if (menuList[menuName][i]["itemType"] === CASCADE) {
                    subMenu = menuList[menuName][i]["accelerator"]
                    menuStruct[subMenu] = {};
                    menuStruct[subMenu]["index"] = i - 1;

                    // Iterate menuLevel down and get indexes for the submenu
                    menuLevel++;
                    buildIndexes(menuList, subMenu, menuLevel)
                    menuLevel--;
                }
            } else {
                mp.osd_message("Too many menu levels. No more than " + jsonArg.menuLimit + " menu levels total.");
                stopCreate = true;
                return;
            }
        }
    }

    buildIndexes(menuList, menuName, 1);

    // Stop building the menu if there was an issue with too many menu levels since it'll
    // just cause problems.
    if (stopCreate === true) { return; }

    // If a file is newly loaded, make sure all menus in the rebuildWatch list are added
    // to the buildList array so make sure we always rebuild the whole menu structure on
    // a new file being loaded.
    if (newFile === true) {
        for (var key in rebuildWatch) {
            if (rebuildWatch.hasOwnProperty(key)) {
                if (typeof(rebuildWatch[key]) === "object") {
                    rebuildWatch[key].forEach(function(type, i) {
                        if (buildList.indexOf(type) === -1) {
                            buildList.push(type);
                        }
                    });
                } else {
                    if (buildList.indexOf(rebuildWatch[key]) === -1) {
                        buildList.push(rebuildWatch[key]);
                    }
                }
            }
        }
        newFile === false;
    }

    // Build the menus that use functions
    for (var key in generatedMenus) {
        if (generatedMenus.hasOwnProperty(key)) {
            if (buildList.indexOf(key) !== -1) {
                // Take the relevant menu out of the list of menus to rebuild.
                buildList.splice(buildList.indexOf(key), 1)

                // Rebuild the relevant menu.
                menuList[key] = generatedMenus[key]();
            }
        }
    }

    // Only go through the general menus to update values if something has changed.
    if (buildList.indexOf("context_menu") !== -1) {
        // Take the general menu rebuild out of the list of menus to rebuild.
        buildList.splice(buildList.indexOf("context_menu"), 1)

        // If any menu that isn't a "command" is a function, call the function to get the value.
        for (var key in menuList) {
            if (menuList.hasOwnProperty(key)) {
                // Check that the menu is an object (ignore file_loaded_menu).
                if (typeof(menuList[key]) === "object") {
                    // The menuList should have been checked for undefined objects so iterate
                    // through the menu items of the menu.
                    for (var i = 1; i <= len(menuList[key]); i++) {
                        // Iterate through the menus and convert non-"command" functions to values
                        for (var itemKey in menuList[key][i]) {
                            //if (itemKey !== COMMAND && typeof menuList[key][i][itemKey] === "function") {
                            if (typeof menuList[key][i][itemKey] === "function") {
                                var newKey = itemKey + "Val"
                                if (itemKey !== COMMAND) {
                                    menuList[key][i][newKey] = menuList[key][i][itemKey]();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    var flatpak = flatpakCheck.check();

    // We use the chosen menu builder with the interpreter and menuscript tables as the key
    // to define which script we're going to call. The builder should be written to handle
    // the information passed to it and provide output back to us in the format we want.
    var cmdArgs = [];
    if (flatpak === true) {
        cmdArgs.push("flatpak-spawn");
        cmdArgs.push("--host");
    }
    cmdArgs.push(interpreter[menuBuilder]);
    cmdArgs.push(menuscript[menuBuilder]);
    cmdArgs.push(JSON.stringify(jsonArg));

    // retVal gets the return value from the subprocess
    var retVal = utils.subprocess({
        args: cmdArgs,
        // We want to get stderr output to check for flatpak errors
        capture_stderr: true,
        // Use the 'file_loaded_menu' boolean to ensure the menu is shown in the pseudo-gui.
        playback_only: menuList["file_loaded_menu"]
    })

    // Show an error and stop executing if the subprocess has an error
    if (retVal.status !== 0) {
        if (String(retVal.stderr).replace(/(?:\r\n|\r|\n)/g, "") === "Portal call failed: "
                + "org.freedesktop.DBus.Error.ServiceUnknown") {
            mp.osd_message("Error: mpv is in a flatpak. Enable talk-name for "
                + "org.freedesktop.Flatpak (Note: This negates the flatpak sandbox)", 5);
            mpdebug ("Error: mpv is in a flatpak. Enable talk-name for "
                + "org.freedesktop.Flatpak (Note: This negates the flatpak sandbox)"); }
        if (retVal.status === -1) {
            mp.osd_message("Possible error in " + scriptfile[menuBuilder]
                + " script (Unknown error with '" + menuBuilder + "' menu builder)."); }
        if (retVal.status === -2) {
            mp.osd_message("Subprocess killed by mpv (mp_cancel)."); }
        if (retVal.status === -3) {
            mp.osd_message("Error during initialization of subprocess (Script: "
                + scriptfile[menuBuilder] + ")"); }
        if (retVal.status === -4) {
            mp.osd_message("API not supported."); }

        return;
    }

    info("ret: " + retVal.stdout);
    // Parse the return value as JSON and assign the JSON values.
    var response = JSON.parse(retVal.stdout);
    response.x = Number(response.x);
    response.y = Number(response.y);
    response.menuname = String(response.menuname);
    response.index = Number(response.index);
    response.menupath = String(response.menupath);
    response.errorvalue = String(response.errorvalue);

    // Check for an error value first as we use the menu cancel when the menu nesting
    // exceeds the menu limit.
    if (response.errorvalue !== "errorValue") {
        mpdebug("Error Value: " + response.errorvalue);
        mp.osd_message(response.errorvalue);
    }

    if (response.index === -1) {
        info("Context menu cancelled");
        return;
    }

    var respMenu = menuList[response.menuname]
    var menuIndex = response.index
    var menuItem = respMenu[menuIndex]
    if (!(menuItem && menuItem["command"])) {
        mp.msg.error("Unknown menu item index: " + String(response.index) + " for menu "
                    + response.menuname);
        mp.msg.error("menuItem: " + JSON.stringify(menuItem));
        return;
    }

    // Run the command accessed by the menu name and menu item index return values
    if (typeof menuItem.command === "string") {
        info("string: " + menuItem.command);
        if (menuItem.command !== "") { mp.command(menuItem.command); }
    } else {
        info("command: " + menuItem.command);
        menuItem.command();
    }

    // Currently only the 'tk' menu supports a rebuild or re'post' to show the menu re-cascaded to
    // the same menu it was on when it was clicked.
    if (menuBuilder === "tk") {
        // Re'post' the menu if there's a seventh menu item and it's true. Only available for tk menu
        // at the moment.
        if (menuItem.repostMenu) {
            if (menuItem.repostMenu !== "boolean") {
                rebuildMenu = (menuItem.repostMenu === true) ? true : false;
            }

            if (rebuildMenu === true) {
                // Figure out the menu indexes based on the path and send as args to re'post' the menu
                var menuPaths = "";
                var menuIndexes = "";
                var pathList = {};
                var idx = 0;
                var menuPath = response.menupath.split('.')
                menuPath.splice(0,1)
                for (var path in menuPath) {
                    if (menuPath.hasOwnProperty(path)) {
                        pathList[idx] = menuPath[path];
                        idx++;
                    }
                }

                // Iterate through the menus and build the index values
                for (var i = 0; i < (len(pathList)); i++) {
                    var pathJoin = ""
                    // Set menu paths prepended by a period to work with Tcl/Tk path names
                    for (var p = 0; p <= i; p++) {
                        pathJoin = pathJoin + "." + pathList[p]
                    }
                    if (i > 0) {
                        if (i < (len(pathList) - 1)) {
                            menuPaths = menuPaths + "?" + pathJoin
                        }
                    } else { menuPaths = pathJoin }

                    // Set the menu index for the sub menus. Indexes are for accessing the
                    // menus after the main top-level menu.
                    if (i > 1) {
                        menuIndexes = menuIndexes + "?" + menuStruct[pathList[i]]["index"]
                    } else if (i > 0) {
                        menuIndexes = menuStruct[pathList[i]]["index"]
                    }
                }

                // Asynchronously call the menu builder again, to prevent stack overflow
                // and to un-congest the event queue. A short timeout is set to allow other
                // queued events to happen, but the timeout should be increased if needed.
                id = setTimeout(function() { doMenu(menuList, "context_menu", response.x, response.y, menuPaths, menuIndexes); }, 50);
            } else {
                mpdebug("There's a problem with the menu rebuild value");
            }
        }
    }
}

/**
 * Set a watch on a provided property. JavaScript version based on observe-all.lua.
 * @param {string} propName The property name to watch for changes to.
 * @param {string} rebuildType The type of rebuild that needs to be done for the changed property.
 */
function observe(propName, rebuildType) {
    watchProp(propName, "native", function(propName, val) {
        if (typeof(rebuildType) === "object") {
            rebuildType.forEach(function(type, i) {
                if (buildList.indexOf(type) === -1) {
                    buildList.push(type);
                }
            });
        } else {
            if (buildList.indexOf(rebuildType) === -1) {
                buildList.push(rebuildType);
            }
        }
    });
}

// Iterate through the list of properties to watch for (in main.js) and set a watch on the
// properties. All properties *should* be set when a file is first loaded, and therefore
// *should* allow the engine to build/update the menu complete structure on the first run.
for (var key in rebuildWatch) {
    if (rebuildWatch.hasOwnProperty(key)) {
        observe(key, rebuildWatch[key]);
    }
}

/**
 * Create a menu.
 * @param {object} menu_list The menu list object to build from.
 * @param {string} menu_name The menu name to build (can have nested submenus).
 * @param {number} x The X axis mouse coordinate.
 * @param {number} y The Y axis mouse coordinate.
 * @param {string} menu_builder The menu builder to use to build the menu.
 */
function createMenu(menu_list, menu_name, x, y, menu_builder) {
    menuBuilder = menu_builder;
    doMenu(menu_list, menu_name, x, y);

}

module.exports = {
    createMenu: createMenu
}

/* Use KDialog/Zenity for various dialogs including:
 * - Opening files (replacing current playlist)
 * - Adding files to the playlist
 * - Opening separate Audio/Subtitle Tracks
 * - Opening URLs
 * - Opening folders (replacing current playlist)
 * - Adding folders to the playlist - Note: This will only resolve the list of files once
 *   the playlist entry starts playing
 *
 * Based on "kdialog-open-files" (https://gist.github.com/ntasos/d1d846abd7d25e4e83a78d22ee067a22).
 *
 * This is intended to be used in concert with mpvcontextmenu, but can be used seperately
 * by specifying script bindings below or in input.conf.
 *
 * 2018-04-30 - Version 0.1 - Replace zenity-dialogs.lua with this gui-dialogs.lua, which has been
 *                            somewhat rewritten to allow for use of KDialog and Zenity.
 * 2021-09-17 - Version 0.2 - Improve compatibility with Zenity under Windows.
 * 2023-07-07 - Version 0.3 - Enable use of the script when mpv is inside a flatpak by checking
 *                            environment variables and use the host system executables.
 * 2024-03-16 - Version 0.4 - Converted from LUA to JavaScript. Also updated KDialog URL opening
 *                            to use an entry dialog, instead of the file picker.
 */

var flatpakCheck = require("./flatpak-check");

var utils = mp.utils;

// Set options
var options = mp.options;
var opt = {
    // Dialog preference (kdialog/zenity)
    dialogPref: "",
    // Standard keybindings
    addFiles: "Ctrl+f",
    addFolder: "Ctrl+g",
    appendFiles: "Ctrl+Shift+f",
    appendFolder: "Ctrl+Shift+g",
    addSubtitle: "F",
    // These bindings default to nil
    addURL: "",
    openURL: "",
    openPlaylist: "",
    addAudio: "",
}
options.read_options(opt, "gui-dialogs");

// Specify the paths here if necessary
var KDialog = "kdialog";
var Zenity = "zenity";

// File Filters with a list of filetypes - add more types here as desired
var fileFilters = {
    video_files: { label: "Videos", 1: "3gp", 2: "asf", 3: "avi", 4: "bdm", 5: "bdmv", 6: "clpi",
                    7: "cpi", 8: "dat", 9: "divx", 10: "dv", 11: "fli", 12: "flv", 13: "ifo",
                    14: "m2t", 15: "m2ts", 16: "m4v", 17: "mkv", 18: "mov", 19: "mp4", 20: "mpeg",
                    21: "mpg", 22: "mpg2", 23: "mpg4", 24: "mpls", 25: "mts", 26: "nsv", 27: "nut",
                    28: "nuv", 29: "ogg", 30: "ogm", 31: "qt", 32: "rm", 33: "rmvb", 34: "trp",
                    35: "tp", 36: "ts", 37: "vcd", 38: "vfw", 39: "vob", 40: "webm", 41: "wmv"},

    audio_files: { label: "Audio", 1: "aac", 2: "ac3", 3: "aiff", 4: "ape", 5: "flac", 6: "it",
                    7: "m4a", 8: "mka", 9: "mod", 10: "mp2", 11: "mp3", 12: "ogg", 13: "pcm",
                    14: "wav", 15: "wma", 16: "xm"},

    image_files: { label: "Images", 1: "bmp", 2: "gif", 3: "jpeg", 4: "jpg", 5: "png", 6: "tif",
                    8: "tiff"},

    playlist_files: { label: "Playlists", 1: "cue", 2: "pls", 3: "m3u", 4: "m3u8"},

    subtitle_files: { label: "Subtitles", 1: "ass", 2: "smi", 3: "srt", 4: "ssa", 5: "sub",
                    6: "txt"},

    all_files_zenity: "--file-filter=All Files | *",

    all_files_kdialog: "All Files (*)"
}

/**
 * Build file filters and return a value including --file-filter= in it for zenity.
 * @param {string} filterName The name of the filter object to build the filter for.
 * @param {string} dialog The dialog to build the filter for.
 * @returns Returns a string with the filter arguments.
 */
function buildFilter(filterName, dialog) {
    var filterList = fileFilters[filterName];
    var filterArg = "";
    if (dialog === "zenity") {
        filterArg = "--file-filter=" + filterList["label"] + " | ";
    } else if (dialog === "kdialog") {
        filterArg = filterList["label"] + " (";
    }

    for (i = 1; i <= len(filterList); i++) {
        filterArg = filterArg + "*." + filterList[i];

        if (i !== len(filterList)) {
            filterArg = filterArg + " ";
        }
    }

    if (dialog === "kdialog") {
        filterArg = filterArg + ")";
    }

    return filterArg;
}

/**
 * Build all Video/Audio/Image/Playlist file type filters all together.
 * @param {string} dialog The dialog to build the filter for.
 * @returns Returns a string with the filter arguments.
 */
function buildMultimedia(dialog) {
    var mediaList = {1: "video_files", 2: "audio_files", 3: "image_files", 4: "playlist_files"};
    var allMultimedia = "";

    if (dialog === "zenity") {
        allMultimedia = "--file-filter=All Types | ";
    } else if (dialog === "kdialog") {
        allMultimedia = "All Types (";
    }

    for (var i = 1; i <= len(mediaList); i++) {
        var filterList = fileFilters[mediaList[i]];

        for (var subi = 1; subi <= len(filterList); subi++) {
            allMultimedia = allMultimedia + "*." + filterList[subi]

            if ((i !== len(mediaList)) && (subi !== len(filterList))) {
                allMultimedia = allMultimedia + " ";
            }
        }
    }

    if (dialog === "kdialog") {
        allMultimedia = allMultimedia + ")";
    }

    return allMultimedia;
}

/**
 * Create a given dialog type based on a type and mode.
 * @param {string} selType The type of dialog to open.
 * @param {string} selMode The mode for the dialog to operate in.
 * @returns Returns in error only.
 */
function createDialog(selType, selMode) {
    var args = []
    var flatpak = flatpakCheck.check()
    if (flatpak === true) {
        args.push("flatpak-spawn")
        args.push("--host")
    }
    args.push("xdotool")
    args.push("getwindowfocus")
    var focus = utils.subprocess({ args: args })
    var kargs = []
    var zargs = []
    args = []

    // Get the current path if possible
    if (mp.get_property("path") === undefined) {
        directory = opt.dialogPref === "kdialog" ? "." : "";
    } else {
        directory = utils.split_path(utils.join_path(mp.get_property("working-directory"), mp.get_property("path")))
    }

    if (flatpak === true) {
        kargs.push("flatpak-spawn")
        kargs.push("--host")
        zargs.push("flatpak-spawn")
        zargs.push("--host")
    }

    kargs.push(KDialog)
    zargs.push(Zenity)

    kargs.push("--attach=" + focus.stdout.trim())

    if (selType === "url") {
        //KDialog
        kargs.push("--title=Open URL")
        kargs.push("--inputbox=Enter URL:")
        //Zenity
        zargs.push("--entry")
        zargs.push("--text=Enter URL:")
        zargs.push("--title=Open URL")
    } else {
        //KDialog
        kargs.push("--icon=mpv")
        kargs.push("--separate-output")
        //Zenity
        zargs.push("--file-selection")
        // Only zenity can be done out here as the filter is another flag to be
        // passed. kdialog must be done just before the filter items
        zargs.push("--filename=" + directory[0] + "")

        if (selType === "file") {
            //KDialog
            kargs.push("--multiple")
            kargs.push("--title=Select Files")
            kargs.push("--getopenfilename")
            kargs.push("" + directory[0] + directory[1] + "")
            kargs.push(buildFilter("video_files", "kdialog") + "\n"
                                + buildFilter("audio_files", "kdialog") + "\n"
                                + buildFilter("image_files", "kdialog") + "\n"
                                + buildFilter("playlist_files", "kdialog") + "\n"
                                + buildMultimedia("kdialog") + "\n"
                                + fileFilters["all_files_kdialog"])
            //Zenity
            zargs.push("--multiple")
            zargs.push("--title=Select Files")
            zargs.push(buildFilter("video_files", "zenity"))
            zargs.push(buildFilter("audio_files", "zenity"))
            zargs.push(buildFilter("image_files", "zenity"))
            zargs.push(buildFilter("playlist_files", "zenity"))
            zargs.push(buildMultimedia("zenity"))
            zargs.push(fileFilters["all_files_zenity"])
        } else if (selType === "folder") {
            //KDialog
            kargs.push("--multiple")
            kargs.push("--title=Select Folders")
            kargs.push("--getexistingdirectory")
            //Zenity
            zargs.push("--multiple")
            zargs.push("--title=Select Folders")
            zargs.push("--directory")
        } else if (selType === "playlist") {
            //KDialog
            kargs.push("--title=Select Playlist")
            kargs.push("--getopenfilename")
            kargs.push("" + directory[0] + "")
            kargs.push(buildFilter("playlist_files", "kdialog") + "\n"
                                + fileFilters["all_files_kdialog"])
            //Zenity
            zargs.push("--title=Select Playlist")
            zargs.push(buildFilter("playlist_files", "zenity"))
            zargs.push(fileFilters["all_files_zenity"])
        } else if (selType === "subtitle") {
            //KDialog
            kargs.push("--title=Select Subtitle")
            kargs.push("--getopenfilename")
            kargs.push("" + directory[0] + "")
            kargs.push(buildFilter("subtitle_files", "kdialog") + "\n"
                                + fileFilters["all_files_kdialog"])
            //Zenity
            zargs.push("--title=Select Subtitle")
            zargs.push(buildFilter("subtitle_files", "zenity"))
            zargs.push(fileFilters["all_files_zenity"])
        } else if (selType === "audio") {
            //KDialog
            kargs.push("--title=Select Audio")
            kargs.push("--getopenfilename")
            kargs.push("" + directory[0] + "")
            kargs.push(buildFilter("audio_files", "kdialog") + "\n"
                                + fileFilters["all_files_kdialog"])
            //Zenity
            zargs.push("--title=Select Audio")
            zargs.push(buildFilter("audio_files", "zenity"))
            zargs.push(fileFilters["all_files_zenity"])
        }
    }

    if (opt.dialogPref === "kdialog") {
        args = kargs
    } else if (opt.dialogPref === "zenity") {
        args = zargs
    } else {
        mp.osd_message("No dialog preference configured for gui-dialogs.lua")
        return
    }

    var dialogResponse = utils.subprocess({
        args: args,
        playback_only: false,
    })

    if (dialogResponse.status !== 0) { return }
    var dialogOutput = dialogResponse.stdout;

    // Convert newlines into pipes. This does mean that filenames with a pipe will
    // throw an error, but this helps to unify KDialog and Zenity outputs.
    dialogOutput = dialogOutput.replace(/\r?\n|\r/g, "|")

    // Remove any trailing newlines, as can happen with Zenity output under Windows.
    do {
        dialogOutput = dialogOutput.replace(/\|$/, "")
    } while (dialogOutput.match(/\|$/) !== null)

    var firstFile = true
    var files = dialogOutput.match(/[^|]+/g)

    if (selMode === "add") {
        for (var i in files) {
            if ((selType === "file" ) || (selType === "folder")) {
                mp.commandv("loadfile", files[i], firstFile ? "replace" : "append")
                firstFile = false
            } else if (selType== "subtitle") {
                mp.commandv("sub-add", files[i], "select")
            } else if (selType== "audio") {
                mp.commandv("audio-add", files[i], "select")
            }
        }
    }

    if (selMode === "append") {
        if ((selType === "file" ) || (selType === "folder") || (selType === "url")) {
            playlistCount = 0
            for (var i in files) {
                if (mp.get_property_number("playlist-count") === 0) {
                    mp.commandv("loadfile", files[i], "replace")
                } else {
                    mp.commandv("loadfile", files[i], "append")
                }
                playlistCount = playlistCount + 1
            }

            if (selType === "file") {
                mp.osd_message("Added " + playlistCount + " file(s) to playlist")
            }

            if (selType === "folder") {
                mp.osd_message("Added " + playlistCount + " folder(s) to playlist")
            }
        }
    }

    if (selMode === "open") {
        for (var i in files) {
            if (selType === "url") {
                mp.commandv("loadfile", files[i], "replace")
            } else if (selType === "playlist") {
                mp.commandv("loadfile", files[i], "select")
            }
        }
    }
}

mp.add_key_binding(opt.addFiles, "add_files_dialog", function() { createDialog("file", "add"); })
mp.add_key_binding(opt.addFolder, "add_folder_dialog", function() { createDialog("folder", "add"); })
mp.add_key_binding(opt.appendFiles, "append_files_dialog", function() { createDialog("file", "append"); })
mp.add_key_binding(opt.appendFolder, "append_folder_dialog", function() { createDialog("folder", "append"); })
mp.add_key_binding(opt.addSubtitle, "add_subtitle_dialog", function() { createDialog("subtitle", "add"); })
// We won't add keybindings for these, but we do want to be able to use them so we'll create
// some bindings to be able to use them from scripts elsewhere
mp.add_key_binding(opt.addURL, "append_url_dialog", function() { createDialog("url", "append"); })
mp.add_key_binding(opt.openURL, "open_url_dialog", function() { createDialog("url", "open"); })
mp.add_key_binding(opt.openPlaylist, "open_playlist_dialog", function() { createDialog("playlist", "open"); })
mp.add_key_binding(opt.addAudio, "add_audio_dialog", function() { createDialog("audio", "add"); })

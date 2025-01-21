/*
 * Menu definitions and script-message registration
 * Thomas Carmichael (carmanaught) https://gitlab.com/carmanaught
 *
 * Used in concert with menu-builder.lua to create a menu. The script-message registration
 * and calling of the createMenu script are done from the definitions here as trying to
 * pass the menu definitions to the menu builder with the script-message register there
 * doesn't allow for the unloaded/loaded state to work propertly.
 *
 * Specify the menu type in the createMenu function call below. Current options are:
 * tk
 *
 * 2017-08-04 - Version 0.1 - Separation of menu building from definitions.
 * 2017-08-07 - Version 0.2 - Added second mp.register_script_message and changed original
 *                            to allow the use of different menu types by using the related
 *                            script-message name.
 * 2020-06-19 - Version 0.3 - Add script directory detection for mpv 0.32. Change video-aspect
 *                            to video-aspect-override due to deprecation.
 * 2020-11-28 - Version 0.4 - Remove script directory detection added for mpv 0.32.0. Change
 *                            filename to support mpv 0.33.0 script folders and move
 *                            menu script files into 'mpvcontextmenu' folder. Also pull in the
 *                            gui-dialogs.lua here so that all script files are kept in the new
 *                            script directory.
 * 2021-05-29 - Version 0.5 - Add file_loaded_menu value to help with showing menu when the
 *                            pseudo-gui is being used.
 * 2024-03-16 - Version 0.6 - Converted from LUA to JavaScript changing the menu building
 *                            approach by passing the JavaScript object as JSON to the menu
 *                            building scripts.
 */

var guiDialogs = require("./gui-dialogs");

var langcodes = require("./langcodes");

/**
 * Debug output helper using mp.msg.info()
 * @param {any} x Value to return, which could be anything (values, objects, etc.)
 */
function mpdebug(x) { mp.msg.info(x); }

/**
 * Get property using the best type for the property (using mpv built-in mpv.get_property_native()).
 */
var propNative = mp.get_property_native;

var watchProp = mp.observe_property;

var options = mp.options;
var opt = {
    // Play > Speed - Percentage
    playSpeed: 5,
    // Play > Seek - Seconds
    seekSmall: 5,
    seekMedium: 30,
    seekLarge: 60,
    // Video > Aspect - Percentage
    vidAspect: 0.1,
    // Video > Zoom - Percentage
    vidZoom: 0.1,
    // Video > Screen Position - Percentage
    vidPos: 0.1,
    // Video > Color - Percentage
    vidColor: 1,
    // Audio > Sync - Milliseconds
    audSync: 100,
    // Audio > Volume - Percentage
    audVol: 2,
    // Subtitle > Position - Percentage
    subPos: 1,
    // Subtitle > Scale - Percentage
    subScale: 1,
    // Subtitle > Sync
    subSync: 100, // Milliseconds
}
options.read_options(opt);

// Set some constant values
var SEP = "separator";
var CASCADE = "cascade";
var COMMAND = "command";
var CHECK = "checkbutton";
var RADIO = "radiobutton";
var AB = "ab-button";

/**
 * Round a number to a count of decimal places.
 * @param {number} num Number to round.
 * @param {number} decimalPlaces Number of decimal places to round the number to.
 * @returns Returns a number rounded to the number of decimal places specified.
 */
function round(num, decimalPlaces) {
    return Number(Math.round(num + 'e' + decimalPlaces) + 'e-' + decimalPlaces);
}

/**
 * Get the length of an object.
 * @param {object} object The object to get the length of.
 * @returns Returns a value with the length of the object
 */
function len(object) {
    return Object.keys(object).length;
}

/**
 * Table object to hold insert and remove functions to mimic LUA table.x functions
 */
var table = {
    /**
     * Adds a value (as a numeric property) to an object at the end of the current count of objects.
     * @param {object} object The object to add the value to.
     * @param {any} value The value to add to the object.
     */
    insert: function(object, value) {
        object[(len(object) + 1)] = value;
    },

    /**
     * Removes a property from an object. This can be a named property or a value. If it's a value it tries to resequence (assuming sequential numbers).
     * @param {object} object The object to remove the property from.
     * @param {any} property The property to remove from the object.
     */
    remove: function(object, property) {
        if (typeof property === "number") {
            var currentLen = len(object);
            for (var i = property; i < currentLen; i++) {
                object[i] = object[(i + 1)];
            }
            delete object[currentLen];
        } else {
            delete object[property];
        }
    }
}

/**
 * Check if there are editions and therefore whether to enable the edition menu.
 * @returns Returns boolean to indicate if the edition menu should be enabled.
 */
function enableEdition() {
    var editionState = false;

    if (propNative("edition-list/count") < 1) { editionState = true; }

    return editionState;
}

/**
 * Check that state of an edition.
 * @param {number} editionNum Edition number to check the state of.
 * @returns Returns boolean to indicate the state of the edition.
 */
function checkEdition(editionNum) {
    var editionEnable = false;
    var editionCur = propNative("current-edition");

    if (editionNum === editionCur) { editionEnable = true; }

    return editionEnable;
}

/**
 * Build the edition menu structure.
 * @returns Returns the edition menu structure.
 */
function editionMenu() {
    var editionCount = propNative("edition-list/count");
    var editionMenuVal = {};

    if (editionCount !== 0) {
        for (var editionNum = 0; editionNum < editionCount; editionNum++ ) {
            var editionTitle = propNative("edition-list/" + editionNum + "/title");
            if (!editionTitle) { editionTitle = "Edition " + (editionNum + 1); }

            var editionCommand = "set edition " + editionNum;
            editionMenuVal[(editionNum + 1)] = new menuItem(RADIO, editionTitle, "", editionCommand, function(editionNum) { return checkEdition(editionNum); }(editionNum), false, true);
        }
    } else {
        table.insert(editionMenuVal, new menuItem(COMMAND, "No Editions", "", "", "", true));
    }

    return editionMenuVal;
}

/**
 * Check if there are chapters and therefore whether to enable the chapter menu.
 * @returns Returns boolean to indicate if the chapter menu should be enabled.
 */
function enableChapter() {
    var chapterEnable = false;

    if (propNative("chapter-list/count") < 1) { chapterEnable = true; }

    return chapterEnable;
}

/**
 * Check that state of a chapter.
 * @param {number} chapterNum Chapter number to check the state of.
 * @returns Returns boolean to indicate the state of the chapter.
 */
function checkChapter(chapterNum) {
    var chapterState = false;
    var chapterCur = propNative("chapter");

    if (chapterNum === chapterCur) { chapterState = true; }

    return chapterState;
}

/**
 * Build the chapter menu structure.
 * @returns Returns the chapter menu structure.
 */
function chapterMenu() {
    var chapterCount = propNative("chapter-list/count");
    var chapterMenuVal = {};

    table.insert(chapterMenuVal, new menuItem(COMMAND, "Previous", "PgUp", "no-osd add chapter -1", "", false, true));
    table.insert(chapterMenuVal, new menuItem(COMMAND, "Next", "PgDown", "no-osd add chapter 1", "", false, true));
    table.insert(chapterMenuVal, new menuItem(SEP));

    if (chapterCount !== 0) {
        for (var chapterNum = 0; chapterNum < chapterCount; chapterNum++) {
            var chapterTitle = propNative("chapter-list/" + chapterNum + "/title");
            if (!chapterTitle) { chapterTitle = "Chapter " + (chapterNum + 1); }

            var chapterCommand = "set chapter " + chapterNum;
            table.insert(chapterMenuVal, new menuItem(RADIO, chapterTitle, "", chapterCommand, function(chapterNum) { return checkChapter(chapterNum); }(chapterNum), false, true));
        }
    }

    return chapterMenuVal;
}

/**
 * Track type count to iterate through the tracklist and get the number of tracks of the type specified.
 * @param {string} checkType Track type (video / audio / sub) to check the count.
 * @returns Returns a table of track numbers of the given type so that the track-list/N/ properties can be obtained.
 */
function trackCount(checkType) {
    var tracksCount = propNative("track-list/count");
    var trackCountVal = {};

    if (tracksCount > 0) {
        for (var i = 0; i < tracksCount; i++) {
            var trackType = propNative("track-list/" + i + "/type")
            if (trackType === checkType) { table.insert(trackCountVal, i); }
        }
    }

    return trackCountVal
}

/**
 * Check if a track is selected based on the track-list so isn't specific ta a track type.
 * @param {boolean} trackNum Track number to check the state of.
 * @returns Returns boolean to indicate the state of the track.
 */
function checkTrack(trackNum) {
    var trackState = false;
    var trackCur = propNative("track-list/" + trackNum + "/selected");

    if (trackCur === true) { trackState = true; }

    return trackState;
}

/**
 * Check if there are video tracks and therefore whether to enable the video track menu.
 * @returns Returns boolean to indicate if the video track menu should be enabled.
 */
function enableVidTrack() {
    var vidTrackEnable = false;
    var vidTracks = trackCount("video");
    var vidTracksLen = len(vidTracks);

    if (vidTracksLen < 1) { vidTrackEnable = true; }

    return vidTrackEnable;
}

/**
 * Build the video menu structure.
 * @returns Returns the video menu structure.
 */
function vidTrackMenu() {
    var vidTrackMenuVal = {};
    var vidTrackCount = trackCount("video");
    var vidTrackCountLen = len(vidTrackCount);

    if (vidTrackCountLen !== 0) {
        for (var i = 1; i <= vidTrackCountLen; i++) {
            var vidTrackNum = vidTrackCount[i];
            var vidTrackID = propNative("track-list/" + vidTrackNum + "/id");
            var vidTrackTitle = propNative("track-list/" + vidTrackNum + "/title");
            if (!vidTrackTitle) { vidTrackTitle = "Video Track " + i; }

            var vidTrackCommand = "set vid " + vidTrackID;
            table.insert(vidTrackMenuVal, new menuItem(RADIO, vidTrackTitle, "", vidTrackCommand, function(trackNum) { return checkTrack(trackNum); }(vidTrackNum), false, true));
        }
    } else {
        table.insert(vidTrackMenuVal, new menuItem (RADIO, "No Video Tracks", "", "", "", true));
    }

    return vidTrackMenuVal;
}

/**
 * Convert ISO 639-1/639-2 codes to be full length language names. The full length names are obtained by using the property accessor with the iso639_1/_2 tables stored in the langcodes.js file (require("./langcodes") above).
 * @param {string} trackLang The 2 or 3 character language code.
 * @returns Returns the full length language names.
 */
function getLang(trackLang) {
    trackLang = trackLang.toUpperCase();

    if (trackLang.length === 2) { trackLang = langcodes.iso639_1(trackLang); }
    else if (trackLang.length === 3) { trackLang = langcodes.iso639_2(trackLang); }

    return trackLang;
}

/**
 * Checks if a type of track is disabled. The track check will return a track number if not disabled and "no/false" if disabled.
 * @param {(boolean|any)} checkType Check the type (values are vid/sid/aid).
 * @returns Returns boolean to indicate if the track type provided is disabled.
 */
function noneCheck(checkType) {
    var checkVal = false;
    var trackID = propNative(checkType);

    if (typeof trackID === "boolean") {
        if (trackID === false) { checkVal = true; }
    }

    return checkVal
}

/**
 * Build the audio menu structure.
 * @returns Returns the audio menu structure.
 */
function audTrackMenu() {
    var audTrackMenuVal = {};
    var audTrackCount = trackCount("audio");
    var audTrackCountLen = len(audTrackCount);

    table.insert(audTrackMenuVal, new menuItem(COMMAND, "Open File", "", "script-binding add_audio_dialog", "", false));
    table.insert(audTrackMenuVal, new menuItem(COMMAND, "Reload File", "", "audio-reload", "", false));
    table.insert(audTrackMenuVal, new menuItem(COMMAND, "Remove", "", "audio-remove", "", false));
    table.insert(audTrackMenuVal, new menuItem(SEP));
    table.insert(audTrackMenuVal, new menuItem(COMMAND, "Select Next", "Ctrl+A", "cycle audio", "", false, true));

    if (audTrackCountLen !== 0) {
        for (var i = 1; i <= audTrackCountLen; i++) {
            var audTrackNum = audTrackCount[i];
            var audTrackID = propNative("track-list/" + audTrackNum + "/id");
            var audTrackTitle = propNative("track-list/" + audTrackNum + "/title");
            var audTrackLang = propNative("track-list/" + audTrackNum + "/lang");
            // Convert ISO 639-1/2 codes
            if (audTrackLang !== undefined) { audTrackLang = getLang(audTrackLang) ? getLang(audTrackLang) : audTrackLang; }

            if (audTrackTitle) { audTrackTitle = audTrackTitle + ((audTrackLang !== undefined) ? " (" + audTrackLang + ")" : ""); }
            else if (audTrackLang) { audTrackTitle = audTrackLang; }
            else { audTrackTitle = "Audio Track " + i; }

            var audTrackCommand = "set aid " + audTrackID;
            if (i === 1) {
                table.insert(audTrackMenuVal, new menuItem(SEP));
                table.insert(audTrackMenuVal, new menuItem(RADIO, "Select None", "", "set aid 0", function() { return noneCheck("aid"); }, false, true));
                table.insert(audTrackMenuVal, new menuItem(SEP));
            }
            table.insert(audTrackMenuVal, new menuItem(RADIO, audTrackTitle, "", audTrackCommand, function(trackNum) { return checkTrack(trackNum); }(audTrackNum), false, true));
        }
    }

    return audTrackMenuVal;
}

/**
 * Subtitle menu item label to indicate what the clicking on the menu this is associated with will do (hide if visible, un-hide if hidden).
 * @returns Returns string to indicate what the menu will do.
 */
function subVisLabel() { return propNative("sub-visibility") ? "Hide" : "Un-hide" }

/**
 * Build the subtitle menu structure.
 * @returns Returns the subtitle menu structure.
 */
function subTrackMenu() {
    var subTrackMenuVal = {};
    var subTrackCount = trackCount("sub");
    var subTrackCountLen = len(subTrackCount);

    table.insert(subTrackMenuVal, new menuItem(COMMAND, "Open File", "(Shift+F)", "script-binding add_subtitle_dialog", "", false));
    table.insert(subTrackMenuVal, new menuItem(COMMAND, "Reload File", "", "sub-reload", "", false));
    table.insert(subTrackMenuVal, new menuItem(COMMAND, "Clear File", "", "sub-remove", "", false));
    table.insert(subTrackMenuVal, new menuItem(SEP));
    table.insert(subTrackMenuVal, new menuItem(COMMAND, "Select Next", "Shift+N", "cycle sub", "", false, true));
    table.insert(subTrackMenuVal, new menuItem(COMMAND, "Select Previous", "Ctrl+Shift+N", "cycle sub down", "", false, true));
    table.insert(subTrackMenuVal, new menuItem(CHECK, function() { return subVisLabel(); }, "V", "cycle sub-visibility", function() { return !propNative("sub-visibility"); }, false, true));

    if (subTrackCountLen !== 0) {
        for (var i = 1; i <= subTrackCountLen; i++) {
            var subTrackNum = subTrackCount[i];
            var subTrackID = propNative("track-list/" + subTrackNum + "/id");
            var subTrackTitle = propNative("track-list/" + subTrackNum + "/title");
            var subTrackLang = propNative("track-list/" + subTrackNum + "/lang");
            // Convert ISO 639-1/2 codes
            if (subTrackLang !== undefined) { subTrackLang = getLang(subTrackLang) ? getLang(subTrackLang) : subTrackLang; }

            if (subTrackTitle) { subTrackTitle = subTrackTitle + ((subTrackLang !== undefined) ? " (" + subTrackLang + ")" : ""); }
            else if (subTrackLang) { subTrackTitle = subTrackLang; }
            else { subTrackTitle = "Subtitle Track " + i; }

            var subTrackCommand = "set sid " + subTrackID;
            if (i === 1) {
                table.insert(subTrackMenuVal, new menuItem(SEP));
                table.insert(subTrackMenuVal, new menuItem(RADIO, "Select None", "", "set sid 0", function() { return noneCheck("sid"); }, false, true));
                table.insert(subTrackMenuVal, new menuItem(SEP));
            }
            table.insert(subTrackMenuVal, new menuItem(RADIO, subTrackTitle, "", subTrackCommand, function(subTrackNum) { return checkTrack(subTrackNum); }(subTrackNum), false, true));
        }
    }

    return subTrackMenuVal;
}

/**
 * Get the A/B loop state.
 * @returns Returns the A/B loop state.
 */
function stateABLoop() {
    var abLoopState = "";
    var abLoopA = propNative("ab-loop-a");
    var abLoopB = propNative("ab-loop-b");

    if ((abLoopA === "no") && (abLoopB === "no")) { abLoopState = "off"; }
    else if ((abLoopA !== "no") && (abLoopB === "no")) { abLoopState = "a"; }
    else if ((abLoopA !== "no") && (abLoopB !== "no")) { abLoopState = "b"; }

    return abLoopState;
}

/**
 * Check the file infinite loop state.
 * @returns Return the file infinite loop state.
 */
function stateFileLoop() {
    var loopState = false;
    var loopval = propNative("loop-file");

    if (loopval === "inf") { loopState = true;}

    return loopState;
}

/**
 * Check the video aspect ratio for the video aspect radio menu items.
 * @param {any} ratioVal The video ratio value to check the state of.
 * @returns Returns boolean to indicate the video ratio is active/selected.
 */
function stateRatio(ratioVal) {
    // Ratios and Decimal equivalents
    // Ratios:    "4:3" "16:10"  "16:9" "1.85:1" "2.35:1"
    // Decimal: "1.333" "1.600" "1.778"  "1.850"  "2.350"
    var ratioState = false;
    var ratioCur = round(propNative("video-aspect-override"), 3);

    if ((ratioVal === "4:3") && (ratioCur === round(4/3, 3))) { ratioState = true; }
    else if ((ratioVal === "16:10") && (ratioCur === round(16/10, 3))) { ratioState = true; }
    else if ((ratioVal === "16:9") && (ratioCur === round(16/9, 3))) { ratioState = true; }
    else if ((ratioVal === "1.85:1") && (ratioCur === round(1.85/1, 3))) { ratioState = true; }
    else if ((ratioVal === "2.35:1") && (ratioCur === round(2.35/1, 3))) { ratioState = true; }

    return ratioState;
}

/**
 * Check the video rotate angle for the video rotate radio menu items.
 * @param {number} rotateVal The rotation angle number to check the state of.
 * @returns Returns boolean to indicate the video rotate angle is active/selected.
 */
function stateRotate(rotateVal) {
    var rotateState = false;
    var rotateCur = propNative("video-rotate");

    if (rotateVal === rotateCur) { rotateState = true; }

    return rotateState;
}

/**
 * Check the video alignment for the video alignment radio menu items.
 * @param {string} alignAxis The alignment axis ("x" or "y").
 * @param {number} alignPos The alignment position (-1 = X: Left, Y: Top, 0 = Center, 1 = X: Right, Y: Bottom ).
 * @returns Returns boolean to indicate the alignment is active/selected.
 */
function stateAlign(alignAxis, alignPos) {
    var alignState = false;
    var alignValX = propNative("video-align-x");
    var alignValY = propNative("video-align-y");

    if ((alignAxis === "y") && (alignPos === alignValY)) { alignState = true; }
    else if ((alignAxis === "x") && (alignPos === alignValX)) { alignState = true; }

    return alignState;
}

/**
 * Check the deinterlace state for the deinterlace radio menu items.
 * @param {boolean} deIntVal The deinterlace state to check for.
 * @returns Returns the deinterlace state.
 */
function stateDeInt(deIntVal) {
    var deIntState = false;
    var deIntCur = propNative("deinterlace");

    if (deIntVal === deIntCur) { deIntState = true };

    return deIntState;
}

/**
 * Check the video filter name to get the state of the video flip filter.
 * @param {string} flipVal String to check the video flip filter names for.
 * @returns Returns the state of the video flip filter name.
 */
function stateFlip(flipVal) {
    var vfState = false;
    var vfVals = propNative("vf");

    for (i in vfVals) {
        if (vfVals[i].hasOwnProperty("name") && vfVals[i].hasOwnProperty("enabled")) {
            if (vfVals[i]["name"] === flipVal && vfVals[i]["enabled"] === true) {
                vfState = true;
            }
        }
    }

    return vfState;
}

/**
 * Mute menu item label to indicate what the clicking on the menu this is associated with will do (mute if un-muted, un-mute if muted).
 * @returns Returns string to indicate what the menu will do.
 */
function muteLabel() { return propNative("mute") ? "Un-mute" : "Mute"; }

// Based on "mpv --audio-channels=help", reordered/renamed in part as per Bomi
var audioChannels = { 1: { 1: "Auto", 2: "auto"}, 2: { 1: "Auto (Safe)", 2: "auto-safe"}, 3: { 1: "Empty", 2: "empty"}, 4: { 1: "Mono", 2: "mono"}, 5: { 1: "Stereo", 2: "stereo"}, 6: { 1: "2.1ch", 2: "2.1"}, 7: { 1: "3.0ch", 2: "3.0"}, 8: { 1: "3.0ch (Back)", 2: "3.0(back)"}, 9: { 1: "3.1ch", 2: "3.1"}, 10: { 1: "3.1ch (Back)", 2: "3.1(back)"}, 11: { 1: "4.0ch", 2: "quad"}, 12: { 1: "4.0ch (Side)", 2: "quad(side)"}, 13: { 1: "4.0ch (Diamond)", 2: "4.0"}, 14: { 1: "4.1ch", 2: "4.1(alsa)"}, 15: { 1: "4.1ch (Diamond)", 2: "4.1"}, 16: { 1: "5.0ch", 2: "5.0(alsa)"}, 17: { 1: "5.0ch (Alt.)", 2: "5.0"}, 18: { 1: "5.0ch (Side)", 2: "5.0(side)"}, 19: { 1: "5.1ch", 2: "5.1(alsa)"}, 20: { 1: "5.1ch (Alt.)", 2: "5.1"}, 21: { 1: "5.1ch (Side)", 2: "5.1(side)"}, 22: { 1: "6.0ch", 2: "6.0"}, 23: { 1: "6.0ch (Front)", 2: "6.0(front)"}, 24: { 1: "6.0ch (Hexagonal)", 2: "hexagonal"}, 25: { 1: "6.1ch", 2: "6.1"}, 26: { 1: "6.1ch (Top)", 2: "6.1(top)"}, 27: { 1: "6.1ch (Back)", 2: "6.1(back)"}, 28: { 1: "6.1ch (Front)", 2: "6.1(front)"}, 29: { 1: "7.0ch", 2: "7.0"}, 30: { 1: "7.0ch (Back)", 2: "7.0(rear)"}, 31: { 1: "7.0ch (Front)", 2: "7.0(front)"}, 32: { 1: "7.1ch", 2: "7.1(alsa)"}, 33: { 1: "7.1ch (Alt.)", 2: "7.1"}, 34: { 1: "7.1ch (Wide)", 2: "7.1(wide)"}, 35: { 1: "7.1ch (Side)", 2: "7.1(wide-side)"}, 36: { 1: "7.1ch (Back)", 2: "7.1(rear)"}, 37: { 1: "8.0ch (Octagonal)", 2: "octagonal"} }

// Create audio key/value pairs to check against the native property
// e.g. audioPair["2.1"] = "2.1", etc.
var audioPair = {}
for (var i = 1; i <= len(audioChannels); i++) {
    audioPair[audioChannels[i][2]] = audioChannels[i][2]
}

/**
 * Check the audio channel state for the audio channel layout radio menu items.
 * @param {string} audVal The audioPair value (derived from "mpv --audio-channels=help") to check against audio-channels for.
 * @returns Returns boolean to indicate that the audio channel is active/selected.
 */
function stateAudChannel(audVal) {
    var audState = false;
    var audLayout = propNative("audio-channels");

    audState = (audioPair[audVal] === audLayout) ? true : false;

    return audState;
}

/**
 * Build the audio channel layout menu structure.
 * @returns Returns the audio channel layout menu structure.
 */
function audLayoutMenu() {
    var audLayoutMenuVal = {};

    for (var i = 1; i <= len(audioChannels); i++) {
        if (i === 3) { table.insert(audLayoutMenuVal, new menuItem(SEP)); }

        table.insert(audLayoutMenuVal, new menuItem(RADIO, audioChannels[i][1], "", "set audio-channels \"" + audioChannels[i][2] + "\"", function(ind) { return stateAudChannel(audioChannels[ind][2]); }(i), false, true));
    }

    return audLayoutMenuVal;
}

/**
 * Check the subtitle alignment location for the subtitle alignment radio menu items.
 * @param {string} subAlignVal The subtitle alignment location to check for ("top" or "bottom").
 * @returns Returns boolean to indicate that the subtitle alignment location is active/selected.
 */
function stateSubAlign(subAlignVal) {
    var subAlignState = false;
    var subAlignCur = propNative("sub-align-y");

    subAlignState = (subAlignVal === subAlignCur) ? true : false;

    return subAlignState;
}

/**
 * Checks if the subitles are displayed on letterbox (false) or video (true) for the radio menu items.
 * @param {boolean} subPosVal The subtitle position location to check for.
 * @returns Returns boolean to indicate that the subtitles position is active/selected.
 */
function stateSubPos(subPosVal) {
    var subPosState = false;
    var subPosCur = propNative("image-subs-video-resolution");

    subPosState = (subPosVal === subPosCur) ? true : false;

    return subPosState;
}

/**
 * Move the current playlist item in a nominated direction.
 * @param {string} direction Direction to move the playlist item ("up" or "down").
 */
function movePlaylist(direction) {
    var playlistPos = propNative("playlist-pos");
    var newPos = 0;
    // We'll remove 1 here to "0 index" the value since we're using it with playlist-pos
    var playlistCount = propNative("playlist-count") - 1;

    if (direction === "up") {
        newPos = playlistPos - 1
        if (playlistPos !== 0) {
            mp.commandv("plalist-move", playlistPos, newPos);
        } else {
            mp.osd_message("Can't move item up any further");
        }
    } else if (direction === "down") {
        if (playlistPos !== playlistCount) {
            newPos = playlistPos + 2;
            mp.commandv("plalist-move", playlistPos, newPos);
        } else {
            mp.osd_message("Can't move item down any further");
        }
    }
}

/**
 * Check the state of the playlist loop.
 * @returns Returns boolean to indicate if the playlist is set to loop.
 */
function statePlayLoop() {
    var loopState = false;
    var loopVal = propNative("loop-playlist");

    if (String(loopVal) !== "false") { loopState = true; }

    return loopState;
}

/**
 * Checks if the video is set to on top (true) or not (false).
 * @param {boolean} onTopVal The on top state to check for.
 * @returns Returns boolean to indicate that the on top state is active/selected.
 */
function stateOnTop(onTopVal) {
    var onTopState = false;
    var onTopCur = propNative("ontop");

    onTopState = (onTopVal === onTopCur) ? true : false;

    return onTopState;
}

/**
 * Check if a value passed is null or an empty string.
 * @param {any} itemVal The value to check.
 * @returns Returns boolean to indicate if the value is null or an empty string.
 */
function notEmpty(itemVal) {
    if (typeof(itemVal) === "boolean") { return true; }
    if (itemVal === null || itemVal === "") { return false; }
    return true;
}

/**
 * Creates a menu item object.
 * @param {string} itemType The type of item, e.g. CASCADE, COMMAND, etc. If this is a SEP, leave all other values empty.
 * @param {string} label The label for the item.
 * @param {string} accelerator The text shortcut/accelerator for the item.
 * @param {function|string} command This is the command to run when the item is clicked. Will be handled after the menu item is clicked on.
 * @param {(boolean|string)} itemState The state of the item (selected/unselected). A/B Repeat is a special case.
 * @param {boolean} itemDisable Whether to disable.
 * @param {boolean} [repostMenu] This is only for use with the Tk menu and is optional (only needed if the intent is for the menu item to cause the menu to repost).
 */
function menuItem(itemType, label, accelerator, command, itemState, itemDisable, repostMenu) {
    if (typeof itemType !== "undefined") { if (notEmpty(itemType)) { this.itemType = itemType; } }
    if (typeof label !== "undefined") { if (notEmpty(label)) { this.label = label; }}
    if (typeof accelerator !== "undefined") { if (notEmpty(accelerator)) { this.accelerator = accelerator; }}
    if (typeof command !== "undefined") { if (notEmpty(command)) { this.command = command; }}
    if (typeof itemState !== "undefined") { if (notEmpty(itemState)) { this.itemState = itemState; }}
    if (typeof itemDisable !== "undefined") { if (notEmpty(itemDisable)) { this.itemDisable = itemDisable; }}
    if (typeof repostMenu !== "undefined") { if (notEmpty(repostMenu)) { this.repostMenu = repostMenu; }}
}

/* ----------- Menu Structure Configuration Start ----------- */

var menuList = {}
var generatedMenus = {}
var buildList = [];
var newFile = false;

/* The Menu Item structure is defined above, but general things to be aware of:
 *
 * Item Type, Label and Accelerator should all evaluate to strings as a result of the return
 * from a function or be strings themselves.
 * Command can be a function or string, this will be handled after a click.
 * Item State and Item Disable should normally be boolean but can be a string for A/B Repeat.
 * Repost Menu (Optional) should only be boolean and is only needed if the value is true.
 *
 * The 'file_loaded_menu' value is used when the table is passed to the menu-engine to handle the
 * behavior of the 'playback_only' (cancellable) argument.
 */

// This is to be shown when nothing is open yet and is a small subset of the greater menu that
// will be overwritten when the full menu is created.
menuList = {
    file_loaded_menu: false,

    context_menu: {
        1: new menuItem(CASCADE, "Open", "open_menu", "", "", false),
        2: new menuItem(SEP),
        3: new menuItem(CASCADE, "Window", "window_menu", "", "", false),
        4: new menuItem(SEP),
        5: new menuItem(COMMAND, "Dismiss Menu", "", "ignore", "", false),
        6: new menuItem(COMMAND, "Quit", "", "quit", "", false),
    },

    open_menu: {
        1: new menuItem(COMMAND, "File", "Ctrl+F", "script-binding add_files_dialog", "", false),
        2: new menuItem(COMMAND, "Folder", "Ctrl+G", "script-binding add_folder_dialog", "", false),
        3: new menuItem(COMMAND, "URL", "", "script-binding open_url_dialog", "", false),
    },

    window_menu: {
        1: new menuItem(CASCADE, "Stays on Top", "staysontop_menu", "", "", false),
        2: new menuItem(CHECK, "Remove Frame", "", "cycle border", function() { return !propNative("border"); }, false, true),
        3: new menuItem(SEP),
        4: new menuItem(COMMAND, "Toggle Fullscreen", "F", "cycle fullscreen", "", false, true),
        5: new menuItem(COMMAND, "Enter Fullscreen", "", "set fullscreen \"yes\"", "", false, true),
        6: new menuItem(COMMAND, "Exit Fullscreen", "Escape", "set fullscreen \"no\"", "", false, true),
        7: new menuItem(SEP),
        8: new menuItem(COMMAND, "Close", "Ctrl+W", "quit", "", false),
    },

    staysontop_menu: {
        1: new menuItem(COMMAND, "Select Next", "", "cycle ontop", "", false, true),
        2: new menuItem(SEP),
        3: new menuItem(RADIO, "Off", "", "set ontop \"yes\"", function() { return stateOnTop(false); }, false, true),
        4: new menuItem(RADIO, "On", "", "set ontop \"no\"", function() { return stateOnTop(true); }, false, true),
    },
}

// If mpv enters a stopped state, change the change the menu back to the "no file loaded" menu
// so that it will still popup.
menuListBase = menuList;
mp.register_event("end-file", function() {
    menuList = menuListBase;
})

// DO NOT create the "playing" menu tables until AFTER the file has loaded as we're unable to
// dynamically create some menus if it tries to build the table before the file is loaded.
// A prime example is the chapter-list or track-list values, which are unavailable until
// the file has been loaded.

mp.register_event("file-loaded", function() {
    menuList = {
        file_loaded_menu: true,

        context_menu: {
            1: new menuItem(CASCADE, "Open", "open_menu", "", "", false),
            2: new menuItem(SEP),
            3: new menuItem(CASCADE, "Play", "play_menu", "", "", false),
            4: new menuItem(CASCADE, "Video", "video_menu", "", "", false),
            5: new menuItem(CASCADE, "Audio", "audio_menu", "", "", false),
            6: new menuItem(CASCADE, "Subtitle", "subtitle_menu", "", "", false),
            7: new menuItem(SEP),
            8: new menuItem(CASCADE, "Tools", "tools_menu", "", "", false),
            9: new menuItem(CASCADE, "Window", "window_menu", "", "", false),
            10: new menuItem(SEP),
            11: new menuItem(COMMAND, "Dismiss Menu", "", "ignore", "", false),
            12: new menuItem(COMMAND, "Quit", "", "quit", "", false),
        },

        open_menu: {
            1: new menuItem(COMMAND, "File", "Ctrl+F", "script-binding add_files_dialog", "", false),
            2: new menuItem(COMMAND, "Folder", "Ctrl+G", "script-binding add_folder_dialog", "", false),
            3: new menuItem(COMMAND, "URL", "", "script-binding open_url_dialog", "", false),
        },

        play_menu: {
            1: new menuItem(COMMAND, "Play/Pause", "Space", "cycle pause", "", false, true),
            2: new menuItem(COMMAND, "Stop", "Ctrl+Space", "stop", "", false),
            3: new menuItem(SEP),
            4: new menuItem(COMMAND, "Previous", "<", "playlist-prev", "", false, true),
            5: new menuItem(COMMAND, "Next", ">", "playlist-next", "", false, true),
            6: new menuItem(SEP),
            7: new menuItem(CASCADE, "Speed", "speed_menu", "", "", false),
            8: new menuItem(CASCADE, "A-B Repeat", "abrepeat_menu", "", "", false),
            9: new menuItem(SEP),
            10: new menuItem(CASCADE, "Seek", "seek_menu", "", "", false),
            11: new menuItem(CASCADE, "Title/Edition", "edition_menu", "", "", function() { return enableEdition() }),
            12: new menuItem(CASCADE, "Chapter", "chapter_menu", "", "", function() { return enableChapter() }),
        },

        speed_menu: {
            1: new menuItem(COMMAND, "Reset", "Backspace", "no-osd set speed 1.0 ; show-text \"Play Speed - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.playSpeed + "%", "=", "multiply speed " + (1 + (opt.playSpeed / 100)), "", false, true),
            4: new menuItem(COMMAND, "-" + opt.playSpeed + "%", "-", "multiply speed " + (1 - (opt.playSpeed / 100)), "", false, true),
        },

        abrepeat_menu: {
            1: new menuItem(AB, "Set/Clear A-B Loop", "R", "ab-loop", function() { return stateABLoop(); }, false, true),
            2: new menuItem(CHECK, "Toggle Infinite Loop", "", "cycle-values loop-file \"inf\" \"no\"", function() { return stateFileLoop(); }, false, true),
        },

        seek_menu: {
            1: new menuItem(COMMAND, "Beginning", "Ctrl+Home", "no-osd seek 0 absolute", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.seekSmall + " Sec", "Right", "no-osd seek " + opt.seekSmall, "", false, true),
            4: new menuItem(COMMAND, "-" + opt.seekSmall + " Sec", "Left", "no-osd seek -" + opt.seekSmall, "", false, true),
            5: new menuItem(COMMAND, "+" + opt.seekMedium + " Sec", "Up", "no-osd seek " + opt.seekMedium, "", false, true),
            6: new menuItem(COMMAND, "-" + opt.seekMedium + " Sec", "Down", "no-osd seek -" + opt.seekMedium, "", false, true),
            7: new menuItem(COMMAND, "+" + opt.seekLarge + " Sec", "End", "no-osd seek " + opt.seekLarge, "", false, true),
            8: new menuItem(COMMAND, "-" + opt.seekLarge + " Sec", "Home", "no-osd seek -" + opt.seekLarge, "", false, true),
            9: new menuItem(SEP),
            10: new menuItem(COMMAND, "Previous Frame", "Alt+Left", "frame-back-step", "", false, true),
            11: new menuItem(COMMAND, "Next Frame", "Alt+Right", "frame-step", "", false, true),
            12: new menuItem(COMMAND, "Next Black Frame", "Alt+b", "script-binding skip_scene", "", false, true),
            13: new menuItem(SEP),
            14: new menuItem(COMMAND, "Previous Subtitle", "", "no-osd sub-seek -1", "", false, true),
            15: new menuItem(COMMAND, "Current Subtitle", "", "no-osd sub-seek 0", "", false, true),
            16: new menuItem(COMMAND, "Next Subtitle", "", "no-osd sub-seek 1", "", false, true),
        },

        // Use functions returning tables, since we don't need these menus if there
        // aren't any editions or any chapters to seek through.
        edition_menu: function() { return editionMenu() },
        chapter_menu: function() { return chapterMenu() },

        video_menu: {
            1: new menuItem(CASCADE, "Track", "vidtrack_menu", "", "", function() { return enableVidTrack() }),
            2: new menuItem(SEP),
            3: new menuItem(CASCADE, "Take Screenshot", "screenshot_menu", "", "", false),
            4: new menuItem(SEP),
            5: new menuItem(CASCADE, "Aspect Ratio", "aspect_menu", "", "", false),
            6: new menuItem(CASCADE, "Zoom", "zoom_menu", "", "", false),
            7: new menuItem(CASCADE, "Rotate", "rotate_menu", "", "", false),
            8: new menuItem(CASCADE, "Screen Position", "screenpos_menu", "", "", false),
            9: new menuItem(CASCADE, "Screen Alignment", "screenalign_menu", "", "", false),
            10: new menuItem(SEP),
            11: new menuItem(CASCADE, "Deinterlacing", "deint_menu", "", "", false),
            12: new menuItem(CASCADE, "Filter", "filter_menu", "", "", false),
            13: new menuItem(CASCADE, "Adjust Color", "color_menu", "", "", false),
        },

        // Use function to return list of Video Tracks
        vidtrack_menu: function() { return vidTrackMenu() },

        screenshot_menu: {
            1: new menuItem(COMMAND, "Screenshot", "Ctrl+S", "async screenshot", "", false),
            2: new menuItem(COMMAND, "Screenshot (No Subs)", "Alt+S", "async screenshot video", "", false),
            3: new menuItem(COMMAND, "Screenshot (Subs/OSD/Scaled)", "", "async screenshot window", "", false),
        },

        aspect_menu: {
            1: new menuItem(COMMAND, "Reset", "Ctrl+Shift+R", "no-osd set video-aspect-override \"-1\" ; no-osd set video-aspect-override \"-1\" ; show-text \"Video Aspect Ratio - Reset\"", "", false, true),
            2: new menuItem(COMMAND, "Select Next", "", "cycle-values video-aspect-override \"4:3\" \"16:10\" \"16:9\" \"1.85:1\" \"2.35:1\" \"-1\" \"-1\"", "", false, true),
            3: new menuItem(SEP),
            4: new menuItem(RADIO, "4:3 (TV)", "", "set video-aspect-override \"4:3\"", function() { return stateRatio("4:3"); }, false, true),
            5: new menuItem(RADIO, "16:10 (Wide Monitor)", "", "set video-aspect-override \"16:10\"", function() { return stateRatio("16:10"); }, false, true),
            6: new menuItem(RADIO, "16:9 (HDTV)", "", "set video-aspect-override \"16:9\"", function() { return stateRatio("16:9"); }, false, true),
            7: new menuItem(RADIO, "1.85:1 (Wide Vision)", "", "set video-aspect-override \"1.85:1\"", function() { return stateRatio("1.85:1"); }, false, true),
            8: new menuItem(RADIO, "2.35:1 (CinemaScope)", "", "set video-aspect-override \"2.35:1\"", function() { return stateRatio("2.35:1"); }, false, true),
            9: new menuItem(SEP),
            10: new menuItem(COMMAND, "+" + opt.vidAspect + "%", "Ctrl+Shift+A", "add video-aspect-override " + (opt.vidAspect / 100), "", false, true),
            11: new menuItem(COMMAND, "-" + opt.vidAspect + "%", "Ctrl+Shift+D", "add video-aspect-override -" + (opt.vidAspect / 100), "", false, true),
        },

        zoom_menu: {
            1: new menuItem(COMMAND, "Reset", "Shift+R", "no-osd set panscan 0 ; show-text \"Pan/Scan - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.vidZoom + "%", "Shift+T", "add panscan " + (opt.vidZoom / 100), "", false, true),
            4: new menuItem(COMMAND, "-" + opt.vidZoom + "%", "Shift+G", "add panscan -" + (opt.vidZoom / 100), "", false, true),
        },

        rotate_menu: {
            1: new menuItem(COMMAND, "Reset", "", "set video-rotate \"0\"", "", false, true),
            2: new menuItem(COMMAND, "Select Next", "", "cycle-values video-rotate \"0\" \"90\" \"180\" \"270\"", "", false, true),
            3: new menuItem(SEP),
            4: new menuItem(RADIO, "0°", "", "set video-rotate \"0\"", function() { return stateRotate(0); }, false, true),
            5: new menuItem(RADIO, "90°", "", "set video-rotate \"90\"", function() { return stateRotate(90); }, false, true),
            6: new menuItem(RADIO, "180°", "", "set video-rotate \"180\"", function() { return stateRotate(180); }, false, true),
            7: new menuItem(RADIO, "270°", "", "set video-rotate \"270\"", function() { return stateRotate(270); }, false, true),
        },

        screenpos_menu: {
            1: new menuItem(COMMAND, "Reset", "Shift+X", "no-osd set video-pan-x 0 ; no-osd set video-pan-y 0 ; show-text \"Video Pan - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "Horizontally +" + opt.vidPos + "%", "Shift+D", "add video-pan-x " + (opt.vidPos / 100), "", false, true),
            4: new menuItem(COMMAND, "Horizontally -" + opt.vidPos + "%", "Shift+A", "add video-pan-x -" + (opt.vidPos / 100), "", false, true),
            5: new menuItem(SEP),
            6: new menuItem(COMMAND, "Vertically +" + opt.vidPos + "%", "Shift+S", "add video-pan-y -" + (opt.vidPos / 100), "", false, true),
            7: new menuItem(COMMAND, "Vertically -" + opt.vidPos + "%", "Shift+W", "add video-pan-y " + (opt.vidPos / 100), "", false, true),
        },

        screenalign_menu: {
            // Y Values: -1 = Top, 0 = Vertical Center, 1 = Bottom
            // X Values: -1 = Left, 0 = Horizontal Center, 1 = Right
            1: new menuItem(RADIO, "Top", "", "no-osd set video-align-y -1", function() { return stateAlign("y",-1); }, false, true),
            2: new menuItem(RADIO, "Vertical Center", "", "no-osd set video-align-y 0", function() { return stateAlign("y",0); }, false, true),
            3: new menuItem(RADIO, "Bottom", "", "no-osd set video-align-y 1", function() { return stateAlign("y",1); }, false, true),
            4: new menuItem(SEP),
            5: new menuItem(RADIO, "Left", "", "no-osd set video-align-x -1", function() { return stateAlign("x",-1); }, false, true),
            6: new menuItem(RADIO, "Horizontal Center", "", "no-osd set video-align-x 0", function() { return stateAlign("x",0); }, false, true),
            7: new menuItem(RADIO, "Right", "", "no-osd set video-align-x 1", function() { return stateAlign("x",1); }, false, true),
        },

        deint_menu: {
            1: new menuItem(COMMAND, "Toggle", "Ctrl+D", "cycle deinterlace", "", false, true),
            2: new menuItem(COMMAND, "Auto", "", "set deinterlace \"auto\"", "", false, true),
            3: new menuItem(SEP),
            4: new menuItem(RADIO, "Off", "", "no-osd set deinterlace \"no\"", function() { return stateDeInt(false); }, false, true),
            5: new menuItem(RADIO, "On", "", "no-osd set deinterlace \"yes\"", function() { return stateDeInt(true); }, false, true),
        },

        filter_menu: {
            1: new menuItem(CHECK, "Flip Vertically", "", "no-osd vf toggle vflip", function() { return stateFlip("vflip"); }, false, true),
            2: new menuItem(CHECK, "Flip Horizontally", "", "no-osd vf toggle hflip", function() { return stateFlip("hflip"); }, false, true),
        },

        color_menu: {
            1: new menuItem(COMMAND, "Reset", "O", "no-osd set brightness 0 ; no-osd set contrast 0 ; no-osd set hue 0 ; no-osd set saturation 0 ; show-text \"Colors - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "Brightness +" + opt.vidColor + "%", "T", "add brightness " + opt.vidColor, "", false, true),
            4: new menuItem(COMMAND, "Brightness -" + opt.vidColor + "%", "G", "add brightness -" + opt.vidColor, "", false, true),
            5: new menuItem(COMMAND, "Contrast +" + opt.vidColor + "%", "Y", "add contrast " + opt.vidColor, "", false, true),
            6: new menuItem(COMMAND, "Contrast -" + opt.vidColor + "%", "H", "add contrast -" + opt.vidColor, "", false, true),
            7: new menuItem(COMMAND, "Saturation +" + opt.vidColor + "%", "U", "add saturation " + opt.vidColor, "", false, true),
            8: new menuItem(COMMAND, "Saturation -" + opt.vidColor + "%", "J", "add saturation -" + opt.vidColor, "", false, true),
            9: new menuItem(COMMAND, "Hue +" + opt.vidColor + "%", "I", "add hue " + opt.vidColor, "", false, true),
            10: new menuItem(COMMAND, "Hue -" + opt.vidColor + "%", "K", "add hue -" + opt.vidColor, "", false, true),
        },

        audio_menu: {
            1: new menuItem(CASCADE, "Track", "audtrack_menu", "", "", false),
            2: new menuItem(CASCADE, "Sync", "audsync_menu", "", "", false),
            3: new menuItem(SEP),
            4: new menuItem(CASCADE, "Volume", "volume_menu", "", "", false),
            5: new menuItem(CASCADE, "Channel Layout", "channel_layout", "", "", false),
        },

        // Use function to return list of Audio Tracks
        audtrack_menu: function() { return audTrackMenu() },

        audsync_menu: {
            1: new menuItem(COMMAND, "Reset", "\\", "no-osd set audio-delay 0 ; show-text \"Audio Sync - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.audSync + " ms", "]", "add audio-delay " + (opt.audSync / 1000) + "", "", false, true),
            4: new menuItem(COMMAND, "-" + opt.audSync + " ms", "[", "add audio-delay -" + (opt.audSync / 1000) + "", "", false, true),
        },

        volume_menu: {
            1: new menuItem(CHECK, function() { return muteLabel(); }, "", "cycle mute", function() { return propNative("mute"); }, false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.audVol+ "%", "Shift+Up", "add volume " + opt.audVol, "", false, true),
            4: new menuItem(COMMAND, "-" + opt.audVol+ "%", "Shift+Down", "add volume -" + opt.audVol, "", false, true),
        },

        channel_layout: function() { return audLayoutMenu() },

        subtitle_menu: {
            1: new menuItem(CASCADE, "Track", "subtrack_menu", "", "", false),
            2: new menuItem(SEP),
            3: new menuItem(CASCADE, "Alightment", "subalign_menu", "", "", false),
            4: new menuItem(CASCADE, "Position", "subpos_menu", "", "", false),
            5: new menuItem(CASCADE, "Scale", "subscale_menu", "", "", false),
            6: new menuItem(SEP),
            7: new menuItem(CASCADE, "Sync", "subsync_menu", "", "", false),
        },

        // Use function to return list of Subtitle Tracks
        subtrack_menu: function() { return subTrackMenu() },

        subalign_menu: {
            1: new menuItem(COMMAND, "Select Next", "", "cycle-values sub-align-y \"top\" \"bottom\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(RADIO, "Top", "", "set sub-align-y \"top\"", function() { return stateSubAlign("top"); }, false, true),
            4: new menuItem(RADIO, "Bottom", "","set sub-align-y \"bottom\"", function() { return stateSubAlign("bottom"); }, false, true),
        },

        subpos_menu: {
            1: new menuItem(COMMAND, "Reset", "Alt+S", "no-osd set sub-pos 100 ; no-osd set sub-scale 1 ; show-text \"Subtitle Position - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.subPos + "%", "S", "add sub-pos " + opt.subPos, "", false, true),
            4: new menuItem(COMMAND, "-" + opt.subPos + "%", "W", "add sub-pos -" + opt.subPos, "", false, true),
            5: new menuItem(SEP),
            6: new menuItem(RADIO, "Display on Letterbox", "", "set image-subs-video-resolution \"no\"", function() { return stateSubPos(false); }, false, true),
            7: new menuItem(RADIO, "Display in Video", "", "set image-subs-video-resolution \"yes\"", function() { return stateSubPos(true); }, false, true),
        },

        subscale_menu: {
            1: new menuItem(COMMAND, "Reset", "", "no-osd set sub-pos 100 ; no-osd set sub-scale 1 ; show-text \"Subtitle Position - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.subScale + "%", "Shift+K", "add sub-scale " + (opt.subScale / 100), "", false, true),
            4: new menuItem(COMMAND, "-" + opt.subScale + "%", "Shift+J", "add sub-scale -" + (opt.subScale / 100), "", false, true),
        },

        subsync_menu: {
            1: new menuItem(COMMAND, "Reset", "Q", "no-osd set sub-delay 0 ; show-text \"Subtitle Delay - Reset\"", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "+" + opt.subSync + " ms", "D", "add sub-delay +" + (opt.subSync / 1000) + "", "", false, true),
            4: new menuItem(COMMAND, "-" + opt.subSync + " ms", "A", "add sub-delay -" + (opt.subSync / 1000) + "", "", false, true),
        },

        tools_menu: {
            1: new menuItem(CASCADE, "Playlist", "playlist_menu", "", "", false),
            2: new menuItem(COMMAND, "Find Subtitle (Subit)", "", "script-binding subit", "", false),
            3: new menuItem(COMMAND, "Playback Information", "Tab", "script-binding display-stats-toggle", "", false, true),
        },

        playlist_menu: {
            1: new menuItem(COMMAND, "Show", "L", "script-binding showplaylist", "", false),
            2: new menuItem(SEP),
            3: new menuItem(COMMAND, "Open", "", "script-binding open_playlist_dialog", "", false),
            4: new menuItem(COMMAND, "Save", "", "script-binding saveplaylist", "", false),
            5: new menuItem(COMMAND, "Regenerate", "", "script-binding loadfiles", "", false),
            6: new menuItem(COMMAND, "Clear", "Shift+L", "playlist-clear", "", false),
            7: new menuItem(SEP),
            8: new menuItem(COMMAND, "Append File", "", "script-binding append_files_dialog", "", false),
            9: new menuItem(COMMAND, "Append URL", "", "script_binding append_url_dialog", "", false),
            10: new menuItem(COMMAND, "Remove", "", "playlist-remove current", "", false, true),
            11: new menuItem(SEP),
            12: new menuItem(COMMAND, "Move Up", "", function() { movePlaylist("up"); }, "", function() { return (propNative("playlist-count") < 2) ? true : false; }, true),
            13: new menuItem(COMMAND, "Move Down", "", function() { movePlaylist("down"); }, "", function() { return (propNative("playlist-count") < 2) ? true : false; }, true),
            14: new menuItem(SEP),
            15: new menuItem(CHECK, "Shuffle", "", "cycle shuffle", function() { return propNative("shuffle"); }, false, true),
            16: new menuItem(CHECK, "Repeat", "", "cycle-values loop-playlist \"inf\" \"no\"", function() { return statePlayLoop(); }, false, true),
        },

        window_menu: {
            1: new menuItem(CASCADE, "Stays on Top", "staysontop_menu", "", "", false),
            2: new menuItem(CHECK, "Remove Frame", "", "cycle border", function() { return !propNative("border"); }, false, true),
            3: new menuItem(SEP),
            4: new menuItem(COMMAND, "Toggle Fullscreen", "F", "cycle fullscreen", "", false, true),
            5: new menuItem(COMMAND, "Enter Fullscreen", "", "set fullscreen \"yes\"", "", false, true),
            6: new menuItem(COMMAND, "Exit Fullscreen", "Escape", "set fullscreen \"no\"", "", false, true),
            7: new menuItem(SEP),
            8: new menuItem(COMMAND, "Close", "Ctrl+W", "quit", "", false),
        },

        staysontop_menu: {
            1: new menuItem(COMMAND, "Select Next", "", "cycle ontop", "", false, true),
            2: new menuItem(SEP),
            3: new menuItem(RADIO, "Off", "", "set ontop \"no\"", function() { return stateOnTop(false); }, false, true),
            4: new menuItem(RADIO, "On", "", "set ontop \"yes\"", function() { return stateOnTop(true); }, false, true),
        },
    }

    // This check ensures that there are no "undefined objects"/missed menu item numbers.
    for (var key in menuList) {
        if (menuList.hasOwnProperty(key)) {
            // Check that the menu is an object (ignore file_loaded_menu) as the following for
            // loop will fail otherwise due to an attempt to get the length of a boolean value.
            if (typeof(menuList[key]) === "object") {
                for (var i = 1; i <= len(menuList[key]); i++) {
                    // Check that there are no undefined objects. This could happen if the objects
                    // are missing numbers, e.g. "1: menuItem, 3: menuItem", is missing "2: menuItem"
                    if (menuList[key][i] === undefined) {
                        mpdebug("Menu \"" + key + "\" with property/index \"" + i + "\" is undefined. Confirm that the property exists.")
                        mp.osd_message("Menu structure check failed!")
                        return;
                    }
                }
            }
            if (typeof(menuList[key]) === "function") {
                generatedMenus[key] = menuList[key];
            }
        }
    }

    // Set this value to indicate that a file is newly loaded.
    newFile = true;
})

// Hold a list of properties to observe to determine what menus should be
// rebuilt. This helps reduce the need to iterate through menu rebuild
// functions when only certain properties have changed.
rebuildWatch = {
    // Properties to watch for menus that can be independently rebuilt
    "vid": "vidtrack_menu",
    "aid": "audtrack_menu",
    "audio-channels": "channel_layout",
    "sid": "subtrack_menu",
    "sub-visibility": "subtrack_menu",
    "track-list/count": ["audtrack_menu", "subtrack_menu"],
    "chapter-list": "chapter_menu",
    "chapter": "chapter_menu",
    "edition-list": "edition_menu",
    "edition": "edition_menu",

    // Properties to watch for the base menu rebuild
    "video-aspect-override": "context_menu",
    "video-rotate": "context_menu",
    "video-align-x": "context_menu",
    "video-align-y": "context_menu",
    "deinterlace": "context_menu",
    "vf": "context_menu",
    "mute": "context_menu",
    "sub-align-y": "context_menu",
    "image-subs-video-resolution": "context_menu",
    "ab-loop-a": "context_menu",
    "ab-loop-b": "context_menu",
    "loop-file": "context_menu",
    "shuffle": "context_menu",
    "loop-playlist": "context_menu",
    "playlist-count": "context_menu",
    "ontop": "context_menu",
    "border": "context_menu",
}

/* ----------- Menu Structure Configuration End ----------- */

var menuEngine = require("./menu-engine");

mp.register_script_message("mpv_context_menu_tk", function() {
    menuEngine.createMenu(menuList, "context_menu", -1, -1, "tk");
})

mp.register_script_message("mpv_context_menu_gtk", function() {
    menuEngine.createMenu(menuList, "context_menu", -1, -1, "gtk");
})

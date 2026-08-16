var utils = mp.utils;

/**
 * Check if we're in a flatpak so we know to whether to use "flatpak-spawn --host" command which requires the org.freedesktop.Flatpak talk-name to be enabled.
 * @returns Returns a boolean to indicate if we're in a flatpak.
 */
function check() {
    var flatpak = false;
    envList = utils.get_env_list();
    for (var key in envList) {
        if (envList.hasOwnProperty(key)) {
            if (envList[key].match(/FLATPAK_ID=/) && !envList[key].match(/PS1=/)) {
                flatpak = true;
            }
        }
    }

    return flatpak;
}

module.exports = {
    check: check
}

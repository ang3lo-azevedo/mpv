`The config is still in experimental phase`

# TODO

> - [ ]  Add the [mpv-auto-chapters](https://github.com/po5/mpv-auto-chapters) script
> - [ ]  Fix [load-subdirs](scripts/load-subdirs/main.lua) by changing the way the appends are handled (Make a map with all the appends and then set them all at once probably)
> - [ ]  Improve [conf/quality/quality.conf](conf/quality/quality.conf) with [classicjazz mpv.conf](https://github.com/classicjazz/mpv-config/blob/master/mpv.conf)
> - [ ]  Fix the script-opts-append on the [/conf/scripts/**/*.conf](conf/scripts/) files
> - [ ]  Fix [mpvcontextmenu](scripts/utils/ui/context-menu/mpvcontextmenu.lua)
> - [ ]  Add rest of the scripts to the [manager](scripts/scripts-manager/mpv_manager/manager.json)
> - [ ]  Update the [scripts-manager](scripts/scripts-manager/mpv_manager/main.lua) script
> - [ ]  Update the [trakt-mpv](scripts/utils/tracking/trakt-mpv/main.lua) script
> - [ ]  Update the [trakt-mpv](scripts/utils/tracking/trakt-mpv/trakt-mpv.py) helper to be rewritten in Rust™️

# 

This is my personal configuration and collection of scripts and shaders for mpv.
The configurations have been made to be used on Linux.

# Configs

> - [netflix-subtitles](conf/netflix-subtitles) - For having the subtitles as close as possible to the ones on Netflix
> - [vuality](conf/video) - For having the best video quality possible
> - [audio](conf/audio) - For having the best audio quality possible

# Scripts

## Script Managing

> - [mpv_manager](scripts/scripts-manager/mpv_manager) - For managing all the other scripts and shaders (All the other scripts are defined in the manager.json file)

## Script Loading

> - [load-subdirs](scripts/load-subdirs) - For loading all the scripts main.* and all the conf files from the scripts/ and conf/ subdirectories

## UI

### OSC

> - [ModernZ](https://github.com/Samillion/ModernZ) - As the UI for the OSC

### Thumbnails

> - [thumbfast](https://github.com/po5/thumbfast) - To show thumbnails on the OSC

### Pause Indicator

> - [pause-indicator](https://github.com/thisisshihan/mpv-player-config-snad/tree/mpv-config-snad-windows-ubuntu-linux-macos/removed_conf/scripts/pause-indicator.lua) - To show a pause/resume indicator

### Context Menu

> - [mpvcontextmenu](https://gitlab.com/carmanaught/mpvcontextmenu/) - To show a context menu on the OSC

### Subtitles

> - [mpv-autosub](scripts/subtitles/mpv-autosub) - To download subtitles automatically (using subliminal)


## Utilities

> - [SmartSkip](https://github.com/Eisa01/mpv-scripts/blob/master/scripts/SmartSkip.lua) - To be able to skip intros, outros and previews
> - [recent](https://github.com/hacel/recent) - To show the most recent files

### Tracking

> - [trakt-mpv](scripts/utils/tracking/trakt-mpv) - To have automatic scrobbling to trakt.tv

# Shaders

> - [Anime4K](https://github.com/bloc97/Anime4K) - For upscaling anime
> - [Tsubajashi config shaders](https://github.com/Tsubajashi/mpv-settings/tree/master/shaders) - All the shaders used in the Tsubajashi config

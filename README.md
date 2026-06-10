# Ângelo's MPV Config

> **Note:** This config is still in the experimental phase.

This repository is my personal configuration and collection of scripts and shaders for [mpv](https://mpv.io/). The configuration was made to work on Linux, but it should still work well on other operating systems.

---

## MPV Manager

A major feature of this configuration is the custom `mpv_manager` system designed to automatically keep all 3rd-party scripts, shaders, and utilities perfectly up to date.

* **GitHub Actions:** An automated workflow runs every Sunday at midnight to fetch upstream updates directly into this repository.
* **Declarative Configuration:** The script map is defined simply in [`manager.json`](scripts/scripts-manager/mpv_manager/manager.json), allowing mapping of GitHub repositories and directories to local paths.
* **Modular Support:** It seamlessly parses whole repositories or single standalone `.lua` scripts, extracting them to their exact necessary locations.
* **Local Runner:** If you do not wish to use GitHub Actions, you can run the [manager script](scripts/scripts-manager/mpv_manager/main.lua) manually inside mpv.

---

## Core Configurations

* [**Video (`vuality`)**](conf/video) - Configured for the highest possible video quality.
* [**Audio (`audio`)**](conf/audio) - Configured for the best possible audio fidelity.
* [**Netflix Subtitles**](conf/netflix-subtitles) - Styled to look identical to Netflix subtitles.

---

## Scripts Included

### System & Management
* [**mpv_manager**](scripts/scripts-manager/mpv_manager) - Manages downloading and updating all scripts.
* [**load-subdirs**](scripts/load-subdirs) - Automatically loads all `main.*` and `.conf` files from subdirectories.

### User Interface (UI)
* [**ModernZ**](https://github.com/Samillion/ModernZ) - A modern UI replacement for the default OSC.
* [**Thumbfast**](https://github.com/po5/thumbfast) - Generates high-performance thumbnails on the OSC timeline.
* [**Pause Indicator**](https://github.com/thisisshihan/mpv-player-config-snad/tree/mpv-config-snad-windows-ubuntu-linux-macos/removed_conf/scripts/pause-indicator.lua) - Displays a sleek play/pause indicator on screen.
* [**Context Menu**](https://gitlab.com/carmanaught/mpvcontextmenu/) - A right-click context menu within mpv.
* [**Interactive Video**](https://github.com/mosquito-byte/mpv-interactive-video) - Support for interactive branching videos.

### Utilities & Playback
* [**Notify Skip**](https://github.com/allecsc/Stremio-Kai) - Advanced chapter and silence-based skipping for anime/TV intros.
* [**Smart Track Selector**](https://github.com/allecsc/Stremio-Kai) - Automatically selects the best audio and subtitle tracks.
* [**Profile Manager**](https://github.com/allecsc/Stremio-Kai) - Dynamically applies configurations and shader presets based on content.
* [**mpv-auto-chapters**](https://github.com/po5/mpv-auto-chapters) - Automatically generates chapters based on video silence and black frames.
* [**Reactive VF Bypass**](https://github.com/allecsc/Stremio-Kai) - Bypasses video filters efficiently when not needed.
* [**SVP Cleanup**](https://github.com/allecsc/Stremio-Kai) - Cleanup tools for SmoothVideo Project (SVP) integration.
* [**Recent**](https://github.com/hacel/recent) - Keeps track of recently watched files.
* [**mpv-autosub**](https://github.com/davidde/mpv-autosub) - Automatically downloads missing subtitles using Subliminal.

### Tracking
* [**trakt-mpv**](scripts/utils/tracking/trakt-mpv) - Automatic scrobbling of watch history to Trakt.tv.
* [**mpv-anilist-updater**](https://github.com/AzuredBlue/mpv-anilist-updater) - Automatically updates your anime watch status on AniList.

---

## Shaders & Video Processing

Dynamic shader profiles are automatically applied using the Profile Manager.

* [**Anime4K**](https://github.com/bloc97/Anime4K) - Real-time anime upscaling, denoising, and debanding.
* [**NLMeans & Denoise**](shaders/) - Standard mpv noise reduction shaders.
* [**Tsubajashi Shaders**](https://github.com/Tsubajashi/mpv-settings/tree/master/shaders) - Collection of shaders from the Tsubajashi configuration.

---

## Credits

A huge thank you to the original creators whose scripts, configurations, and shaders have been adapted and included in this repository:
* [**allecsc**](https://github.com/allecsc) for the incredible Stremio-Kai suite (Notify Skip, Profile Manager, Smart Track Selector, etc.).
* [**Samillion**](https://github.com/Samillion) for the ModernZ user interface.
* [**po5**](https://github.com/po5) for Thumbfast and mpv-auto-chapters.
* [**bloc97**](https://github.com/bloc97) for the amazing Anime4K shaders.
* [**Tsubajashi**](https://github.com/Tsubajashi), [**thisisshihan**](https://github.com/thisisshihan), [**carmanaught**](https://gitlab.com/carmanaught), [**mosquito-byte**](https://github.com/mosquito-byte), [**hacel**](https://github.com/hacel), [**davidde**](https://github.com/davidde), and [**AzuredBlue**](https://github.com/AzuredBlue) for their various utilities and playback enhancements.

---

See [TODO.md](TODO.md) for the list of planned improvements and bug fixes.

# mpv_manager

> This script is based on [mpv_manager](https://github.com/po5/mpv_manager) with some changes to work with my structure of the scripts.

# mpv_manager
User script and shader manager for mpv.

## Requirements
- git

## Installation
Place manager.json next to your `mpv.conf`, and manager.lua in your `scripts` folder.

## Usage
Define your rules in `manager.json`  
Assign a key to the update function with `M script-binding manager-update-all` in `input.conf`
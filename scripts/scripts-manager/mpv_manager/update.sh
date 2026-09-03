#!/usr/bin/env sh

set -eu

MPV_MANAGER_ONESHOT=1 \
MPV_MANAGER_TARGETS="~~/input.conf,~~/mpv.conf,~~/svp_anime.vpy,~~/svp_cinema.vpy,~~/scripts/ui/other/thumbnails/thumbfast/thumbfast.lua" \
exec timeout 10m mpv \
    --config-dir="$HOME/.config/mpv" \
    --no-audio \
    --force-window=no \
    --idle=yes

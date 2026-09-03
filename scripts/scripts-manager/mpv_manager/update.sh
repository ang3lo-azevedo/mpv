#!/usr/bin/env sh

set -eu

MPV_MANAGER_ONESHOT=1 \
exec timeout 10m mpv \
    --config-dir="$HOME/.config/mpv" \
    --no-audio \
    --force-window=no \
    --idle=yes

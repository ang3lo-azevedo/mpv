local mp = require 'mp'

local function on_start_file()
    local path = mp.get_property("path", "")
    if path:match("^http") or path:match("^magnet") then
        -- Show loading message for up to 60 seconds
        mp.osd_message("⏳ Loading Network Stream...", 60)
    end
end

local function on_playback_restart()
    -- Clear the message instantly once playback actually starts
    mp.osd_message("", 0)
end

mp.register_event("start-file", on_start_file)
mp.register_event("playback-restart", on_playback_restart)

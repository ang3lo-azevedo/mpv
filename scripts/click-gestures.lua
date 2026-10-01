local mp = require 'mp'

-- Seconds the button must stay down before playback speeds up
local HOLD_DELAY = 0.4
local HOLD_SPEED = 2
local SEEK_SECONDS = 10
-- Fraction of the window on each side that seeks on double click, the rest toggles fullscreen
local SIDE_WIDTH = 1 / 3

local hold_timer, single_timer = nil, nil
local speed_before_hold = nil
local clicks, last_click = 0, 0

local function side()
    local mx = mp.get_mouse_pos()
    local w = mp.get_osd_size()
    if mx == nil or w == nil or w == 0 then return "middle" end
    if mx < w * SIDE_WIDTH then return "left" end
    if mx > w * (1 - SIDE_WIDTH) then return "right" end
    return "middle"
end

local function on_down()
    hold_timer = mp.add_timeout(HOLD_DELAY, function()
        hold_timer = nil
        -- Speeding up does nothing while paused: let the release count as a normal click
        if mp.get_property_native("pause") then return end
        speed_before_hold = mp.get_property_number("speed", 1)
        mp.set_property_number("speed", speed_before_hold * HOLD_SPEED)
        mp.osd_message(string.format("%gx", speed_before_hold * HOLD_SPEED), 3600)
    end)
end

local function on_up()
    if hold_timer then
        hold_timer:kill()
        hold_timer = nil
    end
    if speed_before_hold then
        mp.set_property_number("speed", speed_before_hold)
        speed_before_hold = nil
        mp.osd_message("", 0)
        return
    end

    local now = mp.get_time()
    local window = mp.get_property_number("input-doubleclick-time", 300) / 1000
    clicks = (now - last_click <= window) and clicks + 1 or 1
    last_click = now

    if single_timer then
        single_timer:kill()
        single_timer = nil
    end

    if clicks == 1 then
        -- Wait before pausing so a double click does not flicker pause on its first click
        single_timer = mp.add_timeout(window, function()
            single_timer = nil
            mp.commandv("cycle", "pause")
        end)
        return
    end

    -- Every extra click after the second keeps seeking
    local where = side()
    if where == "left" then
        mp.commandv("seek", -SEEK_SECONDS, "relative")
        mp.osd_message(string.format("-%ds", SEEK_SECONDS * (clicks - 1)), 1)
    elseif where == "right" then
        mp.commandv("seek", SEEK_SECONDS, "relative")
        mp.osd_message(string.format("+%ds", SEEK_SECONDS * (clicks - 1)), 1)
    elseif clicks == 2 then
        mp.commandv("cycle", "fullscreen")
    end
end

mp.add_forced_key_binding("MBTN_LEFT", "click", function(e)
    if e.event == "down" then
        on_down()
    elseif e.event == "up" or e.event == "press" then
        on_up()
    end
end, { complex = true })

-- mpv sends MBTN_LEFT_DBL on top of the second MBTN_LEFT: swallow it, double clicks are counted above
mp.add_forced_key_binding("MBTN_LEFT_DBL", "double-click", function() end)

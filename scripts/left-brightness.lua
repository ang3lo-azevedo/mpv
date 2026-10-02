local mp = require 'mp'

local BRIGHTNESS_CMD = os.getenv("HOME") .. "/.config/waybar/scripts/monitor-brightness.sh"
local STEP = 2
-- Seconds without scrolling before the level is read from the screen again,
-- so changes made outside mpv are picked up
local STALE_AFTER = 2

local level, level_output, last_scroll = nil, nil, 0

-- Output the mpv window is on, e.g. "eDP-1" or "DP-3"
local function current_output()
    local names = mp.get_property_native("display-names")
    return names and names[1]
end

local function read_level(output)
    local res = mp.command_native({
        name = "subprocess",
        args = { BRIGHTNESS_CMD, "get", output },
        capture_stdout = true,
        playback_only = false,
    })
    return res and res.status == 0 and tonumber(res.stdout) or nil
end

local function change_brightness(direction)
    local mx, my = mp.get_mouse_pos()
    local w, h = mp.get_osd_size()
    if mx == nil or w == nil or w == 0 then return false end

    -- If mouse is on the left half of the screen
    if mx < w * 0.5 then
        local output = current_output()
        if not output then return true end

        local now = mp.get_time()
        if level == nil or output ~= level_output or now - last_scroll > STALE_AFTER then
            level = read_level(output)
            level_output = output
        end
        last_scroll = now
        if level == nil then return true end

        level = math.max(0, math.min(100, level + (direction == "up" and STEP or -STEP)))

        -- External monitors are slow to answer: do not block the player on every wheel step
        mp.command_native_async({
            name = "subprocess",
            args = { BRIGHTNESS_CMD, "set", tostring(level), output },
            playback_only = false,
        }, function() end)

        mp.osd_message(string.format("Screen Brightness: %d%%", level), 1.5)
        return true
    end
    return false
end

mp.add_key_binding("WHEEL_UP", "wheel_up_handler", function()
    if not change_brightness("up") then
        mp.command("add volume 2")
    end
end)

mp.add_key_binding("AXIS_UP", "axis_up_handler", function()
    if not change_brightness("up") then
        mp.command("add volume 2")
    end
end)

mp.add_key_binding("WHEEL_DOWN", "wheel_down_handler", function()
    if not change_brightness("down") then
        mp.command("add volume -2")
    end
end)

mp.add_key_binding("AXIS_DOWN", "axis_down_handler", function()
    if not change_brightness("down") then
        mp.command("add volume -2")
    end
end)

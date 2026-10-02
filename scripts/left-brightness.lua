local mp = require 'mp'

local function change_brightness(direction)
    local mx, my = mp.get_mouse_pos()
    local w, h = mp.get_osd_size()
    if mx == nil or w == nil or w == 0 then return false end

    -- If mouse is on the left half of the screen
    if mx < w * 0.5 then
        local delta = direction == "up" and "+2%" or "2%-"
        local res = mp.command_native({
            name = "subprocess",
            args = { "brightnessctl", "set", delta, "-q" },
            capture_stdout = false,
            playback_only = false,
        })
        
        -- After setting it, read it to get the current percentage
        local info = mp.command_native({
            name = "subprocess",
            args = { "brightnessctl", "i" },
            capture_stdout = true,
            playback_only = false,
        })

        if info and info.status == 0 thensa
            local level = string.match(info.stdout, "(%d+)%%")
            if level then
                mp.osd_message(string.format("Screen Brightness: %s%%", level), 1.5)
            end
        end
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

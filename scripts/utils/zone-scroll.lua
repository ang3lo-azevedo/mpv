local mp = require 'mp'

local function handle_scroll(dir)
    local mouse = mp.get_property_native("mouse-pos")
    if not mouse then return end

    local w = mp.get_property_number("osd-width") or 1920
    
    if mouse.x < w / 2 then
        -- Left side: Brightness
        if dir == "up" then
            mp.commandv("add", "brightness", 5)
            mp.osd_message("Brightness: " .. (mp.get_property("brightness") or 0))
        else
            mp.commandv("add", "brightness", -5)
            mp.osd_message("Brightness: " .. (mp.get_property("brightness") or 0))
        end
    else
        -- Right side: Volume
        if dir == "up" then
            mp.commandv("add", "volume", 5)
            mp.osd_message("Volume: " .. (mp.get_property("volume") or 0))
        else
            mp.commandv("add", "volume", -5)
            mp.osd_message("Volume: " .. (mp.get_property("volume") or 0))
        end
    end
end

mp.add_forced_key_binding("WHEEL_UP", "scroll_up", function() handle_scroll("up") end)
mp.add_forced_key_binding("WHEEL_DOWN", "scroll_down", function() handle_scroll("down") end)

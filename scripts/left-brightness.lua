local mp = require 'mp'

local function change_brightness(direction)
    local mx, my = mp.get_mouse_pos()
    local w, h = mp.get_osd_size()
    if mx == nil or w == nil or w == 0 then return false end
    
    -- If mouse is on the left half of the screen
    if mx < w * 0.5 then
        local delta = direction == "up" and "2%+" or "2%-"
        os.execute("brightnessctl set " .. delta .. " > /dev/null 2>&1")
        
        -- Show osd message
        local handle = io.popen("brightnessctl g 2>/dev/null")
        local current = handle:read("*a")
        handle:close()
        local handle2 = io.popen("brightnessctl m 2>/dev/null")
        local max = handle2:read("*a")
        handle2:close()
        
        if current and max and current ~= "" and max ~= "" then
            local pct = math.floor((tonumber(current) / tonumber(max)) * 100)
            mp.osd_message(string.format("Screen Brightness: %d%%", pct), 1.5)
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

mp.add_key_binding("WHEEL_DOWN", "wheel_down_handler", function()
    if not change_brightness("down") then
        mp.command("add volume -2")
    end
end)

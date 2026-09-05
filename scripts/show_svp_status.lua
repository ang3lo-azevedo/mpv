local mp = require("mp")

mp.register_script_message("show-svp-status", function(name)
    -- Add a tiny delay to ensure the video filter toggle has fully applied
    mp.add_timeout(0.05, function()
        local is_on = false
        local vf = mp.get_property_native("vf") or {}
        
        for _, f in ipairs(vf) do
            if f.enabled and (f.label == "SVP" or (f.name and f.name:find("vapoursynth", 1, true))) then
                is_on = true
                break
            end
        end

        mp.osd_message(name .. ": " .. (is_on and "ON" or "OFF"), 3000)
    end)
end)

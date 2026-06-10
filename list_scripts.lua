local mp = require 'mp'
mp.register_event("start-file", function()
    for _, s in ipairs(mp.get_property_native("script-list") or {}) do
        print("LOADED SCRIPT: " .. s.name .. " from " .. (s.filename or "unknown"))
    end
end)

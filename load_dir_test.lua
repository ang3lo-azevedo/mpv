local mp = require 'mp'
mp.register_event("file-loaded", function()
    local dir = mp.command_native({"expand-path", "~~/scripts/ui/other/thumbnails/thumbfast"})
    mp.commandv("load-script", dir)
    for _, s in ipairs(mp.get_property_native("script-list") or {}) do
        print("LOADED SCRIPT: " .. s.name .. " from " .. (s.filename or "unknown"))
    end
end)

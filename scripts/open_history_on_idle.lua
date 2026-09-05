local mp = require("mp")

local function show_history()
    if mp.get_property_bool("idle-active", false) then
        mp.commandv("script-binding", "memo-history")
    end
end

-- Also show history automatically when a video finishes and mpv returns to idle state
mp.register_event("idle", function()
    mp.add_timeout(0.1, show_history)
end)

-- If mpv exits idle mode (e.g. a link is pasted or file is dropped), instantly close the menu
mp.observe_property("idle-active", "bool", function(name, is_idle)
    if is_idle == false then
        mp.commandv("script-message-to", "uosc", "close-menu", "memo-history")
        mp.commandv("script-message-to", "memo", "memo-clear")
    end
end)

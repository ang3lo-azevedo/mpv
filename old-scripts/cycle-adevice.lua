local api = "wasapi"
local deviceList = mp.get_property_native("audio-device-list")
local aid = 1
local function cycle_adevice(s, e, d)
    mp.enable_messages("error")
    while s ~= e + d do -- until the loop would cycle back to the number we started on
        if string.find(mp.get_property("audio-device"), deviceList[s].name, 1, true) then
            while true do
                if s + d == 0 then       --the device list starts at 1; 0 means we iterated to far
                    s = #deviceList + 1  --so lets restart at the last device
                elseif s + d == #deviceList + 1 then --we iterated past the last device
                    s = 0                --then start from the beginning
                end
                s = s + d                --next device
                if string.find(deviceList[s].name, api, 1, true) then
                    mp.set_property("audio-device", deviceList[s].name)
                    deviceList[s].description = "•" .. string.match(deviceList[s].description, "[^%(]+")
                    local list = "AUDIO DEVICE:\n"
                    for i = 1, #deviceList do
                        if string.find(deviceList[i].name, api, 1, true) then
                            if deviceList[i].name ~= deviceList[s].name then list = list .. "◦" end
                            list = list .. string.match(deviceList[i].description, "[^%(]+") .. "\n"
                        end
                    end
                    if mp.get_property("vid") == "no" then
                        print("audio=" .. deviceList[s].description)
                    else
                        mp.osd_message(list, 3)
                    end
                    mp.set_property("aid", aid)
                    mp.command("seek 0 exact")
                    return
                end
            end
        end
        s = s + d
    end
end

mp.observe_property("aid", function(id)
    if id ~= "no" then aid = id end
end)

mp.register_event("log-message", function(event)
    if event.text:find("Try unsetting it") then
        mp.set_property("audio-device", "auto")
        mp.set_property("aid", aid)
    end
end)

mp.add_key_binding("A", "cycle_adevice", function()
    deviceList = mp.get_property_native("audio-device-list")
    cycle_adevice(1, #deviceList, 1) --'s'tart at device 1, 'e'nd at last device, iterate forward 'd'elta=1
end)

mp.add_key_binding("Ctrl+a", "cycleBack_adevice", function()
    deviceList = mp.get_property_native("audio-device-list")
    cycle_adevice(#deviceList, 1, -1) --'s'tart at last device, 'e'nd at device 1, iterate backward 'd'elta=-1
end)
mp.register_event("file-loaded", function()
    local res = mp.command_native_async({name = "subprocess", args = {"ls"}, env = "PATH=/usr/bin"}, function() print("Done") end)
    print("res: " .. tostring(res))
end)

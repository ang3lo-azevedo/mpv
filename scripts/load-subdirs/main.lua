local utils = require("mp.utils")
local msg = require("mp.msg")

--[[
* Load a conf file from a path and process profiles if present
* @param path The path to load the conf file from
]]
function load_conf_from_path(path)
    msg.debug("Loading config: " .. path)
    local file = io.open(path, "r")
    if not file then
        msg.error("Could not open config file: " .. path)
        return
    end

    local current_profile = nil
    local success, err = pcall(function()
        for line in file:lines() do
            -- Skip comments and empty lines
            if not line:match("^%s*#") and not line:match("^%s*$") then
                -- Check if line starts a new profile
                local profile_name = line:match("^%s*%[([^%]]+)%]%s*$")
                if profile_name then
                    current_profile = profile_name
                    msg.debug("Found profile: " .. profile_name)
                else
                    -- Split line into key and value
                    local key, value = line:match("^%s*([^=]+)%s*=%s*(.+)%s*$")
                    if key and value then
                        -- Remove inline comments and trailing whitespace
                        key = key:gsub("%s+$", "")
                        value = value:gsub("%s+#.*$", "")
                        value = value:gsub("%s+$", "")
                        value = value:gsub("^'(.*)'$", "%1")
                        
                        -- If we're in a profile, prefix the key with profile name
                        if current_profile then
                            key = "profile-" .. current_profile .. "-" .. key
                        end
                        
                        -- Check if key ends with -append and handle accordingly
                        local base_key = key:match("^(.+)-append$")
                        if base_key then
                            -- For -append, get existing value and append new value
                            local current = mp.get_property(base_key, "")
                            if current ~= "" then
                                value = current .. "," .. value
                            end
                            key = base_key
                        end
                        
                        msg.debug("Setting " .. key .. "-> " .. value)
                        mp.set_property(key:gsub("%s+$", ""), value)
                    end
                end
            end
        end
    end)

    file:close()

    if not success then
        msg.error("Failed to load config " .. path .. ": " .. err)
    end
end

--[[
* Load a script from a path
* @param path The path to load the script from
]]
function load_script_from_path(path)
    msg.debug("Loading script: " .. path)

    local success, err = pcall(function()
        -- Load the script
        mp.commandv("load-script", path)
    end)
    if not success then
        msg.error("Failed to load script " .. path .. ": " .. err)
    end
end

--[[
* Load all scripts and config files from a directory
* @param dir The directory to load scripts and config files from
]]
function load_from_dir(dir)
    local files = utils.readdir(dir)
    local profile_confs = {}

    if not files then
        msg.warn("Could not read directory: " .. dir)
        return
    end

    for _, file in ipairs(files) do
        local path = utils.join_path(dir, file)
        local info = utils.file_info(path)

        if info and info.is_dir and not file:match("^%.") then
            -- Check if the directory is the load-subdirs directory
            if file == "load-subdirs" then
                msg.debug("Skipping load-subdirs directory: " .. path)
            else
                -- Recursively load scripts from subdirectories, ignoring hidden dirs
                msg.debug("Entering directory: " .. path)
                load_from_dir(path)
            end
        elseif info and info.is_file and file:match("%.conf$") then
            -- Store profiles/*.conf files to load them later
            if path:match("profiles[/\\].*%.conf$") then
                table.insert(profile_confs, path)
            else
                -- Load non-profile .conf files immediately
                load_conf_from_path(path)
            end
        elseif info and info.is_file and file:match("^main[%.]?.*$") then
            -- Load script files
            load_script_from_path(path)
        end
    end

    -- Load profile configs after all other configs
    for _, profile_path in ipairs(profile_confs) do
        load_conf_from_path(profile_path)
    end
end

-- Get the mpv directory path
local mpv_dir = mp.command_native({"expand-path", "~~/"})
msg.info("Loading config files from: " .. mpv_dir)

-- Load all config and script files recursively from the mpv directory
load_from_dir(mpv_dir)
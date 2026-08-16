local utils = require("mp.utils")
local msg = require("mp.msg")

local properties = {}
local regular_confs = {}
local profile_confs = {}
local script_files = {}

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
                            -- Collect into our properties map
                            local current = properties[base_key] or mp.get_property(base_key, "")
                            if current ~= "" then
                                properties[base_key] = current .. "," .. value
                            else
                                properties[base_key] = value
                            end
                        else
                            properties[key] = value
                        end
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
* Scan a directory recursively and organize files by type
* @param dir The directory to scan
]]
function scan_dir(dir)
    local files = utils.readdir(dir)
    if not files then return end

    -- Sort files to guarantee deterministic loading order
    table.sort(files)

    for _, file in ipairs(files) do
        local path = utils.join_path(dir, file)
        local info = utils.file_info(path)

        if info and info.is_dir and not file:match("^%.") then
            -- Skip the load-subdirs folder to avoid infinite loops or self-loading
            if file ~= "load-subdirs" then
                scan_dir(path)
            end
        elseif info and info.is_file then
            if file:match("%.conf$") then
                -- Store profiles/*.conf files to load them later
                if path:match("profiles[/\\].*%.conf$") then
                    table.insert(profile_confs, path)
                else
                    table.insert(regular_confs, path)
                end
            elseif file:match("%.lua$") then
                -- Exclude 'load-subdirs' self-loading and 'modules/' subdirectories used by some scripts (like notify_skip)
                if file ~= "main.lua" or not path:match("[/\\]load%-subdirs[/\\]") then
                    if not path:match("[/\\]modules[/\\]") and not path:match("[/\\]elements[/\\]") and not path:match("[/\\]lib[/\\]") and not path:match("[/\\]script%-opts[/\\]") and not path:match("[/\\]imgs[/\\]") then
                        -- Also skip if this is a directory script that MPV already loaded (top-level folders with main.lua)
                        -- For safety, just don't load anything but main.lua if the folder has a main.lua
                        print("FOUND SCRIPT: " .. path); table.insert(script_files, path)
                    end
                end
            end
        end
    end
end

-- Get the mpv directory path
local mpv_dir = mp.command_native({"expand-path", "~~/"})
local conf_dir = utils.join_path(mpv_dir, "conf")
local scripts_dir = utils.join_path(mpv_dir, "scripts")

msg.info("Scanning directories: " .. conf_dir .. " and " .. scripts_dir)

-- 1. Scan target directories (avoids crawling irrelevant folders like ~/.git)
scan_dir(conf_dir)
scan_dir(scripts_dir)

-- 2. Load configurations into properties map
for _, path in ipairs(regular_confs) do
    load_conf_from_path(path)
end
for _, path in ipairs(profile_confs) do
    load_conf_from_path(path)
end

-- 3. Apply aggregated properties at once
for k, v in pairs(properties) do
    msg.debug("Applying " .. k .. " -> " .. v)
    mp.set_property(k, v)
end

-- 4. Load scripts only AFTER configurations are correctly applied
for _, path in ipairs(script_files) do
    msg.debug("Loading script: " .. path)
    local success, err = pcall(function()
        mp.commandv("load-script", path)
    end)
    if not success then
        msg.error("Failed to load script " .. path .. ": " .. err)
    end
end

msg.info("Loaded " .. (#regular_confs + #profile_confs) .. " configs and " .. #script_files .. " scripts.")
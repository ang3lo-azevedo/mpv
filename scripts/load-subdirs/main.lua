local utils = require("mp.utils")
local msg = require("mp.msg")

--[[
* Load a conf file from a path
* @param path The path to load the conf file from
]]
function load_conf_from_path(path)
    msg.debug("Loading config: " .. path)
    local file = io.open(path, "r")
    if not file then
        msg.error("Could not open config file: " .. path)
        return
    end

    local success, err = pcall(function()
        for line in file:lines() do
            -- Skip comments and empty lines
            if not line:match("^%s*#") and not line:match("^%s*$") then
                -- Split line into key and value
                local key, value = line:match("^%s*([^=]+)%s*=%s*(.+)%s*$")
                if key and value then
                    -- Remove inline comments (only if # is preceded by space) and trailing whitespace
                    value = value:gsub("%s+#.*$", "")
                    value = value:gsub("%s+$", "")
                    -- Remove quotes from value
                    value = value:gsub("^'(.*)'$", "%1")
                    -- Set the option
                    msg.debug("Setting " .. key .. " to " .. value)
                    mp.set_property(key:gsub("%s+$", ""), value)
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
            -- Load .conf files
            load_conf_from_path(path)
        elseif info and info.is_file and file:match("%.lua$") then
            -- Load .lua files
            load_script_from_path(path)
        end
    end
end

-- Get the conf directory path
local conf_dir_name = "conf"
local conf_dir = mp.command_native({"expand-path", "~~/" .. conf_dir_name})
msg.info("Loading config files from: " .. conf_dir)

-- Load all config files
load_from_dir(conf_dir)

-- Get the scripts directory path
local scripts_dir_name = "scripts"
local scripts_dir = mp.command_native({"expand-path", "~~/" .. scripts_dir_name})
msg.info("Loading scripts from: " .. scripts_dir)

-- Load all scripts recursively
load_from_dir(scripts_dir)

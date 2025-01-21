local utils = require("mp.utils")
local msg = require("mp.msg")

--[[
* Load all scripts from a directory
* @param dir The directory to load scripts from
]]
function load_scripts_from_dir(dir)
    local files = utils.readdir(dir)
    
    if not files then
        msg.warn("Could not read directory: " .. dir)
        return
    end
    
    for _, file in ipairs(files) do
        local path = utils.join_path(dir, file)
        local info = utils.file_info(path)
        
        if info and info.is_file and file:match("%.lua$") then
            -- Load .lua files
            msg.debug("Loading script: " .. path)
            local success, err = pcall(function()
                -- Load the script
                mp.commandv("load-script", path)
            end)
            if not success then
                msg.error("Failed to load script " .. path .. ": " .. err)
            end
        elseif info and info.is_dir and not file:match("^%.") then
            -- Recursively load scripts from subdirectories, ignoring hidden dirs
            msg.debug("Entering directory: " .. path)
            load_scripts_from_dir(path)
        end
    end
end

-- Get the scripts directory path
local script_dir = mp.get_script_directory()
msg.info("Script directory: " .. script_dir)

local scripts_dir = utils.join_path(script_dir, "..")

msg.info("Loading scripts from: " .. scripts_dir)

-- Load all scripts recursively
load_scripts_from_dir(scripts_dir)
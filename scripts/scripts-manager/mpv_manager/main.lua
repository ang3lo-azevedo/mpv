local utils = require "mp.utils"
local legacy = mp.command_native_async == nil
local config = {}
local dir_cache = {}

-- Run a command
function run(args)
    if legacy then
        return utils.subprocess({args = args})
    end
    return mp.command_native({name = "subprocess", capture_stdout = true, playback_only = false, args = args})
end

-- Get the parent directory of a path
function parent(path)
    return string.match(path, "(.*)[/\\]")
end

-- Cache a directory
function cache(path)
    local p_path = parent(path)
    if p_path == nil or p_path == "" or dir_cache[p_path] then return end
    cache(p_path)
    dir_cache[path] = 1
end

-- Create a directory
function mkdir(path)
    if dir_cache[path] then return end
    cache(path)
    run({"git", "init", path})
end

-- Match a string against a list of patterns
function match(str, patterns)
    for pattern in string.gmatch(patterns, "[^|]+") do
        if string.match(str, pattern) then
            return true
        end
    end
end

-- Apply default values to a script info
function apply_defaults(info)
    if info.git == nil then return false end
    if info.whitelist == nil then info.whitelist = "" end
    if info.blacklist == nil then info.blacklist = "" end
    if info.dest == nil then info.dest = "~~/scripts" end
    if info.branch == nil then info.branch = "master" end
    return info
end

--[[
* Update a script
* @param info The script info
* @return true if the script was updated, false otherwise
]]
function update(info)
    info = apply_defaults(info)
    if not info then return false end

    local base = nil
    
    -- Get the destination directory or file
    local e_dest = string.match(mp.command_native({"expand-path", info.dest}), "(.-)[/\\]?$")
    local dest_dir = parent(e_dest) or e_dest
    mkdir(dest_dir)
    
    local files = {}
    
    -- Add the remote repository
    run({"git", "-C", dest_dir, "remote", "add", "manager", info.git})
    run({"git", "-C", dest_dir, "remote", "set-url", "manager", info.git})
    run({"git", "-C", dest_dir, "fetch", "manager", info.branch})
    
    for file in string.gmatch(run({"git", "-C", dest_dir, "ls-tree", "-r", "--name-only", "remotes/manager/"..info.branch}).stdout, "[^\r\n]+") do
        local l_file = string.lower(file)
        if info.whitelist == "" or match(l_file, info.whitelist) then
            if info.blacklist == "" or not match(l_file, info.blacklist) then
                table.insert(files, file)
                if base == nil then base = parent(l_file) or "" end
                while string.match(base, l_file) == nil do
                    if l_file == "" then break end
                    l_file = parent(l_file) or ""
                end
                base = l_file
            end
        end
    end
    
    if base == nil then return false end
    
    if base ~= "" then base = base.."/" end
    
    if next(files) == nil then
        print("no files matching patterns")
    else
        for _, file in ipairs(files) do
            local based = string.sub(file, string.len(base)+1)
            local p_based = parent(based)
            
            -- If dest is a file, write directly to it
            if parent(e_dest) then
                local c = string.match(run({"git", "-C", dest_dir, "--no-pager", "show", "remotes/manager/"..info.branch..":"..file}).stdout, "(.-)[\r\n]?$")
                local f = io.open(e_dest, "w")
                f:write(c)
                f:close()
                break -- Only write the first matching file
            else
                -- Otherwise handle as directory
                if p_based and not info.flatten_folders then mkdir(e_dest.."/"..p_based) end
                local c = string.match(run({"git", "-C", dest_dir, "--no-pager", "show", "remotes/manager/"..info.branch..":"..file}).stdout, "(.-)[\r\n]?$")
                local f = io.open(e_dest.."/"..(info.flatten_folders and file:match("[^/]+$") or based), "w")
                f:write(c)
                f:close()
            end
        end
    end
    return true
end

--[[
    Update all scripts
]]
function update_all()
    -- Open the manager.json file
    local f = io.open(
        mp.command_native(
            {"expand-path", "~~/manager.json"}
        ),
        "r"
    )

    -- Check if the file was opened successfully
    if f then
        -- Read the file
        local json = f:read("*all")
        f:close()

        -- Parse the JSON
        local props = utils.parse_json(json or "")
        if props then
            config = props
        end
    end

    -- Update each script
    for i, info in ipairs(config) do
        print("update"..i, update(info))
    end
end

-- Update all scripts when the file is loaded
mp.register_event("file-loaded", update_all)
local utils = require "mp.utils"
local msg = require "mp.msg"
local legacy = mp.command_native_async == nil
local config = {}
local dir_cache = {}

-- Run a command
function run(args)
    -- Add quiet flags for git commands
    if args[1] == "git" then
        if args[2] == "fetch" then
            table.insert(args, "--quiet")
            table.insert(args, "--no-progress")
        elseif args[2] == "remote" then
            table.insert(args, "-q")
        elseif args[2] == "init" then
            table.insert(args, "--quiet")
        elseif args[2] == "ls-tree" then
            table.insert(args, "--quiet")
        end
    end
    
    if legacy then
        return utils.subprocess({
            args = args,
            env = {"GIT_TERMINAL_PROMPT=0"}
        })
    end
    return mp.command_native({
        name = "subprocess", 
        capture_stdout = true,
        capture_stderr = false,
        playback_only = false,
        env = {"GIT_TERMINAL_PROMPT=0"},
        args = args
    })
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
        -- Remove whitespaces and check the pattern
        pattern = pattern:gsub("^%s*(.-)%s*$", "%1")
        -- Check if pattern is found anywhere in the string
        if string.find(str, pattern, 1, true) then
            return true
        end
    end
    return false
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
    
    -- Expand destination path and remove trailing slashes
    local e_dest = string.match(mp.command_native({"expand-path", info.dest}), "(.-)[/\\]?$")
    
    -- Determine if the destination is a directory or file
    local is_dir = true  -- Force directory treatment
    if string.match(info.dest, "%.%w+$") then  -- If ends with extension (e.g. .lua), it's a file
        is_dir = false
    end
    local dest_dir = is_dir and e_dest or parent(e_dest)
    
    mkdir(dest_dir)
    
    local files = {}
    
    -- Remove remote if it exists and add it again
    run({"git", "-C", dest_dir, "remote", "remove", "manager"})
    run({"git", "-C", dest_dir, "remote", "add", "manager", info.git})
    run({"git", "-C", dest_dir, "fetch", "manager", info.branch})
    
    -- List all files in repository
    local files_in_repo = run({"git", "-C", dest_dir, "ls-tree", "-r", "--name-only", "remotes/manager/"..info.branch}).stdout
    
    for file in string.gmatch(files_in_repo, "[^\r\n]+") do
        local l_file = string.lower(file)
        if (info.whitelist == "" or match(l_file, info.whitelist)) and
           (info.blacklist == "" or not match(l_file, info.blacklist)) then
            table.insert(files, file)
        end
    end
    
    if next(files) == nil then
        msg.info("no files matching patterns")
        return false
    end
    
    for _, file in ipairs(files) do
        -- If destination is not a directory, use the destination name as the filename
        if not is_dir then
            local c = string.match(run({"git", "-C", dest_dir, "--no-pager", "show", "remotes/manager/"..info.branch..":"..file}).stdout, "(.-)[\r\n]?$")
            local f = io.open(e_dest, "w")
            f:write(c)
            f:close()
            break -- Only write the first file that matches the patterns
        else
            -- If it's a directory, maintain the original structure
            local p_based = parent(file)
            if p_based and not info.flatten_folders then 
                mkdir(e_dest.."/"..p_based) 
            end
            local c = string.match(run({"git", "-C", dest_dir, "--no-pager", "show", "remotes/manager/"..info.branch..":"..file}).stdout, "(.-)[\r\n]?$")
            local f = io.open(e_dest.."/"..(info.flatten_folders and file:match("[^/]+$") or file), "w")
            f:write(c)
            f:close()
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
            {"expand-path", "~~/scripts/scripts-manager/mpv_manager/manager.json"}
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
        local script_path = info.dest:match("~~/(.*)")  -- Get path after ~~/
        msg.info("Updating " .. script_path .. ":", update(info))
    end
end

msg.info("Updating all scripts")

update_all()

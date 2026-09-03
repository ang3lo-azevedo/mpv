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
    
    local co = coroutine.running()
    if legacy or not co then
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
    
    mp.command_native_async({
        name = "subprocess", 
        capture_stdout = true,
        capture_stderr = false,
        playback_only = false,
        env = {"GIT_TERMINAL_PROMPT=0"},
        args = args
    }, function(success, res, err)
        if not res then res = {} end
        if not res.stdout then res.stdout = "" end
        if not res.status then res.status = -1 end
        coroutine.resume(co, res)
    end)
    return coroutine.yield()
end

-- Get the parent directory of a path
function parent(path)
    return string.match(path, "(.*)[/\\]")
end

local function remove_empty_dirs_lua(path)
    local p = parent(path)
    while p and p ~= "" and p ~= "." do
        local success, err = os.remove(p)
        if not success then
            break
        end
        p = parent(p)
    end
end

local function to_relative(abs_path)
    local mpv_dir = mp.command_native({"expand-path", "~~/"})
    local escaped_dir = mpv_dir:gsub("([%-%.%+%[%]%(%)%$%^%%%?%*])", "%%%1")
    local rel = abs_path:gsub("^" .. escaped_dir .. "[/\\]?", "")
    return rel:gsub("\\", "/")
end

local current_installed = {}
local update_targets = os.getenv("MPV_MANAGER_TARGETS")

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
    if info.base_dir == nil then info.base_dir = "" end
    return info
end

--[[
* Update a script
* @param info The script info
* @return true if the script was updated, false otherwise
]]
function update(info)
    local updated_count = 0
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
            
            if info.replacements then
                for _, rep in ipairs(info.replacements) do
                    if rep.search and rep.replace then
                        local escaped_search = rep.search:gsub("([%-%.%+%[%]%(%)%$%^%%%?%*])", "%%%1")
                        local escaped_replace = rep.replace:gsub("%%", "%%%%")
                        c = c:gsub(escaped_search, escaped_replace)
                    end
                end
            end
            
            local current_content = ""
            local old_f = io.open(e_dest, "r")
            if old_f then
                current_content = old_f:read("*all")
                old_f:close()
            end
            
            table.insert(current_installed, to_relative(e_dest))
            if c ~= current_content then
                local f = io.open(e_dest, "w")
                if f then
                    f:write(c)
                    f:close()
                    updated_count = updated_count + 1
                end
            end
            break -- Only write the first file that matches the patterns
        else
            -- If it's a directory, maintain the original structure
            local out_file = file
            if info.base_dir and info.base_dir ~= "" then
                -- Try to strip base_dir prefix safely
                local escaped_base = info.base_dir:gsub("([%-%.%+%[%]%(%)%$%^%%%?%*])", "%%%1")
                out_file = out_file:gsub("^" .. escaped_base .. "/?", "")
            end
            
            local p_based = parent(out_file)
            if p_based and not info.flatten_folders then 
                mkdir(e_dest.."/"..p_based) 
            end
            local c = string.match(run({"git", "-C", dest_dir, "--no-pager", "show", "remotes/manager/"..info.branch..":"..file}).stdout, "(.-)[\r\n]?$")
            
            if info.replacements then
                for _, rep in ipairs(info.replacements) do
                    if rep.search and rep.replace then
                        local escaped_search = rep.search:gsub("([%-%.%+%[%]%(%)%$%^%%%?%*])", "%%%1")
                        local escaped_replace = rep.replace:gsub("%%", "%%%%")
                        c = c:gsub(escaped_search, escaped_replace)
                    end
                end
            end
            
            local target_path = e_dest.."/"..(info.flatten_folders and out_file:match("[^/]+$") or out_file)
            local current_content = ""
            local old_f = io.open(target_path, "r")
            if old_f then
                current_content = old_f:read("*all")
                old_f:close()
            end
            
            table.insert(current_installed, to_relative(target_path))
            if c ~= current_content then
                local f = io.open(target_path, "w")
                if f then
                    f:write(c)
                    f:close()
                    updated_count = updated_count + 1
                else
                    msg.error("Failed to write to " .. target_path)
                end
            end
        end
    end
    return updated_count
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
    local total_updated = 0
    current_installed = {}
    
    local installed_path = mp.command_native({"expand-path", "~~/scripts/scripts-manager/mpv_manager/installed.json"})
    local old_installed = {}
    local f_inst = io.open(installed_path, "r")
    if f_inst then
        local j = f_inst:read("*all")
        f_inst:close()
        old_installed = utils.parse_json(j or "[]") or {}
    end

    for i, info in ipairs(config) do
        local script_path = info.dest:match("~~/(.*)")  -- Get path after ~~/
        local selected = not update_targets
        if update_targets and info.dest then
            for target in string.gmatch(update_targets, "[^,]+") do
                if info.dest == target then
                    selected = true
                    break
                end
            end
        end
        if selected then
            local updated = update(info)
            if type(updated) == "number" then
                total_updated = total_updated + updated
            end
            msg.info("Checked " .. script_path .. ": Updated " .. (type(updated) == "number" and updated or 0) .. " files")
        end
    end
    
    if not update_targets then
        -- Cleanup orphans
        local current_set = {}
        for _, path in ipairs(current_installed) do
            current_set[path] = true
        end

        local mpv_dir = mp.command_native({"expand-path", "~~/"})
        for _, path in ipairs(old_installed) do
            if not current_set[path] then
                local abs_path = mpv_dir .. "/" .. path
                os.remove(abs_path)
                msg.info("Removed orphan: " .. path)
                remove_empty_dirs_lua(abs_path)
            end
        end

        -- Save new installed list
        local f_out = io.open(installed_path, "w")
        if f_out then
            local j_out = utils.format_json(current_installed)
            if j_out then
                f_out:write(j_out)
            end
            f_out:close()
        end
    end
    
    if total_updated > 0 then
        mp.osd_message("Manager: Updated " .. total_updated .. " files!", 5)
        msg.info("Manager: Updated " .. total_updated .. " files!")
    end
end

local update_running = false

local function run_update(source)
    if update_running then
        mp.osd_message("Manager: update already running", 3)
        return
    end

    update_running = true
    mp.osd_message("Manager: updating scripts...", 2)
    coroutine.wrap(function()
        update_all()
        update_running = false
        mp.osd_message("Manager: update complete", 3)
        msg.info(source .. " update complete!")
        if os.getenv("MPV_MANAGER_ONESHOT") == "1" then
            mp.command("quit")
        end
    end)()
end

msg.info("Starting background update of all scripts...")
run_update("Background")

mp.add_key_binding("ctrl+alt+u", "manager-update", function()
    run_update("Manual")
end)

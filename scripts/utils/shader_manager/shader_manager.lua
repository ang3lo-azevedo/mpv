local mp = require("mp")

local function get_filename(path)
    if not path then return "" end
    return path:match("([^/\\]+)$") or path
end

local function clean_shader_list(list)
    local cleaned = {}
    for _, s in ipairs(list or {}) do
        if type(s) == "string" and s:match("%S") then
            -- Handle potential semicolon or colon separated chains inside a single string entry
            for sub in s:gmatch("[^;:]+") do
                local trimmed = sub:match("^%s*(.-)%s*$")
                if trimmed ~= "" then
                    table.insert(cleaned, trimmed)
                end
            end
        end
    end
    return cleaned
end

local function is_shader_active(shaders, shader_path)
    local target_file = get_filename(shader_path)
    for _, s in ipairs(shaders) do
        if s == shader_path or get_filename(s) == target_file then
            return true
        end
    end
    return false
end

-- Toggle a shader cleanly without affecting other active shaders (e.g., Anime4K)
local function toggle_shader(shader_path, display_name, emoji)
    if not shader_path or shader_path == "" then return end
    display_name = display_name or get_filename(shader_path)

    local target_file = get_filename(shader_path)
    local current_shaders = clean_shader_list(mp.get_property_native("glsl-shaders") or {})
    local new_shaders = {}
    local was_active = false

    for _, s in ipairs(current_shaders) do
        if s == shader_path or get_filename(s) == target_file then
            was_active = true
        else
            table.insert(new_shaders, s)
        end
    end

    local is_now_active = false
    if not was_active then
        table.insert(new_shaders, shader_path)
        is_now_active = true
    end

    mp.set_property_native("glsl-shaders", new_shaders)

    local state_text = is_now_active and "ON" or "OFF"
    local message = display_name .. ": " .. state_text
    if emoji and emoji ~= "" then
        message = message .. " " .. emoji
    end

    mp.osd_message(message, 3)
    mp.msg.info(string.format("[shader_manager] '%s' toggled %s (active shaders: %d)", target_file, state_text, #new_shaders))
end

-- Toggle a group of shaders cleanly (e.g., AIO Thin Lines)
local function toggle_shader_group(shaders_str, display_name, emoji)
    if not shaders_str or shaders_str == "" then return end
    display_name = display_name or "Shader Group"

    -- Split shaders_str by semicolon or colon
    local target_paths = {}
    local target_filenames = {}
    for sub in shaders_str:gmatch("[^;:]+") do
        local trimmed = sub:match("^%s*(.-)%s*$")
        if trimmed ~= "" then
            table.insert(target_paths, trimmed)
            target_filenames[get_filename(trimmed)] = true
        end
    end

    local current_shaders = clean_shader_list(mp.get_property_native("glsl-shaders") or {})
    local new_shaders = {}
    local any_active = false

    for _, s in ipairs(current_shaders) do
        local fn = get_filename(s)
        if target_filenames[fn] or target_filenames[s] then
            any_active = true
        else
            table.insert(new_shaders, s)
        end
    end

    local is_now_active = false
    if not any_active then
        -- None were active, turn all on
        for _, p in ipairs(target_paths) do
            table.insert(new_shaders, p)
        end
        is_now_active = true
    end
    -- If any were active, they have all been excluded from new_shaders, turning them off!

    mp.set_property_native("glsl-shaders", new_shaders)

    local state_text = is_now_active and "ON" or "OFF"
    local message = display_name .. ": " .. state_text
    if emoji and emoji ~= "" then
        message = message .. " " .. emoji
    end

    mp.osd_message(message, 3)
    mp.msg.info(string.format("[shader_manager] Group '%s' toggled %s (active shaders: %d)", display_name, state_text, #new_shaders))
end

-- Display the current status of a shader
local function show_shader_status(shader_path, display_name, emoji)
    if not shader_path or shader_path == "" then return end
    display_name = display_name or get_filename(shader_path)

    local current_shaders = clean_shader_list(mp.get_property_native("glsl-shaders") or {})
    local is_active = is_shader_active(current_shaders, shader_path)

    local state_text = is_active and "ON" or "OFF"
    local message = display_name .. ": " .. state_text
    if emoji and emoji ~= "" then
        message = message .. " " .. emoji
    end

    mp.osd_message(message, 3)
end

-- Clear all shaders cleanly
local function clear_shaders()
    mp.set_property_native("glsl-shaders", {})
    mp.osd_message("All Filters: OFF ❌", 3)
    mp.msg.info("[shader_manager] Cleared all shaders")
end

mp.register_script_message("toggle-shader", toggle_shader)
mp.register_script_message("toggle-shader-group", toggle_shader_group)
mp.register_script_message("show-shader-status", show_shader_status)
mp.register_script_message("clear-shaders", clear_shaders)

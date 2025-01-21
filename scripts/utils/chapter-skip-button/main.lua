-- chapter-skip-button.lua
--
-- Shows a Netflix-style skip button for certain chapter categories
--
-- This script shows a skip button for chapters based on their title.

local mp = require 'mp'
local assdraw = require 'mp.assdraw'

local categories = {
    prologue = "^Prologue/^Intro",
    opening = "^OP/ OP$/^Opening", 
    ending = "^ED/ ED$/^Ending",
    preview = "Preview$"
}

local options = {
    enabled = true,
    skip_once = true,
    categories = "",
    button_x = 85,
    button_y = 85,
    button_width = 120,
    button_height = 40
}

mp.options = require "mp.options"

local skipped = {}
local parsed = {}
local skip_button_visible = false
local current_chapter = nil

function create_skip_button()
    local ass = assdraw.ass_new()
    
    -- Button background
    ass:new_event()
    ass:pos(options.button_x, options.button_y)
    ass:append('{\\1c&H000000&\\1a&H66&\\bord2\\3c&HFFFFFF&}')
    ass:draw_start()
    ass:rect_cw(0, 0, options.button_width, options.button_height)
    ass:draw_stop()
    
    -- Button text
    ass:new_event()
    ass:pos(options.button_x + options.button_width/2, options.button_y + options.button_height/2)
    ass:append('{\\fs20\\bord0\\c&HFFFFFF&\\b1\\an5}Skip')
    
    return ass.text
end

function show_skip_button()
    if not skip_button_visible then
        local button = create_skip_button()
        mp.set_osd_ass(mp.get_screen_width(), mp.get_screen_height(), button)
        skip_button_visible = true
    end
end

function hide_skip_button()
    if skip_button_visible then
        mp.set_osd_ass(mp.get_screen_width(), mp.get_screen_height(), "")
        skip_button_visible = false
    end
end

function matches(index, title)
    if not title then return false end
    title = title:lower()

    -- Get chapters list to check special cases
    local chapters = mp.get_property_native("chapter-list")
    if chapters then
        local ch1_idx, ch2_idx
        for i, chapter in ipairs(chapters) do
            if chapter.title == "Chapter 01" then ch1_idx = i end
            if chapter.title == "Chapter 02" then ch2_idx = i end
        end

        -- If both chapters exist, check their times
        if ch1_idx and ch2_idx then
            if title == "chapter 01" and ch1_idx < ch2_idx then
                return true -- Chapter 01 is opening when before Chapter 02
            elseif title == "chapter 02" and ch2_idx < ch1_idx then
                return true -- Chapter 02 is opening when before Chapter 01
            elseif title == "chapter 01" and ch1_idx > ch2_idx then
                categories["prologue"] = categories["prologue"] .. "/Chapter 01"
            end
        end
    end

    -- Check regular patterns
    for category, patterns in pairs(categories) do
        for pattern in string.gmatch(patterns, "[^/]+") do
            if title:match(pattern:lower()) then
                return true
            end
        end
    end
    return false
end

function skip_chapter()
    if current_chapter then
        local chapters = mp.get_property_native("chapter-list")
        if current_chapter < #chapters then
            mp.set_property("time-pos", chapters[current_chapter + 1].time)
        else
            if mp.get_property_native("playlist-count") == mp.get_property_native("playlist-pos-1") then
                mp.set_property("time-pos", mp.get_property_native("duration"))
            else
                mp.commandv("playlist-next")
            end
        end
        skipped[current_chapter] = true
        hide_skip_button()
    end
end

function check_chapter(_, chapter_index)
    mp.options.read_options(options, "chapterskip")
    if not options.enabled or chapter_index == nil then 
        hide_skip_button()
        return 
    end

    for category in string.gmatch(options.categories, "([^;]+)") do
        name, patterns = string.match(category, " *([^+>]*[^+> ]) *[+>](.*)")
        if name then
            categories[name:lower()] = patterns
        elseif not parsed[category] then
            mp.msg.warn("Improper category definition: " .. category)
        end
        parsed[category] = true
    end

    local chapters = mp.get_property_native("chapter-list")
    if not chapters or not chapters[chapter_index + 1] then
        hide_skip_button()
        return
    end

    if matches(chapter_index + 1, chapters[chapter_index + 1].title) and 
       (not options.skip_once or not skipped[chapter_index + 1]) then
        current_chapter = chapter_index + 1
        show_skip_button()
    else
        hide_skip_button()
    end
end

mp.observe_property("chapter", "number", check_chapter)
mp.register_event("file-loaded", function() 
    skipped = {} 
    hide_skip_button()
end)

-- Handle mouse clicks on skip button
mp.add_key_binding("MBTN_LEFT", "skip_chapter", function()
    if skip_button_visible then
        local mouse_x, mouse_y = mp.get_mouse_pos()
        if mouse_x >= options.button_x and mouse_x <= options.button_x + options.button_width and
           mouse_y >= options.button_y and mouse_y <= options.button_y + options.button_height then
            skip_chapter()
        end
    end
end)
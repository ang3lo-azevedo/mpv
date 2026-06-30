local Element = require('elements/Element')

---@class SkipNotificationButton : Element
local SkipNotificationButton = class(Element)

function SkipNotificationButton:new() return Class.new(self) --[[@as SkipNotificationButton]] end

function SkipNotificationButton:init()
	Element.init(self, 'skip_notification_button', {render_order = 7})
	self.ignores_curtain = true
	self.message = ""
	self.is_prompt = false
	self.min_visibility = 0 -- Start hidden
	self:update_dimensions()
end

function SkipNotificationButton:update_dimensions()
	if not display.initialized then return end

	-- Calculate scale factor based on display height relative to 1080p
	local base_height = 1080
	local scale = display.height / base_height

	-- Netflix-style positioning: bottom right area, moved higher
	local margin = 80 * scale
	local button_width = 200 * scale
	local button_height = 60 * scale

	-- Position higher up (reduce bottom margin)
	self:set_coordinates(
		display.width - button_width - margin,  -- Right side
		display.height - button_height - margin - (80 * scale), -- Higher up
		display.width - margin,
		display.height - margin - (80 * scale)
	)

	-- Store scale for use in render
	self.scale = scale
end

function SkipNotificationButton:set_message(message, is_prompt)
	self.message = message or ""
	self.is_prompt = is_prompt or false
	self.min_visibility = 1 -- Make visible immediately
	self:update_dimensions()
	request_render()
end

function SkipNotificationButton:handle_click()
	-- Call the main script's perform_skip function
	-- This will be available in the global scope when the button is created
	perform_skip()
end

function SkipNotificationButton:render()
	local visibility = self:get_visibility()
	if visibility <= 0 or self.message == "" then return end

	local ass = assdraw.ass_new()
	local is_hover = self.proximity_raw == 0

	-- Netflix-style button: white background with black text
	local bg_color = is_hover and '333333' or '111111'  -- Dark bg, lighter on hover (matches hayase-osc)
	local text_color = 'FFFFFF'  -- White text always (matches hayase-osc)

	-- Background with rounded corners (Netflix style)
	ass:rect(self.ax, self.ay, self.bx, self.by, {
		color = bg_color,
		opacity = visibility * 0.65,
		border = 2 * self.scale,
		border_color = '444444',
		radius = 13 * self.scale,
	})

	-- Text using original ASS font settings (fs24, b900)
	local font_size = 24 * self.scale
	local x = round((self.ax + self.bx) / 2)
	local y = round((self.ay + self.by) / 2)

	-- Main text (centered)
	ass:txt(x, y, 5, self.message, {
		size = font_size,
		color = text_color,
		opacity = visibility,
		bold = true,
		shadow_x = 1 * self.scale,
		shadow_y = 1 * self.scale,
		shadow_color = '000000',
	})

	-- Click zone
	cursor:zone('primary_click', self, function() self:handle_click() end)

	return ass
end

function SkipNotificationButton:on_display()
	self:update_dimensions()
end

function SkipNotificationButton:hide()
	self.message = ""
	self.min_visibility = 0 -- Hide the button
	request_render()
end

return SkipNotificationButton
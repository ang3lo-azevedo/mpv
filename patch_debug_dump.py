import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'dest' in item and 'thumbfast.lua' in item['dest']:
        rep = {
            "search": '    subprocess(args, true,',
            "replace": '    local dfile = io.open("/tmp/thumbfast_debug.txt", "w")\n    if dfile then\n        dfile:write("mpv_path: "..tostring(mpv_path).."\\n")\n        dfile:write("url: "..tostring(path).."\\n")\n        dfile:write("socket: "..tostring(options.socket).."\\n")\n        dfile:write("thumbnail: "..tostring(options.thumbnail).."\\n")\n        for k, v in pairs(args) do dfile:write("arg "..k..": "..tostring(v).."\\n") end\n        dfile:close()\n    end\n    subprocess(args, true,'
        }
        item.setdefault('replacements', []).append(rep)

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

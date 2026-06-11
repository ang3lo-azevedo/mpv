import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'dest' in item and 'thumbfast.lua' in item['dest']:
        reps = item.setdefault('replacements', [])
        reps.append({
            "search": "script:write(string.format(client_script, options.socket))",
            "replace": "script:write(string.format(client_script, options.socket, options.socket))"
        })

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'dest' in item and 'thumbfast.lua' in item['dest']:
        if 'replacements' not in item:
            item['replacements'] = []
        item['replacements'].append({
            "search": 'mpv_path, "--no-config", "--msg-level=all=no", "--idle"',
            "replace": 'mpv_path, "--no-config", "--msg-level=all=v", "--log-file=/tmp/thumbfast_bg.log", "--idle"'
        })

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

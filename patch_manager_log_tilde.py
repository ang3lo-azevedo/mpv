import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'dest' in item and 'thumbfast.lua' in item['dest']:
        for rep in item.get('replacements', []):
            if 'thumbfast_bg.log' in rep['replace']:
                rep['replace'] = 'mpv_path, "--no-config", "--msg-level=all=v", "--log-file=~~/thumbfast_bg.log", "--idle"'

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

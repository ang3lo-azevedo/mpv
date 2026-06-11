import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'dest' in item and 'thumbfast.lua' in item['dest']:
        rep1 = {
            "search": ', env = "PATH="..os.getenv("PATH")',
            "replace": ''
        }
        item.setdefault('replacements', []).append(rep1)

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

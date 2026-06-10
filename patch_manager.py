import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'dest' in item and item['dest'].endswith('/main.lua'):
        # Extract the name from the parent directory
        parts = item['dest'].split('/')
        name = parts[-2]
        # Keep it in the same directory but name it correctly
        item['dest'] = '/'.join(parts[:-1]) + f'/{name}.lua'

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

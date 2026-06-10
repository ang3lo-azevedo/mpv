import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'dest' in item and 'mpv-auto-chapters' in item['dest']:
        item['replacements'] = [
            {
                "search": "local script_name, script_dir = mp.get_script_name(), mp.get_script_directory()",
                "replace": "local script_name, script_dir = mp.get_script_name(), mp.get_script_directory() or mp.command_native({\"expand-path\", \"~~/script-opts\"})"
            }
        ]

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

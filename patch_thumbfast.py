import json

with open('scripts/scripts-manager/mpv_manager/manager.json', 'r') as f:
    data = json.load(f)

lua_script = """local last_size = 0
mp.add_periodic_timer(0.033, function()
    local finfo = mp.utils.file_info("%s")
    if finfo and finfo.size > last_size then
        local f = io.open("%s", "r")
        if f then
            f:seek("set", last_size)
            local data = f:read("*a")
            last_size = finfo.size
            f:close()
            if data and data ~= "" then
                for cmd in data:gmatch("[^\\r\\n]+") do
                    mp.command(cmd)
                end
            end
        end
    end
end)
mp.commandv("print-text", "thumbfast")
"""

for item in data:
    if 'dest' in item and 'thumbfast.lua' in item['dest']:
        reps = item.setdefault('replacements', [])
        reps.append({
            "search": "subprocess({\"mkfifo\", options.socket}, true)",
            "replace": "local f=io.open(options.socket, \"w\"); if f then f:close() end"
        })
        reps.append({
            "search": "options.socket..\".run\"",
            "replace": "options.socket..\".lua\""
        })
        reps.append({
            "search": "local client_script = [=[\n#!/usr/bin/env bash\nMPV_IPC_FD=0; MPV_IPC_PATH=\"%s\"\ntrap \"kill 0\" EXIT\nwhile [[ $# -ne 0 ]]; do case $1 in --mpv-ipc-fd=*) MPV_IPC_FD=${1/--mpv-ipc-fd=/} ;; esac; shift; done\nif echo \"print-text thumbfast\" >&\"$MPV_IPC_FD\"; then echo -n > \"$MPV_IPC_PATH\"; tail -f \"$MPV_IPC_PATH\" >&\"$MPV_IPC_FD\" & while read -r -u \"$MPV_IPC_FD\" 2>/dev/null; do :; done; fi\n]=]",
            "replace": "local client_script = [=[\n" + lua_script + "]=]"
        })

with open('scripts/scripts-manager/mpv_manager/manager.json', 'w') as f:
    json.dump(data, f, indent=2)

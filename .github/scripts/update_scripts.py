import json
import os
import subprocess
import tempfile
import shutil

def is_match(string, patterns):
    if not patterns:
        return True
    for pattern in patterns.split('|'):
        pattern = pattern.strip()
        if pattern in string:
            return True
    return False

def remove_empty_dirs(path):
    try:
        while path and path != '.':
            path = os.path.dirname(path)
            if not path or path == '.':
                break
            if not os.listdir(path):
                os.rmdir(path)
            else:
                break
    except OSError:
        pass

def main():
    manager_path = 'scripts/scripts-manager/mpv_manager/manager.json'
    installed_path = 'scripts/scripts-manager/mpv_manager/installed.json'
    if not os.path.exists(manager_path):
        print(f"Error: {manager_path} not found")
        return

    with open(manager_path, 'r') as f:
        config = json.load(f)

    old_installed = []
    if os.path.exists(installed_path):
        with open(installed_path, 'r') as f:
            try:
                old_installed = json.load(f)
            except json.JSONDecodeError:
                pass

    current_installed = []

    for info in config:
        git_url = info.get('git')
        if not git_url:
            continue
            
        whitelist = info.get('whitelist', '')
        blacklist = info.get('blacklist', '')
        dest = info.get('dest', '~~/scripts')
        branch = info.get('branch', 'master')
        base_dir = info.get('base_dir', '')
        flatten_folders = info.get('flatten_folders', False)

        # Expand destination path (~/ expands to current directory conceptually)
        if dest.startswith('~~/'):
            dest = dest[3:]
            
        # Ensure dest doesn't have a trailing slash for consistency
        dest = dest.rstrip('/')

        # Determine if it's a file or directory
        is_dir = True
        if '.' in os.path.basename(dest):
            is_dir = False

        print(f"Updating {dest} from {git_url} ({branch})...")

        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                subprocess.run(
                    ['git', 'clone', '--depth', '1', '-b', branch, git_url, tmpdir], 
                    check=True, 
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE
                )
            except subprocess.CalledProcessError as e:
                print(f"Failed to clone {git_url}: {e.stderr.decode('utf-8')}")
                continue
            
            # Get all files in repo tracked by git
            result = subprocess.run(
                ['git', '-C', tmpdir, 'ls-tree', '-r', '--name-only', 'HEAD'], 
                check=True, 
                capture_output=True, 
                text=True
            )
            files_in_repo = result.stdout.splitlines()

            matched_files = []
            for file in files_in_repo:
                l_file = file.lower()
                if (not whitelist or is_match(l_file, whitelist.lower())) and \
                   (not blacklist or not is_match(l_file, blacklist.lower())):
                    matched_files.append(file)

            if not matched_files:
                print(f"  No files matched for {git_url}")
                continue

            for file in matched_files:
                src_path = os.path.join(tmpdir, file)
                
                if not is_dir:
                    # File destination
                    dest_dir = os.path.dirname(dest)
                    if dest_dir:
                        os.makedirs(dest_dir, exist_ok=True)
                    shutil.copy2(src_path, dest)
                    current_installed.append(dest)
                    print(f"  Saved -> {dest}")
                    break # Only copy the first matching file to the specific file destination
                else:
                    # Directory destination
                    out_file = file
                    if base_dir and out_file.startswith(base_dir):
                        out_file = out_file[len(base_dir):].lstrip('/')
                    
                    if flatten_folders:
                        target_path = os.path.join(dest, os.path.basename(out_file))
                    else:
                        target_path = os.path.join(dest, out_file)
                    
                    target_dir = os.path.dirname(target_path)
                    if target_dir:
                        os.makedirs(target_dir, exist_ok=True)
                    shutil.copy2(src_path, target_path)
                    current_installed.append(target_path)
                    print(f"  Saved -> {target_path}")

    # Cleanup orphaned files
    orphans = set(old_installed) - set(current_installed)
    for orphan in orphans:
        if os.path.exists(orphan):
            try:
                os.remove(orphan)
                print(f"Removed orphan: {orphan}")
                remove_empty_dirs(orphan)
            except OSError as e:
                print(f"Failed to remove orphan {orphan}: {e}")

    # Save new installed list
    os.makedirs(os.path.dirname(installed_path), exist_ok=True)
    with open(installed_path, 'w') as f:
        json.dump(current_installed, f, indent=2)

if __name__ == '__main__':
    main()

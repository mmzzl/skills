import json
from pathlib import Path

detect = json.loads(Path('.graphify_detect.json').read_text(encoding='utf-16'))
print(f"Total files: {detect['total_files']}")
print(f"Total words: {detect['total_words']}")
print(f"Code files: {len(detect['files']['code'])}")
print(f"Doc files: {len(detect['files']['document'])}")
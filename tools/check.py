#!/usr/bin/env python3
"""Static checks for the rules in CLAUDE.md. Run before every commit:

    python3 tools/check.py

Exits non-zero when a rule is broken. Standard library only.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXT_FILES = ['index.html', 'app.js', 'sw.js', 'manifest.webmanifest', 'CLAUDE.md']
COPY_FILES = ['index.html', 'app.js', 'sw.js', 'manifest.webmanifest']
errors = []


def read(name):
    raw = (ROOT / name).read_bytes()
    if raw.startswith(b'\xef\xbb\xbf'):
        errors.append(f'{name}: starts with a UTF-8 BOM')
        raw = raw[3:]
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError as e:
        errors.append(f'{name}: not valid UTF-8 ({e})')
        return raw.decode('utf-8', 'replace')


texts = {name: read(name) for name in TEXT_FILES}

# Rule 1: APP_VERSION and the service worker cache name must match.
app_v = re.search(r"const APP_VERSION = '(v\d+)'", texts['app.js'])
sw_v = re.search(r"const CACHE = 'aligno-(v\d+)'", texts['sw.js'])
if not app_v or not sw_v:
    errors.append('version: APP_VERSION or CACHE line not found')
elif app_v.group(1) != sw_v.group(1):
    errors.append(f'version: app.js is {app_v.group(1)}, sw.js is {sw_v.group(1)}')

# Rule 2: every $('id') in app.js needs a matching id in the markup
# (index.html, or markup that app.js builds itself).
ids = set(re.findall(r'\bid="([^"]+)"', texts['index.html']))
ids |= set(re.findall(r'\bid="([^"$]+)"', texts['app.js']))
for ref in sorted(set(re.findall(r"\$\('([^']+)'\)", texts['app.js']))):
    if ref not in ids:
        errors.append(f"ids: $('{ref}') in app.js has no element with that id")

# Rule 3: no em dashes in anything the user can see.
for name in COPY_FILES:
    for n, line in enumerate(texts[name].splitlines(), 1):
        if '—' in line:
            errors.append(f'{name}:{n}: em dash')

if errors:
    print('check failed:')
    for e in errors:
        print('  ' + e)
    sys.exit(1)
print(f'check ok: {app_v.group(1)}, {len(ids)} ids, no BOM, no em dashes')

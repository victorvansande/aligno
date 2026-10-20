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

# Rule 4 (DESIGN.md): no inline style attributes in the markup, and font
# sizes and corner radii in the CSS only through the tokens.
html = texts['index.html']
css_start, css_end = html.find('<style>'), html.find('</style>')
markup = html[:css_start] + html[css_end:]
for m in re.finditer(r'<[a-zA-Z][^>]*\sstyle="', markup):
    errors.append(f'index.html: inline style attribute near "{m.group(0)[:40]}"')
css = html[css_start:css_end]
css_line0 = html.count('\n', 0, css_start) + 1
for m in re.finditer(r'font-size:\s*([^;}]+)', css):
    v = m.group(1).strip()
    if not v.startswith('var(--fs-') and v != '120px':
        errors.append(f'index.html:{css_line0 + css.count(chr(10), 0, m.start())}: font-size {v} is not a --fs-* token')
for m in re.finditer(r'border-radius:\s*([^;}]+)', css):
    v = m.group(1).strip()
    if v.startswith('calc(') and 'var(--r-' in v:
        continue  # a token scaled at runtime, e.g. the page corner behind a sheet
    if any(p not in ('0', '50%') and not p.startswith('var(--r-') for p in v.split()):
        errors.append(f'index.html:{css_line0 + css.count(chr(10), 0, m.start())}: border-radius {v} is not a --r-* token')

if errors:
    print('check failed:')
    for e in errors:
        print('  ' + e)
    sys.exit(1)
print(f'check ok: {app_v.group(1)}, {len(ids)} ids, no BOM, no em dashes, design tokens respected')

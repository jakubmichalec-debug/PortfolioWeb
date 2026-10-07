"""Bump the ?v= cache-busting suffix on every local <link>/<script> tag, across all site
HTML pages, so a browser (or this sandboxed preview pane, which has ignored Cache-Control
in testing) is forced to request a genuinely new URL instead of possibly reusing a stale copy.

Run this after editing any file under site/css or site/js:
    python tools/bump_cache_version.py
"""
import glob
import os
import re

SITE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")
ATTR = re.compile(r'((?:href|src)=")(css/[\w.\-]+\.css|js/[\w.\-/]+\.js)(?:\?v=(\d+))?(")')

paths = glob.glob(os.path.join(SITE, "*.html"))
seen = [int(m.group(3)) for path in paths for m in ATTR.finditer(open(path, encoding="utf8", newline="").read()) if m.group(3)]
version = max(seen, default=0) + 1

for path in paths:
    html = open(path, encoding="utf8", newline="").read()
    new_html, n = ATTR.subn(rf"\g<1>\g<2>?v={version}\g<4>", html)
    if new_html != html:
        open(path, "w", encoding="utf8", newline="").write(new_html)
    print(f"{os.path.basename(path)}: {n} tag(s) -> v{version}")

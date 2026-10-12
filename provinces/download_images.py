#!/usr/bin/env python3
"""
دانلود عکس‌های لینک‌خارجی صفحات استان و ذخیره در provinces/pic
و جایگزینی لینک‌ها با مسیر محلی.

اجرا (کنار index.html):
    python download_images.py

همچنین نقشه را (اگر iran.svg نبود) دانلود می‌کند.
"""
import re, sys, urllib.request, urllib.parse
from pathlib import Path

root = Path(__file__).parent
pages = sorted((root / "provinces").glob("*.html"))
pic = root / "provinces" / "pic"
pic.mkdir(exist_ok=True)

def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        dest.write_bytes(r.read())

# 1) map
svg = root / "iran.svg"
if not svg.exists():
    try:
        fetch("https://raw.githubusercontent.com/nastoohir/iran-map-svg/master/iran.svg", svg)
        print("OK  iran.svg")
    except Exception as e:
        print("FAIL iran.svg:", e)

# 2) images
pat = re.compile(r'(<img\s+src=")(https?://[^"]+)(")')
for page in pages:
    html = page.read_text(encoding="utf-8")
    n = 0
    def repl(m):
        global n
        url = m.group(2)
        ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".avif"):
            ext = ".jpg"
        n += 1
        name = f"{page.stem}-ext{n}{ext}"
        try:
            fetch(url, pic / name)
            print("OK  ", page.stem, name)
            return f'{m.group(1)}pic/{name}{m.group(3)}'
        except Exception as e:
            print("FAIL", page.stem, url, e)
            return m.group(0)
    new = pat.sub(repl, html)
    if new != html:
        page.write_text(new, encoding="utf-8")
print("تمام شد.")

#!/usr/bin/env python3
"""
تبدیل صفحات استان به استایل مشترک (provinces/province.css).

- فقط بلوک <style> هر صفحه را عوض می‌کند؛ بقیه صفحه (متن، عکس‌ها و مسیرهایی
  که با download_images.py ساختید) دست‌نخورده می‌ماند.
- از هر صفحه قبل از تغییر، یک نسخه پشتیبان در provinces/_backup می‌گذارد.
- روی صفحه‌ای که قبلاً تبدیل شده دوباره اجرا نمی‌شود.

اجرا (کنار index.html):
    python refactor_provinces.py
"""
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent
prov = root / "provinces"
backup = prov / "_backup"

# رنگ هر استان. کلیدهای ذکرنشده از مقدار پیش‌فرض province.css استفاده می‌کنند.
PALETTES = {
    "gilan": {
        "heading": "#1b5e20", "btn-hover": "#2e7d32", "accent": "#c6a664",
        "page-bg": "#f9fbf9", "text": "#333333",
        "stat-bg": "rgba(232, 245, 233, 0.92)",
        "chip-border": "rgba(198, 166, 100, 0.4)",
    },
    "hamadan": {
        "heading": "#2d5a27", "btn-hover": "#3e7538", "accent": "#c45c26",
        "page-bg": "#f8f5f0", "text": "#3e2723",
        "stat-bg": "rgba(240, 245, 235, 0.92)",
        "chip-border": "#c45c26",
    },
    "isfahan": {
        "heading": "#005691", "btn-hover": "#006bb3", "accent": "rgba(0, 86, 145, 0.8)",
        "page-bg": "#fdfaf5", "text": "#2c3e50",
        "stat-bg": "rgba(238, 246, 251, 0.92)",
        "chip-border": "rgba(1, 68, 113, 0.875)",
    },
    "khuzestan": {
        "heading": "#0d47a1", "btn": "#d4a017", "btn-hover": "#b8860b", "accent": "#d4a017",
        "page-bg": "#fdf2e9", "text": "#3e2723",
        "stat-bg": "rgba(255, 255, 255, 0.92)",
        "stat-border": "rgba(212, 160, 23, 0.2)",
        "chip-border": "rgba(212, 160, 23, 0.5)",
        "hero-top": "rgba(0, 0, 0, 0.45)", "hero-bottom": "rgba(0, 0, 0, 0.7)",
    },
    "qazvin": {
        "heading": "#008b8b", "btn-hover": "#006f6f", "accent": "#027272",
        "page-bg": "#fdfaf5", "text": "#4e342e",
        "stat-bg": "rgba(240, 245, 235, 0.92)",
    },
    "tehran": {
        "heading": "#0d1b2a", "btn-hover": "#1b263b", "accent": "rgba(13, 27, 42, 0.6)",
        "page-bg": "#f8f9fa", "text": "#0d1b2a",
        "stat-bg": "#e0e1dd", "stat-hover-bg": "#d0d2ca", "stat-border": "transparent",
        "stat-title": "#415a77",
        "hero-top": "rgba(13, 27, 42, 0.65)", "hero-bottom": "rgba(13, 27, 42, 0.8)",
        "chip-bg": "rgba(184, 146, 106, 0.35)", "chip-border": "rgba(255, 255, 255, 0.2)",
        "footer-text": "#e0e1dd",
    },
    "yazd": {
        "heading": "#bc6c25", "btn-hover": "#a55b1f", "accent": "#49270c",
        "page-bg": "#fefae0", "text": "#582f0e",
        "stat-bg": "rgba(250, 237, 205, 0.92)",
        "chip-border": "#391f0a",
        "footer-bg": "#582f0e", "back-text": "#582f0e",
    },
    "azerbaijan-west": {
        "heading": "#1e88e5", "btn-hover": "#1565c0", "accent": "#1873c3",
        "page-bg": "#fffde7", "text": "#3e2723",
        "stat-bg": "rgba(255, 255, 255, 0.92)",
        "chip-border": "rgba(255, 179, 0, 0.4)",
    },
    "fars": {
        "heading": "#6a0e1a", "btn-hover": "#85121f", "accent": "#d4af37",
        "page-bg": "#f8f9fa", "text": "#2b2d42",
        "stat-bg": "rgba(255, 243, 243, 0.92)",
        "chip-border": "rgba(212, 175, 55, 0.4)",
    },
}

STYLE_RE = re.compile(r"<style>.*?</style>", re.S)
HERO_URL_RE = re.compile(r"\.hero\s*\{[^}]*?url\(\s*(['\"]?)([^'\")]+)\1\s*\)", re.S)


def build_head_block(stem, hero_url):
    pal = dict(PALETTES[stem])
    lines = []
    if hero_url:
        lines.append(f"            --hero-img: url('{hero_url}');")
    for key, value in pal.items():
        lines.append(f"            --{key}: {value};")
    body = "\n".join(lines)
    return (
        '<link rel="stylesheet" href="province.css">\n'
        "    <style>\n"
        "        /* رنگ‌های اختصاصی این استان. بقیه استایل‌ها در province.css است */\n"
        "        :root {\n"
        f"{body}\n"
        "        }\n"
        "    </style>"
    )


def main():
    if not (prov / "province.css").exists():
        print("فایل provinces/province.css پیدا نشد. اول آن را کنار صفحات استان بگذارید.")
        return

    backup.mkdir(exist_ok=True)
    done = skipped = 0

    for page in sorted(prov.glob("*.html")):
        stem = page.stem
        if stem == "coming-soon":
            continue
        if stem not in PALETTES:
            print(f"رد شد  {page.name}: رنگ این استان در PALETTES تعریف نشده")
            skipped += 1
            continue

        html = page.read_text(encoding="utf-8")
        if "province.css" in html:
            print(f"قبلاً تبدیل شده  {page.name}")
            skipped += 1
            continue

        m = STYLE_RE.search(html)
        if not m:
            print(f"رد شد  {page.name}: بلوک <style> پیدا نشد")
            skipped += 1
            continue

        hero = HERO_URL_RE.search(m.group(0))
        hero_url = hero.group(2) if hero else None
        if not hero_url:
            print(f"هشدار  {page.name}: عکس بالای صفحه پیدا نشد")

        shutil.copy2(page, backup / page.name)
        new_html = html[: m.start()] + build_head_block(stem, hero_url) + html[m.end():]
        page.write_text(new_html, encoding="utf-8")
        print(f"OK  {page.name}")
        done += 1

    print(f"\nتبدیل شد: {done}   ردشده: {skipped}   (نسخه پشتیبان‌ها در provinces/_backup)")


if __name__ == "__main__":
    main()

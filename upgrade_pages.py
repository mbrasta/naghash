#!/usr/bin/env python3
"""
اتصال صفحات استان به قابلیت‌های جدید (سفر من، نقشه، خدمات، PWA). دوباره‌اجراشدنی.

- به <head> هر صفحه manifest و theme-color اضافه می‌کند.
- قبل از province.js دو فایل province-meta.js و trip-core.js را اضافه می‌کند.
- از هر صفحه قبل از تغییر نسخه‌ی پشتیبان در provinces/_backup می‌گذارد (اگر نبود).

برای استان تازه‌ساخته: ۱) صفحه را بسازید ۲) استان را به PROVINCE_META در provinces/province-meta.js اضافه کنید
۳) این اسکریپت را اجرا کنید:
    python upgrade_pages.py
"""
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent
prov = root / "provinces"
backup = prov / "_backup"

SCRIPTS = (
    '<script src="province-meta.js" defer></script>\n'
    '    <script src="trip-core.js" defer></script>\n'
    '    '
)


def main():
    backup.mkdir(exist_ok=True)
    done = skipped = 0
    for page in sorted(prov.glob("*.html")):
        if page.stem == "coming-soon":
            continue
        html = page.read_text(encoding="utf-8")
        if "trip-core.js" in html:
            print(f"قبلاً ارتقا یافته  {page.name}")
            skipped += 1
            continue
        if '<script src="province.js"' not in html:
            print(f"رد شد  {page.name}: province.js پیدا نشد")
            skipped += 1
            continue

        if not (backup / page.name).exists():
            shutil.copy2(page, backup / page.name)

        color = re.search(r"--heading:\s*(#[0-9a-fA-F]{3,8})", html)
        head_add = '<link rel="manifest" href="../manifest.webmanifest">\n    '
        if color:
            head_add += f'<meta name="theme-color" content="{color.group(1)}">\n    '
        if 'rel="manifest"' not in html:
            html = html.replace('<link rel="stylesheet" href="province.css">',
                                head_add + '<link rel="stylesheet" href="province.css">', 1)
        html = html.replace('<script src="province.js" defer></script>',
                            SCRIPTS + '<script src="province.js" defer></script>', 1)
        page.write_text(html, encoding="utf-8")
        print(f"OK  {page.name}")
        done += 1
    print(f"\nارتقا یافت: {done}   ردشده: {skipped}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
بهینه‌سازی عکس‌ها برای اینترنت موبایل. دوباره‌اجراشدنی؛ فایل‌های اصلی را حذف نمی‌کند.

برای هر عکس در provinces/pic:
  نام.webp        (حداکثر عرض ۱۶۰۰)
  نام-960.webp    و   نام-480.webp   (فقط اگر عکس اصلی عریض‌تر باشد)
سپس صفحات استان را به‌روز می‌کند:
  - هر <img src="pic/..."> یک srcset و aspect-ratio می‌گیرد تا گوشی عکس کوچک‌تر بگیرد و صفحه نپرد.
  - عکس بالای صفحه (--hero-img) و preload آن به نسخه‌ی webp می‌رود.
  - از هر صفحه قبل از تغییر نسخه‌ی پشتیبان در provinces/_backup/pre-webp می‌گذارد.

نیازمند Pillow:  pip install pillow
اجرا (کنار index.html):
    python optimize_images.py
"""
import re
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow نصب نیست:  pip install pillow")

root = Path(__file__).resolve().parent
prov = root / "provinces"
pic = prov / "pic"
backup = prov / "_backup" / "pre-webp"

MAX_W = 1600
SIZES = (480, 960)
QUALITY = 78
RASTER = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
SIZES_ATTR = "(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 600px"


def save_webp(im, path, width):
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "transparency" in im.info else "RGB")
    tmp = path.with_suffix(".tmp.webp")
    im.save(tmp, "WEBP", quality=QUALITY, method=6)
    tmp.replace(path)
    return im.size


def process_images():
    """برمی‌گرداند: {نام پایه: (عرض نهایی، ارتفاع نهایی, [عرض‌های موجود])}"""
    info = {}
    saved_before = saved_after = 0
    if not pic.exists():
        print("پوشه‌ی provinces/pic پیدا نشد.")
        return info
    sources = {}
    for f in sorted(pic.iterdir()):
        if f.suffix.lower() in RASTER and not re.search(r"-(480|960)\.webp$", f.name, re.I):
            # اگر هم jpg و هم webp هم‌نام بود، اصل غیر webp را ترجیح بده
            key = f.stem
            if key not in sources or f.suffix.lower() != ".webp":
                sources[key] = f
    for stem, src in sources.items():
        try:
            im = Image.open(src)
            im.load()
        except Exception as e:
            print(f"رد شد  {src.name}: {e}")
            continue
        out_main = pic / f"{stem}.webp"
        widths = []
        if src.suffix.lower() != ".webp" or im.width > MAX_W:
            size = save_webp(im, out_main, MAX_W)
        else:
            size = im.size
        for w in SIZES:
            if im.width > w * 1.15:
                save_webp(im, pic / f"{stem}-{w}.webp", w)
                widths.append(w)
        widths.append(size[0])
        info[stem] = (size[0], size[1], widths)
        saved_before += src.stat().st_size
        saved_after += out_main.stat().st_size
        print(f"OK  {src.name} → {out_main.name}  ({src.stat().st_size // 1024} → {out_main.stat().st_size // 1024} KB)")
    if saved_before:
        print(f"\nحجم نسخه‌ی اصلی در برابر webp اصلی: {saved_before // 1024} KB → {saved_after // 1024} KB")
    return info


IMG_RE = re.compile(r"<img\b[^>]*>", re.S)
SRC_RE = re.compile(r'\ssrc="pic/([^"/]+)\.(?:jpe?g|png|webp|avif)"', re.I)


def rewrite_page(page, info):
    html = page.read_text(encoding="utf-8")
    orig = html

    def img_sub(m):
        tag = m.group(0)
        if "srcset=" in tag:
            return tag
        s = SRC_RE.search(tag)
        if not s or s.group(1) not in info:
            return tag
        stem = s.group(1)
        w, h, widths = info[stem]
        srcset = ", ".join(
            f"pic/{stem}-{x}.webp {x}w" if x != w else f"pic/{stem}.webp {w}w" for x in sorted(set(widths))
        )
        tag = tag.replace(s.group(0), f' src="pic/{stem}.webp" srcset="{srcset}" sizes="{SIZES_ATTR}"', 1)
        if "style=" not in tag:
            tag = tag[:-1].rstrip() + f' style="aspect-ratio:{w}/{h}" decoding="async">'
        return tag

    html = IMG_RE.sub(img_sub, html)

    def hero_sub(m):
        stem = m.group(2)
        return f"{m.group(1)}pic/{stem}.webp{m.group(3)}" if stem in info else m.group(0)

    html = re.sub(r"(--hero-img:\s*url\(\s*['\"]?)pic/([^'\")]+)\.(?:jpe?g|png|avif|webp)(['\"]?\s*\))", hero_sub, html)

    def pre_sub(m):
        stem = m.group(1)
        return m.group(0).replace(m.group(0), f'<link rel="preload" as="image" href="pic/{stem}.webp" type="image/webp">') if stem in info else m.group(0)

    html = re.sub(r'<link rel="preload" as="image" href="pic/([^".]+)\.[a-z]+"[^>]*>', pre_sub, html)

    if html != orig:
        backup.mkdir(parents=True, exist_ok=True)
        if not (backup / page.name).exists():
            shutil.copy2(page, backup / page.name)
        page.write_text(html, encoding="utf-8")
        return True
    return False


def main():
    info = process_images()
    if not info:
        return
    changed = 0
    for page in sorted(prov.glob("*.html")):
        if page.stem == "coming-soon":
            continue
        if rewrite_page(page, info):
            print(f"صفحه به‌روز شد  {page.name}")
            changed += 1
    print(f"\n{changed} صفحه به‌روز شد. پس از این، sw.js را با VERSION جدید منتشر کنید تا کش قدیمی عوض شود.")


if __name__ == "__main__":
    main()

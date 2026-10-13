/*
 * Service Worker: سایت بعد از اولین بازدید آفلاین هم کار می‌کند.
 *  - هسته‌ی سایت (صفحه‌ها، CSS/JS، نقشه، فونت) هنگام نصب ذخیره می‌شود.
 *  - عکس‌ها و تایل‌های نقشه هنگام دیدن ذخیره می‌شوند (cache-first، با سقف تعداد).
 *  - برای صفحه‌ها و کدها «اول کش، همزمان به‌روزرسانی» است.
 * هر وقت فایل‌های هسته را عوض کردید عدد VERSION را بالا ببرید.
 */
const VERSION = 'v1';
const CORE = `core-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const IMG_LIMIT = 120;
const TILE_LIMIT = 200;

const CORE_FILES = [
  './', 'index.html', 'trip.html', 'manifest.webmanifest', 'provinces-data.js', 'iran.svg',
  'fonts/Vazirmatn.woff2', 'icons/icon-192.png', 'icons/icon-512.png',
  'provinces/province.css', 'provinces/province.js', 'provinces/province-meta.js', 'provinces/trip-core.js',
  'provinces/coming-soon.html',
  'provinces/hamadan.html', 'provinces/isfahan.html', 'provinces/khuzestan.html', 'provinces/qazvin.html',
  'provinces/tehran.html', 'provinces/yazd.html', 'provinces/azerbaijan-west.html', 'provinces/fars.html', 'provinces/gilan.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CORE);
    // فایل ناموجود (مثلاً iran.svg یا فونت) نباید نصب را خراب کند
    await Promise.all(CORE_FILES.map(f => cache.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [CORE, RUNTIME];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function staleWhileRevalidate(req, fallbackUrl) {
  const cache = await caches.open(CORE);
  const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  const net = fetch(req).then(res => {
    if (res && res.ok && res.type !== 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) { net.catch(() => {}); return hit; }
  const res = await net;
  if (res) return res;
  if (fallbackUrl) { const fb = await cache.match(fallbackUrl); if (fb) return fb; }
  return new Response('آفلاین هستید و این صفحه هنوز ذخیره نشده است.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function cacheFirst(req, limit) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()); trim(RUNTIME, limit + TILE_LIMIT); }
    return res;
  } catch (err) {
    return new Response('', { status: 504 });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // وضعیت هوا: همیشه از شبکه (صفحه خودش آخرین مقدار را نگه می‌دارد)
  if (url.hostname.endsWith('open-meteo.com')) return;

  // تایل‌های نقشه و کتابخانه‌ی Leaflet
  if (url.hostname === 'tile.openstreetmap.org' || url.hostname === 'unpkg.com') {
    e.respondWith(cacheFirst(req, TILE_LIMIT));
    return;
  }

  if (url.origin !== location.origin) return;

  // عکس‌ها
  if (/\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(url.pathname) && !url.pathname.endsWith('iran.svg')) {
    e.respondWith(cacheFirst(req, IMG_LIMIT));
    return;
  }

  // صفحه‌ها و فایل‌های هسته
  e.respondWith(staleWhileRevalidate(req, req.mode === 'navigate' ? 'index.html' : null));
});

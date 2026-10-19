/*
 * Vercel Serverless Function:  GET /api/offers?province=tehran&to=تهران&from=مشهد
 * پاسخ:  { offers: [...] }  با همان قالب بالای provinces/travel-data.js
 *
 * ⚠ علی‌بابا، جاباما و رجا API عمومی ندارند و من قالب پاسخ هیچ‌کدام را نمی‌دانم؛ پس این تابع
 *   داده‌ی ساختگی نمی‌سازد و از آن سایت‌ها هم اسکرپ نمی‌کند. کارش این است که از «منبع‌های مجاز» بخواند
 *   و پاسخ را اعتبارسنجی و یکدست کند. منبع مجاز یعنی API رسمی/همکاری‌درآمدی که قرارداد استفاده‌اش را دارید
 *   یا سرویس تجمیع‌کننده‌ی خودتان.
 *
 * تنظیم در Vercel → Settings → Environment Variables (برای هر منبع):
 *   TRAVEL_SOURCE_<NAME>_URL   مثل  https://partner.example.com/search?from={from}&to={to}
 *                              ({from} و {to} و {province} جایگزین می‌شوند)
 *   TRAVEL_SOURCE_<NAME>_KEY   اختیاری؛ به‌صورت هدر Authorization: Bearer ارسال می‌شود
 *   TRAVEL_SOURCE_<NAME>_PROVIDER  یکی از alibaba | jabama | raja (برچسب منبع روی کارت)
 * اگر پاسخ منبع‌تان قالب دیگری دارد، فقط تابع normalize پایین را برایش تطبیق دهید.
 * اگر هیچ منبعی تنظیم نشده باشد، 503 برمی‌گردد و سایت خودکار به حالت «نمونه» برمی‌گردد.
 */
const TYPES = ['train', 'flight', 'bus', 'hotel'];
const PROVIDERS = ['alibaba', 'jabama', 'raja'];

function sources() {
  const out = [];
  for (const k of Object.keys(process.env)) {
    const m = /^TRAVEL_SOURCE_([A-Z0-9]+)_URL$/.exec(k);
    if (!m) continue;
    const n = m[1];
    out.push({ name: n, url: process.env[k], key: process.env['TRAVEL_SOURCE_' + n + '_KEY'], provider: (process.env['TRAVEL_SOURCE_' + n + '_PROVIDER'] || '').toLowerCase() });
  }
  return out;
}

const str = (v, max = 80) => String(v == null ? '' : v).slice(0, max);
const num = (v) => (Number.isFinite(+v) && +v >= 0 ? +v : null);

// فقط فیلدهای شناخته‌شده را نگه می‌دارد و url را به https محدود می‌کند.
function normalize(o, src, i) {
  if (!o || !TYPES.includes(o.type)) return null;
  const provider = PROVIDERS.includes(o.provider) ? o.provider : src.provider;
  const price = num(o.price);
  if (!PROVIDERS.includes(provider) || price == null || !/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) return null;
  let url = '';
  try { const u = new URL(o.url); if (u.protocol === 'https:') url = u.href; } catch (e) {}
  if (!url) return null;
  return {
    id: str(o.id || src.name + '.' + i, 60), type: o.type, provider, company: str(o.company), from: str(o.from), to: str(o.to),
    date: o.date, depart: str(o.depart, 8), arrive: str(o.arrive, 8), durationMin: num(o.durationMin) || 0, price,
    seatsLeft: num(o.seatsLeft) || 0, cls: str(o.cls), url, meta: typeof o.meta === 'object' && o.meta ? o.meta : {}
  };
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const to = str(q.to), from = str(q.from), province = str(q.province);
  const list = sources();
  if (!list.length) { res.status(503).json({ error: 'not_configured' }); return; }
  if (!to) { res.status(400).json({ error: 'to_required' }); return; }

  const results = await Promise.all(list.map(async (src) => {
    try {
      const url = src.url.replace('{from}', encodeURIComponent(from)).replace('{to}', encodeURIComponent(to)).replace('{province}', encodeURIComponent(province));
      if (!/^https:\/\//.test(url)) return [];
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(url, { signal: ctl.signal, headers: Object.assign({ Accept: 'application/json' }, src.key ? { Authorization: 'Bearer ' + src.key } : {}) });
      clearTimeout(t);
      if (!r.ok) return [];
      const j = await r.json();
      return (Array.isArray(j) ? j : j.offers || []).map((o, i) => normalize(o, src, i)).filter(Boolean);
    } catch (e) { return []; }
  }));

  const offers = results.flat();
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (!offers.length) { res.status(502).json({ error: 'no_offers' }); return; }
  res.status(200).json({ offers });
};

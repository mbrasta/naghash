/*
 * Vercel Serverless Function:  GET /api/route?coords=lng,lat;lng,lat;...
 * ماتریس فاصله و زمان جاده‌ای (OSRM /table) را از سمت سرور می‌گیرد و کش می‌کند، تا
 *  - مرورگر کاربر مجبور نباشد مستقیم به سرور OSRM وصل شود (فیلتر/CORS/کندی)،
 *  - فشار روی سرور نمایشی عمومی OSRM کم شود (پاسخ یک روز در CDN می‌ماند).
 * سرور دیگری (مثلاً OSRM اختصاصی) را با متغیر محیطی OSRM_URL در Vercel بگذارید؛ باید https باشد.
 * پاسخ همان JSON خود OSRM است: { code:'Ok', distances:[[متر]], durations:[[ثانیه]] }
 */
const COORD = /^-?\d{1,3}(\.\d{1,6})?,-?\d{1,2}(\.\d{1,6})?$/;

module.exports = async (req, res) => {
  const coords = String((req.query && req.query.coords) || '');
  const list = coords.split(';');
  if (list.length < 2 || list.length > 100 || !list.every((c) => COORD.test(c))) { res.status(400).json({ error: 'bad_coords' }); return; }
  // فقط محدوده‌ی ایران و اطراف (از سوءاستفاده به‌عنوان پروکسی عمومی جلوگیری می‌کند)
  const ok = list.every((c) => { const [lng, lat] = c.split(',').map(Number); return lng >= 43 && lng <= 64 && lat >= 24 && lat <= 40.5; });
  if (!ok) { res.status(400).json({ error: 'out_of_range' }); return; }

  const base = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  if (!/^https:\/\//.test(base)) { res.status(500).json({ error: 'bad_upstream' }); return; }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(base + '/table/v1/driving/' + coords + '?annotations=distance,duration', { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) { res.status(502).json({ error: 'upstream_' + r.status }); return; }
    const j = await r.json();
    if (j.code !== 'Ok' || !j.distances || !j.durations) { res.status(502).json({ error: 'upstream_bad' }); return; }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ code: 'Ok', distances: j.distances, durations: j.durations });
  } catch (e) { res.status(502).json({ error: 'upstream_failed' }); }
};

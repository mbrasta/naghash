/*
 * اطلاعات شخصی کاربر:  GET /api/data  ←  { data }     PUT /api/data  (بدنه: { trip, cart, origin })
 * فقط برای کاربر لاگین‌شده و فقط همان کاربر. ورودی اعتبارسنجی و کوتاه می‌شود.
 */
const db = require('./_lib/db');
const A = require('./_lib/auth');

const TYPES = ['train', 'flight', 'bus', 'hotel'], PROVIDERS = ['alibaba', 'jabama', 'raja'];
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v) => (Number.isFinite(+v) && +v >= 0 && v !== null && v !== '' ? +v : null);

function cleanTrip(t) {
  t = t && typeof t === 'object' ? t : {};
  const ids = Array.isArray(t.ids) ? t.ids.filter((i) => typeof i === 'string' && /^[a-z0-9._-]{1,60}$/i.test(i)).slice(0, 200) : [];
  return { ids: Array.from(new Set(ids)), days: Math.min(Math.max(parseInt(t.days, 10) || 0, 0), 30) };
}
function cleanCart(c) {
  if (!Array.isArray(c)) return [];
  const out = [];
  for (const o of c.slice(0, 50)) {
    if (!o || !TYPES.includes(o.type) || !PROVIDERS.includes(o.provider)) continue;
    let url = ''; try { const u = new URL(o.url); if (u.protocol === 'https:') url = u.href.slice(0, 1000); } catch (e) {}
    if (!url) continue;
    out.push({
      id: str(o.id, 160), type: o.type, provider: o.provider, company: str(o.company, 80), from: str(o.from, 60), to: str(o.to, 60),
      date: /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : '', depart: str(o.depart, 8), arrive: str(o.arrive, 8), durationMin: num(o.durationMin) || 0,
      price: num(o.price), seatsLeft: num(o.seatsLeft) || 0, cls: str(o.cls, 40), url, link: !!o.link, generic: !!o.generic, demo: !!o.demo
    });
  }
  return out;
}
function cleanOrigin(o) {
  if (!o || typeof o !== 'object' || !o.name) return null;
  const r = { name: str(o.name, 40) };
  if (Number.isFinite(+o.lat) && Number.isFinite(+o.lng) && Math.abs(+o.lat) <= 90 && Math.abs(+o.lng) <= 180) { r.lat = +o.lat; r.lng = +o.lng; }
  if (o.gps) r.gps = true;
  return r;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!db.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  try {
    const user = await A.currentUser(req);
    if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
    if (req.method === 'GET') {
      const raw = await db.cmd(['GET', 'data:' + user]);
      let data = null; try { data = raw ? JSON.parse(raw) : null; } catch (e) {}
      res.status(200).json({ data }); return;
    }
    if (req.method === 'PUT' && A.csrfOk(req)) {
      const b = A.body(req);
      const data = { trip: cleanTrip(b.trip), cart: cleanCart(b.cart), origin: cleanOrigin(b.origin), updated: Date.now() };
      const json = JSON.stringify(data);
      if (json.length > 60000) { res.status(413).json({ error: 'too_large' }); return; }
      await db.cmd(['SET', 'data:' + user, json]);
      res.status(200).json({ ok: true, updated: data.updated }); return;
    }
    res.status(400).json({ error: 'bad_request' });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

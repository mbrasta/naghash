/*
 * حساب کاربری:  GET /api/auth?action=me   POST /api/auth?action=register|login|logout|delete
 * نام کاربری کوچک لاتین/عدد/_ (۳ تا ۲۴ نویسه)، رمز حداقل ۸ نویسه. رمز با scrypt هش می‌شود،
 * نشست با کوکی امضاشده‌ی HttpOnly. نیاز به: SESSION_SECRET (حداقل ۳۲ نویسه‌ی تصادفی) و یک Redis (Upstash).
 * بازیابی رمز نداریم چون ایمیل/تلفن نمی‌گیریم.
 */
const db = require('./_lib/db');
const A = require('./_lib/auth');

const USER = /^[a-z0-9_]{3,24}$/;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!db.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  const action = String((req.query && req.query.action) || '');
  try {
    if (action === 'me' && req.method === 'GET') { res.status(200).json({ user: await A.currentUser(req) }); return; }
    if (req.method !== 'POST' || !A.csrfOk(req)) { res.status(400).json({ error: 'bad_request' }); return; }
    const b = A.body(req), ip = A.ip(req);

    if (action === 'logout') { A.setCookie(req, res, ''); res.status(200).json({ ok: true }); return; }

    const username = String(b.username || '').trim().toLowerCase(), password = String(b.password || '');
    if (!USER.test(username)) { res.status(400).json({ error: 'bad_username' }); return; }
    if (password.length < 8 || password.length > 128) { res.status(400).json({ error: 'bad_password' }); return; }

    if (action === 'register') {
      if (!(await A.rateOk('rl:reg:' + ip, 5, 3600))) { res.status(429).json({ error: 'rate_limited' }); return; }
      const rec = JSON.stringify({ pw: await A.hashPassword(password), created: Date.now() });
      if ((await db.cmd(['SET', 'user:' + username, rec, 'NX'])) !== 'OK') { res.status(409).json({ error: 'username_taken' }); return; }
      A.setCookie(req, res, A.signSession(username)); res.status(200).json({ user: username }); return;
    }

    if (action === 'login' || action === 'delete') {
      if (!(await A.rateOk('rl:login:' + ip + ':' + username, 10, 900))) { res.status(429).json({ error: 'rate_limited' }); return; }
      const raw = await db.cmd(['GET', 'user:' + username]);
      let rec = null; try { rec = raw ? JSON.parse(raw) : null; } catch (e) {}
      const ok = rec ? await A.verifyPassword(password, rec.pw) : (await A.dummyVerify(password), false);
      if (!ok) { res.status(401).json({ error: 'bad_credentials' }); return; }
      if (action === 'delete') {
        await db.cmd(['DEL', 'user:' + username]); await db.cmd(['DEL', 'data:' + username]);
        A.setCookie(req, res, ''); res.status(200).json({ ok: true }); return;
      }
      A.setCookie(req, res, A.signSession(username)); res.status(200).json({ user: username }); return;
    }
    res.status(400).json({ error: 'bad_request' });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

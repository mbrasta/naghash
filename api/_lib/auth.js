const crypto = require('crypto');
const { secret, cmd } = require('./db');

const COOKIE = 'naghash_session';
const MAX_AGE = 30 * 24 * 3600;

const scrypt = (pw, salt) => new Promise((ok, bad) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? bad(e) : ok(k))));

exports.hashPassword = async (pw) => {
  const salt = crypto.randomBytes(16);
  return 's1$' + salt.toString('hex') + '$' + (await scrypt(pw, salt)).toString('hex');
};
exports.verifyPassword = async (pw, stored) => {
  const p = String(stored || '').split('$');
  if (p.length !== 3 || p[0] !== 's1') return false;
  const want = Buffer.from(p[2], 'hex'), got = await scrypt(pw, Buffer.from(p[1], 'hex'));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
};
// برای یکسان نگه داشتن زمان پاسخ وقتی کاربر وجود ندارد
const DUMMY = 's1$' + '00'.repeat(16) + '$' + '00'.repeat(64);
exports.dummyVerify = (pw) => exports.verifyPassword(pw, DUMMY);

function mac(body) { return crypto.createHmac('sha256', secret()).update(body).digest('base64url'); }
exports.signSession = (username) => {
  const body = Buffer.from(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url');
  return body + '.' + mac(body);
};
function readSession(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(body, 'base64url').toString()); return o.exp > Date.now() / 1000 && typeof o.u === 'string' ? o.u : null; } catch (e) { return null; }
}
function cookies(req) {
  const out = {};
  String((req.headers && req.headers.cookie) || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
const isLocal = (req) => /^(localhost|127\.0\.0\.1)(:|$)/.test(String((req.headers && req.headers.host) || ''));
exports.setCookie = (req, res, token) => {
  res.setHeader('Set-Cookie', COOKIE + '=' + (token || '') + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + (token ? MAX_AGE : 0) + (isLocal(req) ? '' : '; Secure'));
};
// نام کاربری لاگین‌شده، یا null (و وجود کاربر در پایگاه‌داده را هم بررسی می‌کند)
exports.currentUser = async (req) => {
  const u = readSession(cookies(req)[COOKIE]);
  if (!u) return null;
  return (await cmd(['EXISTS', 'user:' + u])) === 1 ? u : null;
};
// محافظ CSRF: درخواست‌های تغییردهنده باید این هدر را داشته باشند (فرم سایت دیگر نمی‌تواند بفرستد)
exports.csrfOk = (req) => (req.headers && req.headers['x-requested-with']) === 'naghash';
exports.ip = (req) => String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim() || 'unknown';
exports.body = (req) => { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } } return b && typeof b === 'object' ? b : {}; };
// true یعنی مجاز؛ false یعنی از سقف گذشته
exports.rateOk = async (key, limit, windowSec) => {
  const n = await cmd(['INCR', key]);
  if (n === 1) await cmd(['EXPIRE', key, String(windowSec)]);
  return n <= limit;
};

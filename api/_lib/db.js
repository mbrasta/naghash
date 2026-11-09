/* دسترسی به Upstash Redis (از Vercel Marketplace) با REST؛ بدون وابستگی اضافه.
 * متغیرها را Vercel خودش می‌سازد: KV_REST_API_URL و KV_REST_API_TOKEN (یا UPSTASH_REDIS_REST_*). */
function conf() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
    secret: process.env.SESSION_SECRET || ''
  };
}
exports.configured = () => { const c = conf(); return !!(c.url && c.token && c.secret.length >= 32); };
exports.secret = () => conf().secret;

exports.cmd = async function cmd(args) {
  const c = conf();
  const r = await fetch(c.url, { method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('db_error');
  return j.result;
};

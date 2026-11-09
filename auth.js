/* حساب کاربری سمت مرورگر: ورود/ثبت‌نام، و همگام‌سازی «سفر من»، سبد بلیت و مبدا با حساب.
 * اگر سرویس حساب روی سرور تنظیم نشده باشد (api/auth → 503) هیچ دکمه‌ای نشان داده نمی‌شود و سایت مثل قبل با حافظه‌ی مرورگر کار می‌کند. */
(function () {
    if (window.NaghashAuth) return;
    var KEYS = { trip: 'iranTrip.v1', cart: 'iranCart.v1', originName: 'iranOrigin.v1', originObj: 'iranTripOrigin.v1' };
    var OWNER = 'naghashOwner', DIRTY = 'naghashDirty', PULLED = 'naghashPulled';
    var user = null, applying = false, timer = null, btn = null, dlg = null;

    function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
    function jparse(s, d) { try { var v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } }

    function api(method, path, body, extra) {
        var o = { method: method, credentials: 'same-origin', headers: { 'X-Requested-With': 'naghash' } };
        if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
        if (extra) for (var k in extra) o[k] = extra[k];
        return fetch(path, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); });
    }

    /* ── خواندن/نوشتن داده‌ی محلی ── */
    function collect() {
        var t = jparse(ls(KEYS.trip), {}), o = jparse(ls(KEYS.originObj), null), n = ls(KEYS.originName);
        return {
            trip: { ids: Array.isArray(t.ids) ? t.ids : [], days: t.days | 0 },
            cart: jparse(ls(KEYS.cart), []),
            origin: o && o.name ? o : (n ? { name: n } : null)
        };
    }
    function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    function apply(d) {
        applying = true;
        d = d || {};
        lsSet(KEYS.trip, JSON.stringify({ ids: (d.trip && d.trip.ids) || [], days: (d.trip && d.trip.days) | 0 }));
        lsSet(KEYS.cart, JSON.stringify(d.cart || []));
        var o = d.origin;
        if (o && o.lat != null) { lsSet(KEYS.originObj, JSON.stringify(o)); lsSet(KEYS.originName, o.gps ? null : o.name); }
        else { lsSet(KEYS.originObj, null); lsSet(KEYS.originName, o ? o.name : null); }
        try { window.dispatchEvent(new CustomEvent('tripchange')); } catch (e) {}
        applying = false;
    }
    function clearLocal() { apply({}); lsSet(OWNER, null); lsSet(DIRTY, null); }
    function hasData(d) { return !!(d && ((d.trip && d.trip.ids && d.trip.ids.length) || (d.cart && d.cart.length))); }
    function merge(server, local) {   // اجتماع؛ ترتیب سرور اول
        var ids = ((server.trip && server.trip.ids) || []).slice();
        local.trip.ids.forEach(function (i) { if (ids.indexOf(i) < 0) ids.push(i); });
        var cart = ((server.cart) || []).slice(), seen = {};
        cart.forEach(function (c) { seen[c.id] = 1; });
        local.cart.forEach(function (c) { if (c && !seen[c.id]) cart.push(c); });
        return {
            trip: { ids: ids, days: (server.trip && server.trip.days) || local.trip.days },
            cart: cart, origin: server.origin || local.origin
        };
    }

    /* ── ارسال به سرور ── */
    function push(keepalive) {
        if (!user) return Promise.resolve(false);
        return api('PUT', '/api/data', collect(), keepalive ? { keepalive: true } : null).then(function (r) {
            if (r.status === 200) { lsSet(DIRTY, null); return true; }
            if (r.status === 401) { user = null; paint(); }
            return false;
        }).catch(function () { return false; });
    }
    function touch() {
        if (!user || applying) return;
        lsSet(DIRTY, '1');
        clearTimeout(timer); timer = setTimeout(function () { push(false); }, 1200);
    }
    window.addEventListener('tripchange', touch);
    window.addEventListener('pagehide', function () { if (user && ls(DIRTY)) push(true); });

    /* ── بعد از ورود/ثبت‌نام ── */
    function afterLogin(name) {
        user = name;
        return api('GET', '/api/data').then(function (r) {
            var server = r.status === 200 ? r.body.data : null, local = collect(), owner = ls(OWNER), result;
            if (owner && owner !== name) result = server || {};                      // داده‌ی محلی کاربر دیگری است
            else if (!owner && hasData(local)) {
                var take = !hasData(server) || window.confirm('برنامه‌ی «سفر من» و سبدی که قبل از ورود ساخته‌اید به حساب «' + name + '» اضافه شود؟');
                result = take ? merge(server || { trip: { ids: [], days: 0 }, cart: [] }, local) : (server || {});
            } else result = owner === name && ls(DIRTY) ? local : (server || local);
            lsSet(OWNER, name); apply(result); lsSet(DIRTY, '1');
            return push(false);
        }).then(function () { location.reload(); });
    }
    function logout() {
        return api('POST', '/api/auth?action=logout', {}).then(function () { user = null; clearLocal(); location.reload(); });
    }

    /* ── همگام‌سازی بار اول هر نشست ── */
    function pullOnce() {
        if (!user) return;
        var pending = ls(DIRTY);
        if (pending) { push(false); return; }
        var done = false; try { done = sessionStorage.getItem(PULLED) === user; sessionStorage.setItem(PULLED, user); } catch (e) {}
        if (done) return;
        api('GET', '/api/data').then(function (r) {
            if (r.status !== 200 || !r.body.data) return;
            var d = r.body.data, l = collect();
            if (same({ t: d.trip, c: d.cart, o: d.origin && d.origin.name }, { t: l.trip, c: l.cart, o: l.origin && l.origin.name })) return;
            apply(d); lsSet(OWNER, user); location.reload();
        });
    }

    /* ── رابط کاربری ── */
    var MSG = {
        bad_username: 'نام کاربری باید ۳ تا ۲۴ نویسه و فقط حروف کوچک انگلیسی، عدد و _ باشد.',
        bad_password: 'رمز باید حداقل ۸ نویسه باشد.', username_taken: 'این نام کاربری قبلاً گرفته شده است.',
        bad_credentials: 'نام کاربری یا رمز اشتباه است.', rate_limited: 'تلاش‌های زیاد؛ کمی بعد دوباره امتحان کنید.'
    };
    function css() {
        if (document.getElementById('nh-css')) return;
        var s = document.createElement('style'); s.id = 'nh-css';
        s.textContent =
            '.nh-btn{font:inherit;cursor:pointer;border-radius:10px;padding:9px 12px;font-size:.92rem;white-space:nowrap;border:1px solid #475569;background:#0f172a;color:#fff}' +
            '.nh-btn:hover{background:#2563eb;border-color:#2563eb}.nh-btn.in{border-color:#4ade80}' +
            '.nh-fixed{position:fixed;top:12px;left:12px;z-index:1001;background:rgba(255,255,255,.95);color:#222;border-color:#cbd5e1;box-shadow:0 4px 15px rgba(0,0,0,.12)}' +
            '.nh-fixed:hover{color:#fff}' +
            '.nh-ov{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Vazirmatn,Tahoma,system-ui,sans-serif}' +
            '.nh-box{width:min(380px,100%);background:#1e293b;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);line-height:1.8}' +
            '.nh-box h2{margin:0 0 12px;font-size:1.15rem;color:#60a5fa}' +
            '.nh-tabs{display:flex;gap:6px;margin-bottom:12px}.nh-tabs button{flex:1;font:inherit;padding:8px;border-radius:10px;border:1px solid #475569;background:transparent;color:#cbd5e1;cursor:pointer}' +
            '.nh-tabs button[aria-pressed=true]{background:#2563eb;border-color:#2563eb;color:#fff}' +
            '.nh-box label{display:block;font-size:.85rem;color:#cbd5e1;margin-top:8px}' +
            '.nh-box input{width:100%;font:inherit;font-size:16px;padding:10px 12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;direction:ltr;text-align:left}' +
            '.nh-go{width:100%;margin-top:14px;font:inherit;padding:11px;border:0;border-radius:10px;background:#2563eb;color:#fff;cursor:pointer}.nh-go:disabled{opacity:.6}' +
            '.nh-err{min-height:1.4em;margin:8px 0 0;font-size:.85rem;color:#fbbf24}.nh-note{margin:10px 0 0;font-size:.78rem;color:#94a3b8}' +
            '.nh-row{display:flex;gap:8px;margin-top:12px}.nh-row button{flex:1;font:inherit;padding:10px;border-radius:10px;border:1px solid #475569;background:transparent;color:#fff;cursor:pointer}' +
            '.nh-row .danger{border-color:#ef4444;color:#fca5a5}' +
            '.nh-close{float:left;background:none;border:0;color:#94a3b8;font-size:1.3rem;cursor:pointer;line-height:1}' +
            '@media print{.nh-btn,.nh-ov{display:none!important}}';
        document.head.appendChild(s);
    }
    function paint() {
        if (!btn) return;
        btn.textContent = user ? 'حساب: ' + user : 'ورود / ثبت‌نام';
        btn.classList.toggle('in', !!user);
    }
    function mount() {
        css();
        btn = document.createElement('button'); btn.type = 'button'; btn.className = 'nh-btn';
        btn.setAttribute('aria-haspopup', 'dialog'); btn.addEventListener('click', openDialog);
        var slot = document.querySelector('[data-nh-mount]');
        if (slot) slot.appendChild(btn); else { btn.classList.add('nh-fixed'); document.body.appendChild(btn); }
        paint();
    }
    function closeDialog() { if (dlg) { dlg.remove(); dlg = null; } }
    function openDialog() {
        closeDialog();
        dlg = document.createElement('div'); dlg.className = 'nh-ov';
        var box = document.createElement('div'); box.className = 'nh-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'nh-h');
        dlg.appendChild(box); document.body.appendChild(dlg);
        dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(); });
        dlg.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDialog(); });
        user ? viewAccount(box) : viewForm(box, 'login');
    }
    function viewAccount(box) {
        box.innerHTML = '<button class="nh-close" type="button" aria-label="بستن">✕</button><h2 id="nh-h">حساب کاربری</h2>' +
            '<p>وارد شده‌اید: <b></b></p><p class="nh-note">برنامه‌ی سفر، سبد بلیت و مبدای شما به این حساب وصل است و روی هر دستگاه با ورود دیده می‌شود.</p>' +
            '<div class="nh-row"><button type="button" id="nh-out">خروج</button><button type="button" class="danger" id="nh-del">حذف حساب</button></div><p class="nh-err" id="nh-e"></p>';
        box.querySelector('b').textContent = user;
        box.querySelector('.nh-close').addEventListener('click', closeDialog);
        box.querySelector('#nh-out').addEventListener('click', function () { push(false).then(logout); });
        box.querySelector('#nh-del').addEventListener('click', function () {
            var pw = window.prompt('برای حذف دائمی حساب و همه‌ی داده‌هایش، رمز را وارد کنید:'); if (!pw) return;
            api('POST', '/api/auth?action=delete', { username: user, password: pw }).then(function (r) {
                if (r.status === 200) { user = null; clearLocal(); location.reload(); }
                else box.querySelector('#nh-e').textContent = MSG[r.body.error] || 'حذف انجام نشد.';
            });
        });
        box.querySelector('#nh-out').focus();
    }
    function viewForm(box, mode) {
        var reg = mode === 'register';
        box.innerHTML = '<button class="nh-close" type="button" aria-label="بستن">✕</button><h2 id="nh-h">' + (reg ? 'ساخت حساب' : 'ورود به حساب') + '</h2>' +
            '<div class="nh-tabs"><button type="button" data-m="login" aria-pressed="' + !reg + '">ورود</button><button type="button" data-m="register" aria-pressed="' + reg + '">ثبت‌نام</button></div>' +
            '<form novalidate><label>نام کاربری<input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="24"></label>' +
            '<label>رمز عبور<input name="p" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" maxlength="128"></label>' +
            '<p class="nh-err" role="alert"></p><button class="nh-go" type="submit">' + (reg ? 'ساخت حساب' : 'ورود') + '</button></form>' +
            '<p class="nh-note">' + (reg ? 'نام کاربری: حروف کوچک انگلیسی، عدد و _ (۳ تا ۲۴ نویسه). رمز: حداقل ۸ نویسه. ' : '') + 'ایمیل یا شماره نمی‌گیریم؛ بنابراین رمز فراموش‌شده قابل بازیابی نیست.</p>';
        box.querySelector('.nh-close').addEventListener('click', closeDialog);
        box.querySelectorAll('.nh-tabs button').forEach(function (b) { b.addEventListener('click', function () { viewForm(box, b.getAttribute('data-m')); }); });
        var f = box.querySelector('form'), err = box.querySelector('.nh-err'), go = box.querySelector('.nh-go');
        f.addEventListener('submit', function (e) {
            e.preventDefault(); err.textContent = ''; go.disabled = true;
            api('POST', '/api/auth?action=' + mode, { username: f.u.value.trim(), password: f.p.value }).then(function (r) {
                if (r.status === 200 && r.body.user) { closeDialog(); return afterLogin(r.body.user); }
                err.textContent = MSG[r.body.error] || 'مشکلی پیش آمد؛ دوباره تلاش کنید.'; go.disabled = false;
            }).catch(function () { err.textContent = 'اتصال برقرار نشد.'; go.disabled = false; });
        });
        f.u.focus();
    }

    /* ── شروع ── */
    function init() {
        if (!/^https?:$/.test(location.protocol)) return;
        api('GET', '/api/auth?action=me').then(function (r) {
            if (r.status !== 200) return;                 // سرویس حساب تنظیم نشده → چیزی نشان نمی‌دهیم
            user = r.body.user || null;
            mount(); pullOnce();
        }).catch(function () {});
    }
    window.NaghashAuth = { touch: touch, user: function () { return user; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* پنجره‌ی «ساعت بازدید و بلیت»: نوار بالا (نام استان + سبد)، فیلترها (راست)، کارت‌های بلیت (چپ). */
(function (g) {
    var TD = g.TravelData, TC = g.TripCore, META = g.PROVINCE_META;
    var CART_KEY = 'iranCart.v1';
    var root, st, offers = [], isDemo = true, cart = [], lastFocus;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fa(n) { return TC ? TC.faNum(n) : String(n); }
    function money(n) { return fa(Math.round(n).toLocaleString('en-US')) + ' تومان'; }
    function dur(m) { return m ? (m >= 60 ? fa(Math.floor(m / 60)) + ' ساعت' : '') + (m % 60 ? (m >= 60 ? ' و ' : '') + fa(m % 60) + ' دقیقه' : '') : ''; }
    function dayLabel(d) {
        try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'short', month: 'long', day: 'numeric' }).format(new Date(d + 'T12:00:00')); }
        catch (e) { return d; }
    }
    function loadCart() { try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { cart = []; } }
    function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }
    function inCart(id) { return cart.some(function (o) { return o.id === id; }); }

    function build(stem) {
        var m = META[stem];
        root = document.createElement('div');
        root.className = 'tv-overlay'; root.hidden = true;
        root.innerHTML =
            '<div class="tv-modal" role="dialog" aria-modal="true" aria-labelledby="tv-title">' +
            '<header class="tv-top"><h2 id="tv-title">استان ' + esc(m.name) + '</h2>' +
            '<div class="tv-top-btns"><button type="button" class="tv-cart" aria-label="سبد انتخاب‌ها">🛒 <b class="tv-cart-n">۰</b></button>' +
            '<button type="button" class="tv-close" aria-label="بستن">✕</button></div></header>' +
            '<div class="tv-body"><aside class="tv-filters" aria-label="فیلترها"></aside><main class="tv-main"></main></div></div>';
        document.body.appendChild(root);
        root.addEventListener('click', function (e) { if (e.target === root) close(); });
        root.querySelector('.tv-close').addEventListener('click', close);
        root.querySelector('.tv-cart').addEventListener('click', function () { st.view = st.view === 'cart' ? 'list' : 'cart'; render(); });
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { close(); return; }
            if (e.key !== 'Tab') return;
            var f = root.querySelectorAll('button:not([disabled]),input,select,a[href]'); if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    function matches(o) {
        if (st.types.length && st.types.indexOf(o.type) < 0) return false;
        if (st.company.length && st.company.indexOf(o.company) < 0) return false;
        if (st.provider.length && st.provider.indexOf(o.provider) < 0) return false;
        if (st.date && o.date !== st.date) return false;
        if (st.maxPrice && o.price > st.maxPrice) return false;
        if (st.q) {
            var hay = [o.company, o.from, o.to, o.cls, TD.PROVIDERS[o.provider].name, TD.TYPES[o.type].label].join(' ');
            if (hay.indexOf(st.q) < 0) return false;
        }
        return true;
    }

    function renderFilters() {
        var box = root.querySelector('.tv-filters');
        var maxP = Math.max.apply(null, offers.map(function (o) { return o.price; }).concat([1000000]));
        var step = 100000, top = Math.ceil(maxP / step) * step;
        var companies = [];
        offers.forEach(function (o) {
            if ((!st.types.length || st.types.indexOf(o.type) >= 0) && companies.indexOf(o.company) < 0) companies.push(o.company);
        });
        function chk(name, val, label, on) {
            return '<label class="tv-chk"><input type="checkbox" data-f="' + name + '" value="' + esc(val) + '"' + (on ? ' checked' : '') + '> ' + label + '</label>';
        }
        box.innerHTML =
            '<div class="tv-search"><input type="search" class="tv-q" placeholder="جستجو" aria-label="جستجو" value="' + esc(st.q) + '"><span aria-hidden="true">🔍</span></div>' +
            '<fieldset><legend>نوع</legend>' + Object.keys(TD.TYPES).map(function (k) {
                return chk('types', k, TD.TYPES[k].icon + ' ' + TD.TYPES[k].label, st.types.indexOf(k) >= 0);
            }).join('') + '</fieldset>' +
            '<fieldset><legend>تاریخ</legend><select class="tv-date" aria-label="تاریخ"><option value="">همه‌ی روزها</option>' +
            TD.days(10).map(function (d) { return '<option value="' + d + '"' + (st.date === d ? ' selected' : '') + '>' + esc(dayLabel(d)) + '</option>'; }).join('') + '</select></fieldset>' +
            '<fieldset><legend>حداکثر قیمت</legend><input type="range" class="tv-price" min="' + step + '" max="' + top + '" step="' + step + '" value="' + (st.maxPrice || top) + '" aria-label="حداکثر قیمت">' +
            '<output class="tv-price-out">' + (st.maxPrice ? money(st.maxPrice) : 'بدون محدودیت') + '</output></fieldset>' +
            '<fieldset><legend>شرکت</legend>' + companies.map(function (c) { return chk('company', c, esc(c), st.company.indexOf(c) >= 0); }).join('') + '</fieldset>' +
            '<fieldset><legend>سرویس‌دهنده</legend>' + Object.keys(TD.PROVIDERS).map(function (k) {
                return chk('provider', k, esc(TD.PROVIDERS[k].name), st.provider.indexOf(k) >= 0);
            }).join('') + '</fieldset>' +
            '<fieldset><legend>مرتب‌سازی</legend><select class="tv-sort" aria-label="مرتب‌سازی">' +
            [['price', 'ارزان‌ترین'], ['time', 'زودترین حرکت'], ['dur', 'کوتاه‌ترین مدت']].map(function (s) {
                return '<option value="' + s[0] + '"' + (st.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
            }).join('') + '</select></fieldset>' +
            '<button type="button" class="tv-reset">پاک کردن فیلترها</button>';

        var q = box.querySelector('.tv-q');
        q.addEventListener('input', function () { st.q = q.value.trim(); renderList(); });
        box.querySelectorAll('input[type=checkbox]').forEach(function (c) {
            c.addEventListener('change', function () {
                var arr = st[c.getAttribute('data-f')], i = arr.indexOf(c.value);
                if (c.checked && i < 0) arr.push(c.value); else if (!c.checked && i >= 0) arr.splice(i, 1);
                if (c.getAttribute('data-f') === 'types') st.company = [];
                if (st.view === 'cart') st.view = 'list';
                renderFilters(); renderMain();
            });
        });
        box.querySelector('.tv-date').addEventListener('change', function (e) { st.date = e.target.value; renderList(); });
        var pr = box.querySelector('.tv-price'), po = box.querySelector('.tv-price-out');
        pr.addEventListener('input', function () {
            st.maxPrice = +pr.value >= +pr.max ? 0 : +pr.value;
            po.textContent = st.maxPrice ? money(st.maxPrice) : 'بدون محدودیت'; renderList();
        });
        box.querySelector('.tv-sort').addEventListener('change', function (e) { st.sort = e.target.value; renderList(); });
        box.querySelector('.tv-reset').addEventListener('click', function () {
            st.types = []; st.company = []; st.provider = []; st.date = ''; st.maxPrice = 0; st.q = ''; renderFilters(); renderMain();
        });
    }

    function card(o) {
        var t = TD.TYPES[o.type], pv = TD.PROVIDERS[o.provider], on = inCart(o.id), hotel = o.type === 'hotel';
        var route = hotel ? esc(o.company) + ' · ' + esc(o.to) : esc(o.from) + ' ← ' + esc(o.to);
        var times = hotel ? 'ورود ' + esc(o.depart) + ' · خروج ' + esc(o.arrive) : esc(o.depart) + ' تا ' + esc(o.arrive) + (o.durationMin ? ' · ' + dur(o.durationMin) : '');
        return '<article class="tv-card' + (o.demo ? ' demo' : '') + '"><div class="tv-card-h"><span class="tv-type">' + t.icon + ' ' + t.label + '</span>' +
            (o.demo ? '<span class="tv-demo">نمونه</span>' : '') + '</div>' +
            '<h3>' + route + '</h3>' +
            '<ul><li>' + esc(hotel ? o.cls : o.company + ' · ' + o.cls) + '</li><li>' + esc(dayLabel(o.date)) + '</li><li>' + times + '</li>' +
            '<li>' + (hotel ? 'اتاق باقی‌مانده: ' : 'ظرفیت باقی‌مانده: ') + fa(o.seatsLeft) + '</li><li class="tv-src">منبع: ' + esc(pv.name) + '</li></ul>' +
            '<div class="tv-card-f"><b>' + money(o.price) + (hotel ? ' <small>/ شب</small>' : '') + '</b>' +
            '<button type="button" class="tv-add' + (on ? ' on' : '') + '" data-id="' + esc(o.id) + '" aria-pressed="' + on + '">' + (on ? '✓ در سبد' : '＋ افزودن به سبد') + '</button></div></article>';
    }

    function renderList() {
        var main = root.querySelector('.tv-main');
        var list = offers.filter(matches).sort(function (a, b) {
            if (st.sort === 'time') return (a.date + a.depart).localeCompare(b.date + b.depart);
            if (st.sort === 'dur') return (a.durationMin || 1e9) - (b.durationMin || 1e9);
            return a.price - b.price;
        });
        var grid = main.querySelector('.tv-grid');
        grid.innerHTML = list.length ? list.map(card).join('') : '<p class="tv-empty">موردی با این فیلترها پیدا نشد.</p>';
        main.querySelector('.tv-count').textContent = fa(list.length) + ' مورد';
        grid.querySelectorAll('.tv-add').forEach(function (b) {
            b.addEventListener('click', function () { toggleCart(b.getAttribute('data-id')); });
        });
    }

    function renderCart() {
        var main = root.querySelector('.tv-main'), total = 0;
        var rows = cart.map(function (o) {
            total += o.price; var pv = TD.PROVIDERS[o.provider] || { name: '' };
            return '<li><div><b>' + TD.TYPES[o.type].icon + ' ' + (o.type === 'hotel' ? esc(o.company + ' · ' + o.to) : esc(o.from + ' ← ' + o.to)) + '</b>' +
                '<small>' + esc(dayLabel(o.date)) + ' · ' + esc(o.depart) + ' · ' + esc(pv.name) + (o.demo ? ' · نمونه' : '') + '</small></div>' +
                '<span>' + money(o.price) + '</span><a class="tv-open" href="' + esc(o.url) + '" target="_blank" rel="noopener">مشاهده در سایت</a>' +
                '<button type="button" class="tv-rm" data-id="' + esc(o.id) + '" aria-label="حذف">✕</button></li>';
        }).join('');
        main.innerHTML = '<div class="tv-cart-view"><h3>سبد انتخاب‌ها</h3>' + (cart.length ?
            '<ul class="tv-cart-list">' + rows + '</ul><p class="tv-total">جمع: <b>' + money(total) + '</b></p>' +
            '<p class="tv-note">رزرو و پرداخت در این سایت انجام نمی‌شود؛ هر مورد را در سایت سرویس‌دهنده ببینید و قیمت نهایی را همان‌جا تأیید کنید.</p>' +
            '<button type="button" class="tv-clear">خالی کردن سبد</button>' : '<p class="tv-empty">سبد خالی است.</p>') +
            '<button type="button" class="tv-back">← بازگشت به بلیت‌ها</button></div>';
        main.querySelectorAll('.tv-rm').forEach(function (b) { b.addEventListener('click', function () { toggleCart(b.getAttribute('data-id')); }); });
        var c = main.querySelector('.tv-clear'); if (c) c.addEventListener('click', function () { cart = []; saveCart(); render(); });
        main.querySelector('.tv-back').addEventListener('click', function () { st.view = 'list'; render(); });
    }

    function renderMain() {
        var main = root.querySelector('.tv-main');
        if (st.view === 'cart') { renderCart(); return; }
        main.innerHTML = (isDemo ? '<p class="tv-banner" role="note">⚠ این فهرست نمونه (آزمایشی) است و قیمت و موجودی واقعی علی‌بابا، جاباما و رجا نیست. ' +
            'برای قیمت دقیق از دکمه‌ی «مشاهده در سایت» در سبد استفاده کنید.</p>' : '') +
            '<div class="tv-bar"><span class="tv-count"></span></div><div class="tv-grid"></div>';
        renderList();
    }

    function updateBadge() {
        root.querySelector('.tv-cart-n').textContent = fa(cart.length);
        root.querySelector('.tv-cart').classList.toggle('has', cart.length > 0);
    }
    function toggleCart(id) {
        var i = -1; cart.forEach(function (o, k) { if (o.id === id) i = k; });
        if (i >= 0) cart.splice(i, 1);
        else { var o = offers.filter(function (x) { return x.id === id; })[0]; if (o) cart.push(o); }
        saveCart(); render();
    }
    function render() { updateBadge(); renderFilters(); renderMain(); }

    function open(stem) {
        var m = META && META[stem]; if (!m || !TD) return;
        loadCart(); lastFocus = document.activeElement;
        if (!root) build(stem);
        st = { types: [], company: [], provider: [], date: '', maxPrice: 0, q: '', sort: 'price', view: 'list' };
        root.hidden = false; document.body.classList.add('tv-lock');
        root.querySelector('.tv-main').innerHTML = '<p class="tv-empty">در حال بارگذاری…</p>';
        updateBadge();
        TD.load(stem, m.city.name).then(function (r) {
            offers = r.offers; isDemo = r.demo; render();
            root.querySelector('.tv-close').focus();
        });
    }
    function close() {
        if (!root) return; root.hidden = true; document.body.classList.remove('tv-lock');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    g.TravelModal = { open: open, close: close };
})(window);

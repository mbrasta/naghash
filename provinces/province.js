/* رفتارهای مشترک صفحات استان:
 * ظهور بخش‌ها، ناوبری سریع، بزرگ‌نمایی گالری، بازگشت به بالا
 * + سفر من، فاصله و مسیریابی، نقشه‌ی جاذبه‌ها، اطلاعات کاربردی، لینک خدمات رزرو، ثبت Service Worker
 */
(function () {
    var TC = window.TripCore, META = window.PROVINCE_META;
    var stem = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '');
    var meta = META && META[stem];
    var enhanced = !!(TC && meta);

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    /* ───────── پیام کوتاه ───────── */
    var toastEl, toastTimer;
    function toast(msg) {
        if (!toastEl) {
            toastEl = el('div', 'toast'); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg; toastEl.classList.add('show');
        clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
    }

    /* ───────── سفر من: دکمه‌ی شناور + کارت‌ها ───────── */
    function setupTrip() {
        var fab = el('a', 'trip-fab', '<span aria-hidden="true">🧳</span> سفر من <b class="trip-count">۰</b>');
        fab.href = '../trip.html'; fab.setAttribute('aria-label', 'برنامه‌ی سفر من');
        document.body.appendChild(fab);

        function refresh() {
            var n = TC.Store.count();
            fab.querySelector('.trip-count').textContent = TC.faNum(n);
            fab.classList.toggle('has', n > 0);
            document.querySelectorAll('[data-trip-id]').forEach(function (b) {
                var on = TC.Store.has(b.getAttribute('data-trip-id'));
                b.classList.toggle('on', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                b.textContent = on ? '✓ در سفر من' : '＋ افزودن به سفر من';
            });
        }
        window.addEventListener('tripchange', refresh);

        function toggle(id) {
            var added = TC.Store.toggle(id);
            toast(added ? 'به برنامه‌ی سفر اضافه شد' : 'از برنامه‌ی سفر حذف شد');
        }

        var attr = document.getElementById('attractions');
        if (attr) attr.querySelectorAll('.card').forEach(function (card) {
            var h = card.querySelector('h3'); if (!h) return;
            var a = TC.byName(stem, h.textContent); if (!a) return;
            card.setAttribute('data-aid', a.id);

            var d = TC.distKm(meta.city, a);
            var box = el('div', 'card-actions');
            var chip = el('span', 'card-dist');
            chip.textContent = '📍 ' + TC.fmtKm(d) + ' تا ' + meta.city.name + (a.approx ? ' · تقریبی' : '');
            chip.title = 'فاصله‌ی خط مستقیم از مرکز شهر؛ مسیر جاده‌ای بیشتر است';

            var row = el('div', 'card-btns');
            var add = el('button', 'card-trip'); add.type = 'button'; add.setAttribute('data-trip-id', a.id);
            add.addEventListener('click', function () { toggle(a.id); });
            var go = el('a', 'card-route', '🧭 مسیریابی');
            go.href = TC.dirUrl(a); go.target = '_blank'; go.rel = 'noopener';
            go.setAttribute('aria-label', 'مسیریابی به ' + h.textContent);
            row.append(add, go);
            box.append(chip, row);
            card.appendChild(box);
        });
        refresh();
        return { toggle: toggle };
    }

    /* ───────── بخش‌های ساخته‌شده با داده ───────── */
    function insertSections() {
        var container = document.querySelector('.container'); if (!container) return null;
        var attr = document.getElementById('attractions');
        var season = container.querySelector('section[data-nav="زمان سفر"]');
        var facts = container.querySelector('section[data-nav="می‌دانستید؟"]');

        /* نقشه‌ی جاذبه‌ها */
        var mapSec = el('section', '', '');
        mapSec.id = 'map-section'; mapSec.setAttribute('data-nav', 'نقشه');
        var list = meta.attractions.map(function (a, i) {
            var p = TC.find(stem + '.' + a[0]);
            return '<li><span class="n">' + TC.faNum(i + 1) + '</span><a href="' + TC.placeUrl(p) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a>' +
                (p.approx ? ' <small>(موقعیت تقریبی)</small>' : '') + '</li>';
        }).join('');
        mapSec.innerHTML =
            '<h2>جاذبه‌ها روی نقشه</h2>' +
            '<div id="prov-map" class="prov-map" role="region" aria-label="نقشه‌ی جاذبه‌های ' + esc(meta.name) + '"><p class="map-wait">نقشه با رسیدن به این بخش بارگذاری می‌شود…</p></div>' +
            '<p class="map-note">نقشه: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>. ' +
            'روی هر نشان بزنید تا به سفر اضافه یا مسیریابی کنید. موقعیت برخی مکان‌ها تقریبی است.</p>' +
            '<details class="map-list"><summary>فهرست مکان‌ها با لینک نقشه</summary><ol>' + list + '</ol></details>';
        if (attr && attr.nextSibling) attr.parentNode.insertBefore(mapSec, attr.nextSibling); else container.appendChild(mapSec);

        /* اطلاعات کاربردی */
        var tehranD = stem === 'tehran' ? null : TC.distKm(meta.city, window.TEHRAN_POINT);
        var info = el('section'); info.id = 'practical'; info.setAttribute('data-nav', 'اطلاعات کاربردی');
        var access =
            '<li><b>پرواز:</b> ' + esc(meta.airport) + '</li>' +
            '<li><b>قطار:</b> ' + esc(meta.rail) + '</li>' +
            (tehranD ? '<li><b>تا تهران:</b> حدود ' + TC.fmtKm(tehranD) + ' خط مستقیم؛ مسیر جاده‌ای بیشتر است.</li>' : '');
        info.innerHTML =
            '<h2>اطلاعات کاربردی</h2>' +
            '<div class="info-grid">' +
            '<div class="info-card" id="wx"><h3>🌤 هوای اکنون در ' + esc(meta.city.name) + '</h3><p id="wx-body">در حال دریافت…</p></div>' +
            '<div class="info-card"><h3>🧭 نحوه‌ی رسیدن</h3><ul>' + access + '</ul></div>' +
            '<div class="info-card"><h3>☎ شماره‌های ضروری</h3><ul class="tel">' +
            '<li><a href="tel:110">۱۱۰</a> پلیس</li><li><a href="tel:115">۱۱۵</a> اورژانس</li><li><a href="tel:125">۱۲۵</a> آتش‌نشانی</li></ul></div>' +
            '<div class="info-card"><h3>🎟 ساعت بازدید و بلیت</h3><p>---</p></div>' +
            '</div>' + ticketTable() +
            '<p class="updated">آخرین به‌روزرسانی داده‌های این بخش: ' + esc(window.PROVINCE_META_UPDATED || '') + '</p>';
        (season || facts || mapSec).parentNode.insertBefore(info, season ? season.nextSibling : facts);

        /* خدمات رزرو */
        var S = window.SERVICE_LINKS || {}, anyAff = false;
        function links(arr) {
            return (arr || []).map(function (s) {
                if (s.affiliate) anyAff = true;
                var u = s.url.replace('{city}', encodeURIComponent(meta.city.name)).replace('{lat}', meta.city.lat).replace('{lng}', meta.city.lng);
                return '<a class="svc-link" href="' + esc(u) + '" target="_blank" rel="noopener' + (s.affiliate ? ' sponsored nofollow' : '') + '">' + esc(s.name) + '</a>';
            }).join('');
        }
        var svc = el('section'); svc.id = 'services'; svc.setAttribute('data-nav', 'رزرو و خدمات');
        svc.innerHTML =
            '<h2>اقامت، حمل‌ونقل و تور</h2>' +
            '<div class="svc-grid">' +
            '<div class="svc"><h3>🏨 اقامت در ' + esc(meta.city.name) + '</h3><div class="svc-links">' + links(S.hotel) +
            '<a class="svc-link alt" href="' + TC.searchUrl('هتل در ' + meta.city.name) + '" target="_blank" rel="noopener">هتل‌ها روی نقشه</a></div></div>' +
            '<div class="svc"><h3>🚆 قطار</h3><div class="svc-links">' + links(S.train) +
            '<a class="svc-link alt" href="' + TC.searchUrl('ایستگاه راه‌آهن ' + meta.city.name) + '" target="_blank" rel="noopener">ایستگاه روی نقشه</a></div></div>' +
            '<div class="svc"><h3>✈️ پرواز</h3><div class="svc-links">' + links(S.flight) +
            '<a class="svc-link alt" href="' + TC.searchUrl('فرودگاه ' + meta.city.name) + '" target="_blank" rel="noopener">فرودگاه روی نقشه</a></div></div>' +
            '<div class="svc"><h3>🧭 تور و راهنما</h3><div class="svc-links">' + links(S.tour) + '</div></div>' +
            '</div>' +
            '<p class="svc-note">رزرو در این سایت انجام نمی‌شود؛ با کلیک به سایت سرویس‌دهنده می‌روید و قیمت و موجودی را همان‌جا ببینید.' +
            (anyAff ? ' از برخی لینک‌ها ممکن است کمیسیون دریافت کنیم.' : '') + '</p>';
        info.parentNode.insertBefore(svc, info.nextSibling);
        return { mapSec: mapSec };
    }

    // جدول ساعت و بلیت فقط وقتی داده‌ی تأییدشده در ATTRACTION_INFO باشد
    function ticketTable() {
        var I = window.ATTRACTION_INFO || {}, rows = '';
        meta.attractions.forEach(function (a) {
            var x = I[stem + '.' + a[0]]; if (!x) return;
            rows += '<tr><td>' + esc(a[1]) + '</td><td>' + esc(x.hours || '—') + '</td><td>' + esc(x.ticket || '—') + '</td><td>' + esc(x.updated || '') + '</td></tr>';
        });
        return rows ? '<div class="tbl-wrap"><table class="tickets"><thead><tr><th>جاذبه</th><th>ساعت</th><th>بلیت</th><th>به‌روزرسانی</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '';
    }

    /* ───────── هوا (Open-Meteo، رایگان و بدون کلید) ───────── */
    var WX = [[0, '☀️', 'آفتابی'], [2, '⛅', 'نیمه‌ابری'], [3, '☁️', 'ابری'], [48, '🌫', 'مه'], [57, '🌦', 'نم‌نم باران'],
        [67, '🌧', 'باران'], [77, '🌨', 'برف'], [82, '🌧', 'رگبار'], [86, '🌨', 'بارش برف'], [99, '⛈', 'رعد و برق']];
    function wxDesc(c) { for (var i = 0; i < WX.length; i++) if (c <= WX[i][0]) return WX[i]; return WX[2]; }
    function loadWeather() {
        var body = document.getElementById('wx-body'); if (!body) return;
        var key = 'wx.' + stem, cached = null;
        try { cached = JSON.parse(localStorage.getItem(key)); } catch (e) {}
        function show(d, stale) {
            var w = wxDesc(d.code);
            body.innerHTML = '<span class="wx-big">' + w[1] + ' ' + TC.faNum(Math.round(d.t)) + '°C</span> ' + w[2] +
                '<br><small>باد ' + TC.faNum(Math.round(d.wind)) + ' کیلومتر بر ساعت' + (stale ? ' · آخرین مقدار ثبت‌شده (آفلاین)' : '') + '</small>';
        }
        if (cached && Date.now() - cached.at < 3600e3) { show(cached); return; }
        var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + meta.city.lat + '&longitude=' + meta.city.lng +
            '&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto';
        fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
            var c = j.current, d = { t: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m, at: Date.now() };
            try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) {}
            show(d);
        }).catch(function () {
            if (cached) show(cached, true); else body.textContent = 'دریافت وضعیت هوا ممکن نشد (اینترنت لازم است).';
        });
    }

    /* ───────── نقشه‌ی Leaflet با بارگذاری تنبل ───────── */
    function loadLeaflet(cb, fail) {
        if (window.L) return cb();
        var css = el('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; css.crossOrigin = '';
        document.head.appendChild(css);
        var s = el('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.crossOrigin = '';
        s.onload = cb; s.onerror = fail; document.head.appendChild(s);
    }
    function buildMap(api) {
        var box = document.getElementById('prov-map'); if (!box) return;
        box.innerHTML = '';
        var L = window.L;
        var map = L.map(box, { scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false }).setView([meta.city.lat, meta.city.lng], 8);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
        box.addEventListener('click', function () { map.scrollWheelZoom.enable(); });

        var pts = [[meta.city.lat, meta.city.lng]];
        L.marker([meta.city.lat, meta.city.lng], {
            icon: L.divIcon({ className: 'pin city', html: '<span>★</span>', iconSize: [30, 30], iconAnchor: [15, 15] }), title: meta.city.name
        }).addTo(map).bindPopup('<b>' + esc(meta.city.name) + '</b><br>مرکز استان');

        meta.attractions.forEach(function (a, i) {
            var p = TC.find(stem + '.' + a[0]); pts.push([p.lat, p.lng]);
            var m = L.marker([p.lat, p.lng], {
                icon: L.divIcon({ className: 'pin', html: '<span>' + TC.faNum(i + 1) + '</span>', iconSize: [30, 30], iconAnchor: [15, 15] }), title: p.name
            }).addTo(map);
            m.on('click', function () {
                var wrap = el('div', 'pop');
                wrap.innerHTML = '<b>' + esc(p.name) + '</b><br><small>' + TC.fmtKm(TC.distKm(meta.city, p)) + ' تا ' + esc(meta.city.name) + (p.approx ? ' · تقریبی' : '') + '</small>';
                var add = el('button', 'card-trip'); add.type = 'button'; add.setAttribute('data-trip-id', p.id);
                add.addEventListener('click', function () { api.toggle(p.id); });
                var go = el('a', 'card-route', '🧭 مسیریابی'); go.href = TC.dirUrl(p); go.target = '_blank'; go.rel = 'noopener';
                var r = el('div', 'card-btns'); r.append(add, go); wrap.appendChild(r);
                m.bindPopup(wrap).openPopup();
                window.dispatchEvent(new CustomEvent('tripchange'));   // وضعیت دکمه‌ی پاپ‌آپ
            });
        });
        map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 11 });
        setTimeout(function () { map.invalidateSize(); }, 300);
    }
    function lazyMap(mapSec, api) {
        var started = false;
        function go() {
            if (started) return; started = true;
            loadLeaflet(function () { buildMap(api); }, function () {
                var b = document.getElementById('prov-map');
                if (b) b.innerHTML = '<p class="map-wait">نقشه بارگذاری نشد (اینترنت لازم است). از «فهرست مکان‌ها» در پایین استفاده کنید.</p>';
                var d = mapSec.querySelector('details'); if (d) d.open = true;
            });
        }
        if ('IntersectionObserver' in window) {
            var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); go(); } }, { rootMargin: '400px' });
            o.observe(mapSec);
        } else go();
    }

    /* ───────── اجرا: اول بخش‌ها را بساز، بعد رفتارهای قبلی را وصل کن ───────── */
    var api = null;
    if (enhanced) {
        api = setupTrip();
        var made = insertSections();
        if (made) { lazyMap(made.mapSec, api); loadWeather(); }
    }

    var sections = Array.prototype.slice.call(document.querySelectorAll('section'));

    // ظهور تدریجی
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
            es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
        }, { threshold: 0.1 });
        sections.forEach(function (s) { io.observe(s); });
    } else { sections.forEach(function (s) { s.classList.add('visible'); }); }

    // ناوبری سریع از روی عنوان بخش‌ها
    var nav = document.querySelector('.quick-nav');
    if (nav) {
        var links = [];
        sections.forEach(function (s, i) {
            var h = s.querySelector('h2');
            if (!h) return;
            if (!h.id) h.id = 'sec-' + (i + 1);
            var a = document.createElement('a');
            a.href = '#' + h.id;
            a.textContent = (s.dataset.nav || h.textContent.split('؛')[0]).trim();
            nav.appendChild(a);
            links.push({ a: a, h: h });
        });
        window.addEventListener('scroll', function () {
            var cur = null;
            links.forEach(function (l) { if (l.h.getBoundingClientRect().top < window.innerHeight * 0.4) cur = l; });
            links.forEach(function (l) { l.a.classList.toggle('active', l === cur); });
            if (cur) { var x = cur.a.offsetLeft - nav.clientWidth / 2; nav.scrollTo ? nav.scrollTo({ left: x, behavior: 'auto' }) : 0; }
        }, { passive: true });
    }

    // بزرگ‌نمایی عکس گالری
    var lb = document.createElement('div');
    lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<img alt=""><p></p>';
    document.body.appendChild(lb);
    function close() { lb.classList.remove('open'); }
    lb.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.querySelectorAll('.gallery-item').forEach(function (it) {
        it.addEventListener('click', function () {
            var img = it.querySelector('img'), cap = it.querySelector('span');
            lb.querySelector('img').src = img.currentSrc || img.src;
            lb.querySelector('img').alt = img.alt;
            lb.querySelector('p').textContent = cap ? cap.textContent : '';
            lb.classList.add('open');
        });
    });

    // دکمه بازگشت به بالا
    var top = document.createElement('button');
    top.className = 'to-top'; top.type = 'button'; top.setAttribute('aria-label', 'بازگشت به بالای صفحه'); top.textContent = '↑';
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(top);
    window.addEventListener('scroll', function () { top.classList.toggle('show', window.scrollY > 700); }, { passive: true });

    // PWA: ثبت Service Worker (مسیر نسبت به provinces/)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', function () { navigator.serviceWorker.register('../sw.js').catch(function () {}); });
    }
})();

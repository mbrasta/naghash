/*
 * هسته‌ی برنامه‌ی سفر: ذخیره‌سازی (localStorage)، جست‌وجوی جاذبه در province-meta.js،
 * فاصله‌ی خط مستقیم، لینک مسیریابی و لینک اشتراکی. بدون سرور.
 * باید بعد از province-meta.js بارگذاری شود.
 */
(function (g) {
    var KEY = 'iranTrip.v1';
    var META = g.PROVINCE_META || {};
    var mem = { ids: [], days: 0 };          // اگر localStorage در دسترس نبود
    var index = {};

    Object.keys(META).forEach(function (stem) {
        var p = META[stem];
        p.attractions.forEach(function (a) {
            index[stem + '.' + a[0]] = {
                id: stem + '.' + a[0], slug: a[0], prov: stem, provName: p.name,
                name: a[1], lat: a[2], lng: a[3], approx: !!a[4], city: p.city
            };
        });
    });

    function norm(s) {
        return String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏ً-ٟ]/g, '').replace(/\s+/g, ' ').trim();
    }
    function byName(stem, name) {
        var p = META[stem]; if (!p) return null;
        var n = norm(name);
        for (var i = 0; i < p.attractions.length; i++) {
            if (norm(p.attractions[i][1]) === n) return index[stem + '.' + p.attractions[i][0]];
        }
        return null;
    }
    function find(id) { return index[id] || null; }

    /* ── اعداد و فاصله ── */
    function faNum(n, opts) { return Number(n).toLocaleString('fa-IR', opts || {}); }
    function rad(d) { return d * Math.PI / 180; }
    function distKm(a, b) {
        var R = 6371, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
        var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * R * Math.asin(Math.sqrt(h));
    }
    function fmtKm(km) {
        if (km < 1) return 'کمتر از ۱ کیلومتر';
        return faNum(km < 10 ? Math.round(km * 10) / 10 : Math.round(km), { maximumFractionDigits: 1 }) + ' کیلومتر';
    }

    /* ── لینک‌ها ── */
    function pt(p) { return p.lat.toFixed(5) + ',' + p.lng.toFixed(5); }
    function dirUrl(dest, origin, waypoints) {
        var u = 'https://www.google.com/maps/dir/?api=1&destination=' + pt(dest) + '&travelmode=driving';
        if (origin) u += '&origin=' + pt(origin);
        if (waypoints && waypoints.length) u += '&waypoints=' + waypoints.map(pt).join('%7C');
        return u;
    }
    function placeUrl(p) { return 'https://www.google.com/maps/search/?api=1&query=' + pt(p); }
    function searchUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }

    /* ── ذخیره‌سازی ── */
    function read() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return { ids: [], days: 0 };
            var o = JSON.parse(raw);
            return { ids: (o.ids || []).filter(function (i) { return index[i]; }), days: o.days | 0 };
        } catch (e) { return { ids: mem.ids.slice(), days: mem.days }; }
    }
    function write(o) {
        mem = { ids: o.ids.slice(), days: o.days | 0 };
        try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* حالت خصوصی */ }
        try { g.dispatchEvent(new CustomEvent('tripchange')); } catch (e) {}
    }
    var Store = {
        get: read,
        ids: function () { return read().ids; },
        count: function () { return read().ids.length; },
        has: function (id) { return read().ids.indexOf(id) > -1; },
        add: function (id) { var o = read(); if (index[id] && o.ids.indexOf(id) < 0) { o.ids.push(id); write(o); } },
        remove: function (id) { var o = read(); o.ids = o.ids.filter(function (i) { return i !== id; }); write(o); },
        toggle: function (id) { if (Store.has(id)) { Store.remove(id); return false; } Store.add(id); return true; },
        set: function (ids, days) { var o = read(); o.ids = ids.filter(function (i) { return index[i]; }); if (days != null) o.days = days | 0; write(o); },
        setDays: function (d) { var o = read(); o.days = d | 0; write(o); },
        clear: function () { write({ ids: [], days: 0 }); }
    };
    // همگام‌سازی بین تب‌ها
    g.addEventListener('storage', function (e) { if (e.key === KEY) { try { g.dispatchEvent(new CustomEvent('tripchange')); } catch (_) {} } });

    /* ── چیدمان هوشمند: نزدیک‌ترین همسایه، با شروع از اولین مورد ── */
    function smartOrder(ids) {
        var left = ids.filter(function (i) { return index[i]; });
        if (left.length < 3) return left;
        var out = [left.shift()];
        while (left.length) {
            var last = index[out[out.length - 1]], bi = 0, bd = Infinity;
            for (var i = 0; i < left.length; i++) {
                var d = distKm(last, index[left[i]]);
                if (d < bd) { bd = d; bi = i; }
            }
            out.push(left.splice(bi, 1)[0]);
        }
        return out;
    }

    /* ── لینک اشتراکی ── */
    function encodeShare(ids, days) {
        return 't=' + ids.join(',') + (days ? '&d=' + days : '');
    }
    function decodeShare(hash) {
        var h = String(hash || '').replace(/^#/, '');
        if (h.indexOf('t=') !== 0 && h.indexOf('&t=') < 0) return null;
        var o = {}; h.split('&').forEach(function (kv) { var p = kv.split('='); o[p[0]] = decodeURIComponent(p.slice(1).join('=')); });
        var ids = (o.t || '').split(',').filter(function (i) { return index[i]; });
        return ids.length ? { ids: ids, days: parseInt(o.d, 10) || 0 } : null;
    }

    g.TripCore = {
        META: META, find: find, byName: byName, norm: norm, all: function () { return Object.keys(index).map(find); },
        distKm: distKm, fmtKm: fmtKm, faNum: faNum, dirUrl: dirUrl, placeUrl: placeUrl, searchUrl: searchUrl,
        Store: Store, smartOrder: smartOrder, encodeShare: encodeShare, decodeShare: decodeShare
    };
})(window);

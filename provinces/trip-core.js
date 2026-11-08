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

    /* ── شهرهای مبدا (مرکز استان‌ها؛ مختصات تقریبی مرکز شهر) ── */
    var ORIGINS = [
        ['تهران', 35.6892, 51.3890], ['مشهد', 36.2605, 59.6168], ['اصفهان', 32.6546, 51.6680], ['شیراز', 29.5918, 52.5837],
        ['تبریز', 38.0962, 46.2738], ['کرج', 35.8400, 50.9391], ['اهواز', 31.3183, 48.6706], ['قم', 34.6416, 50.8764],
        ['کرمانشاه', 34.3142, 47.0650], ['ارومیه', 37.5527, 45.0760], ['رشت', 37.2808, 49.5832], ['زاهدان', 29.4963, 60.8629],
        ['کرمان', 30.2839, 57.0834], ['همدان', 34.7983, 48.5148], ['یزد', 31.8974, 54.3569], ['اردبیل', 38.2498, 48.2933],
        ['بندرعباس', 27.1865, 56.2808], ['اراک', 34.0917, 49.6892], ['زنجان', 36.6765, 48.4963], ['سنندج', 35.3219, 46.9862],
        ['قزوین', 36.2797, 50.0049], ['خرم‌آباد', 33.4878, 48.3558], ['گرگان', 36.8427, 54.4390], ['ساری', 36.5633, 53.0601],
        ['بجنورد', 37.4747, 57.3290], ['بیرجند', 32.8649, 59.2262], ['ایلام', 33.6374, 46.4227], ['سمنان', 35.5769, 53.3920],
        ['یاسوج', 30.6682, 51.5878], ['شهرکرد', 32.3256, 50.8644], ['بوشهر', 28.9234, 50.8203]
    ].map(function (c) { return { name: c[0], lat: c[1], lng: c[2] }; });

    /* ── فاصله و زمان جاده‌ای از روی نقشه (OSRM روی داده‌ی OpenStreetMap) ──
     * پیش‌فرض سرور نمایشی عمومی project-osrm است که برای استفاده‌ی سبک است؛ برای ترافیک واقعی سایت،
     * سرور خودتان یا سرویس پولی را در window.ROUTING_URL بگذارید (باید /table/v1/driving را پشتیبانی کند).
     * اگر سرویس در دسترس نبود، get() خط مستقیم برمی‌گرداند و road=false است. */
    var ROAD_KEY = 'iranRoad.v1', roadPairs = {}, roadFailedAt = 0, roadInflight = null;
    try { roadPairs = JSON.parse(localStorage.getItem(ROAD_KEY)) || {}; } catch (e) { roadPairs = {}; }
    function pk(p) { return p.lat.toFixed(4) + ',' + p.lng.toFixed(4); }
    function persistRoad() {
        try { if (Object.keys(roadPairs).length < 4000) localStorage.setItem(ROAD_KEY, JSON.stringify(roadPairs)); } catch (e) {}
    }
    function uniq(points) {
        var seen = {}, out = [];
        points.forEach(function (p) { if (p && !seen[pk(p)]) { seen[pk(p)] = 1; out.push(p); } });
        return out;
    }
    var Road = {
        failed: false, pending: false,
        retry: function () { roadFailedAt = 0; Road.failed = false; },
        get: function (a, b) {
            var k = pk(a) + '>' + pk(b), v = roadPairs[k];
            if (pk(a) === pk(b)) return { km: 0, min: 0, road: true };
            if (v) return { km: v[0], min: v[1], road: true };
            return { km: distKm(a, b), min: null, road: false };
        },
        missing: function (points) {
            var u = uniq(points);
            for (var i = 0; i < u.length; i++) for (var j = 0; j < u.length; j++) if (i !== j && !roadPairs[pk(u[i]) + '>' + pk(u[j])]) return true;
            return false;
        },
        /* Promise<boolean>: true یعنی داده‌ی تازه‌ای گرفته شد */
        prefetch: function (points) {
            var u = uniq(points);
            if (u.length < 2 || !Road.missing(u)) return Promise.resolve(false);
            if (u.length > 100) { Road.failed = true; return Promise.resolve(false); }
            if (Date.now() - roadFailedAt < 30000) return Promise.resolve(false);
            if (roadInflight) return roadInflight.then(function () { return Road.missing(u) ? Road.prefetch(u) : true; });
            var cs = u.map(function (p) { return p.lng.toFixed(5) + ',' + p.lat.toFixed(5); }).join(';');
            var q = '?annotations=distance,duration', direct = function (b) { return b.replace(/\/$/, '') + '/table/v1/driving/' + cs + q; };
            // اول سرور خودمان (/api/route: کش‌شده و بدون مشکل CORS)، بعد مستقیم OSRM
            var urls = g.ROUTING_URL ? [direct(g.ROUTING_URL)]
                : (/^https?:$/.test(location.protocol) ? ['/api/route?coords=' + cs] : []).concat([direct('https://router.project-osrm.org')]);
            function attempt(i) {
                if (i >= urls.length) return Promise.reject(0);
                var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 20000);
                return fetch(urls[i], ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
                    if (t) clearTimeout(t);
                    if (j.code !== 'Ok' || !j.distances || !j.durations) throw 0;
                    return j;
                }).catch(function () { if (t) clearTimeout(t); return attempt(i + 1); });
            }
            Road.pending = true;
            roadInflight = attempt(0).then(function (j) {
                for (var i = 0; i < u.length; i++) for (var k = 0; k < u.length; k++) {
                    var d = j.distances[i][k], m = j.durations[i][k];
                    if (i !== k && d != null && m != null) roadPairs[pk(u[i]) + '>' + pk(u[k])] = [Math.round(d / 100) / 10, Math.round(m / 60)];
                }
                Road.failed = false; persistRoad(); return true;
            }).catch(function () { Road.failed = true; roadFailedAt = Date.now(); return false; })
                .then(function (ok) { Road.pending = false; roadInflight = null; return ok; });
            return roadInflight;
        },
        /* چیدمان هوشمند از مبدای کاربر: نزدیک‌ترین همسایه + بهبود 2-opt روی فاصله‌ی جاده‌ای.
         * Promise<{ids, road}> */
        smartOrder: function (origin, ids) {
            var stops = ids.filter(function (i) { return index[i]; }).map(function (i) { return index[i]; });
            if (stops.length < 2 && !origin) return Promise.resolve({ ids: ids.slice(), road: false });
            var pts = [origin].concat(stops);
            return Road.prefetch(pts).then(function () {
                var n = pts.length, road = true, D = [];
                for (var i = 0; i < n; i++) { D.push([]); for (var j = 0; j < n; j++) { var r = i === j ? { km: 0, road: true } : Road.get(pts[i], pts[j]); D[i][j] = r.km; if (!r.road) road = false; } }
                var left = []; for (var a = 1; a < n; a++) left.push(a);
                var path = [0];
                while (left.length) {
                    var last = path[path.length - 1], bi = 0, bd = Infinity;
                    for (var q = 0; q < left.length; q++) if (D[last][left[q]] < bd) { bd = D[last][left[q]]; bi = q; }
                    path.push(left.splice(bi, 1)[0]);
                }
                var improved = true, guard = 0;
                while (improved && guard++ < 50) {
                    improved = false;
                    for (var x = 1; x < n - 1; x++) for (var y = x + 1; y < n; y++) {
                        var before = D[path[x - 1]][path[x]] + (y < n - 1 ? D[path[y]][path[y + 1]] : 0);
                        var after = D[path[x - 1]][path[y]] + (y < n - 1 ? D[path[x]][path[y + 1]] : 0);
                        if (after < before - 1e-6) {
                            var seg = path.slice(x, y + 1).reverse();
                            path = path.slice(0, x).concat(seg, path.slice(y + 1)); improved = true;
                        }
                    }
                }
                return { ids: path.slice(1).map(function (k) { return pts[k].id; }), road: road };
            });
        }
    };

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
        Store: Store, smartOrder: smartOrder, Road: Road, ORIGINS: ORIGINS, encodeShare: encodeShare, decodeShare: decodeShare
    };
})(window);

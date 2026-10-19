/*
 * داده‌ی «ساعت بازدید و بلیت»: قطار، پرواز، اتوبوس و اقامت به مقصد مرکز هر استان.
 *
 * ⚠ خواندن مستقیم قیمت و موجودی از علی‌بابا، جاباما و رجا داخل مرورگر ممکن نیست
 *   (API عمومی ندارند، CORS مسدود است و شرایط استفاده اجازه نمی‌دهد). پس دو حالت داریم:
 *   1) حالت زنده: آدرس سرویس خودتان (یا API همکاری‌درآمدی) را در window.TRAVEL_API_URL بگذارید.
 *      درخواست:  GET {URL}?province=tehran&to=تهران   ←  پاسخ: { offers: [ ... ] } با قالب پایین.
 *   2) حالت نمونه (پیش‌فرض): داده‌ی ساختگی و قطعی برای نمایش ساختار؛ همه‌ی کارت‌ها «نمونه» برچسب می‌خورند
 *      و دکمه‌ی «مشاهده در سایت» به صفحه‌ی اصلی سرویس می‌رود، نه یک بلیت واقعی.
 *
 * قالب هر پیشنهاد:
 *   { id, type:'train'|'flight'|'bus'|'hotel', provider:'alibaba'|'jabama'|'raja', company,
 *     from, to, date:'YYYY-MM-DD', depart:'HH:MM', arrive:'HH:MM', durationMin, price (تومان),
 *     seatsLeft, cls, url, meta:{...}, demo:true? }
 *   برای hotel: from خالی، price = قیمت هر شب، meta = { stars, nights }.
 */
(function (g) {
    var TYPES = {
        train: { label: 'قطار', icon: '🚆' },
        flight: { label: 'هواپیما', icon: '✈️' },
        bus: { label: 'اتوبوس', icon: '🚌' },
        hotel: { label: 'اقامت', icon: '🏨' }
    };
    var PROVIDERS = {
        alibaba: { name: 'علی‌بابا', url: 'https://www.alibaba.ir/' },
        jabama: { name: 'جاباما', url: 'https://www.jabama.com/' },
        raja: { name: 'رجا', url: 'https://www.raja.ir/' }
    };
    var COMPANIES = {
        train: ['رجا', 'فدک', 'سیر و سفر', 'رجا (VIP)'],
        flight: ['ایران‌ایر', 'ماهان', 'آسمان', 'کاسپین', 'قشم‌ایر'],
        bus: ['سیرو سفر', 'همسفر', 'ایران‌پیما', 'عدل‌رو'],
        hotel: ['هتل', 'هتل‌آپارتمان', 'اقامتگاه بوم‌گردی', 'ویلا و سوئیت']
    };
    var ORIGINS = ['تهران', 'مشهد', 'شیراز', 'اصفهان', 'تبریز', 'اهواز', 'رشت', 'کرمان'];
    var ALLOWED = { train: ['raja', 'alibaba'], flight: ['alibaba'], bus: ['alibaba'], hotel: ['jabama', 'alibaba'] };

    function seed(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return function () {
            h += 0x6D2B79F5; var t = Math.imul(h ^ h >>> 15, 1 | h);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function iso(d) {
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    function hhmm(min) { min = ((min % 1440) + 1440) % 1440; return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }
    function days(n) {
        var out = [], d = new Date(); d.setHours(12, 0, 0, 0);
        for (var i = 0; i < n; i++) { var x = new Date(d.getTime() + i * 864e5); out.push(iso(x)); }
        return out;
    }

    function demoOffers(stem, city) {
        var R = seed('trip-demo:' + stem), out = [], dates = days(10), n = 0;
        var origins = ORIGINS.filter(function (o) { return o !== city; });
        function pick(a) { return a[Math.floor(R() * a.length)]; }
        ['train', 'flight', 'bus'].forEach(function (type) {
            var count = type === 'flight' ? 10 : 8;
            for (var i = 0; i < count; i++) {
                var from = pick(origins), dur = type === 'flight' ? 60 + Math.floor(R() * 60) : type === 'train' ? 360 + Math.floor(R() * 420) : 300 + Math.floor(R() * 480);
                var base = type === 'flight' ? 2200000 : type === 'train' ? 650000 : 420000;
                var dep = 300 + Math.floor(R() * 17 * 60 / 15) * 15, prov = pick(ALLOWED[type]);
                out.push({
                    id: 'demo.' + stem + '.' + (++n), type: type, provider: prov, company: pick(COMPANIES[type]),
                    from: from, to: city, date: pick(dates), depart: hhmm(dep), arrive: hhmm(dep + dur), durationMin: dur,
                    price: Math.round(base * (0.7 + R() * 1.1) / 10000) * 10000, seatsLeft: 1 + Math.floor(R() * 20),
                    cls: type === 'flight' ? 'اکونومی' : type === 'train' ? pick(['۴ نفره', '۶ نفره', 'VIP']) : pick(['معمولی', 'اسکانیا', 'VIP ۲۴ نفره']),
                    url: PROVIDERS[prov].url, meta: {}, demo: true
                });
            }
        });
        for (var h = 0; h < 8; h++) {
            var hp = pick(ALLOWED.hotel), stars = 2 + Math.floor(R() * 4);
            out.push({
                id: 'demo.' + stem + '.' + (++n), type: 'hotel', provider: hp, company: pick(COMPANIES.hotel),
                from: '', to: city, date: pick(dates), depart: '۱۴:۰۰', arrive: '۱۲:۰۰', durationMin: 0,
                price: Math.round((600000 + stars * 500000) * (0.7 + R() * 0.9) / 10000) * 10000,
                seatsLeft: 1 + Math.floor(R() * 6), cls: stars + ' ستاره', url: PROVIDERS[hp].url,
                meta: { stars: stars, nights: 1 }, demo: true
            });
        }
        return out;
    }

    /* برمی‌گرداند Promise<{offers, demo}> */
    function load(stem, city) {
        var api = g.TRAVEL_API_URL;
        if (api) {
            var u = api + (api.indexOf('?') < 0 ? '?' : '&') + 'province=' + encodeURIComponent(stem) + '&to=' + encodeURIComponent(city);
            return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
                return { offers: (j.offers || []).filter(function (o) { return TYPES[o.type] && PROVIDERS[o.provider]; }), demo: false };
            }).catch(function () { return { offers: demoOffers(stem, city), demo: true, failed: true }; });
        }
        return Promise.resolve({ offers: demoOffers(stem, city), demo: true });
    }

    g.TravelData = { TYPES: TYPES, PROVIDERS: PROVIDERS, load: load, days: days };
})(window);

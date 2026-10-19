/*
 * داده‌ی «ساعت بازدید و بلیت»: قطار، پرواز، اتوبوس و اقامت به مقصد مرکز هر استان.
 *
 * ⚠ خواندن مستقیم قیمت و موجودی از علی‌بابا، جاباما و رجا داخل مرورگر ممکن نیست
 *   (API عمومی ندارند، CORS مسدود است و شرایط استفاده اجازه نمی‌دهد). پس دو حالت داریم:
 *   1) حالت زنده: پیش‌فرض /api/offers (فایل api/offers.js روی Vercel) است؛ بدون منبع تنظیم‌شده 503 می‌دهد و نمونه نشان داده می‌شود.
 *      آدرس دیگر را می‌توانید در window.TRAVEL_API_URL بگذارید.
 *      درخواست:  GET {URL}?province=tehran&to=تهران&from=مشهد   ←  پاسخ: { offers: [ ... ] } با قالب پایین.
 *   2) حالت لینک (پیش‌فرض بدون داده‌ی واقعی): کارت‌ها قیمت ندارند و دکمه‌ی «جست‌وجو در سایت» کاربر را با مبدا/مقصد/تاریخ
 *      به جست‌وجوی همان سرویس می‌برد (قالب‌ها در SEARCH پایین). داده‌ی نمونه فقط با window.TRAVEL_DEMO = true برای توسعه.
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
    /* شهرهای قابل انتخاب به‌عنوان مبدا (مرکز استان‌ها) */
    var CITIES = ['تهران', 'مشهد', 'اصفهان', 'شیراز', 'تبریز', 'کرج', 'اهواز', 'قم', 'کرمانشاه', 'ارومیه', 'رشت', 'زاهدان', 'کرمان', 'همدان',
        'یزد', 'اردبیل', 'بندرعباس', 'اراک', 'زنجان', 'سنندج', 'قزوین', 'خرم‌آباد', 'گرگان', 'ساری', 'بجنورد', 'بیرجند', 'ایلام',
        'سمنان', 'یاسوج', 'شهرکرد', 'بوشهر'];
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

    function demoOffers(stem, city, from) {
        var R = seed('trip-demo:' + stem + ':' + from), out = [], dates = days(10), n = 0;
        function pick(a) { return a[Math.floor(R() * a.length)]; }
        (from && from !== city ? ['train', 'flight', 'bus'] : []).forEach(function (type) {
            var count = type === 'flight' ? 6 : 5;
            for (var i = 0; i < count; i++) {
                var dur = type === 'flight' ? 60 + Math.floor(R() * 60) : type === 'train' ? 360 + Math.floor(R() * 420) : 300 + Math.floor(R() * 480);
                var base = type === 'flight' ? 2200000 : type === 'train' ? 650000 : 420000;
                var dep = 300 + Math.floor(R() * 17 * 60 / 15) * 15, prov = pick(ALLOWED[type]);
                out.push({
                    id: 'demo.' + stem + '.' + from + '.' + (++n), type: type, provider: prov, company: pick(COMPANIES[type]),
                    from: from, to: city, date: pick(dates), depart: hhmm(dep), arrive: hhmm(dep + dur), durationMin: dur,
                    price: Math.round(base * (0.7 + R() * 1.1) / 10000) * 10000, seatsLeft: 1 + Math.floor(R() * 20),
                    cls: type === 'flight' ? 'اکونومی' : type === 'train' ? pick(['۴ نفره', '۶ نفره', 'VIP']) : pick(['معمولی', 'اسکانیا', 'VIP ۲۴ نفره']),
                    url: PROVIDERS[prov].url, meta: {}, demo: true
                });
            }
        });
        R = seed('trip-demo-hotel:' + stem);
        for (var h = 0; h < 8; h++) {
            var hp = pick(ALLOWED.hotel), stars = 2 + Math.floor(R() * 4);
            out.push({
                id: 'demo.' + stem + '.hotel.' + (++n), type: 'hotel', provider: hp, company: pick(COMPANIES.hotel),
                from: '', to: city, date: pick(dates), depart: '۱۴:۰۰', arrive: '۱۲:۰۰', durationMin: 0,
                price: Math.round((600000 + stars * 500000) * (0.7 + R() * 0.9) / 10000) * 10000,
                seatsLeft: 1 + Math.floor(R() * 6), cls: stars + ' ستاره', url: PROVIDERS[hp].url,
                meta: { stars: stars, nights: 1 }, demo: true
            });
        }
        return out;
    }

    /* ── حالت لینک: وقتی داده‌ی واقعی نیست، کاربر را با مبدا/مقصد/تاریخ به جست‌وجوی خود سایت می‌فرستیم ──
     * قالب‌ها را خودتان از آدرس جست‌وجوی هر سایت در مرورگر کپی و اینجا جای‌گذاری کنید. جاهای قابل‌استفاده:
     *   {from} {to} نام شهر · {fromCode} {toCode} کد شهر از CITY_CODES ·
     *   {date} تاریخ میلادی 2026-10-20 · {dateFa} تاریخ شمسی 1405-07-28
     * تا وقتی قالبی جای‌گذاری نشده، دکمه به صفحه‌ی اصلی همان سایت می‌رود (و روی کارت همین نوشته می‌شود).
     */
    /* کد فرودگاه/شهر برای آدرس پرواز علی‌بابا. شهری که اینجا نیست (کرج، قم، قزوین، سمنان: بدون پرواز تجاری) کارت پرواز نمی‌گیرد.
     * کدها از دانش عمومی IATA است؛ هر کدام را یک بار در علی‌بابا امتحان کنید. */
    var CITY_CODES = {
        'تهران': 'THR', 'مشهد': 'MHD', 'اصفهان': 'IFN', 'شیراز': 'SYZ', 'تبریز': 'TBZ', 'اهواز': 'AWZ', 'کرمانشاه': 'KSH', 'ارومیه': 'OMH',
        'رشت': 'RAS', 'زاهدان': 'ZAH', 'کرمان': 'KER', 'همدان': 'HDM', 'یزد': 'AZD', 'اردبیل': 'ADU', 'بندرعباس': 'BND', 'اراک': 'AJK',
        'زنجان': 'JWN', 'سنندج': 'SDG', 'خرم‌آباد': 'KHD', 'گرگان': 'GBT', 'ساری': 'SRY', 'بجنورد': 'BJB', 'بیرجند': 'XBJ', 'ایلام': 'IIL',
        'یاسوج': 'YES', 'شهرکرد': 'CQD', 'بوشهر': 'BUZ'
    };
    var SEARCH = {
        train: [{ provider: 'raja', url: 'https://www.raja.ir/' }, { provider: 'alibaba', url: 'https://www.alibaba.ir/' }],
        flight: [{ provider: 'alibaba', url: 'https://www.alibaba.ir/flights/{fromCode}-{toCode}?adult=1&child=0&infant=0&departing={dateFa}' }],
        bus: [{ provider: 'alibaba', url: 'https://www.alibaba.ir/' }],
        hotel: [{ provider: 'jabama', url: 'https://www.jabama.com/' }, { provider: 'alibaba', url: 'https://www.alibaba.ir/' }]
    };
    function faDate(d) {
        try {
            var parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(d + 'T12:00:00')), o = {};
            parts.forEach(function (p) { o[p.type] = p.value; });
            return o.year + '-' + o.month + '-' + o.day;
        } catch (e) { return d; }
    }
    function fill(tpl, v) {
        return tpl.replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : encodeURIComponent(v[k]); });
    }
    function linkOffers(stem, city, from, date) {
        var out = [], d = date || days(2)[1], v = {
            from: from, to: city, fromCode: CITY_CODES[from] || '', toCode: CITY_CODES[city] || '', date: d, dateFa: faDate(d)
        };
        Object.keys(SEARCH).forEach(function (type) {
            if (type !== 'hotel' && (!from || from === city)) return;
            SEARCH[type].forEach(function (x) {
                if (/Code\}/.test(x.url) && (!CITY_CODES[from] || !CITY_CODES[city])) return;
                out.push({
                    id: 'link.' + type + '.' + x.provider + '.' + (type === 'hotel' ? '' : from + '.') + city + '.' + d,
                    type: type, provider: x.provider, company: TYPES[type].label, from: type === 'hotel' ? '' : from, to: city, date: d,
                    depart: '', arrive: '', durationMin: 0, price: null, seatsLeft: 0, cls: '', url: fill(x.url, v), meta: {},
                    link: true, generic: x.url.indexOf('{') < 0
                });
            });
        });
        return out;
    }

    /* برمی‌گرداند Promise<{offers, mode:'live'|'links'|'demo'}> */
    function load(stem, city, from, date) {
        var api = g.TRAVEL_API_URL === undefined ? (/^https?:$/.test(location.protocol) ? '/api/offers' : '') : g.TRAVEL_API_URL;
        function fallback(extra) {
            var r = g.TRAVEL_DEMO ? { offers: demoOffers(stem, city, from), mode: 'demo', demo: true } : { offers: linkOffers(stem, city, from, date), mode: 'links', demo: false };
            return Object.assign(r, extra || {});
        }
        if (api) {
            var u = api + (api.indexOf('?') < 0 ? '?' : '&') + 'province=' + encodeURIComponent(stem) + '&to=' + encodeURIComponent(city) + '&from=' + encodeURIComponent(from || '');
            return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
                return { offers: (j.offers || []).filter(function (o) { return TYPES[o.type] && PROVIDERS[o.provider]; }), mode: 'live', demo: false };
            }).catch(function () { return fallback({ failed: true }); });
        }
        return Promise.resolve(fallback());
    }

    g.TravelData = { CITIES: CITIES, TYPES: TYPES, PROVIDERS: PROVIDERS, load: load, days: days, faDate: faDate };
})(window);

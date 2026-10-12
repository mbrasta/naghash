/* رفتارهای مشترک صفحات استان: ظهور بخش‌ها، ناوبری سریع، بزرگ‌نمایی گالری، بازگشت به بالا */
(function () {
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

    // ── سفر من: ذخیره‌ی جاذبه‌ها در localStorage ──
    var KEY = 'trip.v1';
    var stem = (location.pathname.split('/').pop() || '').replace('.html', '');
    function load() { try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.items)) return d; } catch (e) {} return { days: 3, items: [] }; }
    function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }
    function has(d, id) { return d.items.some(function (x) { return x.id === id; }); }

    var toast = document.createElement('div');
    toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
    var tt;
    function say(m) { toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, 2200); }

    var fab = document.createElement('a');
    fab.className = 'trip-fab'; fab.href = '../trip.html';
    document.body.appendChild(fab);
    function refresh() {
        var d = load();
        fab.innerHTML = '🧳 سفر من' + (d.items.length ? ' <b>' + d.items.length + '</b>' : '');
        document.querySelectorAll('.card .add-trip').forEach(function (b) {
            var on = has(d, b.dataset.id);
            b.classList.toggle('on', on);
            b.textContent = on ? '✓ در سفر شما' : '＋ افزودن به سفر';
            b.setAttribute('aria-pressed', on);
        });
    }
    document.querySelectorAll('#attractions .card').forEach(function (c) {
        var title = c.querySelector('h3').textContent.trim();
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'add-trip'; b.dataset.id = stem + ':' + title;
        b.addEventListener('click', function () {
            var d = load(), id = b.dataset.id;
            if (has(d, id)) { d.items = d.items.filter(function (x) { return x.id !== id; }); say('از سفر شما حذف شد'); }
            else {
                d.items.push({ id: id, p: stem, t: title, i: c.querySelector('.ico').textContent, d: c.querySelector('p').textContent, day: 0 });
                say('به سفر شما اضافه شد');
            }
            if (!save(d)) say('ذخیره‌سازی مرورگر در دسترس نیست');
            refresh();
        });
        c.appendChild(b);
    });
    refresh();
    window.addEventListener('storage', refresh);
})();

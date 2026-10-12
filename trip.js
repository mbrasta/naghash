(function () {
    var KEY = 'trip.v1';
    var NAMES = { fars:'فارس', tehran:'تهران', yazd:'یزد', 'azerbaijan-west':'آذربایجان غربی', gilan:'گیلان', qazvin:'قزوین', hamadan:'همدان', isfahan:'اصفهان', khuzestan:'خوزستان' };
    var app = document.getElementById('app');
    var toast = document.getElementById('toast'), tt;
    function say(m) { toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, 2000); }
    function load() { try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.items)) { d.days = d.days || 3; return d; } } catch (e) {} return { days: 3, items: [] }; }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { say('ذخیره‌سازی مرورگر در دسترس نیست'); } }
    var data = load();
    function el(tag, attrs, kids) {
        var e = document.createElement(tag);
        for (var k in (attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
        (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
        return e;
    }
    function pname(p) { return NAMES[p] || p; }
    function dayOf(x) { return Math.min(Math.max(x.day || 0, 0), data.days); } // 0 = بدون روز

    function move(item, dir) {
        var group = data.items.filter(function (x) { return dayOf(x) === dayOf(item); });
        var i = group.indexOf(item), j = i + dir;
        if (j < 0 || j >= group.length) return;
        var a = data.items.indexOf(item), b = data.items.indexOf(group[j]);
        data.items[a] = group[j]; data.items[b] = item; save(); render();
    }
    function remove(item) { data.items = data.items.filter(function (x) { return x !== item; }); save(); render(); }

    function itemNode(x) {
        var sel = el('select', { 'aria-label': 'روز', onchange: function () { x.day = +sel.value; save(); render(); } });
        sel.appendChild(el('option', { value: 0, text: 'بدون روز' }));
        for (var d = 1; d <= data.days; d++) sel.appendChild(el('option', { value: d, text: 'روز ' + d }));
        sel.value = dayOf(x);
        return el('div', { class: 'item' }, [
            el('span', { class: 'ico', text: x.i, 'aria-hidden': 'true' }),
            el('div', { class: 'info' }, [
                el('b', { text: x.t }), el('small', { text: 'استان ' + pname(x.p) }), el('p', { text: x.d }),
                el('div', { class: 'acts' }, [
                    sel,
                    el('button', { type: 'button', text: '↑', 'aria-label': 'بالاتر', onclick: function () { move(x, -1); } }),
                    el('button', { type: 'button', text: '↓', 'aria-label': 'پایین‌تر', onclick: function () { move(x, 1); } }),
                    el('a', { href: 'https://www.google.com/maps/search/' + encodeURIComponent(x.t + ' ' + pname(x.p)), target: '_blank', rel: 'noopener', text: '📍 نقشه' }),
                    el('button', { type: 'button', text: '🗑 حذف', onclick: function () { remove(x); } })
                ])
            ])
        ]);
    }

    function asText() {
        var out = ['سفر من — نقشه هوشمند ایران', ''];
        for (var d = 0; d <= data.days; d++) {
            var g = data.items.filter(function (x) { return dayOf(x) === d; });
            if (!g.length) continue;
            out.push(d ? 'روز ' + d : 'هنوز بدون روز');
            g.forEach(function (x, i) { out.push('  ' + (i + 1) + '. ' + x.t + ' (' + pname(x.p) + ')'); });
            out.push('');
        }
        return out.join('\n');
    }
    function share() {
        var t = asText();
        if (navigator.share) { navigator.share({ title: 'سفر من', text: t }).catch(function () {}); return; }
        if (navigator.clipboard) { navigator.clipboard.writeText(t).then(function () { say('متن برنامه کپی شد'); }, function () { say('کپی نشد'); }); }
        else say('مرورگر از کپی پشتیبانی نمی‌کند');
    }

    function render() {
        app.textContent = '';
        if (!data.items.length) {
            app.appendChild(el('div', { class: 'panel empty' }, [
                el('div', { class: 'big', text: '🗺' }),
                el('p', { text: 'هنوز چیزی به سفرتان اضافه نکرده‌اید.' }),
                el('p', {}, [document.createTextNode('در صفحه‌ی هر استان، دکمه‌ی «＋ افزودن به سفر» را روی جاذبه‌ها بزنید. '), el('a', { href: 'index.html', text: 'رفتن به نقشه' })])
            ]));
            return;
        }
        var daysSel = el('select', { id: 'days', onchange: function () { data.days = +daysSel.value; save(); render(); } });
        for (var n = 1; n <= 14; n++) daysSel.appendChild(el('option', { value: n, text: n + ' روز' }));
        daysSel.value = data.days;
        app.appendChild(el('div', { class: 'panel bar' }, [
            el('label', { for: 'days', text: 'مدت سفر: ' }), daysSel,
            el('span', { text: data.items.length + ' جاذبه از ' + new Set(data.items.map(function (x) { return x.p; })).size + ' استان' }),
            el('div', { class: 'btns' }, [
                el('button', { class: 'btn primary', type: 'button', text: 'اشتراک / کپی', onclick: share }),
                el('button', { class: 'btn', type: 'button', text: 'چاپ', onclick: function () { window.print(); } }),
                el('button', { class: 'btn danger', type: 'button', text: 'پاک‌کردن همه', onclick: function () { if (confirm('همه‌ی موارد سفر پاک شود؟')) { data.items = []; save(); render(); } } })
            ])
        ]));
        for (var d = 1; d <= data.days; d++) app.appendChild(dayPanel(d));
        var free = data.items.filter(function (x) { return dayOf(x) === 0; });
        if (free.length) app.appendChild(dayPanel(0));

        var provs = [];
        data.items.forEach(function (x) { if (provs.indexOf(x.p) < 0) provs.push(x.p); });
        var chips = el('div', { class: 'chips' });
        Object.keys(NAMES).forEach(function (k) { chips.appendChild(el('a', { href: 'provinces/' + k + '.html', text: pname(k) })); });
        app.appendChild(el('div', { class: 'panel', id: 'addmore' }, [el('b', { text: 'افزودن از استان‌های دیگر' }), chips]));
    }
    function dayPanel(d) {
        var g = data.items.filter(function (x) { return dayOf(x) === d; });
        var p = el('div', { class: 'panel day' }, [el('h2', {}, [el('span', { text: d ? 'روز ' + d : 'هنوز بدون روز' }), el('small', { text: g.length + ' مورد' })])]);
        if (!g.length) p.appendChild(el('p', { class: 'empty', text: 'خالی است؛ از منوی هر جاذبه این روز را انتخاب کنید.' }));
        g.forEach(function (x) { p.appendChild(itemNode(x)); });
        return p;
    }
    window.addEventListener('storage', function () { data = load(); render(); });
    render();
})();

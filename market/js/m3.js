/* m3: chapter 5 (business models & pricing) and chapter 6 (trends & consolidation).
   Data: MD.r.pricing_history, MD.r.business_models, MD.r.entrants_timeline (via MD.extra.m3_consolidation),
   MD.r.company_size, MD.r.regulation_trends, MD.matrix, MD.extra.m3_* (curated, see their "derivation"). */
(function () {
  'use strict';
  const MD = window.MD, UI = window.UI, d3 = window.d3;
  if (!MD || !UI || !d3) return;
  const X = MD.extra || {};
  const R = MD.r || {};
  const C = (t) => UI.css(t) || '#888';
  const $ = (id) => document.getElementById(id);
  const esc = UI.esc, fmt = UI.fmt;
  const NOW = new Date(2026, 10, 25);

  /* ---------- helpers ---------- */
  const pd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 7) - 1, d || 15); };
  const tw = (s, fs) => String(s).length * (fs || 11) * 0.56;
  const widthOf = (el) => Math.max(260, Math.floor(el.getBoundingClientRect().width || el.clientWidth || 600));
  const isLow = (c) => c === 'low';
  const money = (v, d) => (v == null ? '–' : fmt(v, d == null ? (Number.isInteger(v) ? 0 : 2) : d));
  const host = (u) => { try { if (/raw\/gruppe|group-research/.test(u || '')) return 'team research artifact, unverified'; return u && /^https?:/.test(u) ? new URL(u).hostname.replace(/^www\./, '') : (u || '').split(' ')[0]; } catch (e) { return ''; } };
  function mkSvg(el, w, h, label) {
    el.innerHTML = '';
    return d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%')
      .attr('role', 'img').attr('aria-label', label).style('height', 'auto');
  }
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  function boxFor(x, y, text, fs, anchor) {
    const w = tw(text, fs);
    const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    return { x0: x0 - 1, x1: x0 + w + 1, y0: y - fs * 0.82, y1: y + fs * 0.28 };
  }
  /* greedy label placement around anchor points; returns items with lx/ly/la or lx=null */
  function placeLabels(items, obstacles, bounds, far) {
    const placed = [];
    items.slice().sort((a, b) => (b.prio || 0) - (a.prio || 0)).forEach((it) => {
      const fs = it.fs || 11, r = (it.r || 4) + 3;
      const c = [
        [it.x + r, it.y + fs * 0.35, 'start'], [it.x - r, it.y + fs * 0.35, 'end'],
        [it.x, it.y - r - 1, 'middle'], [it.x, it.y + r + fs * 0.85, 'middle'],
        [it.x + r - 2, it.y - r, 'start'], [it.x - r + 2, it.y - r, 'end'],
        [it.x + r - 2, it.y + r + fs * 0.6, 'start'], [it.x - r + 2, it.y + r + fs * 0.6, 'end'],
        [it.x, it.y - r - fs - 2, 'middle'], [it.x, it.y + r + fs * 1.9, 'middle'],
      ];
      if (far) {
        const fc = [];
        [-18, 18, -32, 32, -46, 46].forEach((dy) => [0, 24, -24, 50, -50, 90, -90, 140, -140, 200, -200].forEach((dx) => {
          fc.push([it.x + dx, it.y + dy + fs * 0.35, dx === 0 ? 'middle' : dx > 0 ? 'start' : 'end', true, dx * dx + 4 * dy * dy]);
        }));
        fc.sort((a, b) => a[4] - b[4]).forEach((q) => c.push(q));
      }
      it.lx = null; it.lead = false;
      for (const [x, y, a, lead] of c) {
        const b = boxFor(x, y, it.text, fs, a);
        if (b.x0 < bounds.x0 || b.x1 > bounds.x1 || b.y0 < bounds.y0 || b.y1 > bounds.y1) continue;
        if (placed.some((p) => hit(p, b)) || obstacles.some((o) => o.own !== it && hit(o, b))) continue;
        placed.push(b); it.lx = x; it.ly = y; it.la = a; it.lead = !!lead; break;
      }
    });
    return placed;
  }
  const ptBox = (x, y, r, own) => ({ x0: x - r, x1: x + r, y0: y - r, y1: y + r, own });

  /* ---------- 5a price landscape ---------- */
  const MODEL = {
    one_off: { label: 'One-off price only', tok: '--a1', sym: d3.symbolSquare },
    subscription: { label: 'Subscription', tok: '--a5', sym: d3.symbolCircle },
    freemium: { label: 'Freemium (free base, paid tier)', tok: '--a7', sym: d3.symbolTriangle },
    bundle_with_tariff: { label: 'Bundled with a tariff', tok: '--a6', sym: d3.symbolDiamond },
    free: { label: 'Free', tok: '--a3', sym: d3.symbolCircle },
  };
  const SHORT = [
    [/Energiemanager – Basic/, 'E.ON Home Basic'], [/Mavi/, 'EnBW Mavi'], [/^Tibber/, 'Tibber'], [/^Octopus/, 'Octopus'],
    [/^Ostrom/, 'Ostrom'], [/^Rabot/, 'Rabot'], [/^thermondo/, 'thermondo'], [/^Cloover/, 'Cloover'], [/SWM/, 'SWM'],
    [/Heartbeat/, '1KOMMA5° Heartbeat'], [/^Enpal/, 'Enpal'], [/Dynamic Assistant/, 'Viessmann'], [/OptimierungPLUS/, 'Vaillant'],
    [/Energy Maximizer/, 'SMA Energy Max.'], [/Sunny Home Manager/, 'SMA Home Mgr.'], [/^E3\/DC/, 'E3/DC'], [/EnergyDynamic/, 'sonnen'],
    [/KOSTAL/, 'KOSTAL'], [/EMMA/, 'Huawei'], [/FEMS/, 'FENECON'], [/Leaflet/, 'Consolinno'], [/AMPERIX/, 'Wendeware'],
    [/ASKO/, 'ASKOMA'], [/^Solar Manager/, 'Solar Manager'], [/SMARTFOX/, 'SMARTFOX'], [/enyo/, 'enyo'], [/openWB/, 'openWB'],
    [/storm\.house/, 'storm.house'], [/Loxone/, 'Loxone'], [/clever-PV/, 'clever-PV'], [/Zerofy/, 'Zerofy'], [/^evcc/, 'evcc'],
  ];
  function shortName(o) {
    const s = o.provider + ' ' + o.product;
    for (const [re, n] of SHORT) if (re.test(o.product) || re.test(o.provider) || re.test(s)) return n;
    return o.provider.replace(/\s*\(.*\)/, '');
  }
  function offers() {
    const ph = R.pricing_history; if (!ph) return [];
    const ex = Object.keys((X.m3_pricing || {}).scatter_exclude || {});
    return ph.offers.filter((o) => !ex.some((k) => o.product.includes(k))).map((o) => {
      const ok = o.price_points.filter((p) => (!p.currency || p.currency === 'EUR') && !p.discontinued)
        .slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      const nonPromo = ok.filter((p) => !p.promo);
      const p = (nonPromo.length ? nonPromo : ok)[(nonPromo.length ? nonPromo : ok).length - 1];
      if (!p) return null;
      const ghost = ok.find((q) => q !== p && Math.abs(pd(q.date) - pd(p.date)) < 8 * 864e5 && q.monthly_eur > (p.monthly_eur || 0));
      return { o, p, name: shortName(o), one: +p.one_off_eur || 0, mon: +p.monthly_eur || 0, low: isLow(p.confidence),
        min: p.one_off_eur_min, max: p.one_off_eur_max, ghost, model: MODEL[o.model] ? o.model : 'free' };
    }).filter(Boolean);
  }
  function tipOffer(d) {
    const p = d.p, o = d.o;
    const one = p.one_off_eur != null ? fmt(p.one_off_eur, Number.isInteger(+p.one_off_eur) ? 0 : 2) + ' EUR' + (d.min != null ? ` (band ${fmt(d.min)} to ${fmt(d.max)})` : '') : 'none';
    const mon = p.monthly_eur != null ? fmt(p.monthly_eur, 2) + ' EUR/month' : 'none';
    const tar = p.tariff_base_fee_eur != null ? `<br>Tariff base fee: ${fmt(p.tariff_base_fee_eur, 2)} EUR/month` : '';
    return `<b>${esc(o.provider)}</b><br>${esc(o.product)}<br><span style="opacity:.75">${esc(MODEL[d.model].label)}</span>` +
      `<br>One-off: ${one}<br>Monthly: ${mon}${tar}` +
      (d.ghost ? `<br>With direct marketing: ${fmt(d.ghost.monthly_eur, 2)} EUR/month` : '') +
      `<br>As of ${esc(p.date)} · ${esc(p.confidence || '')}${p.verified ? ' · re-checked' : ''}` +
      (p.included ? `<br><span style="opacity:.75">${esc(p.included.slice(0, 170))}${p.included.length > 170 ? '…' : ''}</span>` : '');
  }
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

  function drawLandscape() {
    const el = $('m3-land'); if (!el) return;
    const all = offers(); if (!all.length) return;
    const free = all.filter((d) => d.one === 0 && d.mon === 0);
    const pts = all.filter((d) => !(d.one === 0 && d.mon === 0));
    const paid = all.filter((d) => d.mon > 0).map((d) => d.mon);
    const med = median(paid);
    const inBand = paid.filter((v) => v >= 3.99 && v <= 6.99).length;
    const ttl = $('m3-land-title');
    if (ttl) ttl.textContent = `${inBand} of ${paid.length} paid HEMS fees lie between 4 and 7 EUR/month`;
    const lpts = $('m3-land-pts'); /* side points: the rest of the former long title */
    if (lpts && med != null) lpts.innerHTML = `<li><b>${fmt(med, 2)} EUR</b>median paid fee per month (n = ${paid.length})</li>` +
      '<li><b>about 1/5</b>of our 25 EUR/month working assumption</li>' +
      `<li><b>${free.length} of ${all.length}</b>offers charge no separate HEMS fee</li>`;

    // legend (models present)
    const lg = $('m3-land-legend');
    if (lg) {
      const used = [...new Set(pts.map((d) => d.model))];
      lg.innerHTML = used.map((k) => `<span><svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><path d="${d3.symbol().type(MODEL[k].sym).size(50)()}" fill="${C(MODEL[k].tok)}"></path></svg>${esc(MODEL[k].label)}</span>`).join('') +
        `<span><svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><circle r="4" fill="${C('--bg')}" stroke="${C('--muted')}" stroke-width="1.3"></circle></svg>Low confidence</span>` +
        `<span><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M1,6H17M1,3.5V8.5M17,3.5V8.5" fill="none" stroke="${C('--muted')}" stroke-width="1.3"></path></svg>Published price band</span>`;
    }

    const w = widthOf(el), narrow = w < 560, fs = narrow ? 10 : 11;
    const lanes = 3, laneH = fs + 4;
    const m = { l: 30, r: 12, t: 30, b: 12 + lanes * laneH + 26 };
    const h = narrow ? 400 : 460;
    const x = d3.scaleLinear().domain([0, 1000]).range([m.l + 10, w - m.r]);
    const y = d3.scaleLinear().domain([0, 27]).range([h - m.b, m.t]);
    const y0 = y(0);
    const svg = mkSvg(el, w, h, 'Scatter of current HEMS offers: one-off price against monthly fee');
    const ink = C('--ink'), muted = C('--muted'), line = C('--line'), bg = C('--bg'), acc = C('--accent'), grey = C('--grey');
    const haloL = (sel) => sel.style('paint-order', 'stroke').attr('stroke', C('--panel')).attr('stroke-width', 3).attr('stroke-linejoin', 'round');

    // grid + axes
    const g = svg.append('g').attr('class', 'ax');
    [0, 5, 10, 15, 20, 25].forEach((v) => {
      g.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', line);
      g.append('text').attr('x', m.l - 4).attr('y', y(v) + 3.5).attr('text-anchor', 'end').text(v);
    });
    const xt = narrow ? [0, 250, 500, 750, 1000] : [0, 200, 400, 600, 800, 1000];
    xt.forEach((v) => {
      g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', m.t).attr('y2', y0).attr('stroke', line);
      g.append('text').attr('x', x(v)).attr('y', h - 8).attr('text-anchor', v === 1000 ? 'end' : 'middle').text(fmt(v));
    });
    svg.append('text').attr('x', m.l - 4).attr('y', m.t - 14).attr('text-anchor', 'start').attr('class', 'lab').style('font-size', '11px').text('Monthly fee, EUR/month');
    svg.append('text').attr('x', w - m.r).attr('y', h - 8 - 13).attr('text-anchor', 'end').style('fill', grey).text('One-off price, EUR');
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y0).attr('y2', y0).attr('stroke', muted);

    const obstacles = [];
    // reference lines
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(25)).attr('y2', y(25)).attr('stroke', acc).attr('stroke-width', 2.5);
    const r25 = narrow ? 'Our working assumption: 25 EUR/month' : 'Our working assumption: 25 EUR/month (300 EUR/yr)';
    svg.append('text').attr('x', m.l + 12).attr('y', y(25) - 6).attr('class', 'lab-strong').style('font-size', fs + 'px').text(r25);
    obstacles.push({ x0: m.l, x1: w - m.r, y0: y(25) - 2, y1: y(25) + 2 }, boxFor(m.l + 12, y(25) - 6, r25, fs, 'start'));
    if (med != null) {
      svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(med)).attr('y2', y(med)).attr('stroke', ink).attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
      const t = narrow ? `Median ${fmt(med, 2)}` : `Median paid fee ${fmt(med, 2)} (n = ${paid.length})`;
      svg.append('text').attr('x', w - m.r).attr('y', y(med) - 5).attr('text-anchor', 'end').attr('class', 'lab').style('font-size', fs + 'px').text(t);
      obstacles.push(boxFor(w - m.r, y(med) - 5, t, fs, 'end'), { x0: x(60), x1: w - m.r, y0: y(med) - 1.5, y1: y(med) + 1.5 });
    }

    // positions: zero-x column (software only) as small beeswarm
    const zero = pts.filter((d) => d.one === 0).sort((a, b) => b.mon - a.mon);
    const xs0 = x(0), R0 = narrow ? 4.5 : 5;
    zero.forEach((d, i) => {
      d.py = y(d.mon);
      let off = 0;
      while (zero.slice(0, i).some((q) => Math.abs(q.px - (xs0 + off)) < 2 * R0 + 1 && Math.abs(q.py - d.py) < 2 * R0 + 1)) off += 2 * R0 + 1;
      d.px = xs0 + off;
    });
    const main = pts.filter((d) => d.one > 0 && d.mon > 0);
    main.forEach((d) => { d.px = x(d.one); d.py = y(d.mon); });
    const base = pts.filter((d) => d.one > 0 && d.mon === 0).sort((a, b) => a.one - b.one);
    base.forEach((d) => { d.px = x(d.one); d.py = y0; });
    [...zero, ...main, ...base].forEach((d) => obstacles.push(ptBox(d.px, d.py, R0 + 1, d)));

    // price bands
    const bandG = svg.append('g');
    const sameY = {};
    [...main, ...base].filter((d) => d.min != null && d.max != null).forEach((d) => {
      const k = d.mon; sameY[k] = (sameY[k] || 0) + 1;
      const yy = d.mon === 0 ? y0 + 4 + (sameY[k] - 1) * 3.5 : d.py + (sameY[k] % 2 ? -4 : 4);
      if (d.mon > 0) obstacles.push({ x0: x(d.min), x1: x(d.max), y0: yy - 3, y1: yy + 3 });
      bandG.append('line').attr('x1', x(d.min)).attr('x2', x(d.max)).attr('y1', yy).attr('y2', yy).attr('stroke', C(MODEL[d.model].tok)).attr('stroke-width', 1.5).attr('opacity', 0.75);
      [d.min, d.max].forEach((v) => bandG.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', yy - 2.5).attr('y2', yy + 2.5).attr('stroke', C(MODEL[d.model].tok)).attr('stroke-width', 1.2));
    });
    // ghost (1KOMMA5 with direct marketing)
    main.filter((d) => d.ghost).forEach((d) => {
      const gy = y(d.ghost.monthly_eur);
      svg.append('line').attr('x1', d.px).attr('x2', d.px).attr('y1', d.py - R0 - 1).attr('y2', gy).attr('stroke', muted).attr('stroke-dasharray', '2 2');
      svg.append('line').attr('x1', d.px - 5).attr('x2', d.px + 5).attr('y1', gy).attr('y2', gy).attr('stroke', muted).attr('stroke-width', 1.5);
      const t = `${fmt(d.ghost.monthly_eur, 2)} with direct marketing`;
      const anc = d.px + 8 + tw(t, fs - 0.5) > w - m.r ? 'end' : 'start';
      const tx = anc === 'end' ? d.px - 8 : d.px + 8;
      svg.append('text').attr('x', tx).attr('y', gy + 3.5).attr('text-anchor', anc).style('font-size', (fs - 0.5) + 'px').text(t);
      obstacles.push(boxFor(tx, gy + 3.5, t, fs - 0.5, anc), { x0: d.px - 3, x1: d.px + 3, y0: gy, y1: d.py });
    });

    // labels: zero column (dodged list to the right)
    const lblG = svg.append('g');
    const zx = d3.max(zero, (d) => d.px) + R0 + 10;
    const zl = zero.slice().sort((a, b) => a.py - b.py).map((d) => ({ d, ly: d.py + 3.5 }));
    const sp = fs + 2.5;
    for (let i = 1; i < zl.length; i++) if (zl[i].ly - zl[i - 1].ly < sp) zl[i].ly = zl[i - 1].ly + sp;
    const over = zl.length ? zl[zl.length - 1].ly - (y0 - 4) : 0;
    if (over > 0) zl.forEach((z) => { z.ly -= over; });
    for (let i = zl.length - 2; i >= 0; i--) if (zl[i + 1].ly - zl[i].ly < sp) zl[i].ly = zl[i + 1].ly - sp;
    if (narrow) {
      const top = d3.min(zero, (d) => d.py) - 8, bot = d3.max(zero, (d) => d.py) + 8, bx = zx - 6;
      lblG.append('path').attr('d', `M${bx - 4},${top}H${bx}V${bot}H${bx - 4}`).attr('fill', 'none').attr('stroke', grey);
      const t = `${zero.length} subscriptions without a box, listed below`;
      lblG.append('text').attr('x', m.l + 2).attr('y', top - 6).attr('class', 'lab').style('font-size', fs + 'px').text(t);
      obstacles.push({ x0: m.l, x1: bx + 2, y0: top, y1: bot }, boxFor(m.l + 2, top - 6, t, fs, 'start'));
    }
    if (!narrow) zl.forEach((z) => {
      const t = z.d.name + ' ' + fmt(z.d.mon, 2);
      lblG.append('line').attr('x1', z.d.px + R0 + 1).attr('x2', zx - 2).attr('y1', z.d.py).attr('y2', z.ly - 3.5).attr('stroke', grey).attr('stroke-width', 0.6);
      haloL(lblG.append('text').attr('x', zx).attr('y', z.ly).attr('class', 'lab').style('font-size', fs + 'px').text(t));
      obstacles.push(boxFor(zx, z.ly, t, fs, 'start'));
    });
    // labels: main points (greedy)
    const items = main.map((d) => ({ d, own: d, x: d.px, y: d.py, r: R0, text: `${d.name} ${fmt(d.one)} + ${fmt(d.mon, 2)}`, fs, prio: d.mon }));
    items.forEach((it) => { if (tw(it.text, fs) > w * 0.42) it.text = it.d.name; });
    obstacles.forEach((o) => { if (o.own) { const it = items.find((q) => q.d === o.own); if (it) o.own = it; } });
    placeLabels(items, obstacles, { x0: m.l + 2, x1: w - m.r, y0: m.t - 2, y1: y0 - 2 });
    items.forEach((it) => {
      if (it.lx == null) { it.text = it.d.name; placeLabels([it], obstacles.concat(items.filter((q) => q.lx != null && q !== it).map((q) => boxFor(q.lx, q.ly, q.text, fs, q.la))), { x0: m.l + 2, x1: w - m.r, y0: m.t - 2, y1: y0 - 2 }, true); }
      if (it.lx == null) return;
      if (it.lead) {
        const bb = boxFor(it.lx, it.ly, it.text, fs, it.la);
        lblG.append('line').attr('x1', it.x).attr('y1', it.y).attr('x2', Math.max(bb.x0, Math.min(bb.x1, it.x))).attr('y2', it.ly < it.y ? bb.y1 : bb.y0).attr('stroke', grey).attr('stroke-width', 0.6);
      }
      haloL(lblG.append('text').attr('x', it.lx).attr('y', it.ly).attr('text-anchor', it.la).attr('class', 'lab').style('font-size', fs + 'px').text(it.text));
    });
    // labels: baseline points in lanes under the axis
    const laneEnd = new Array(lanes).fill(-Infinity);
    base.forEach((d) => {
      const t = d.name;
      const wdt = tw(t, fs - 0.5);
      let cx = Math.min(Math.max(d.px, m.l + wdt / 2), w - m.r - wdt / 2);
      const k = laneEnd.findIndex((e) => e < cx - wdt / 2 - 6);
      if (k < 0) return;
      laneEnd[k] = cx + wdt / 2;
      const ly = y0 + 12 + 9 + k * laneH;
      lblG.append('line').attr('x1', d.px).attr('x2', cx).attr('y1', y0 + 3).attr('y2', ly - fs + 1).attr('stroke', grey).attr('stroke-width', 0.6);
      lblG.append('text').attr('x', cx).attr('y', ly).attr('text-anchor', 'middle').attr('class', 'lab').style('font-size', (fs - 0.5) + 'px').text(t);
    });

    // marks
    const mk = svg.append('g').selectAll('path').data([...base, ...main, ...zero]).join('path')
      .attr('transform', (d) => `translate(${d.px},${d.py})`)
      .attr('d', (d) => d3.symbol().type(MODEL[d.model].sym).size(narrow ? 52 : 68)())
      .attr('fill', (d) => (d.low ? bg : C(MODEL[d.model].tok)))
      .attr('stroke', (d) => (d.low ? C(MODEL[d.model].tok) : bg))
      .attr('stroke-width', (d) => (d.low ? 1.6 : 1))
      .attr('stroke-dasharray', (d) => (d.low ? '2 1.5' : null))
      .style('cursor', 'default');
    UI.bindTip(mk, tipOffer);

    // free cluster strip
    const fr = $('m3-free');
    if (fr) {
      const how = (d) => {
        if (d.p.tariff_base_fee_eur != null) return `tariff fee ${fmt(d.p.tariff_base_fee_eur, 2)}/month`;
        if (d.p.hardware_bundled) return 'inside the battery price';
        if (d.p.bundled_no_separate_price) return 'inside the PV package';
        if (d.o.archetype === 'open_source') return 'open source';
        return 'for power customers';
      };
      const subs = narrow ? `<div class="hd"><b>${zero.length} software subscriptions without a box</b><span>Drawn at a one-off price of 0.</span></div><div class="m3-chips">${zero.slice().sort((a, b) => b.mon - a.mon).map((d) => `<span class="m3-chip${d.low ? ' low' : ''}"><i style="background:${C(MODEL[d.model].tok)}"></i>${esc(d.name)} <small>${fmt(d.mon, 2)}/month${d.low ? ', unverified' : ''}</small></span>`).join('')}</div>` : '';
      /* the long explanation (tariff, hardware, open source; tariff base fees) is in the chips and in the exhibit's notes */
      fr.innerHTML = subs + `<div class="hd"><b>${free.length} of ${all.length} offers charge no separate HEMS fee</b></div><div class="m3-chips m3-free-chips"></div>`;
      const chips = d3.select(fr).select('.m3-free-chips').selectAll('span').data(free).join('span')
        .attr('class', (d) => 'm3-chip' + (d.low ? ' low' : ''))
        .html((d) => `<i style="background:${C(MODEL[d.model].tok)}"></i>${esc(d.name)} <small>${esc(how(d))}${d.low ? ', unverified' : ''}</small>`);
      UI.bindTip(chips, tipOffer);
    }
  }

  /* ---------- 5b price development per provider ---------- */
  const SER = { monthly: { tok: '--a5', dash: null }, tariff: { tok: '--a6', dash: '4 3' }, oneoff: { tok: '--a1', dash: null } };
  function drawHistory() {
    const hostEl = $('m3-sm'); const P = (X.m3_pricing || {}).panels; if (!hostEl || !P) return;
    hostEl.innerHTML = '';
    const arrow = { up: '↑', down: '↓', flat: '→' };
    P.forEach((p) => {
      const card = document.createElement('div'); card.className = 'card';
      /* compact: name + tag visible, the one-line take as tooltip on the card head */
      card.innerHTML = `<div class="top"><span class="nm">${esc(p.name)}</span><span class="tg">${arrow[p.dir] || ''} ${esc(p.tag)}</span></div><div class="m3-chart"></div>`;
      hostEl.appendChild(card);
      UI.bindTip(d3.select(card.querySelector('.top')).datum(p), (d) => `<b>${esc(d.name)}</b><br>${esc(d.take)}`);
    });
    [...hostEl.children].forEach((card, i) => drawPanel(card.querySelector('.m3-chart'), P[i]));
    drawSample();
    const fold = $('m3-why-fold'); /* the sample chart sits in a closed fold: draw it at its real width when opened */
    if (fold && !fold.dataset.bound) { fold.dataset.bound = '1'; fold.addEventListener('toggle', () => { if (fold.open) drawSample(); }); }
  }
  function drawPanel(el, p) {
    const hasM = p.series.some((s) => s.kind !== 'oneoff' && s.pts.length);
    const hasO = p.series.some((s) => s.kind === 'oneoff' && s.pts.length);
    const rows = []; if (hasM) rows.push('m'); if (hasO) rows.push('o');
    const w = widthOf(el), ml = 30, mr = 40, rowH = 60, gap = 28, top = 18;
    const h = top + rows.length * rowH + (rows.length - 1) * gap + 18;
    const svg = mkSvg(el, w, h, `Price history ${p.name}`);
    const D0 = new Date(2022, 0, 1);
    const x0s = d3.scaleTime().domain([D0, new Date(2026, 11, 31)]).range([ml + 6, w - mr]);
    const x = (dt) => (dt < D0 ? ml : x0s(dt));
    const ink = C('--ink'), line = C('--line'), bg = C('--bg'), grey = C('--grey'), muted = C('--muted');
    const rowTop = (k) => top + rows.indexOf(k) * (rowH + gap);
    const yS = {
      m: d3.scaleLinear().domain([0, 20]).range([rowTop('m') + rowH, rowTop('m')]),
      o: d3.scaleLinear().domain([0, 900]).range([rowTop('o') + rowH, rowTop('o')]),
    };
    const yb = top + rows.length * rowH + (rows.length - 1) * gap;
    // year grid
    [2022, 2023, 2024, 2025, 2026].forEach((yr) => {
      const xx = x0s(new Date(yr, 0, 1));
      svg.append('line').attr('x1', xx).attr('x2', xx).attr('y1', top - 4).attr('y2', yb).attr('stroke', line);
      if (w > 320 || yr % 2 === 0) svg.append('text').attr('x', xx).attr('y', yb + 13).attr('text-anchor', 'middle').style('fill', grey).style('font-size', '10px').text(yr);
    });
    rows.forEach((k) => {
      const ys = yS[k], ticks = k === 'm' ? [0, 10, 20] : [0, 400, 800];
      ticks.forEach((v) => {
        if (v) svg.append('line').attr('x1', ml).attr('x2', w - mr).attr('y1', ys(v)).attr('y2', ys(v)).attr('stroke', line).attr('stroke-dasharray', '1 3');
        svg.append('text').attr('x', ml - 4).attr('y', ys(v) + 3).attr('text-anchor', 'end').style('fill', grey).style('font-size', '9.5px').text(v);
      });
      svg.append('line').attr('x1', ml).attr('x2', w - mr).attr('y1', ys(0)).attr('y2', ys(0)).attr('stroke', muted).attr('stroke-width', 0.8);
      svg.append('text').attr('x', ml).attr('y', rowTop(k) - 6).style('fill', grey).style('font-size', '10px').text(k === 'm' ? 'Monthly, EUR' : 'One-off, EUR');
    });
    const labels = [];
    const addLabel = (lx, ly, t, anchor, color, weight) => {
      let a = anchor;
      if (a === 'middle' && lx + tw(t, 10) / 2 > w - mr) a = 'end';
      if (a === 'middle' && lx - tw(t, 10) / 2 < ml) a = 'start';
      const tries = a === 'start' && lx > w - mr ? [0, 10, -10, 20] : [0, -11, 11];
      let b2 = null;
      for (const dy of tries) { const b = boxFor(lx, ly + dy, t, 10, a); if (!labels.some((q) => hit(q, b))) { b2 = b; ly += dy; break; } }
      if (!b2) return;
      labels.push(b2);
      svg.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', a).style('fill', color || ink).style('font-size', '10px').style('font-weight', weight || 400).text(t);
    };
    const markers = [];
    p.series.forEach((s) => {
      if (!s.pts.length) return;
      const k = s.kind === 'oneoff' ? 'o' : 'm'; const ys = yS[k];
      const pts = s.pts.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      if (s.kind === 'ghost') {
        pts.forEach((q, i) => {
          const xx = x(pd(q.date));
          svg.append('line').attr('x1', xx - 5).attr('x2', xx + 5).attr('y1', ys(q.v)).attr('y2', ys(q.v)).attr('stroke', grey).attr('stroke-width', 1.6);
          markers.push({ q, xx, yy: ys(q.v), s, ghost: true });
          if (i === pts.length - 1) addLabel(xx, ys(q.v) - 5, p.id === '1k5' ? `${fmt(q.v, 2)} incl. direct mkt.` : 'announced', 'middle', grey);
        });
        return;
      }
      const sc = SER[s.kind]; const col = C(sc.tok);
      const main = pts.filter((q) => !q.promo);
      // step segments
      for (let i = 0; i < main.length; i++) {
        const a = main[i], b = main[i + 1];
        const xa = x(pd(a.date)), xb = b ? x(pd(b.date)) : x(NOW);
        const dash = isLow(a.conf) || (b && isLow(b.conf)) ? '3 2.5' : sc.dash;
        let d = `M${xa},${ys(a.v)}H${xb}`;
        if (b) d += `V${ys(b.v)}`;
        svg.append('path').attr('d', d).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1.8).attr('stroke-dasharray', dash);
      }
      // bands
      pts.filter((q) => q.min != null && q.max != null).forEach((q) => {
        const xx = x(pd(q.date));
        svg.append('line').attr('x1', xx).attr('x2', xx).attr('y1', ys(q.min)).attr('y2', ys(q.max)).attr('stroke', col).attr('stroke-width', 1.2);
        [q.min, q.max].forEach((v) => svg.append('line').attr('x1', xx - 3).attr('x2', xx + 3).attr('y1', ys(v)).attr('y2', ys(v)).attr('stroke', col));
      });
      pts.forEach((q) => markers.push({ q, xx: x(pd(q.date)), yy: ys(q.v), s, col }));
      // value labels: first and last non-promo, promo as P
      const fmtV = (v) => (v === 0 ? (s.kind === 'oneoff' ? '0' : 'free') : s.kind === 'oneoff' ? fmt(v, v % 1 ? 2 : 0) : fmt(v, 2));
      const last = main[main.length - 1], first = main[0];
      if (last) addLabel(x(NOW) + 4, ys(last.v) + 3.5, fmtV(last.v), 'start', s.kind === 'tariff' ? muted : ink, 500);
      if (first && first !== last && first.v !== last.v) addLabel(x(pd(first.date)), ys(first.v) - 6, (s.kind === 'tariff' ? 'tariff ' : '') + fmtV(first.v), 'middle', muted);
      if (first && pd(first.date) < D0 && !svg.select('.m3-since').size()) { addLabel(ml + 4, ys(0) - 22, `← since ${first.date.slice(0, 4)}`, 'start', muted); svg.selectAll('text').filter(function () { return this.textContent.startsWith('← since'); }).classed('m3-since', true); }
      pts.filter((q) => q.promo).forEach((q) => addLabel(x(pd(q.date)) + 6, ys(q.v) - 3, 'P', 'start', muted, 600));
    });
    (p.nofee || []).forEach((n) => {
      const xx = x(pd(n.date)), yy = yS.m ? yS.m(0) : yb;
      svg.append('circle').attr('cx', xx).attr('cy', yy).attr('r', 3).attr('fill', bg).attr('stroke', grey).attr('stroke-dasharray', '1.5 1.5');
      addLabel(xx, yy - 7, 'no fee stated', 'middle', grey);
    });
    const mk = svg.append('g').selectAll('circle').data(markers).join('circle')
      .attr('cx', (d) => d.xx).attr('cy', (d) => d.yy).attr('r', (d) => (d.ghost ? 5 : 3.3))
      .attr('fill', (d) => (d.ghost ? 'transparent' : (isLow(d.q.conf) || d.q.promo ? bg : d.col)))
      .attr('stroke', (d) => (d.ghost ? 'none' : d.col)).attr('stroke-width', 1.4)
      .attr('stroke-dasharray', (d) => (isLow(d.q.conf) ? '2 1.4' : null));
    UI.bindTip(mk, (d) => `<b>${esc(p.name)}</b> · ${esc(d.s.label)}<br>${esc(d.q.date)}: ${d.s.kind === 'oneoff' ? fmt(d.q.v, 2) + ' EUR' : fmt(d.q.v, 2) + ' EUR/month'}` +
      (d.q.min != null ? ` (band ${fmt(d.q.min)} to ${fmt(d.q.max)})` : '') + (d.q.promo ? '<br>Promotion' : '') +
      `<br>Confidence: ${esc(d.q.conf || '')}${d.q.verified ? ' · re-checked' : ''}` +
      (d.q.note ? `<br><span style="opacity:.75">${esc(d.q.note.slice(0, 160))}</span>` : '') + (d.q.source ? `<br><span style="opacity:.6">${esc(host(d.q.source))}</span>` : ''));
  }
  function drawSample() {
    const el = $('m3-n'); const t = R.pricing_history && R.pricing_history.trend; if (!el || !t) return;
    const data = t.by_year;
    const w = widthOf(el), two = w < 340, h = two ? 172 : 158, m = { l: 8, r: 8, t: two ? 52 : 36, b: 20 };
    const svg = mkSvg(el, w, h, 'Number of offers with a documented price per year');
    const x = d3.scaleBand().domain(data.map((d) => d.year)).range([m.l, w - m.r]).padding(0.28);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.n) || 1]).range([h - m.b, m.t]);
    const ink = C('--ink'), grey = C('--grey');
    const p2 = d3.interpolateRgb(C('--panel'), grey)(0.35);
    svg.append('text').attr('x', m.l).attr('y', 12).attr('class', 'lab').style('font-weight', 500).text('Offers with a documented price, per year');
    svg.append('rect').attr('x', m.l).attr('y', 20).attr('width', 9).attr('height', 9).attr('fill', ink);
    svg.append('text').attr('x', m.l + 13).attr('y', 28).style('font-size', '10.5px').text('paid subscription');
    const lx2 = two ? m.l : m.l + 112, ly2 = two ? 35 : 20;
    svg.append('rect').attr('x', lx2).attr('y', ly2).attr('width', 9).attr('height', 9).attr('fill', p2).attr('stroke', C('--line'));
    svg.append('text').attr('x', lx2 + 13).attr('y', ly2 + 8).style('font-size', '10.5px').text('free, bundled or one-off');
    const gb = svg.append('g').selectAll('g').data(data).join('g');
    gb.append('rect').attr('x', (d) => x(d.year)).attr('width', x.bandwidth()).attr('y', (d) => y(d.n)).attr('height', (d) => y(0) - y(d.n)).attr('fill', p2);
    gb.append('rect').attr('x', (d) => x(d.year)).attr('width', x.bandwidth()).attr('y', (d) => y(d.n_paid_subscriptions)).attr('height', (d) => y(0) - y(d.n_paid_subscriptions)).attr('fill', ink);
    gb.append('text').attr('x', (d) => x(d.year) + x.bandwidth() / 2).attr('y', (d) => y(d.n) - 4).attr('text-anchor', 'middle').attr('class', 'lab').text((d) => d.n);
    gb.append('text').attr('x', (d) => x(d.year) + x.bandwidth() / 2).attr('y', h - 6).attr('text-anchor', 'middle').style('fill', grey).style('font-size', '10px').text((d) => (w < 360 ? "'" + String(d.year).slice(2) : d.year));
    UI.bindTip(gb, (d) => `<b>${d.year}</b><br>${d.n} offers documented, ${d.n_paid_subscriptions} paid subscriptions` + (d.median_monthly_eur != null ? `<br>Median paid: ${fmt(d.median_monthly_eur, 2)} EUR/month` : ''));
  }

  /* ---------- 5c who pays ---------- */
  function drawChannels() {
    const el = $('m3-waffle'); const M = MD.matrix; if (!el || !M) return;
    const chIdx = M.features.map((f, i) => (f.cat === 'Sales channel' ? i : -1)).filter((i) => i >= 0);
    const b2c = M.features.findIndex((f) => /B2C/.test(f.de));
    const sys = M.systems.map((s) => {
      const set = new Set(s.f);
      const any = chIdx.some((i) => set.has(i));
      return { s, cls: set.has(b2c) ? 'b2c' : any ? 'b2b' : 'none' };
    });
    const order = ['b2c', 'b2b', 'none'];
    const CL = {
      b2c: { label: 'list sales to private customers (B2C)', tok: '--ink' },
      b2b: { label: 'sell only via installers, wholesale or white label', tok: '--a7' },
      none: { label: 'state no sales channel', tok: null },
    };
    sys.sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls));
    const cnt = Object.fromEntries(order.map((k) => [k, sys.filter((d) => d.cls === k).length]));
    const sub = $('m3-ch-sub');
    if (sub) sub.textContent = 'One square = one system.';
    const pt = $('m3-pt-ch'); /* side point of the exhibit */
    if (pt) pt.innerHTML = `<b>${cnt.b2b + cnt.none} of ${sys.length}</b>systems do not list direct sales to households`;
    const w = widthOf(el);
    const cols = w >= 430 ? 28 : w >= 330 ? 21 : 17;
    const cell = Math.min(15, Math.floor((w - 2) / cols)), gapc = 2;
    const rowsN = Math.ceil(sys.length / cols);
    const chans = chIdx.map((i) => ({ name: M.features[i].name, n: M.systems.filter((s) => s.f.includes(i)).length })).sort((a, b) => b.n - a.n);
    const wH = rowsN * cell + 8, lgH = 3 * 17 + 10, barH = 20;
    const h = wH + lgH + 18 + chans.length * barH + 6;
    const svg = mkSvg(el, w, h, 'Sales channels of 83 HEMS');
    const ink = C('--ink'), bg = C('--bg'), grey = C('--grey'), p2 = C('--panel-2');
    const sq = svg.append('g').selectAll('rect').data(sys).join('rect')
      .attr('x', (d, i) => (i % cols) * cell).attr('y', (d, i) => Math.floor(i / cols) * cell)
      .attr('width', cell - gapc).attr('height', cell - gapc)
      .attr('fill', (d) => (CL[d.cls].tok ? C(CL[d.cls].tok) : bg))
      .attr('stroke', (d) => (CL[d.cls].tok ? 'none' : grey)).attr('stroke-width', 1);
    UI.bindTip(sq, (d) => `<b>${esc(d.s.name)}</b><br>${esc(d.s.producer)}<br>${esc(d.cls === 'b2c' ? 'Sold to private customers' : d.cls === 'b2b' ? 'B2B channels only' : 'No channel stated')}`);
    order.forEach((k, i) => {
      const yy = wH + 6 + i * 17;
      svg.append('rect').attr('x', 0).attr('y', yy).attr('width', 10).attr('height', 10).attr('fill', CL[k].tok ? C(CL[k].tok) : bg).attr('stroke', CL[k].tok ? 'none' : grey);
      svg.append('text').attr('x', 16).attr('y', yy + 9).attr('class', 'lab').html(`<tspan style="font-weight:600">${cnt[k]}</tspan> ${esc(CL[k].label)}`);
    });
    const by = wH + lgH + 10;
    svg.append('text').attr('x', 0).attr('y', by).style('fill', grey).style('font-size', '10.5px').text('Channels named (multiple answers), systems of 83');
    const lw = Math.min(150, w * 0.42);
    const xb = d3.scaleLinear().domain([0, sys.length]).range([lw, w - 26]);
    chans.forEach((c, i) => {
      const yy = by + 8 + i * barH;
      svg.append('text').attr('x', lw - 6).attr('y', yy + 11).attr('text-anchor', 'end').attr('class', 'lab').style('font-size', '11px').text(c.name);
      svg.append('rect').attr('x', lw).attr('y', yy + 2).attr('width', xb(sys.length) - lw).attr('height', 12).attr('fill', p2);
      svg.append('rect').attr('x', lw).attr('y', yy + 2).attr('width', xb(c.n) - lw).attr('height', 12).attr('fill', /B2C/.test(c.name) ? ink : C('--a7'));
      svg.append('text').attr('x', xb(c.n) + 4).attr('y', yy + 12).attr('class', 'lab').style('font-size', '11px').text(c.n);
    });
  }
  const PAYTOK = { hardware: '--a1', explicit: '--a5', tariff: '--a6', b2b: '--a7', market: '--a3', voluntary: '--a8' };
  function drawPayers() {
    const el = $('m3-payer'); const PC = (X.m3_payers || {}).classes; const BM = R.business_models; if (!el || !PC || !BM) return;
    const byName = Object.fromEntries(BM.players.map((p) => [p.name, p]));
    const isFlex = (p) => p && /flex|VPP|Grid Rewards/i.test((p.revenue_model || []).join(' '));
    const shortP = (n) => n.replace(/\s*\(.*?\)/g, '').replace(/\s*-\s*E\.ON 100%/, '').trim();
    const max = d3.max(PC, (c) => c.players.length);
    el.innerHTML = '<div class="m3-prows"></div>';
    const rows = d3.select(el).select('.m3-prows').selectAll('div.m3-prow').data(PC).join('div').attr('class', 'm3-prow');
    const lb = rows.append('div').attr('class', 'lb').html((c) => `${esc(c.label)} <b>${c.players.length}</b>`);
    UI.bindTip(lb, (c) => `<b>${esc(c.label)}</b><br>${esc(c.players.map(shortP).join(', '))}`); /* player names: tooltip instead of a visible list */
    const units = rows.append('div').attr('class', 'units').style('--max', max);
    const u = units.selectAll('span').data((c) => c.players.map((n) => ({ n, c, p: byName[n] }))).join('span')
      .attr('class', 'u').style('background', (d) => `var(${PAYTOK[d.c.id] || '--grey'})`)
      .html((d) => (isFlex(d.p) ? '<i></i>' : ''));
    UI.bindTip(u, (d) => `<b>${esc(d.n)}</b><br>Payer: ${esc(d.p ? d.p.payer : '')}<br>Revenue: ${esc(d.p ? d.p.revenue_model.join('; ') : '')}<br>Channel: ${esc(d.p ? d.p.channel.join(', ') : '')}`);
    const nf = BM.players.filter(isFlex).length;
    d3.select(el).append('p').attr('class', 'm3-note').style('margin-top', '8px').html(`<span class="m3-dot"></span> also earns flexibility revenue (VPP, Grid Rewards, trading): ${nf} of ${BM.players.length}`);
  }
  function drawValue() {
    const el = $('m3-value'); const BM = R.business_models; if (!el || !BM) return;
    const pool = (re) => BM.profit_pools.find((p) => re.test(p.pool)) || {};
    const offersAll = offers(); const med = median(offersAll.filter((d) => d.mon > 0).map((d) => d.mon));
    const k5 = offersAll.find((d) => /Heartbeat/.test(d.o.product));
    const rng = (p) => [p.value_eur_min, p.value_eur_max];
    const groups = [
      { g: 'What households pay for HEMS software', rows: [
        { l: `Median paid subscription (${fmt(med, 2)}/month)`, v: [med * 12, med * 12], tok: '--a5' },
        { l: `1KOMMA5° Heartbeat (${k5 ? fmt(k5.mon, 2) : '14.99'}/month)`, v: [(k5 ? k5.mon : 14.99) * 12, (k5 ? k5.mon : 14.99) * 12], tok: '--a5' },
        { l: 'Our working assumption (25/month)', v: [300, 300], tok: '--accent', strong: true },
      ] },
      { g: 'Flexibility value per year (BCG, Flex Level I)', rows: [
        { l: 'Heat pump', v: rng(pool(/heat pump/)), tok: '--a6' },
        { l: 'EV, one-way charging', v: rng(pool(/unidirectional EV/)), tok: '--a6' },
        { l: 'Home battery', v: rng(pool(/residential battery/)), tok: '--a6' },
        { l: 'Bidirectional EV (future)', v: rng(pool(/bidirectional EV/)), tok: '--a6', low: true },
        { l: 'Single-family house, total', v: rng(pool(/single-family house/)), tok: '--a6', strong: true },
        { l: 'gridX estimate from 2027 (vendor)', v: [400, 800], tok: '--a6', low: true },
      ] },
      { g: 'What supplier and aggregator earn or pay out', rows: [
        { l: 'Retail margin incl. sales cost (4.45 ct x 4,000 kWh)', v: rng(pool(/Vertrieb und Marge/)), tok: '--a3' },
        { l: 'Tibber Grid Rewards paid to customer (max.)', v: [150, 150], tok: '--a3' },
      ] },
    ];
    const w = widthOf(el), stack = w < 520;
    const lw = stack ? 0 : Math.min(230, w * 0.44);
    const rowH = stack ? 34 : 24, gH = 26, top = 22;
    const nRows = groups.reduce((s, g) => s + g.rows.length, 0);
    const h = top + groups.length * gH + nRows * rowH + 22;
    const svg = mkSvg(el, w, h, 'Annual value per household in EUR');
    const x = d3.scaleLinear().domain([0, 800]).range([lw + 4, w - 64]);
    const ink = C('--ink'), line = C('--line'), grey = C('--grey'), bg = C('--bg'), acc = C('--accent'), panel = C('--panel');
    const halo = (sel) => sel.style('paint-order', 'stroke').attr('stroke', panel).attr('stroke-width', 3).attr('stroke-linejoin', 'round');
    [0, 200, 400, 600, 800].forEach((v) => {
      svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', top - 4).attr('y2', h - 18).attr('stroke', line);
      svg.append('text').attr('x', x(v)).attr('y', h - 5).attr('text-anchor', 'middle').style('fill', grey).style('font-size', '10px').text(v === 800 ? '800 EUR/yr' : v);
    });
    let yy = top;
    const all = [];
    groups.forEach((g) => {
      halo(svg.append('text').attr('x', 0).attr('y', yy + 14).attr('class', 'lab-strong').style('font-size', '11.5px').text(g.g));
      yy += gH;
      g.rows.forEach((r) => { r.y = yy; all.push(r); yy += rowH; });
    });
    svg.append('line').attr('x1', x(300)).attr('x2', x(300)).attr('y1', top - 6).attr('y2', top + 2).attr('stroke', acc).attr('stroke-width', 2);
    svg.append('text').attr('x', x(300) + 4).attr('y', top - 8).style('fill', ink).style('font-size', '10px').style('font-weight', 600).text('25 EUR/month');
    all.forEach((r) => {
      const by = stack ? r.y + 22 : r.y + rowH / 2;
      const ly = stack ? r.y + 11 : r.y + rowH / 2 + 4;
      halo(svg.append('text').attr('x', stack ? 0 : lw - 6).attr('y', ly).attr('text-anchor', stack ? 'start' : 'end').attr('class', r.strong ? 'lab-strong' : 'lab').style('font-size', '11px').text(r.l));
      svg.insert('line', ':first-child').attr('x1', x(300)).attr('x2', x(300)).attr('y1', by - 9).attr('y2', by + 9).attr('stroke', acc).attr('stroke-width', 2);
      const col = C(r.tok);
      const [a, b] = r.v;
      if (a == null) return;
      if (b > a) {
        svg.append('rect').attr('x', x(a)).attr('y', by - 5).attr('width', Math.max(2, x(b) - x(a))).attr('height', 10)
          .attr('fill', r.low ? bg : col).attr('stroke', col).attr('stroke-width', r.low ? 1.3 : 0).attr('stroke-dasharray', r.low ? '3 2' : null);
      } else {
        svg.append('circle').attr('cx', x(a)).attr('cy', by).attr('r', 5.5).attr('fill', r.low ? bg : col).attr('stroke', r.tok === '--accent' ? ink : col).attr('stroke-width', r.tok === '--accent' ? 1 : 0);
      }
      halo(svg.append('text').attr('x', x(b) + 8).attr('y', by + 4).attr('class', 'lab').style('font-size', '11px').text(b > a ? `${fmt(a)}–${fmt(b)}` : fmt(a)));
    });
  }

  /* ---------- 6a consolidation timeline ---------- */
  const LANES = [
    { id: 'funding', label: 'Funding rounds' }, { id: 'acquisition', label: 'Acquisitions' },
    { id: 'stop', label: 'Business stops' }, { id: 'insolvency', label: 'Insolvencies' },
  ];
  function drawConsol() {
    const el = $('m3-con'); const E0 = (X.m3_consolidation || {}).events; if (!el || !E0) return;
    const E = E0.filter((e) => window.MD_PUBLIC || !e.pub_only); /* pub_only = public-source replacements, public build only */
    const w = widthOf(el), narrow = w < 600, fs = narrow ? 10 : 11;
    const laneH = { funding: narrow ? 130 : 132, acquisition: narrow ? 118 : 116, stop: 86, insolvency: 100 };
    const top = 8, m = { l: 6, r: 8 };
    let yy = top; const lane = {};
    LANES.forEach((L) => { lane[L.id] = { y0: yy, y1: yy + laneH[L.id] }; yy += laneH[L.id]; });
    const h = yy + 26;
    const svg = mkSvg(el, w, h, 'Timeline of acquisitions, funding rounds, stops and insolvencies 2017 to 2026');
    const x = d3.scaleTime().domain([new Date(2017, 8, 1), new Date(2026, 11, 31)]).range([m.l + 10, w - m.r - 8]);
    const rS = d3.scaleSqrt().domain([0, 500]).range([0, narrow ? 19 : 24]).clamp(true);
    const ink = C('--ink'), line = C('--line'), grey = C('--grey'), bg = C('--bg'), p2 = C('--panel-2'), muted = C('--muted');
    // exit band
    const xb0 = x(new Date(2024, 8, 1)), xb1 = x(NOW);
    svg.append('rect').attr('x', xb0).attr('y', lane.stop.y0).attr('width', xb1 - xb0).attr('height', lane.insolvency.y1 - lane.stop.y0).attr('fill', p2);
    // lanes
    LANES.forEach((L, i) => {
      if (i) svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', lane[L.id].y0).attr('y2', lane[L.id].y0).attr('stroke', line);
      svg.append('text').attr('x', m.l).attr('y', lane[L.id].y0 + 14).attr('class', 'lab-strong').style('font-size', '11px').text(L.label);
    });
    for (let yr = 2018; yr <= 2026; yr++) {
      const xx = x(new Date(yr, 0, 1));
      svg.append('line').attr('x1', xx).attr('x2', xx).attr('y1', top).attr('y2', yy).attr('stroke', line).attr('stroke-dasharray', '1 3');
      if (!narrow || yr % 2 === 0) svg.append('text').attr('x', xx).attr('y', yy + 16).attr('text-anchor', 'middle').style('fill', grey).style('font-size', '10.5px').text(yr);
    }
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', yy).attr('y2', yy).attr('stroke', muted);
    // nodes
    const nodes = E.map((e) => {
      const sized = e.amount_m != null && (e.type === 'funding' || e.type === 'acquisition');
      const r = sized ? Math.max(4, rS(e.amount_m)) : (e.type === 'stop' || e.type === 'insolvency') ? 6 : 4.5;
      const L = lane[e.type];
      return { e, r, sized, off: sized && e.amount_m > 500, tx: x(pd(e.date)), ty: (L.y0 + L.y1) / 2 + 8, L };
    });
    const sim = d3.forceSimulation(nodes)
      .force('x', d3.forceX((d) => d.tx).strength(0.9))
      .force('y', d3.forceY((d) => d.ty).strength(0.12))
      .force('c', d3.forceCollide((d) => d.r + 1.2))
      .stop();
    nodes.forEach((d) => { d.x = d.tx; d.y = d.ty; });
    for (let i = 0; i < 260; i++) { sim.tick(); nodes.forEach((d) => { d.y = Math.max(d.L.y0 + 20 + d.r, Math.min(d.L.y1 - d.r - 3, d.y)); }); }
    // labels
    const prio = { insolvency: 5, stop: 4, funding: 3, acquisition: 2 };
    const items = nodes.map((d) => {
      const amt = d.e.amount_m != null ? ` ${d.e.amount_kind === 'approx.' ? '~' : d.e.amount_kind === 'at least' ? '>' : ''}${d.e.amount_m >= 1000 ? fmt(d.e.amount_m / 1000) + ' bn' : fmt(d.e.amount_m, d.e.amount_m < 10 ? 1 : 0) + ' m'} ${d.e.currency}` : '';
      let t = d.e.label + amt + (d.off ? ' (off scale)' : '');
      if (narrow && t.length > 26) t = d.e.label.length <= 26 ? d.e.label : d.e.company.replace(/\s*\(.*\)/, '');
      return { own: d, x: d.x, y: d.y, r: d.r, text: t, fs, prio: prio[d.e.type] + (d.sized ? d.e.amount_m / 1000 : 0) + (d.e.conf === 'low' ? -1 : 0) + (/sonnen|SENEC stops|RCT/.test(d.e.label) ? 3 : 0), L: d.L };
    });
    const obst = nodes.map((d) => ptBox(d.x, d.y, d.r + 1, null));
    nodes.forEach((d, i) => { obst[i].own = items[i]; });
    // lane titles as obstacles
    LANES.forEach((L) => obst.push(boxFor(m.l, lane[L.id].y0 + 14, L.label, 11, 'start')));
    // exit band note (top right of the stop lane) as obstacle first
    const bandTxt = narrow ? 'Exit wave since 09/2024' : 'Exit wave since 09/2024: Zolar, SENEC, RCT Power, EKD, sonnen';
    obst.push(boxFor(xb1 - 4, lane.stop.y0 + 13, bandTxt, 10, 'end'));
    // place each item inside its own lane
    const placed = [];
    items.slice().sort((a, b) => b.prio - a.prio).forEach((it) => {
      const others = obst.concat(placed);
      placeLabels([it], others, { x0: m.l, x1: w - m.r, y0: it.L.y0 + 2, y1: it.L.y1 - 1 }, true);
      if (it.lx != null) placed.push(boxFor(it.lx, it.ly, it.text, fs, it.la));
    });
    const lg = svg.append('g');
    items.forEach((it) => {
      if (it.lx == null) return;
      if (it.lead) {
        const b = boxFor(it.lx, it.ly, it.text, fs, it.la);
        const tx = Math.max(b.x0, Math.min(b.x1, it.x)), ty = it.ly < it.y ? b.y1 : b.y0;
        lg.append('line').attr('x1', it.x).attr('y1', it.y).attr('x2', tx).attr('y2', ty).attr('stroke', grey).attr('stroke-width', 0.7);
      }
      lg.append('text').attr('x', it.lx).attr('y', it.ly).attr('text-anchor', it.la).attr('class', 'lab').style('font-size', fs + 'px').text(it.text);
    });
    svg.append('text').attr('x', xb1 - 4).attr('y', lane.stop.y0 + 13).attr('text-anchor', 'end').style('fill', muted).style('font-size', '10px').text(bandTxt);
    // marks
    const gm = svg.append('g').selectAll('path').data(nodes).join('path')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('d', (d) => {
        if (d.sized) return d3.symbol().type(d3.symbolCircle).size(Math.PI * d.r * d.r)();
        if (d.e.type === 'stop' || d.e.type === 'insolvency') return d3.symbol().type(d3.symbolDiamond).size(110)();
        return d3.symbol().type(d3.symbolSquare).size(64)();
      })
      .attr('fill', (d) => (d.e.conf === 'low' ? bg : UI.archColor(d.e.arch)))
      .attr('fill-opacity', (d) => (d.sized && d.e.conf !== 'low' ? 0.85 : 1))
      .attr('stroke', (d) => (d.e.conf === 'low' ? UI.archColor(d.e.arch) : bg))
      .attr('stroke-width', (d) => (d.e.conf === 'low' ? 1.6 : 1))
      .attr('stroke-dasharray', (d) => (d.e.conf === 'low' ? '2.5 1.5' : null));
    nodes.filter((d) => d.off).forEach((d) => svg.append('circle').attr('cx', d.x).attr('cy', d.y).attr('r', d.r + 3).attr('fill', 'none').attr('stroke', UI.archColor(d.e.arch)).attr('stroke-dasharray', '3 2'));
    UI.bindTip(gm, (d) => `<b>${esc(d.e.company)}</b> · ${esc(d.e.type)}<br>${esc(d.e.date)}${d.e.amount_m != null ? ` · ${d.e.amount_kind ? esc(d.e.amount_kind) + ' ' : ''}${fmt(d.e.amount_m, d.e.amount_m < 10 ? 1 : 0)} m ${esc(d.e.currency)}` : ''}<br>${esc(d.e.detail)}<br>${esc((UI.archById[d.e.arch] || {}).label || '')} · ${esc(d.e.conf || '')}${d.e.verified ? ' · re-checked' : ''}`);
    // legend
    const lgEl = $('m3-con-legend');
    if (lgEl) {
      const used = UI.ARCH.filter((a) => E.some((e) => e.arch === a.id));
      /* colour = strategic group; symbol keys replace the former long subtitle */
      const sym = (t, s, hollow) => `<svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><path d="${d3.symbol().type(t).size(s)()}" fill="${hollow ? bg : muted}" stroke="${muted}" stroke-width="${hollow ? 1.3 : 0}"${hollow ? ' stroke-dasharray="2 1.5"' : ''}></path></svg>`;
      lgEl.innerHTML = used.map((a) => `<span><i style="background:${C(a.tok)}"></i>${esc(a.short)}</span>`).join('') +
        `<span>${sym(d3.symbolCircle, 90)}Area = size, m</span><span>${sym(d3.symbolSquare, 50)}Undisclosed</span>` +
        `<span>${sym(d3.symbolDiamond, 60)}Stop or insolvency</span><span>${sym(d3.symbolCircle, 60, true)}Low confidence</span>`;
    }
  }

  /* ---------- 6b profitability ---------- */
  
  
  const isPb = () => false;
  
  function profitRows() {
    const CS = R.company_size; if (!CS) return [];
    const out = [];
    CS.companies.forEach((c) => {
      const cand = (c.net_income || []).filter((n) => n.value_m != null && !/forecast|conflicts|entity only/i.test(n.note || ''));
      if (!cand.length) return;
      const yMax = d3.max(cand, (n) => n.year);
      const best = cand.filter((n) => n.year === yMax).sort((a, b) => (isPb(a.source) ? 1 : 0) - (isPb(b.source) ? 1 : 0))[0];
      const pb = isPb(best.source);
      out.push({ c, n: best, v: best.value_m, pb, low: isLow(best.confidence) || pb,
        name: c.name.replace(/\s*\(.*\)/, '').replace(' Solar Technology', '').replace(' International', '').replace(' Energy Group', '').replace(' Energy', '').replace(' Group', '') });
    });
    return out.sort((a, b) => a.v - b.v);
  }
  function drawProfit() {
    const rows = profitRows(); if (!rows.length) return;
    const big = rows.filter((r) => Math.abs(r.v) >= 5), small = rows.filter((r) => Math.abs(r.v) < 5);
    const loss = rows.filter((r) => r.v < 0), prof = rows.filter((r) => r.v > 0);
    const t = $('m3-pr-title');
    const and = (a) => a.join(', ').replace(/, ([^,]*)$/, ' and $1');
    const pv = prof.filter((r) => !r.low).sort((a, b) => b.v - a.v).map((r) => r.name);
    const pu = prof.filter((r) => r.low).sort((a, b) => b.v - a.v).map((r) => r.name);
    /* title must keep starting with "N of M": m4.js reads it for the summary count */
    if (t) t.textContent = `${loss.length} of ${rows.length} HEMS-relevant companies with available results are loss-making`;
    const pp = $('m3-pr-pts'), worst = loss[0]; /* rows are sorted ascending: loss[0] = largest loss */
    const ptWorst = worst ? `<li><b>${fmt(worst.v, 0).replace('-', '−')} m ${esc(worst.n.currency)}</b>largest loss: ${esc(worst.name)}, ${esc(worst.n.year)}</li>` : '';
    const ptProf = pv.length ? `<li><b>${esc(and(pv))}</b>the only verified profit${pv.length > 1 ? 's' : ''}</li>` : '<li><b>None</b>posted a verified profit</li>';
    
    
    if (pp) pp.innerHTML = ptWorst + ptProf + (pu.length ? `<li><b>${esc(pu.join(', '))}</b>unverified profit</li>` : '');
    
    drawBars($('m3-pr-big'), big, 'Groups and large entities, millions');
    drawBars($('m3-pr-small'), small, 'Specialists and start-ups, millions (separate scale)');
  }
  function drawBars(el, rows, title) {
    if (!el || !rows.length) return;
    const w = widthOf(el), narrow = w < 420;
    const lw = narrow ? 112 : 138, rowH = 30, top = 26;
    const h = top + rows.length * rowH + 22;
    const svg = mkSvg(el, w, h, title);
    const ext = d3.extent(rows, (r) => r.v);
    const lo = Math.min(0, ext[0]), hi = Math.max(0, ext[1]);
    const pad = (hi - lo) * 0.2;
    const x = d3.scaleLinear().domain([lo - (lo < 0 ? pad * 0.6 : 0), hi + pad]).nice().range([lw + 6, w - 6]);
    const ink = C('--ink'), line = C('--line'), grey = C('--grey'), bg = C('--bg'), bad = C('--bad'), good = C('--good');
    svg.append('text').attr('x', 0).attr('y', 12).attr('class', 'lab-strong').style('font-size', '11.5px').text(title);
    x.ticks(narrow ? 3 : 5).forEach((v) => {
      svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', top - 4).attr('y2', h - 18).attr('stroke', line);
      svg.append('text').attr('x', x(v)).attr('y', h - 5).attr('text-anchor', 'middle').style('fill', grey).style('font-size', '10px').text(fmt(v, Math.abs(v) < 2 && v % 1 ? 1 : 0));
    });
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top - 6).attr('y2', h - 18).attr('stroke', ink);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${top + i * rowH})`);
    g.append('rect').attr('x', 0).attr('y', 4).attr('width', 8).attr('height', 8).attr('fill', (r) => UI.archColor(r.c.archetype));
    g.append('text').attr('x', 12).attr('y', 12).attr('class', 'lab').style('font-size', '11.5px').text((r) => r.name);
    
    
    g.append('text').attr('x', 12).attr('y', 24).style('fill', grey).style('font-size', '9.5px').text((r) => `${r.n.currency} ${r.n.year}${r.low ? ' · unverified' : ''}`);
    
    g.append('rect').attr('x', (r) => Math.min(x(0), x(r.v))).attr('y', 6).attr('height', 14)
      .attr('width', (r) => Math.max(1.5, Math.abs(x(r.v) - x(0))))
      .attr('fill', (r) => (r.low ? bg : r.v < 0 ? bad : good))
      .attr('stroke', (r) => (r.v < 0 ? bad : good)).attr('stroke-width', (r) => (r.low ? 1.4 : 0))
      .attr('stroke-dasharray', (r) => (r.low ? '3 2' : null));
    g.append('text').attr('y', 17).style('font-size', '10.5px')
      .attr('x', (r) => (r.v < 0 ? x(r.v) - 4 : x(r.v) + 4)).attr('text-anchor', (r) => (r.v < 0 ? 'end' : 'start'))
      .attr('class', 'lab').text((r) => (r.v > 0 ? '+' : '') + fmt(r.v, Math.abs(r.v) < 10 ? (Math.abs(r.v) < 0.1 ? 3 : 2) : 0));
    UI.bindTip(g, (r) => `<b>${esc(r.c.name)}</b><br>Net income ${r.n.year}: ${fmt(r.v, 2)} m ${esc(r.n.currency)}${r.n.note ? ' (' + esc(r.n.note) + ')' : ''}<br>Confidence: ${esc(r.n.confidence || '')}${r.n.verified ? ' · re-checked' : ''}<br><span style="opacity:.7">${esc(host(r.n.source) || (r.n.source || '').slice(0, 80))}</span>`);
  }

  /* ---------- 6c trends ---------- */
  let trFilter = 'all';
  function drawTrends() {
    const el = $('m3-tr'); const T = (X.m3_trends || {}).trends; if (!el || !T) return;
    const seg = $('m3-tr-filter');
    if (seg && !seg.childElementCount) {
      [['all', 'All ten'], ['opportunity', 'Opportunities for us'], ['threat', 'Threats for us']].forEach(([k, l]) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = l; b.dataset.k = k;
        b.setAttribute('aria-pressed', k === trFilter ? 'true' : 'false');
        b.addEventListener('click', () => { trFilter = k; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.k === k ? 'true' : 'false')); drawTrends(); });
        seg.appendChild(b);
      });
    }
    const DIR = { up: ['↑', 'Rising'], flat: ['→', 'Flat'], contested: ['↕', 'Rising, contested'] };
    /* matrix: columns = implication for us, rows = strength of evidence (both fields from the data) */
    const COLS = [['opportunity', 'Opportunity for us'], ['both', 'Both'], ['threat', 'Threat for us']];
    const STR = [[3, 'Strong'], [2, 'Medium'], [1, 'Weak']];
    const rows = T.filter((t) => trFilter === 'all' || t.impact === trFilter || t.impact === 'both');
    const open = new Set([...el.querySelectorAll('details[open]')].map((d) => d.dataset.id)); /* keep open evidence across redraws */
    const bars = (s) => `<span class="bars" aria-label="strength ${s} of 3">${[1, 2, 3].map((i) => `<i class="${i <= s ? 'on' : ''}"></i>`).join('')}</span>`;
    const card = (t) => {
      const k = TR_KEY[t.id];
      return `<div class="m3-tc">
        <div class="mt"><b title="${DIR[t.dir][1]}" aria-label="${DIR[t.dir][1]}">${DIR[t.dir][0]}</b>${esc(t.horizon)}</div>
        <div class="nm">${esc(t.trend)}</div>
        ${k ? `<div class="kf"><b>${esc(k[0])}</b>${esc(k[1])}</div>` : ''}
        <details data-id="${esc(t.id)}"${open.has(t.id) ? ' open' : ''}><summary>Evidence</summary>
          <ul>${((window.MD_PUBLIC && t.ev_pub) || t.ev).map(([f, c]) => `<li>${esc(f)}${c === 'low' ? ' ' + UI.conf('unverified').replace('class="conf ', 'class="conf low ') : ''}</li>`).join('')}</ul>
          ${t.spark ? `<div class="spk" data-s="${esc(t.spark)}" data-l="${esc(t.spark_label || '')}"></div>` : ''}
          <p class="fu"><b>For us:</b> ${esc(t.for_us)}</p>
        </details>
      </div>`;
    };
    el.innerHTML = '<div class="ch"></div>' + COLS.map(([k, l]) => `<div class="ch ${k}">${l}</div>`).join('') +
      STR.map(([s, sl]) => `<div class="rh">${bars(s)}<span>${sl} evidence</span></div>` + COLS.map(([k, l]) => {
        const cs = rows.filter((t) => t.strength === s && t.impact === k);
        return `<div class="cell${cs.length ? '' : ' empty'}" data-lab="${l}">${cs.map(card).join('')}</div>`;
      }).join('')).join('');
    el.querySelectorAll('.spk').forEach(drawSpark);
  }
  /* one headline figure per trend, quoted from its evidence lines (data/m3_trends.json); the full evidence sits behind "Evidence" */
  const TR_KEY = {
    flex: ['1 GW', 'shiftable at 1KOMMA5° Heartbeat (05/2026)'],
    spreads: ['157 EUR/MWh', 'average daily spread, 2026 to 24.11.'],
    commod: ['94 %', 'of 83 listed HEMS claim PV surplus to battery'],
    bundle: ['No fee', 'EnBW Mavi (initially), Intelligent Octopus control'],
    consol: ['sonnen', 'insolvency reported 22.10.2026'],
    platforms: ['> 60,000', 'Heartbeat AI systems; sold to third parties since 04/2026'],
    simult: ['RLI 06/2026', 'warns of new simultaneity peaks'],
    interop: ['77 %', 'of HEMS receive §14a commands (early 2025)'],
    ai: ['> 100 m EUR', '1KOMMA5° Heartbeat investment planned for 2027'],
    heat: ['+40 %', 'heat-pump sales H1 2026, about 195,000 units'],
  };
  function drawSpark(el) {
    const S = (R.regulation_trends || {}).series || []; const s = S.find((q) => q.id === el.dataset.s); if (!s) return;
    const pts = s.points.filter((p) => p.value != null);
    const w = 220, h = 46, m = { l: 26, r: 30, t: 12, b: 12 };
    const svg = mkSvg(el, w, h, el.dataset.l).style('max-width', w + 'px');
    const x = d3.scaleLinear().domain(d3.extent(pts, (p) => p.year)).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(pts, (p) => p.value)]).range([h - m.b, m.t]);
    const ink = C('--ink'), grey = C('--grey');
    svg.append('path').attr('d', d3.line().x((p) => x(p.year)).y((p) => y(p.value))(pts)).attr('fill', 'none').attr('stroke', ink).attr('stroke-width', 1.6);
    const f = pts[0], l = pts[pts.length - 1];
    svg.append('circle').attr('cx', x(l.year)).attr('cy', y(l.value)).attr('r', 2.6).attr('fill', ink);
    svg.append('text').attr('x', x(f.year) - 4).attr('y', y(f.value) + 4).attr('text-anchor', 'end').style('font-size', '10px').attr('class', 'lab').text(fmt(f.value));
    svg.append('text').attr('x', x(l.year) + 5).attr('y', y(l.value) + 4).style('font-size', '10px').attr('class', 'lab').text(fmt(l.value));
    svg.append('text').attr('x', m.l).attr('y', 8).style('fill', grey).style('font-size', '9.5px').text(`${el.dataset.l}, ${f.year} to ${l.year}${/YTD|2026/.test(String(l.year)) ? ' YTD' : ''}`);
  }

  /* ---------- run ---------- */
  const all = [drawLandscape, drawHistory, drawChannels, drawPayers, drawValue, drawConsol, drawProfit, drawTrends];
  function run() { all.forEach((f) => { try { f(); } catch (e) { console.error('m3', f.name, e); } }); }
  run();
  UI.onTheme(run);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
})();

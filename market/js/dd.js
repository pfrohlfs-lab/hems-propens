/* Deep dive gridX vs. Consolinno: all charts of deep-dive.html.
   Data: MD.r.gridx_deepdive, MD.r.consolinno_deepdive (fact-checked streams), MD.extra.dd_curated.
   Every chart is a function that clears and redraws; registered with UI.onTheme. */
(function () {
  'use strict';
  if (!window.MD || !window.UI || !window.d3) return;
  const MD = window.MD, UI = window.UI;
  const R = MD.r || {};
  const GX = R.gridx_deepdive || {}, CN = R.consolinno_deepdive || {};
  const X = (MD.extra || {}).dd_curated || {};
  const $ = (id) => document.getElementById(id);
  const esc = UI.esc;
  const NS = 'dd';

  const col = () => ({
    ink: UI.css('--ink'), muted: UI.css('--muted'), grey: UI.css('--grey'), line: UI.css('--line'),
    bg: UI.css('--bg'), panel: UI.css('--panel'), panel2: UI.css('--panel-2'),
    gx: UI.css('--c-gridx'), cn: UI.css('--c-consolinno'), us: UI.css('--c-ours'),
    bad: UI.css('--bad'), good: UI.css('--good'),
  });
  const MINUS = '−';
  const eur = (v, d = 1) => (v < 0 ? MINUS : '') + '€' + Math.abs(v).toFixed(d) + ' m';
  const sgn = (v, d = 1) => (v < 0 ? MINUS : v > 0 ? '+' : '') + Math.abs(v).toFixed(d);
  const confTxt = (c) => c ? ` <span style="opacity:.75">· confidence: ${esc(c)}</span>` : '';

  /* ---------- text helpers ---------- */
  let ctx = null;
  function tw(s, size = 11, weight = 400) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;
    return ctx.measureText(String(s)).width;
  }
  function wrap(s, maxW, size = 11, weight = 400) {
    const words = String(s).split(/\s+/); const out = []; let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (!cur || tw(t, size, weight) <= maxW) cur = t; else { out.push(cur); cur = w; } });
    if (cur) out.push(cur);
    return out;
  }
  function lines(g, arr, x, y, lh, cls, anchor = 'start') {
    const t = g.append('text').attr('class', cls).attr('x', x).attr('y', y).attr('text-anchor', anchor);
    arr.forEach((l, i) => t.append('tspan').attr('x', x).attr('dy', i ? lh : 0).text(l));
    return t;
  }
  function svgIn(el) { return d3.select(el).html('').append('svg').attr('width', '100%').attr('role', 'img'); }
  function size(svg, w, h) { svg.attr('viewBox', `0 0 ${w} ${Math.ceil(h)}`); }
  const widthOf = (el) => Math.max(240, Math.floor(el.clientWidth || el.getBoundingClientRect().width || 600));

  /* ---------- compact view: detail text on demand ----------
     .dd-x = detail text, hidden until its exhibit is opened via a .dd-tg button ("Show notes"),
     .dd-tt = hover target whose full content is shown as a tooltip while the exhibit is closed. */
  function tipOn(el, html) {
    el.dataset.ddTip = '1';
    const show = (ev) => { if (el.closest('.dd-open')) { UI.tip(null); return; } UI.tip(typeof html === 'function' ? html() : html, ev); };
    el.addEventListener('mouseenter', show); el.addEventListener('mousemove', show);
    el.addEventListener('mouseleave', () => UI.tip(null));
  }
  function proseTips() {
    document.querySelectorAll('.dd-tt').forEach((el) => { if (el.dataset.ddTip !== '1') tipOn(el, () => el.innerHTML); });
  }
  function toggles() {
    document.querySelectorAll('.dd-tg').forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = '1';
      const fig = b.closest('.exhibit'); if (!fig) return;
      const off = b.textContent, on = b.dataset.on || 'Hide details';
      b.addEventListener('click', () => {
        const open = !fig.classList.contains('dd-open');
        fig.classList.toggle('dd-open', open); b.setAttribute('aria-pressed', String(open)); b.textContent = open ? on : off; UI.tip(null);
      });
    });
  }

  /* ---------- data helpers ---------- */
  function fin(stream, metric, year, currency) {
    const r = (stream.financials || []).find((f) => f.metric === metric && +f.year === year && (!currency || f.currency === currency));
    return r ? r : null;
  }
  const fv = (stream, metric, year, currency) => { const r = fin(stream, metric, year, currency); return r && typeof r.value === 'number' ? r.value : null; };
  function pd(s) {
    s = String(s); let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return { d: new Date(+m[1], +m[2] - 1, +m[3]), approx: false };
    if ((m = s.match(/^(\d{4})-(\d{2})(?!\d)/))) return { d: new Date(+m[1], +m[2] - 1, 15), approx: false };
    if ((m = s.match(/^(\d{4})-Q(\d)/))) return { d: new Date(+m[1], (+m[2] - 1) * 3 + 1, 15), approx: true };
    if ((m = s.match(/^(\d{4})-summer/))) return { d: new Date(+m[1], 6, 15), approx: true };
    if ((m = s.match(/^(\d{4})/))) return { d: new Date(+m[1], 6, 1), approx: true };
    return null;
  }
  const fmtDate = (s) => {
    const p = pd(s); if (!p) return esc(s);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return d3.timeFormat('%d %b %Y')(p.d);
    if (/^\d{4}-\d{2}(?!\d)/.test(s)) return d3.timeFormat('%b %Y')(p.d);
    return esc(s);
  };

  /* ============ 3 · TIMELINE ============ */
  const CAT = [
    { id: 'corporate', label: 'Corporate', sym: d3.symbolSquare },
    { id: 'funding', label: 'Funding', sym: d3.symbolCircle },
    { id: 'product', label: 'Product & tech', sym: d3.symbolTriangle },
    { id: 'partner', label: 'Partners & market', sym: d3.symbolDiamond },
    { id: 'people', label: 'People', sym: d3.symbolCross },
  ];
  const catById = Object.fromEntries(CAT.map((c) => [c.id, c]));
  const CMAP = { technology: 'product', ip: 'product', strategy: 'product', go_to_market: 'partner', pricing: 'partner', finance: 'corporate' };
  const churn = X.churn || null;
  const churnFrom = churn ? pd(churn.from).d : null, churnTo = churn ? pd(churn.to).d : null;
  function events(stream, co) {
    return (stream.timeline || []).map((e) => {
      const p = pd(e.date); if (!p || !e.event) return null; // public build: event text may be emptied by the licence filter
      const cat = catById[e.category] ? e.category : (CMAP[e.category] || 'corporate');
      const isChurn = co === 'gridx' && cat === 'people' && churn && p.d >= new Date(churnFrom.getTime() - 864e5 * 40) && p.d <= new Date(churnTo.getTime() + 864e5 * 5);
      return { co, date: e.date, d: p.d, approx: p.approx, cat, raw: e.category, text: e.event, conf: e.confidence, corr: e.correction || null, churn: isChurn };
    }).filter(Boolean);
  }
  const EV = { gridx: events(GX, 'gridx'), consolinno: events(CN, 'consolinno') };
  let tlCat = 'all';

  function tlSeg() {
    const seg = $('dd-tl-seg'); if (!seg) return;
    const c = col();
    const items = [{ id: 'all', label: 'All' }].concat(CAT);
    seg.innerHTML = items.map((it) => {
      let icon = '';
      if (it.sym) { const p = d3.symbol().type(it.sym).size(46)(); icon = `<svg width="12" height="12" viewBox="-6 -6 12 12" style="display:inline-block;vertical-align:-1px;margin-right:5px;overflow:visible" aria-hidden="true"><path d="${p}" fill="currentColor"/></svg>`; }
      return `<button type="button" data-cat="${it.id}" aria-pressed="${tlCat === it.id}">${icon}${esc(it.label)}</button>`;
    }).join('');
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { tlCat = b.dataset.cat; tlSeg(); drawTimeline(); }));
    void c;
  }

  function drawTimeline() {
    const el = $('dd-timeline'); if (!el) return;
    const c = col(); const W = widthOf(el); const narrow = W < 620;
    const L = narrow ? 2 : 92, Rm = 8;
    const x = d3.scaleTime().domain([new Date(2015, 0, 1), new Date(2027, 0, 1)]).range([L, W - Rm]);
    const s = narrow ? 7 : 9, step = s + 2, area = s * s * 1.05;
    function stack(evts) {
      const rows = [];
      evts.slice().sort((a, b) => a.d - b.d).forEach((e) => {
        e.x = x(e.d);
        let r = rows.findIndex((last) => e.x - last >= s + 1.5);
        if (r < 0) { r = rows.length; rows.push(-1e9); }
        rows[r] = e.x; e.r = r;
      });
      return Math.max(1, rows.length);
    }
    const nG = stack(EV.gridx), nC = stack(EV.consolinno);
    const keysFor = (co) => ((X.timeline_keys || {})[co] || []).filter((k) => (!k.pub || window.MD_PUBLIC) && (!narrow || k.m)).map((k) => {
      const e = EV[co].find((ev) => ev.date === k.date); if (!e) return null;
      const w = tw(k.label, 11.5, 500); let x0 = e.x, anchor = 'start';
      if (x0 + w > W - Rm) { anchor = 'end'; x0 = e.x - w; }
      return { ...k, e, w, x0, x1: x0 + w, anchor };
    }).filter(Boolean);
    function levels(keys) {
      // right to left; a label must sit above every leader line that runs through its span
      const placed = [];
      keys.sort((a, b) => b.e.x - a.e.x).forEach((k) => {
        let lv = 0;
        placed.forEach((p) => { if (p.e.x >= k.x0 - 3 && p.e.x <= k.x1 + 3) lv = Math.max(lv, p.lv + 1); });
        const free = (l) => placed.every((p) => p.lv !== l || k.x1 + 10 < p.x0 || k.x0 > p.x1 + 10);
        while (!free(lv)) lv++;
        k.lv = lv; placed.push(k);
      });
      // relax: no leader may cross a label, no two labels on one level may overlap
      const inSpan = (xv, k) => xv >= k.x0 - 3 && xv <= k.x1 + 3;
      const overlap = (a, b) => !(a.x1 + 10 < b.x0 || a.x0 > b.x1 + 10);
      for (let guard = 0, changed = true; changed && guard < 60; guard++) {
        changed = false;
        placed.forEach((k) => placed.forEach((p) => {
          if (p === k) return;
          if (inSpan(p.e.x, k) && k.lv <= p.lv && !inSpan(k.e.x, p)) { k.lv = p.lv + 1; changed = true; }
          else if (k.lv === p.lv && overlap(k, p) && k.e.x < p.e.x) { k.lv += 1; changed = true; }
        }));
      }
      return placed.length ? d3.max(placed, (p) => p.lv) + 1 : 0;
    }
    const kG = keysFor('gridx'), kC = keysFor('consolinno');
    const lvG = levels(kG), lvC = levels(kC);
    const LH = 15, laneName = narrow ? 18 : 0, rowGap = 34;
    const stackTopG = 6 + laneName + lvG * LH + 8;
    const axisY = stackTopG + s / 2 + (nG - 1) * step + rowGap;
    const yG = (r) => axisY - rowGap - r * step;
    const yC = (r) => axisY + 30 + r * step;
    const stackBotC = yC(nC - 1) + s / 2;
    const H = stackBotC + 10 + lvC * LH + laneName + 6;

    const svg = svgIn(el); size(svg, W, H);
    svg.attr('aria-label', 'Double swimlane timeline of company events 2015 to 2026, gridX above the axis, Consolinno below');
    const g = svg.append('g');

    // churn band
    if (churn) {
      const x0 = x(churnFrom), x1 = x(churnTo);
      g.append('rect').attr('x', x0 - 5).attr('y', stackTopG - s / 2 - 4).attr('width', x1 - x0 + 10).attr('height', axisY - 8 - (stackTopG - s / 2 - 4))
        .attr('fill', c.bad).attr('fill-opacity', 0.07).attr('stroke', c.bad).attr('stroke-opacity', 0.5).attr('stroke-dasharray', '3 3');
      const by = axisY - 20;
      g.append('path').attr('d', `M${x0},${by - 4}V${by}H${x1}V${by - 4}`).attr('fill', 'none').attr('stroke', c.bad).attr('stroke-width', 1.2);
      const lbl = narrow ? '6 management changes' : (churn.label || '');
      g.append('text').attr('class', 'lab').attr('x', narrow ? x1 : x0).attr('y', axisY - 7).attr('text-anchor', narrow ? 'end' : 'start')
        .style('fill', c.bad).style('font-size', '11px').style('font-weight', 600).text(lbl);
    }

    // axis
    const ax = g.append('g').attr('class', 'ax');
    ax.append('line').attr('x1', L).attr('x2', W - Rm).attr('y1', axisY).attr('y2', axisY).style('stroke', c.ink);
    d3.range(2015, 2027).forEach((yr) => {
      const xx = x(new Date(yr, 0, 1));
      ax.append('line').attr('x1', xx).attr('x2', xx).attr('y1', axisY - 3).attr('y2', axisY + 3).style('stroke', c.ink);
      if (!narrow || yr % 2 === 0) ax.append('text').attr('x', x(new Date(yr, 6, 1))).attr('y', axisY + 15).attr('text-anchor', 'middle').text(narrow ? "'" + String(yr).slice(2) : yr);
    });

    // lane names
    if (narrow) {
      g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', 14).text('▲ gridX');
      g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', H - 6).text('▼ Consolinno');
    } else {
      g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', yG(0) + 4).text('gridX');
      g.append('text').attr('class', 'lab').attr('x', 0).attr('y', yG(0) + 18).style('fill', c.grey).text(EV.gridx.length + ' events');
      g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', yC(0) + 4).text('Consolinno');
      g.append('text').attr('class', 'lab').attr('x', 0).attr('y', yC(0) + 18).style('fill', c.grey).text(EV.consolinno.length + ' events');
    }

    // leaders + key labels
    const dim = (cat) => (tlCat === 'all' || tlCat === cat ? 1 : 0.13);
    function keyLabels(keys, co) {
      keys.forEach((k) => {
        const e = k.e;
        const my = co === 'gridx' ? yG(e.r) - s / 2 - 1 : yC(e.r) + s / 2 + 1;
        const ly = co === 'gridx' ? stackTopG - s / 2 - 8 - k.lv * LH : stackBotC + 15 + k.lv * LH;
        g.append('line').attr('x1', e.x).attr('x2', e.x).attr('y1', my).attr('y2', co === 'gridx' ? ly + 3 : ly - 10)
          .attr('stroke', c.grey).attr('stroke-width', 0.8).attr('opacity', dim(e.cat));
        g.append('text').attr('class', 'lab').attr('x', k.anchor === 'start' ? e.x + 2 : e.x - 2).attr('y', ly).attr('text-anchor', k.anchor)
          .style('font-weight', 500).attr('opacity', dim(e.cat)).text(k.label);
      });
    }
    keyLabels(kG, 'gridx'); keyLabels(kC, 'consolinno');

    // marks
    const all = EV.gridx.map((e) => ({ ...e, y: yG(e.r) })).concat(EV.consolinno.map((e) => ({ ...e, y: yC(e.r) })));
    const sym = d3.symbol().size(area);
    const marks = g.append('g').selectAll('path').data(all).join('path')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('d', (d) => sym.type(catById[d.cat].sym)())
      .attr('fill', (d) => d.conf === 'low' ? c.bg : d.churn ? c.bad : d.co === 'gridx' ? c.gx : c.cn)
      .attr('stroke', (d) => d.churn ? c.bad : d.co === 'gridx' ? c.gx : c.cn)
      .attr('stroke-width', (d) => d.conf === 'low' ? 1.2 : 0.6)
      .attr('stroke-dasharray', (d) => d.conf === 'low' ? '2 1.5' : null)
      .attr('opacity', (d) => dim(d.cat))
      .style('cursor', 'default');
    UI.bindTip(marks, (d) => `<b>${d.co === 'gridx' ? 'gridX' : 'Consolinno'} · ${fmtDate(d.date)}</b>${d.approx ? ' (approx.)' : ''}<br>${esc(catById[d.cat].label)}${d.churn ? ' · management change' : ''}<br>${esc(d.text)}${d.corr ? '<br><i>Corrected: ' + esc(d.corr) + '</i>' : ''}${confTxt(d.conf)}`);
  }

  /* ============ 4 · OWNERSHIP ============ */
  function boxAt(g, o) {
    // o: x, y, w, title, sub, stroke, sw, dash, fill, align
    const c = col(); const pad = 9;
    const tl = wrap(o.title, o.w - 2 * pad, 12, 600);
    const sl = o.sub ? wrap(o.sub, o.w - 2 * pad, 11, 400) : [];
    const h = pad + tl.length * 15 + (sl.length ? 2 + sl.length * 14 : 0) + pad - 3;
    g.append('rect').attr('x', o.x).attr('y', o.y).attr('width', o.w).attr('height', h)
      .attr('fill', o.fill || c.bg).attr('stroke', o.stroke || c.ink).attr('stroke-width', o.sw || 1).attr('stroke-dasharray', o.dash || null);
    if (o.bar) g.append('rect').attr('x', o.x).attr('y', o.y).attr('width', 5).attr('height', h).attr('fill', o.bar).attr('stroke', o.stroke || c.ink).attr('stroke-width', 0.5);
    const tx = o.x + pad + (o.bar ? 4 : 0);
    lines(g, tl, tx, o.y + pad + 10, 15, 'lab-strong');
    if (sl.length) lines(g, sl, tx, o.y + pad + 10 + tl.length * 15 + 1, 14, 'lab').style('fill', c.muted).style('font-size', '11px');
    return h;
  }
  function edge(g, x1, y1, x2, y2, label, opt = {}) {
    const c = col();
    g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2 - 5).attr('stroke', c.ink).attr('stroke-width', 1.2).attr('stroke-dasharray', opt.dash || null);
    g.append('path').attr('d', `M${x2 - 4},${y2 - 6}L${x2},${y2}L${x2 + 4},${y2 - 6}Z`).attr('fill', c.ink);
    if (label) g.append('text').attr('class', 'lab-strong').attr('x', (x1 + x2) / 2 + 8).attr('y', (y1 + y2) / 2 + 4).text(label);
    if (opt.note) g.append('text').attr('class', 'lab').attr('x', (x1 + x2) / 2 + 8 + tw(label || '', 12, 600) + 8).attr('y', (y1 + y2) / 2 + 4).style('fill', c.muted).text(opt.note);
  }
  function drawOwnGx() {
    const el = $('dd-own-gx'); if (!el) return;
    const c = col(); const W = widthOf(el);
    const svg = svgIn(el); const g = svg.append('g');
    const bw = Math.min(W - 2, 300), bx = 1;
    let y = 1;
    let h = boxAt(g, { x: bx, y, w: bw, title: 'E.ON SE', sub: 'Essen; listed (ETR: EOAN)' }); y += h;
    
    edge(g, bx + 30, y, bx + 30, y + 40, '100 %', { note: W > 300 ? 'majority 09/2021, rest 12/2022' : '' }); y += 40;
    
    h = boxAt(g, { x: bx, y, w: bw, title: 'gridX GmbH', sub: 'Aachen · HRB 20494 · ~190 staff (2024 avg.) · part of E.ON One since 12/2022', stroke: c.gx, sw: 2.5, bar: c.gx }); y += h + 22;
    y += boxAt(g, { x: 1, y, w: W - 2, title: 'Earlier shareholders, all exited by 12/2022', sub: 'RWE/innogy (in the register 2019–2020) and the investors of a 2018 Series A in the mid-single-digit € millions', stroke: c.grey, dash: '4 3', fill: 'none' });
    size(svg, W, y + 2);
    svg.attr('aria-label', 'gridX ownership: E.ON SE holds 100 percent of gridX GmbH, a majority since September 2021 and the remaining shares since December 2022');
    
    
  }
  function drawOwnCn() {
    const el = $('dd-own-cn'); if (!el) return;
    const c = col(); const W = widthOf(el);
    const svg = svgIn(el); const g = svg.append('g');
    const gap = 14, ow = (W - 2 - gap) / 2;
    const h1 = boxAt(g, { x: 1, y: 1, w: ow, title: 'Klaus Nagl', sub: 'founder and CEO; plus atypical silent partnership €100k (5 %) since 12/2021' });
    const h2 = boxAt(g, { x: 1 + ow + gap, y: 1, w: ow, title: 'MF Tech GmbH', sub: 'since 28.05.2021; paid €3.85 m into the capital reserve 2021–22' });
    const top = 1 + Math.max(h1, h2);
    const cy = top + 46; const cw = Math.min(W - 2, 320), cx = (W - cw) / 2;
    edge(g, 1 + ow / 2, top, Math.max(cx + 30, 1 + ow / 2), cy, '50 %');
    edge(g, 1 + ow + gap + ow / 2, top, Math.min(cx + cw - 30, 1 + ow + gap + ow / 2), cy, '50 %');
    const h3 = boxAt(g, { x: cx, y: cy, w: cw, title: 'Consolinno Energy GmbH', sub: 'Regensburg · HRB 15773 · 71 staff (2024) · no VC backing', stroke: c.cn, sw: 2.5, bar: c.cn });
    let y = cy + h3 + 22;
    const gw = W - 2;
    const h4 = boxAt(g, { x: 1, y: y + 4, w: gw, title: 'Public funders (no equity): about €5.7 m in grants since 2017', sub: 'BMWK/BMWE (e.g. unIT-e² €1.51 m), European Commission (e.g. €387k in 11/2024, €251k in 09/2026), further R&D programmes', stroke: c.grey, dash: '4 3', fill: 'none' });
    g.append('line').attr('x1', W / 2).attr('x2', W / 2).attr('y1', y + 4).attr('y2', y - 18).attr('stroke', c.grey).attr('stroke-dasharray', '3 3');
    y += 4 + h4;
    size(svg, W, y + 2);
    svg.attr('aria-label', 'Consolinno ownership: Klaus Nagl 50 percent and MF Tech GmbH 50 percent; public grants of about 5.7 million euros');
  }

  /* grants vs owner capital */
  function grantsData() {
    const out = [];
    (CN.financials || []).forEach((f) => {
      if (f.metric === 'public_grants_awarded') out.push({ year: +f.year, v: +f.value, conf: f.confidence, kind: 'award' });
      if (f.metric === 'public_grants_received_range') {
        const [lo, hi] = String(f.value).split('-').map(Number);
        out.push({ year: +f.year, v: (lo + hi) / 2, lo, hi, conf: 'low', kind: 'received (band)' });
      }
    });
    return out.sort((a, b) => a.year - b.year);
  }
  function drawGrants() {
    const el = $('dd-grants'); if (!el) return;
    const c = col(); const W = widthOf(el); const narrow = W < 560;
    const gr = grantsData();
    const capital = [{ year: 2021, v: fv(CN, 'capital_reserve_contribution', 2021) || 1.4 }, { year: 2022, v: fv(CN, 'capital_reserve_contribution', 2022) || 2.446 }];
    const tG = d3.sum(gr, (d) => d.v), tC = d3.sum(capital, (d) => d.v);
    const svg = svgIn(el); const g = svg.append('g');
    // A: totals
    const lw = narrow ? 0 : 150; const top = narrow ? 16 : 0;
    const xa = d3.scaleLinear().domain([0, Math.max(tG, tC) * 1.08]).range([lw, W - (narrow ? 50 : 70)]);
    const bh = 24;
    const rows = [{ k: 'Public grants 2017–2026', segs: gr, col: c.cn, tot: tG }, { k: 'Owner capital paid in', segs: capital, col: c.grey, tot: tC }];
    rows.forEach((r, i) => {
      const y = top + i * (bh + (narrow ? 26 : 12));
      if (narrow) g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', y - 5).text(r.k);
      else g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', y + bh / 2 + 4).text(r.k);
      let acc = 0;
      r.segs.forEach((s) => {
        const x0 = xa(acc), x1 = xa(acc + s.v); acc += s.v;
        const rect = g.append('rect').attr('x', x0).attr('y', y).attr('width', Math.max(0.5, x1 - x0 - 1)).attr('height', bh)
          .attr('fill', s.conf === 'low' ? c.bg : r.col).attr('stroke', r.col).attr('stroke-dasharray', s.conf === 'low' ? '3 2' : null);
        UI.bindTip(rect.datum(s), (d) => `<b>${d.year}: ${eur(d.v, 2)}</b><br>${r === rows[0] ? (d.kind === 'award' ? 'Grant awards (not cash received)' : `Grants received, band €${d.lo}–${d.hi} m`) : 'Contribution to capital reserve (MF Tech)'}${confTxt(d.conf)}`);
        if (x1 - x0 > 30) g.append('text').attr('class', 'lab').attr('x', (x0 + x1) / 2).attr('y', y + bh / 2 + 4).attr('text-anchor', 'middle')
          .style('fill', s.conf === 'low' ? c.ink : (r.col === c.grey ? c.bg : c.ink)).style('font-size', '10.5px').text("'" + String(s.year).slice(2));
      });
      g.append('text').attr('class', 'lab-strong').attr('x', xa(r.tot) + 6).attr('y', y + bh / 2 + 4).text(i === 0 ? '≈ ' + eur(r.tot, 1) : eur(r.tot, 2));
    });
    let y = top + 2 * bh + (narrow ? 26 : 12) + 34;
    // B: per year columns
    g.append('text').attr('class', 'lab').attr('x', 0).attr('y', y).style('fill', c.muted).text('By year, € m');
    g.append('rect').attr('x', 90).attr('y', y - 9).attr('width', 10).attr('height', 10).attr('fill', c.cn);
    g.append('text').attr('class', 'lab').attr('x', 105).attr('y', y).text('Public grants');
    g.append('rect').attr('x', 190).attr('y', y - 9).attr('width', 10).attr('height', 10).attr('fill', c.grey);
    g.append('text').attr('class', 'lab').attr('x', 205).attr('y', y).text('Owner capital (MF Tech)');
    y += 14;
    const years = d3.range(2017, 2027);
    const ch = 120;
    const xb = d3.scaleBand().domain(years).range([0, W]).padding(0.25);
    const yb = d3.scaleLinear().domain([0, 2.6]).range([y + ch, y]);
    const sub = d3.scaleBand().domain(['g', 'c']).range([0, xb.bandwidth()]).padding(0.08);
    g.append('line').attr('x1', 0).attr('x2', W).attr('y1', yb(0)).attr('y2', yb(0)).attr('stroke', c.ink);
    years.forEach((yr) => {
      const gg = gr.find((d) => d.year === yr), cc = capital.find((d) => d.year === yr);
      [['g', gg, c.cn], ['c', cc, c.grey]].forEach(([k, d, cl]) => {
        if (!d) return;
        const bx = xb(yr) + sub(k);
        const rect = g.append('rect').attr('x', bx).attr('y', yb(d.v)).attr('width', sub.bandwidth()).attr('height', yb(0) - yb(d.v))
          .attr('fill', d.conf === 'low' ? c.bg : cl).attr('stroke', cl).attr('stroke-dasharray', d.conf === 'low' ? '3 2' : null);
        UI.bindTip(rect.datum(d), (dd) => `<b>${yr}</b><br>${k === 'g' ? 'Public grants' : 'Owner capital'}: ${eur(dd.v, 2)}${confTxt(dd.conf)}`);
        if (!narrow || d.v > 0.5) g.append('text').attr('class', 'lab').attr('x', bx + sub.bandwidth() / 2).attr('y', yb(d.v) - 4).attr('text-anchor', 'middle').style('font-size', narrow ? '9.5px' : '10.5px').text(d.v.toFixed(narrow ? 1 : 2));
      });
      g.append('text').attr('class', 'lab').attr('x', xb(yr) + xb.bandwidth() / 2).attr('y', yb(0) + 14).attr('text-anchor', 'middle').style('fill', c.grey).text(narrow ? "'" + String(yr).slice(2) : yr);
    });
    size(svg, W, y + ch + 20);
    svg.attr('aria-label', `Public grants about ${tG.toFixed(1)} million euros versus owner capital ${tC.toFixed(2)} million euros`);
  }

  function drawDeals() {
    const t = $('dd-deals'); if (!t) return;
    const sw = (co) => `<i class="dd-sw ${co === 'gridx' ? 'gx' : 'cn'}"></i>`;
    
    
    const deals = (X.deals_public || []).slice().sort((a, b) => (a.co === b.co ? 0 : a.co === 'gridx' ? -1 : 1) || String(a.date).localeCompare(String(b.date)));
    t.innerHTML = '<thead><tr><th>Company</th><th>Date</th><th>Event</th><th>Counterparty</th><th>Amount</th></tr></thead><tbody>' +
      deals.map((d) => `<tr><td style="white-space:nowrap">${sw(d.co)} ${d.co === 'gridx' ? 'gridX' : 'Consolinno'}</td><td style="white-space:nowrap">${fmtDate(d.date)}</td><td>${esc(d.type)}</td><td>${esc(d.who)}</td><td>${esc(d.amount)}</td></tr>`).join('') + '</tbody>';
    t.style.minWidth = '680px';
    
  }

  /* ============ 5 · FINANCIALS ============ */
  function drawGxPL() {
    const el = $('dd-gx-pl'); if (!el) return;
    const c = col(); const W = widthOf(el);
    const years = [2020, 2021, 2022, 2023, 2024];
    const data = years.map((y) => ({ y, loss: fv(GX, 'net_loss', y), eq: fv(GX, 'equity_book', y), cl: (fin(GX, 'net_loss', y) || {}).confidence, ce: (fin(GX, 'equity_book', y) || {}).confidence, cash: fv(GX, 'cash', y), loans: fv(GX, 'shareholder_loans', y) }));
    const H = 300, m = { t: 30, b: 26, l: 4, r: 34 };
    const svg = svgIn(el); size(svg, W, H); const g = svg.append('g');
    const x = d3.scaleBand().domain(years).range([m.l, W - m.r]).padding(0.32);
    const y = d3.scaleLinear().domain([-24, 8]).range([H - m.b, m.t]);
    [-20, -10, 0, 5].forEach((v) => {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v === 0 ? c.ink : c.line);
      g.append('text').attr('class', 'lab').attr('x', W - m.r + 4).attr('y', y(v) + 4).style('fill', c.grey).text(v === 0 ? '0' : sgn(v, 0));
    });
    const bars = g.append('g').selectAll('rect').data(data).join('rect')
      .attr('x', (d) => x(d.y)).attr('width', x.bandwidth()).attr('y', y(0)).attr('height', (d) => y(d.loss) - y(0))
      .attr('fill', c.gx).attr('fill-opacity', 0.9);
    UI.bindTip(bars, (d) => `<b>gridX ${d.y}</b><br>Net loss: ${eur(d.loss, 2)}<br>Book equity: ${eur(d.eq, 2)}<br>Shareholder loans: ${eur(d.loans, 2)}<br>Cash: ${eur(d.cash, 2)}${confTxt(d.cl)}`);
    data.forEach((d) => {
      const inside = y(d.loss) - y(0) > 40;
      g.append('text').attr('class', 'lab-strong').attr('x', x(d.y) + x.bandwidth() / 2).attr('y', inside ? y(d.loss) - 6 : y(d.loss) + 13).attr('text-anchor', 'middle')
        .style('fill', inside ? c.bg : c.ink).text(d.loss.toFixed(1).replace('-', MINUS));
      g.append('text').attr('class', 'lab').attr('x', x(d.y) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').style('fill', c.grey).text(d.y);
    });
    // equity line
    const line = d3.line().x((d) => x(d.y) + x.bandwidth() / 2).y((d) => y(d.eq));
    g.append('path').datum(data).attr('d', line).attr('fill', 'none').attr('stroke', c.bad).attr('stroke-width', 2);
    const dots = g.append('g').selectAll('circle').data(data).join('circle').attr('cx', (d) => x(d.y) + x.bandwidth() / 2).attr('cy', (d) => y(d.eq)).attr('r', 4)
      .attr('fill', c.bg).attr('stroke', c.bad).attr('stroke-width', 2);
    UI.bindTip(dots, (d) => `<b>gridX ${d.y}</b><br>Book equity at year end: ${eur(d.eq, 2)}${confTxt(d.ce)}`);
    data.forEach((d) => {
      const cx = x(d.y) + x.bandwidth() / 2;
      const small = Math.abs(d.eq) < 2.5, up = d.eq > 0;
      g.append('text').attr('class', 'lab').attr('x', small || up ? cx : cx + 8).attr('y', small ? y(0) - 6 : up ? y(d.eq) - 9 : y(d.eq) + 4)
        .attr('text-anchor', small || up ? 'middle' : 'start').style('fill', c.bad).style('font-weight', 600).text(sgn(d.eq, 1));
    });
    // direct labels
    g.append('text').attr('class', 'lab').attr('x', m.l).attr('y', 12).style('fill', c.bad).style('font-weight', 600).text('— Book equity (line)');
    g.append('text').attr('class', 'lab').attr('x', m.l + 132).attr('y', 12).style('font-weight', 600).text('▮ Net loss (bars)');
    // recap annotation
    g.append('text').attr('class', 'lab').attr('x', x(2024) - 8).attr('y', y(5.2)).attr('text-anchor', 'end').style('fill', c.muted).text('E.ON recapitalisation 2024 →');
    svg.attr('aria-label', 'gridX net loss 2020 to 2024 grew from 1.7 to 16.1 million euros; book equity negative until 2023, plus 5.8 million in 2024');
  }

  function drawCnPL() {
    const el = $('dd-cn-pl'); if (!el) return;
    const c = col(); const W = widthOf(el);
    const years = [2022, 2023, 2024, 2025];
    const data = years.map((y) => {
      const rv = fin(CN, 'revenue', y), ni = fin(CN, 'net_income', y);
      return { y, rev: rv ? rv.value : null, ni: ni ? ni.value : null, fc: (rv && /forecast/.test(rv.basis || '')) || y === 2025, rc: rv && rv.confidence };
    });
    const H = 300, m = { t: 30, b: 22, l: 4, r: 34 };
    const svg = svgIn(el); size(svg, W, H); const g = svg.append('g');
    const x = d3.scaleBand().domain(years).range([m.l, W - m.r]).padding(0.22);
    const sub = d3.scaleBand().domain(['rev', 'ni']).range([0, x.bandwidth()]).padding(0.1);
    const y = d3.scaleLinear().domain([-2.6, 4]).range([H - m.b, m.t]);
    [-2, -1, 0, 1, 2, 3, 4].forEach((v) => {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v === 0 ? c.ink : c.line);
      g.append('text').attr('class', 'lab').attr('x', W - m.r + 4).attr('y', y(v) + 4).style('fill', c.grey).text(v === 0 ? '0' : sgn(v, 0));
    });
    data.forEach((d) => {
      const x0 = x(d.y);
      [['rev', d.rev, c.cn], ['ni', d.ni, c.bad]].forEach(([k, v, cl]) => {
        const bx = x0 + sub(k), bw = sub.bandwidth();
        if (v == null) {
          g.append('text').attr('class', 'lab').attr('x', bx + bw / 2).attr('y', y(0) + 14).attr('text-anchor', 'middle').style('fill', c.grey).text('n/a');
          return;
        }
        const rect = g.append('rect').attr('x', bx).attr('width', bw).attr('y', v >= 0 ? y(v) : y(0)).attr('height', Math.abs(y(v) - y(0)))
          .attr('fill', d.fc ? c.bg : cl).attr('stroke', cl).attr('stroke-width', d.fc ? 1.5 : 0).attr('stroke-dasharray', d.fc ? '4 2' : null);
        UI.bindTip(rect, () => `<b>Consolinno ${d.y}${d.fc ? ' (forecast)' : ''}</b><br>${k === 'rev' ? 'Revenue' : 'Net income'}: ${eur(v, 2)}${d.fc ? '<br>Management forecast, annual accounts 2024 (11/2025)' : ''}`);
        g.append('text').attr('class', 'lab-strong').attr('x', bx + bw / 2).attr('y', v >= 0 ? y(v) - 5 : y(v) + 13).attr('text-anchor', 'middle')
          .style('font-size', W < 460 ? '10.5px' : '12px').text((d.fc ? '≈' : '') + v.toFixed(2).replace('-', MINUS));
      });
      g.append('text').attr('class', 'lab').attr('x', x0 + x.bandwidth() / 2).attr('y', H - 4).attr('text-anchor', 'middle').style('fill', c.grey).text(d.y + (d.fc ? 'F' : ''));
    });
    g.append('text').attr('class', 'lab').attr('x', m.l).attr('y', 12).style('font-weight', 600).style('fill', c.ink).text('▮ Revenue');
    g.append('text').attr('class', 'lab').attr('x', m.l + 78).attr('y', 12).style('font-weight', 600).style('fill', c.bad).text('▮ Net income');
    const d24 = data.find((d) => d.y === 2024), d23 = data.find((d) => d.y === 2023);
    if (d24 && d23 && W > 320) g.append('text').attr('class', 'lab').attr('x', x(2024) + sub('rev') + sub.bandwidth() / 2).attr('y', y(d24.rev) - 20).attr('text-anchor', 'middle').style('fill', c.muted).text('+294 %');
    svg.attr('aria-label', 'Consolinno revenue 2022 to 2024: 1.00, 0.72, 2.84 million euros; net income minus 0.81 and minus 1.31; 2025 forecast 3.5 and minus 2.0');
  }

  function hatch(svg, id, color) {
    const p = svg.append('defs').append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse').attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
    p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', color).attr('stroke-width', 1.4);
    return `url(#${id})`;
  }
  function drawGxBS() {
    const el = $('dd-gx-bs'); if (!el) return;
    const c = col(); const W = widthOf(el); const narrow = W < 460;
    const real23 = fv(GX, 'total_assets_excl_deficit_item', 2023) || 7.061;
    const def23 = fv(GX, 'deficit_not_covered_by_equity_asset_side', 2023) || 21.464;
    const tot23 = fv(GX, 'total_assets', 2023, 'EUR m') || 28.525;
    
    const svg = svgIn(el); const g = svg.append('g');
    const pat = hatch(svg, NS + '-hatch-bs', c.grey);
    const lw = 44; const bh = 34;
    const x = d3.scaleLinear().domain([0, 30]).range([lw, W - (narrow ? 44 : 60)]);
    const rows = [
      { yr: 2023, segs: [{ k: 'Real assets', v: real23, real: true, conf: 'medium' }, { k: 'Deficit not covered by equity (accounting item)', v: def23, real: false, conf: 'medium' }], tot: tot23 },
      
    ];
    let y = 16;
    rows.forEach((r) => {
      g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', y + bh / 2 + 4).text(r.yr);
      let acc = 0;
      r.segs.forEach((s) => {
        const x0 = x(acc), x1 = x(acc + s.v); acc += s.v;
        const rect = g.append('rect').attr('x', x0).attr('y', y).attr('width', x1 - x0).attr('height', bh)
          .attr('fill', s.real ? c.gx : pat).attr('stroke', s.real ? c.gx : c.grey);
        UI.bindTip(rect, () => `<b>gridX ${r.yr}: ${esc(s.k)}</b><br>${eur(s.v, 2)}${s.real ? '' : '<br>HGB asset-side item "nicht durch Eigenkapital gedeckter Fehlbetrag" = negative book equity'}${confTxt(s.conf)}`);
        if (s.real) g.append('text').attr('class', 'lab-strong').attr('x', x0 + 6).attr('y', y + bh / 2 + 4).style('fill', c.bg).text(s.v.toFixed(1));
        else g.append('text').attr('class', 'lab-strong').attr('x', (x0 + x1) / 2).attr('y', y + bh / 2 + 4).attr('text-anchor', 'middle')
          .style('paint-order', 'stroke').style('stroke', c.panel).style('stroke-width', 4).text(s.v.toFixed(1));
      });
      g.append('text').attr('class', 'lab-strong').attr('x', x(r.tot) + 6).attr('y', y + bh / 2 + 4).text('€' + r.tot.toFixed(1) + ' m');
      y += bh + 34;
    });
    // annotations under 2023
    const ly = 16 + bh + 14;
    g.append('text').attr('class', 'lab').attr('x', x(0)).attr('y', ly).style('fill', c.ink).text(narrow ? '▮ real assets' : '▮ Real assets');
    g.append('text').attr('class', 'lab').attr('x', narrow ? x(0) + 82 : x(real23) + 6).attr('y', ly).style('fill', c.muted).text(narrow ? '▨ deficit item (= negative equity)' : '▨ Deficit not covered by equity (= negative book equity)');
    size(svg, W, y - 18);
    
    
    svg.attr('aria-label', 'gridX balance sheet total 2023 28.5 million euros, of which 21.5 million deficit item and 7.1 million real assets');
    
  }

  function drawCnEq() {
    const el = $('dd-cn-eq'); if (!el) return;
    const c = col(); const W = widthOf(el);
    const e22 = fin(CN, 'equity', 2022), e23 = fin(CN, 'equity', 2023), e24 = fin(CN, 'equity', 2024);
    const est25 = (CN.kpis || []).find((k) => k.metric === 'implied_equity_end_2025_if_no_capital_measure');
    const data = [
      
      
      { y: 2022, v: e22 ? e22.value : 2.295, ratio: '~35 %', note: 'derived from annual accounts 2024: share capital + capital reserve − accumulated loss', conf: 'medium', est: false },
      
      { y: 2023, v: e23 ? e23.value : 1.486, ratio: (fv(CN, 'equity_ratio', 2023) || 13.8).toFixed(1) + ' %', conf: 'high', silent: fv(CN, 'equity_incl_negative_silent_partner_contribution', 2023) },
      { y: 2024, v: e24 ? e24.value : 0.173, ratio: (fv(CN, 'equity_ratio', 2024) || 1.2).toFixed(1) + ' %', conf: 'high', silent: fv(CN, 'equity_incl_negative_silent_partner_contribution', 2024) },
      { y: 2025, v: est25 ? est25.value : -1.83, ratio: 'est.', conf: 'low', est: true },
    ];
    const H = 300, m = { t: 34, b: 22, l: 4, r: 36 };
    const svg = svgIn(el); size(svg, W, H); const g = svg.append('g');
    const x = d3.scaleBand().domain(data.map((d) => d.y)).range([m.l, W - m.r]).padding(0.35);
    const y = d3.scaleLinear().domain([-2.2, 2.7]).range([H - m.b - 10, m.t]);
    [-2, -1, 0, 1, 2].forEach((v) => {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v === 0 ? c.ink : c.line);
      g.append('text').attr('class', 'lab').attr('x', W - m.r + 4).attr('y', y(v) + 4).style('fill', c.grey).text(v === 0 ? '0' : sgn(v, 0));
    });
    data.forEach((d) => {
      const bx = x(d.y), bw = x.bandwidth();
      const rect = g.append('rect').attr('x', bx).attr('width', bw).attr('y', d.v >= 0 ? y(d.v) : y(0)).attr('height', Math.max(1.5, Math.abs(y(d.v) - y(0))))
        .attr('fill', d.est ? c.bg : c.cn).attr('stroke', d.est ? c.bad : c.cn).attr('stroke-width', d.est ? 1.5 : 0).attr('stroke-dasharray', d.est ? '4 2' : null);
      UI.bindTip(rect, () => `<b>Consolinno ${d.y}${d.est ? ' (our estimate)' : ''}</b><br>Balance-sheet equity: ${eur(d.v, 2)}<br>Equity ratio: ${esc(d.ratio)}${d.silent != null ? '<br>Incl. negative silent-partner account: ' + eur(d.silent, 2) : ''}${d.note ? '<br>' + esc(d.note) : ''}${d.est ? '<br>2024 equity minus forecast 2025 loss (~€2 m), no new capital' : ''}${confTxt(d.conf)}`);
      const vy = d.v >= 0 ? y(d.v) - 5 : y(d.v) + 13;
      g.append('text').attr('class', 'lab-strong').attr('x', bx + bw / 2).attr('y', vy).attr('text-anchor', 'middle').style('fill', d.est ? c.bad : c.ink).text((d.est ? '≈' : '') + sgn(d.v, 2));
      g.append('text').attr('class', 'lab').attr('x', bx + bw / 2).attr('y', d.v >= 0 ? y(d.v) - 20 : y(0) - 6).attr('text-anchor', 'middle').style('fill', c.muted).text(d.est ? '' : 'ratio ' + d.ratio);
      if (d.silent != null) {
        g.append('line').attr('x1', bx - 4).attr('x2', bx + bw + 4).attr('y1', y(d.silent)).attr('y2', y(d.silent)).attr('stroke', c.bad).attr('stroke-width', 2.5);
        g.append('text').attr('class', 'lab').attr('x', bx + bw / 2).attr('y', y(d.silent) + 15).attr('text-anchor', 'middle')
          .style('fill', c.bad).style('font-weight', 600).style('paint-order', 'stroke').style('stroke', c.panel).style('stroke-width', 4).text(sgn(d.silent, 2));
      }
      g.append('text').attr('class', 'lab').attr('x', bx + bw / 2).attr('y', H - 4).attr('text-anchor', 'middle').style('fill', c.grey).text(d.y + (d.est ? 'E' : ''));
    });
    g.append('text').attr('class', 'lab').attr('x', m.l).attr('y', 12).style('font-weight', 600).style('fill', c.ink).text('▮ Equity');
    g.append('text').attr('class', 'lab').attr('x', m.l + 64).attr('y', 12).style('font-weight', 600).style('fill', c.bad).text(W < 400 ? '— incl. silent partner' : '— incl. negative silent-partner account');
    svg.attr('aria-label', 'Consolinno equity 2022 2.30, 2023 1.49, 2024 0.17 million euros; including silent partner minus 0.92 in 2024; 2025 estimate minus 1.83');
  }

  function hbars(el, rows, opt) {
    // rows: {k, v, col, hollow, label, tip}
    const c = col(); const W = widthOf(el); const narrow = W < 460;
    const svg = svgIn(el); const g = svg.append('g');
    const lw = narrow ? 0 : (opt.lw || 150); const bh = 24, gap = narrow ? 30 : 14;
    const x = d3.scaleLinear().domain([0, opt.max]).range([lw, W - (opt.rpad || 70)]);
    let y = opt.top || 4;
    rows.forEach((r) => {
      if (narrow) { g.append('text').attr('class', 'lab').attr('x', 0).attr('y', y + 11).style('fill', c.ink).text(r.k); y += 16; }
      else lines(g, wrap(r.k, lw - 10, 11.5), 0, y + bh / 2 + 4 - (wrap(r.k, lw - 10, 11.5).length - 1) * 6, 12, 'lab');
      const rect = g.append('rect').attr('x', x(0)).attr('y', y).attr('width', Math.max(2, x(r.v) - x(0))).attr('height', bh)
        .attr('fill', r.hollow ? c.bg : r.col).attr('stroke', r.col).attr('stroke-width', r.hollow ? 1.5 : 0).attr('stroke-dasharray', r.hollow ? '4 2' : null);
      if (r.tip) UI.bindTip(rect, () => r.tip);
      g.append('text').attr('class', 'lab-strong').attr('x', x(r.v) + 6).attr('y', y + bh / 2 + 4).text(r.label);
      y += bh + gap;
    });
    size(svg, W, y - gap + 6);
    return { svg, g, x };
  }
  function drawCnLiq() {
    const el = $('dd-cn-liq'); if (!el) return;
    const c = col();
    const cash = fv(CN, 'cash', 2024) || 0.3, liab = fv(CN, 'liabilities', 2024) || 12.055, bank = fv(CN, 'bank_debt', 2024), sl = fv(CN, 'shareholder_loans', 2024);
    const st = 10.99; // due within one year, JA 2024 Blatt 14/60 (10,991.5 kEUR)
    const ratio = (CN.kpis || []).find((k) => k.metric === 'short_term_liabilities_to_cash');
    const r = hbars(el, [
      { k: 'Cash, end 2024', v: cash, col: c.cn, label: eur(cash, 2), tip: `<b>Cash end 2024</b><br>${eur(cash, 2)} (2023: ${eur(fv(CN, 'cash', 2023) || 0.756, 2)})` },
      { k: 'Liabilities due within one year', v: st, col: c.bad, label: eur(st, 2), tip: `<b>Liabilities due within one year</b><br>${eur(st, 2)}; ratio to cash ${ratio ? ratio.value : 36.6}×` },
      { k: 'All liabilities', v: liab, col: c.grey, label: eur(liab, 2), tip: `<b>All liabilities (Verbindlichkeiten)</b><br>${eur(liab, 2)}<br>Bank debt ${eur(bank, 2)}, shareholder loans ${eur(sl, 2)}` },
    ], { max: 13, lw: 150, rpad: 64 });
    void r;
  }
  function drawCnUnits() {
    const el = $('dd-cn-units'); if (!el) return;
    const c = col();
    const p0 = fv(CN, 'units_sold_plan_original', 2025) || 20000, p1 = fv(CN, 'units_sold_plan_revised', 2025) || 9500, p2 = fv(CN, 'units_sold_plan', 2026) || 20000;
    hbars(el, [
      { k: '2025 plan, original', v: p0, col: c.cn, hollow: true, label: UI.fmt(p0), tip: '<b>2025 unit plan, original</b><br>20,000 devices' },
      { k: '2025 forecast, after cut', v: p1, col: c.cn, label: '~' + UI.fmt(p1), tip: '<b>2025 forecast after cut</b><br>A customer that was to take 10,000 units did not take any, citing its own production problems' },
      { k: '2026 plan', v: p2, col: c.cn, hollow: true, label: '≥ ' + UI.fmt(p2), tip: '<b>2026 plan</b><br>At least 20,000 units and a positive result (management, 11/2025)' },
    ], { max: 24000, lw: 150, rpad: 64 });
  }

  /* ============ 6 · ARCHITECTURE ============ */
  const ARCH = {
    gx: {
      name: 'gridX', layers: [
        { t: 'Devices and grid', chips: ['PV inverter', 'Battery', 'Heat pump (SG Ready, EEBUS)', 'Wallbox (OCPP)', 'EV (cloud-to-cloud)', 'SMGW + control box (§14a)'] },
        { t: 'On site', main: 'gridBox gateway', sub: 'Own hardware, made in Aachen · 200 ms data · 10 days offline', chips: ['EEBUS', 'Modbus TCP/RTU', 'SEMP', 'OCPP', 'SG Ready', 'OBIS'] },
        { t: 'Cloud', main: 'XENON platform', sub: 'Connect · Control · Optimize · Flex. Optimisation price-based, method not public; §14a Grid Signal Processor', strong: true },
        { t: 'User and partners', chips: ['Operator Dashboard', 'Installer Hub', 'End User App / API', 'E.ON Home', 'Viessmann', 'IBC Solar efa:home', '1KOMMA5 Heartbeat', 'Flex markets DE/NL/UK'] },
      ],
      missing: 'Not documented: CHP + buffer model, schedule view',
    },
    cn: {
      name: 'Consolinno', layers: [
        { t: 'Devices and grid', chips: ['PV inverter', 'Battery', '1 heat pump (SG Ready, EEBUS)', '1 wallbox (OCPP 1.6)', '1 heating rod', 'SMGW (HAN, CLS)'] },
        { t: 'On site', main: 'Leaflet HEMS (DIN rail, 4 TE)', sub: 'HEMS + VDE-FNN control box in one patented device · nymea base · rules on the device; LP only for the wallbox', strong: true, chips: ['Modbus', 'SunSpec', 'SG Ready', 'EEBUS', 'OCPP', 'KNX'] },
        { t: 'Cloud', main: 'No cloud needed for control', sub: 'Optional remote access via proxy · OTA updates (Mender)', dashed: true },
        { t: 'User and partners', chips: ['HEMS app (Qt/QML)', 'Installer set-up', 'KACO blueplanet edition', 'Steuerbox-Connect for metering operators', 'FlexA / CEMS for C&I (CHP schedules)'] },
      ],
      missing: 'Not in the HEMS: CHP + buffer model, schedule view',
    },
  };
  function chipFlow(g, chips, x, y, w, c, opt = {}) {
    let cx = x, cy = y; const h = 22, gap = 6;
    chips.forEach((t) => {
      const cw = Math.min(w, tw(t, 11.5) + 16);
      if (cx + cw > x + w && cx > x) { cx = x; cy += h + gap; }
      g.append('rect').attr('x', cx).attr('y', cy).attr('width', cw).attr('height', h).attr('fill', opt.fill || c.bg).attr('stroke', opt.stroke || c.line);
      g.append('text').attr('class', 'lab').attr('x', cx + 8).attr('y', cy + 15).text(t);
      cx += cw + gap;
    });
    return cy + h - y;
  }
  function drawArch(id, key) {
    const el = $(id); if (!el) return;
    const c = col(); const W = widthOf(el); const spec = ARCH[key];
    const cc = key === 'gx' ? c.gx : c.cn;
    const svg = svgIn(el); const g = svg.append('g');
    g.append('rect').attr('x', 0).attr('y', 0).attr('width', 6).attr('height', 18).attr('fill', cc);
    g.append('text').attr('class', 'lab-strong').attr('x', 12).attr('y', 14).style('font-size', '13px').text(spec.name);
    let y = 30; const pad = 10;
    const layerLabel = (t, lx, ly) => g.append('text').attr('class', 'lab').attr('x', lx).attr('y', ly).style('fill', c.grey).style('font-size', '10.5px').style('letter-spacing', '.06em').text(t.toUpperCase());
    spec.layers.forEach((L, i) => {
      if (i === 0) { layerLabel(L.t, 0, y + 10); y += 16; } else {
        const ax = 14;
        g.append('line').attr('x1', ax).attr('x2', ax).attr('y1', y + 3).attr('y2', y + 15).attr('stroke', c.ink).attr('stroke-width', 1.2);
        g.append('path').attr('d', `M${ax - 4},${y + 13}L${ax},${y + 19}L${ax + 4},${y + 13}Z`).attr('fill', c.ink);
        g.append('line').attr('x1', ax + 12).attr('x2', ax + 12).attr('y1', y + 19).attr('y2', y + 7).attr('stroke', c.ink).attr('stroke-width', 1.2);
        g.append('path').attr('d', `M${ax + 8},${y + 8}L${ax + 12},${y + 2}L${ax + 16},${y + 8}Z`).attr('fill', c.ink);
        layerLabel(L.t, ax + 26, y + 15);
        y += 24;
      }
      const y0 = y;
      if (L.main) {
        const lt = wrap(L.main, W - 2 * pad - 8, 12.5, 600), ls = L.sub ? wrap(L.sub, W - 2 * pad - 12, 11) : [];
        const gh = pad + lt.length * 16 + ls.length * 14 + (L.chips ? 8 + 0 : 0);
        const tmpG = g.append('g');
        let chipH = 0;
        if (L.chips) chipH = chipFlow(tmpG, L.chips, pad + 4, y0 + gh, W - 2 * pad - 8, c, { fill: c.panel });
        const bh = gh + chipH + pad;
        g.insert('rect', ':first-child').attr('x', 0.5).attr('y', y0).attr('width', W - 1).attr('height', bh)
          .attr('fill', L.dashed ? 'none' : c.bg).attr('stroke', L.dashed ? c.grey : cc).attr('stroke-width', L.strong ? 2.5 : (L.dashed ? 1 : 1.5)).attr('stroke-dasharray', L.dashed ? '4 3' : null);
        lines(g, lt, pad + 4, y0 + pad + 12, 16, 'lab-strong').style('font-size', '12.5px');
        if (ls.length) lines(g, ls, pad + 4, y0 + pad + 12 + lt.length * 16, 14, 'lab').style('fill', c.muted).style('font-size', '11px');
        tmpG.raise();
        y = y0 + bh;
      } else {
        y += chipFlow(g, L.chips, 0, y0, W, c);
      }
    });
    y += 12;
    g.append('text').attr('class', 'lab').attr('x', 0).attr('y', y + 4).style('fill', c.bad).style('font-weight', 600).text('✕ ' + spec.missing);
    size(svg, W, y + 10);
    svg.attr('aria-label', `${spec.name} architecture from devices to user`);
  }

  /* ============ 7 · CHANNELS, KPIs, PRICES ============ */
  function drawChannels() {
    const ch = X.channels || {};
    const max = d3.max([].concat(ch.gridx || [], ch.consolinno || []), (r) => r.p.length) || 1;
    [['dd-ch-gx', 'gridx', '--c-gridx', 'gridX'], ['dd-ch-cn', 'consolinno', '--c-consolinno', 'Consolinno']].forEach(([id, key, tok, nm]) => {
      const el = $(id); if (!el) return;
      const rows = ch[key] || [];
      el.innerHTML = `<div class="dd-tilehd"><i class="dd-sw ${key === 'gridx' ? 'gx' : 'cn'}"></i>${nm}</div><div class="dd-ch">` + rows.map((r) => {
        const n = r.p.length;
        return `<div class="row dd-tt"><div><div class="n">${esc(r.ch)}</div><div class="bar" style="width:${(n / max) * 100}%;background:var(${tok})"></div></div><div class="c">${n}</div><div class="p dd-x">${r.p.map((p) => `<span class="dd-chip">${esc(p)}</span>`).join('')}</div></div>`;
      }).join('') + '</div>';
      // partner names: hidden by default ("Show partners"), on hover as a tooltip
      el.querySelectorAll('.dd-ch .row').forEach((row, i) => { const r = rows[i]; tipOn(row, `<b>${nm} · ${esc(r.ch)}</b> (${r.p.length})<br>${r.p.map(esc).join(', ')}`); });
    });
  }

  function kpiLine(el, pts, opt) {
    const c = col(); const W = widthOf(el); const H = opt.h || 200, m = { t: 34, b: 24, l: 6, r: 14 };
    const svg = svgIn(el); size(svg, W, H); const g = svg.append('g');
    g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', 12).text(opt.title);
    if (opt.subt) g.append('text').attr('class', 'lab').attr('x', 0).attr('y', 26).style('fill', c.grey).text(opt.subt);
    const x = d3.scaleTime().domain(opt.xd).range([m.l + 6, W - m.r - 10]);
    const y = d3.scaleLinear().domain([0, opt.ymax]).range([H - m.b, m.t + 10]);
    g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', c.ink);
    opt.years.forEach((yr) => {
      const xx = x(new Date(yr, 0, 1));
      g.append('line').attr('x1', xx).attr('x2', xx).attr('y1', y(0)).attr('y2', y(0) + 4).attr('stroke', c.ink);
      g.append('text').attr('class', 'lab').attr('x', xx).attr('y', H - 6).attr('text-anchor', 'middle').style('fill', c.grey).text(yr);
    });
    const P = pts.map((p) => ({ ...p, X: x(p.d), Y: y(p.v) }));
    if (opt.step) {
      const path = d3.line().curve(d3.curveStepAfter).x((p) => p.X).y((p) => p.Y);
      g.append('path').datum(P.concat([{ ...P[P.length - 1], X: x(opt.xd[1]) - 4 }])).attr('d', path).attr('fill', 'none').attr('stroke', c.gx).attr('stroke-width', 2);
    } else {
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i];
        g.append('line').attr('x1', a.X).attr('y1', a.Y).attr('x2', b.X).attr('y2', b.Y).attr('stroke', c.gx).attr('stroke-width', 2).attr('stroke-dasharray', (a.est || b.est) ? '4 3' : null);
      }
    }
    const dots = g.append('g').selectAll('circle').data(P).join('circle').attr('cx', (p) => p.X).attr('cy', (p) => p.Y).attr('r', 4)
      .attr('fill', (p) => p.est ? c.bg : c.gx).attr('stroke', c.gx).attr('stroke-width', 1.5).attr('stroke-dasharray', (p) => p.conf === 'low' ? '2 1.5' : null);
    UI.bindTip(dots, (p) => `<b>${esc(p.lbl || '')}</b><br>${esc(p.date)}: ${esc(p.text)}${p.note ? '<br>' + esc(p.note) : ''}${confTxt(p.conf)}`);
    P.forEach((p, i) => {
      if (opt.labelIdx && !opt.labelIdx.includes(i)) return;
      let lx = p.X, ly = p.Y - 9, an = 'middle';
      if (opt.step) { if (i === 0) { lx = p.X - 7; ly = p.Y + 4; an = 'end'; } }
      else if (i === P.length - 1) { lx = p.X - 7; ly = p.Y - 8; an = 'end'; }
      else if (i === 0) { lx = p.X - 2; ly = p.Y - 9; an = 'middle'; }
      else { lx = p.X + 7; ly = p.Y + 15; an = 'start'; }
      g.append('text').attr('class', 'lab-strong').attr('x', lx).attr('y', ly).attr('text-anchor', an).style('fill', p.est ? c.muted : c.ink).text(p.text);
    });
  }
  function drawKPIs() {
    const K = GX.kpis || [];
    const val = (v) => {
      if (typeof v === 'number') return v;
      const n = parseFloat(String(v).replace(/[^\d.]/g, ''));
      return /\dk/i.test(String(v)) ? n * 1000 : n;
    };
    // connected assets
    const el1 = $('dd-kpi-assets');
    if (el1) {
      const pts = K.filter((k) => k.metric === 'connected_assets' || k.metric === 'connected_assets_estimate').map((k) => {
        const p = pd(k.date); const v = val(k.value);
        const est = k.metric === 'connected_assets_estimate' || k.confidence !== 'high';
        return { d: p.d, date: k.date, v, est, conf: k.confidence, lbl: 'Connected assets', text: (k.metric === 'connected_assets_estimate' ? '~' : '') + Math.round(v / 1000) + 'k' + (String(k.value).includes('+') ? '+' : ''), note: k.metric === 'connected_assets_estimate' ? 'Estimate, back-solved from a "13-fold" growth claim (about 02/2023 to 08/2025)' : (k.confidence === 'medium' ? 'Derived from "doubled to 200,000"' : '') };
      }).sort((a, b) => a.d - b.d);
      kpiLine(el1, pts, { title: 'Connected assets', subt: 'hollow = estimate or derived', xd: [new Date(2023, 0, 1), new Date(2027, 0, 1)], ymax: 290000, years: [2023, 2024, 2025, 2026] });
    }
    const el2 = $('dd-kpi-oem');
    if (el2) {
      const pts = K.filter((k) => k.metric === 'ready_for_gridx_oems').map((k) => ({ d: pd(k.date).d, date: k.date, v: val(k.value), conf: k.confidence, lbl: 'Ready for gridX OEMs', text: String(k.value) })).sort((a, b) => a.d - b.d);
      const names = ['KOSTAL', 'GoodWe', 'SolaX', 'Sungrow + Huawei', 'go-e', 'Sigenergy'];
      pts.forEach((p, i) => { p.note = 'Added: ' + (names[i] || ''); });
      kpiLine(el2, pts, { title: '"Ready for gridX" OEMs', subt: 'label launched 06/2024', xd: [new Date(2024, 3, 1), new Date(2026, 11, 1)], ymax: 8.5, years: [2025, 2026], step: true, labelIdx: [0, 2, 3, 4, 5] });
    }
    const el3 = $('dd-kpi-ev');
    if (el3) {
      const c = col();
      const get = (m) => K.find((k) => k.metric === m) || {};
      const a = get('cloud_connected_evs'), b = get('home_evs_aggregated_flex_pool'), f = get('flex_active_systems');
      const W = widthOf(el3);
      const svg = svgIn(el3); const g = svg.append('g');
      g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', 12).text('Flexibility pool');
      g.append('text').attr('class', 'lab').attr('x', 0).attr('y', 26).style('fill', c.grey).text('devices under flexibility control');
      const rows = [
        { k: 'Cloud-connected EVs', d: '12/2025', v: val(a.value) || 9000 },
        { k: 'Home EVs pooled (DE)', d: '09/2026', v: val(b.value) || 16000 },
        { k: 'Flex-active systems', d: '11/2026', v: val(f.value) || 13000 },
      ];
      const x = d3.scaleLinear().domain([0, 18000]).range([0, W - 56]);
      let y = 40;
      rows.forEach((r) => {
        g.append('text').attr('class', 'lab').attr('x', 0).attr('y', y + 10).style('fill', c.ink).text(`${r.k}, ${r.d}`);
        const rect = g.append('rect').attr('x', 0).attr('y', y + 16).attr('width', x(r.v)).attr('height', 20).attr('fill', c.gx);
        UI.bindTip(rect, () => `<b>${esc(r.k)}</b><br>${UI.fmt(r.v)} (${r.d}), gridX press release / website`);
        g.append('text').attr('class', 'lab-strong').attr('x', x(r.v) + 6).attr('y', y + 31).text(UI.fmt(Math.round(r.v / 1000)) + 'k');
        y += 50;
      });
      size(svg, W, Math.max(200, y));
    }
  }

  let horizon = 5;
  function priceSeg() {
    const seg = $('dd-price-seg'); if (!seg) return;
    seg.innerHTML = [1, 3, 5].map((n) => `<button type="button" data-n="${n}" aria-pressed="${horizon === n}">${n} year${n > 1 ? 's' : ''}</button>`).join('');
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { horizon = +b.dataset.n; priceSeg(); drawPrice(true); }));
  }
  function drawPrice(animate) {
    const el = $('dd-price'); if (!el) return;
    const c = col(); const W = widthOf(el); const narrow = W < 520;
    const P = X.prices || {};
    const cost = (p) => p.one_off + 12 * horizon * (p.monthly || 0);
    const H = 280, m = { t: 20, b: 26, l: 4, r: 46 };
    const svg = svgIn(el); size(svg, W, H); const g = svg.append('g');
    const x = d3.scaleTime().domain([new Date(2025, 0, 1), new Date(2027, 0, 1)]).range([m.l + 10, W - m.r - (narrow ? 84 : 120)]);
    const y = d3.scaleLinear().domain([200, 1000]).range([H - m.b, m.t]);
    [200, 400, 600, 800, 1000].forEach((v) => {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v === 200 ? c.ink : c.line);
      g.append('text').attr('class', 'lab').attr('x', W - m.r + 4).attr('y', y(v) + 4).style('fill', c.grey).text('€' + v);
    });
    [2025, 2026].forEach((yr) => {
      [0, 6].forEach((mo) => {
        const xx = x(new Date(yr, mo, 1));
        g.append('line').attr('x1', xx).attr('x2', xx).attr('y1', y(200)).attr('y2', y(200) + 4).attr('stroke', c.ink);
        if (mo === 0 || !narrow) g.append('text').attr('class', 'lab').attr('x', xx).attr('y', H - 8).attr('text-anchor', 'middle').style('fill', c.grey).text(mo === 0 ? String(yr) : 'Jul');
      });
    });
    const series = [
      { key: 'eon', name: 'E.ON Home (gridX inside)', pts: (P.eon_home || []), cl: c.gx },
      { key: 'cn', name: 'Consolinno Leaflet', pts: (P.consolinno || []), cl: c.cn },
    ];
    const T = animate ? d3.transition().duration(500) : null;
    series.forEach((s) => {
      const pts = s.pts.map((p) => ({ ...p, X: x(pd(p.date).d), Y: y(cost(p)), c: cost(p) }));
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const ln = g.append('line').attr('x1', a.X).attr('x2', b.X).attr('y1', animate ? a.Y : a.Y).attr('y2', b.Y)
          .attr('stroke', s.cl).attr('stroke-width', 1.5).attr('stroke-dasharray', (b.conf === 'low' || a.conf === 'low' || s.key === 'cn') ? '4 3' : null);
        void ln;
      }
      pts.forEach((p) => {
        if (p.lo != null) g.append('line').attr('x1', p.X).attr('x2', p.X).attr('y1', y(p.lo)).attr('y2', y(p.hi)).attr('stroke', s.cl).attr('stroke-width', 3).attr('opacity', 0.55);
      });
      const dots = g.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (p) => p.X).attr('r', 5)
        .attr('fill', (p) => p.conf === 'low' ? c.bg : s.cl).attr('stroke', s.key === 'eon' ? c.gx : c.cn).attr('stroke-width', 2).attr('stroke-dasharray', (p) => p.conf === 'low' ? '2 1.5' : null);
      if (T) dots.attr('cy', (p) => y(p.one_off)).transition(T).attr('cy', (p) => p.Y); else dots.attr('cy', (p) => p.Y);
      UI.bindTip(dots, (p) => `<b>${esc(s.name)} · ${fmtDate(p.date)}</b><br>${esc(p.label)}<br>One-off €${p.one_off}${p.monthly ? ' + €' + p.monthly.toFixed(2) + '/month' : ', no subscription'}<br>Cost over ${horizon} year${horizon > 1 ? 's' : ''}: <b>€${Math.round(p.c)}</b>${p.note ? '<br>' + esc(p.note) : ''}${confTxt(p.conf)}`);
      pts.forEach((p) => {
        const eon = s.key === 'eon';
        const lab = g.append('text').attr('class', 'lab-strong').attr('x', eon ? p.X - 9 : p.X).attr('y', eon ? p.Y + 4 : p.Y - 10).attr('text-anchor', eon ? 'end' : 'middle')
          .style('paint-order', 'stroke').style('stroke', c.panel).style('stroke-width', 4).text('€' + Math.round(p.c) + (p.conf === 'low' ? ' est.' : ''));
        if (T) lab.attr('opacity', 0).transition(T).attr('opacity', 1);
      });
      const last = pts[pts.length - 1];
      if (last) {
        const nm = narrow ? (s.key === 'eon' ? 'E.ON Home' : 'Consolinno') : s.name;
        lines(g, narrow ? [nm] : wrap(nm, 110, 11.5, 600), last.X + 10, last.Y + 4, 13, 'lab-strong').style('fill', s.key === 'eon' ? c.ink : c.ink);
      }
    });
    svg.attr('aria-label', `Cumulative end-customer cost over ${horizon} years: E.ON Home versus Consolinno Leaflet`);
  }

  /* ============ 8 · BENCHMARK ============ */
  let bmFilter = 'all';
  function bmRows() {
    return (X.benchmark || []).map((r) => {
      const us = r.us[0], best = Math.max(r.gx[0] ?? 0, r.cn[0] ?? 0);
      const st = us == null ? 'na' : us > best ? 'lead' : us < best ? 'lag' : 'tie';
      return { ...r, st };
    });
  }
  function bmSeg() {
    const seg = $('dd-bench-seg'); if (!seg) return;
    const rows = bmRows();
    const n = (s) => rows.filter((r) => r.st === s).length;
    const items = [['all', `All ${rows.length}`], ['lead', `We lead (${n('lead')})`], ['lag', `We lag (${n('lag')})`], ['na', `n/a (${n('na')})`]];
    seg.innerHTML = items.map(([id, l]) => `<button type="button" data-f="${id}" aria-pressed="${bmFilter === id}">${esc(l)}</button>`).join('');
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { bmFilter = b.dataset.f; bmSeg(); drawBench(); }));
  }
  function score(v, k) {
    if (v == null) return '<span class="dd-sc na">n/a</span>';
    return `<span class="dd-sc" role="img" aria-label="${v} of 4">${[1, 2, 3, 4].map((i) => `<i class="${i <= v ? 'on ' + k : ''}"></i>`).join('')}</span>`;
  }
  function drawBench() {
    const t = $('dd-bench'); if (!t) return;
    const rows = bmRows().filter((r) => bmFilter === 'all' || r.st === bmFilter);
    t.innerHTML = '<thead><tr><th style="width:22%">Criterion</th><th class="gx dd-gxh">gridX</th><th class="cn dd-cnh">Consolinno</th><th class="us dd-ush">Flexibility Manager</th></tr></thead><tbody>' +
      rows.map((r) => `<tr class="${r.st}"><td class="crit">${esc(r.k)}</td>` +
        [['gx', r.gx], ['cn', r.cn], ['us', r.us]].map(([k, v]) => `<td class="${k} dd-tt">${score(v[0], k)}<div class="txt dd-x">${esc(v[1])}</div></td>`).join('') + '</tr>').join('') + '</tbody>';
    // reasons behind each score: hidden by default ("Show notes"), on hover as a tooltip
    const NM = { gx: 'gridX', cn: 'Consolinno', us: 'Flexibility Manager' };
    t.querySelectorAll('tbody tr').forEach((tr, i) => {
      const r = rows[i];
      tr.querySelectorAll('td.dd-tt').forEach((td, j) => {
        const k = ['gx', 'cn', 'us'][j], v = r[k];
        tipOn(td, `<b>${NM[k]} · ${esc(r.k)}</b><br>${v[0] == null ? 'n/a' : v[0] + ' of 4'}: ${esc(v[1])}`);
      });
    });
  }

  /* ============ dialog ============ */
  function dialog() {
    const dlg = $('dd-dlg'); if (!dlg || dlg.dataset.bound) return;
    dlg.dataset.bound = '1';
    const img = $('dd-dlg-img'), cap = $('dd-dlg-cap');
    document.querySelectorAll('[data-dd-img]').forEach((b) => b.addEventListener('click', () => {
      img.src = b.dataset.ddImg; img.alt = b.dataset.ddCap || ''; cap.textContent = b.dataset.ddCap || '';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }));
    $('dd-dlg-close')?.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  /* ============ run ============ */
  const draws = [
    drawTimeline, drawOwnGx, drawOwnCn, drawGrants, drawDeals,
    drawGxPL, drawCnPL, drawGxBS, drawCnEq, drawCnLiq, drawCnUnits,
    () => drawArch('dd-arch-gx', 'gx'), () => drawArch('dd-arch-cn', 'cn'),
    drawChannels, drawKPIs, () => drawPrice(false), drawBench,
  ];
  function all() { draws.forEach((f) => { try { f(); } catch (e) { console.error('dd chart failed', f.name, e); } }); }
  const tlN = $('dd-tl-n'); if (tlN) tlN.textContent = EV.gridx.length + EV.consolinno.length; // count of the (filtered) data
  tlSeg(); priceSeg(); bmSeg(); dialog();
  all();
  toggles(); proseTips();
  draws.forEach((f) => UI.onTheme(f));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
})();

/* m1: chapters 1-3 of the HEMS market page (definition, size & growth, drivers & regulation).
   Data: window.MD.r.market_size, .regulation_trends, MD.extra.m1_value_chain, MD.extra.m1_regulation.
   Every chart is a function that clears and redraws; registered with UI.onTheme. */
(function () {
  'use strict';
  const MD = window.MD, UI = window.UI, d3 = window.d3;
  if (!MD || !UI || !d3) return;
  const X = MD.extra || {}, R = MD.r || {};
  const MS = R.market_size || {}, RG = R.regulation_trends || {};
  const ser = (id) => (MS.series || []).find((s) => s.id === id) || { points: [] };
  const rser = (id) => (RG.series || []).find((s) => s.id === id) || { points: [] };
  const C = (n) => UI.css(n);
  const $ = (id) => document.getElementById(id);
  const esc = UI.esc;
  const pd = (s) => { const [a, b, c] = String(s).split('-').map(Number); return new Date(a, (b || 1) - 1, c || 1); };
  const pt = (s, y, f) => (s.points || []).find((p) => p.year === y && (!f || f(p)));

  /* ---------- helpers ---------- */
  const fmtM = (v) => {
    if (v == null) return '–';
    if (v >= 1e5) { const m = v / 1e6; return String(+m.toFixed(m >= 10 ? 1 : 2)) + ' M'; }
    return Math.round(v / 1e3) + 'k';
  };
  const width = (el) => Math.max(260, Math.floor(el.getBoundingClientRect().width || el.clientWidth || 600));
  function mkSvg(el, w, h, label) {
    el.innerHTML = '';
    return d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%')
      .attr('role', 'img').attr('aria-label', label || '');
  }
  let hatchN = 0;
  function hatch(svg, color) {
    const id = 'm1h' + (hatchN++);
    const p = svg.append('defs').append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
    p.append('rect').attr('width', 5).attr('height', 5).attr('fill', C('--panel'));
    p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).attr('stroke', color).attr('stroke-width', 1.5);
    return `url(#${id})`;
  }
  const isLow = (p) => p && (p.confidence === 'low');
  const isEst = (p) => p && (p.estimate || p.confidence === 'low');
  const tipRow = (k, v) => `<br>${esc(k)}: <b>${esc(v)}</b>`;
  function yGrid(g, y, x0, x1, ticks, f) {
    const ax = g.append('g').attr('class', 'ax');
    ticks.forEach((t) => {
      ax.append('line').attr('x1', x0).attr('x2', x1).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', C('--line'));
      ax.append('text').attr('x', x0 - 6).attr('y', y(t) + 3.5).attr('text-anchor', 'end').text(f(t));
    });
  }

  const draws = [];
  function reg(fn) {
    const run = () => { try { fn(); } catch (e) { console.error('[m1]', fn.name, e); } };
    draws.push(run); UI.onTheme(run);
  }

  /* =====================================================================
     Chapter 1: value chain (HTML, CSS grid with subgrid)
     ===================================================================== */
  let vcArch = null;
  function drawValueChain() {
    const host = $('m1-vc'), segEl = $('m1-vc-seg');
    if (!host) return;
    const D = X.m1_value_chain;
    if (!D) { host.textContent = 'Value-chain data missing (data/m1_value_chain.json).'; return; }
    const L = D.layers;
    const used = UI.ARCH.filter((a) => L.some((l) => l.players.some((p) => p[1] === a.id)));
    if (segEl) {
      segEl.innerHTML = `<button data-a="" aria-pressed="${!vcArch}">All</button>` +
        used.map((a) => `<button data-a="${a.id}" aria-pressed="${vcArch === a.id}"><i style="background:${UI.archColor(a.id)}"></i>${esc(a.short)}</button>`).join('');
      segEl.querySelectorAll('button').forEach((b) => { b.onclick = () => { vcArch = b.dataset.a || null; drawValueChain(); }; });
    }
    const arrows = { down: ['↓', 'under price pressure'], flat: ['→', 'thin, stable'], up: ['↑', 'growing pool'] };
    const poolTag = {
      device: 'Outside the BCG HEMS value pools', gateway: 'Part of BCG traditional EMS pool',
      optimization: 'Part of BCG traditional EMS pool', app: 'Part of BCG traditional EMS pool',
      tariff: 'Outside the BCG HEMS value pools', flex: 'BCG flex pool: €10–20 M (2025) → €1.15–1.35 bn (2035)',
      installation: 'EMS installation counts in the BCG traditional pool',
    };
    const rows = ['What it does', 'How it earns', 'Value capture', 'Key number', 'Example players'];
    let h = '<div class="m1-vcg">';
    const rcls = ['m1-r-does', 'm1-r-earns', 'm1-r-cap', 'm1-r-kpi', 'm1-r-players'];
    h += '<div class="m1-card m1-rlcol"><div class="m1-rl" style="border-top:0"></div>' + rows.map((t, k) => `<div class="m1-rl ${rcls[k]}">${t}</div>`).join('') + '</div>';
    L.forEach((l, i) => {
      const ar = arrows[l.trend] || arrows.flat;
      const chips = l.players.map((p) => {
        const a = p[1] ? UI.archById[p[1]] : null;
        const col = a ? UI.archColor(p[1]) : C('--grey');
        const dim = vcArch && p[1] !== vcArch;
        return `<span class="m1-chip${dim ? ' m1-dim' : ''}" title="${esc(a ? a.label : 'Local trades (no archetype)')}"><i style="background:${col}"></i>${esc(p[0])}</span>`;
      }).join('');
      const lowK = l.kpi.conf === 'low' ? ' <span class="conf low">low</span>' : '';
      h += `<div class="m1-card${i === 0 ? ' m1-first' : ''}${l.id === 'flex' ? ' m1-flexl' : ''}" data-layer="${l.id}">
        <div class="m1-chev"><span class="m1-no">${i + 1}</span><b>${esc(l.label)}</b></div>
        <div class="m1-cell m1-c-does"><span class="m1-il">${rows[0]}</span>${esc(l.does)}</div>
        <div class="m1-cell m1-c-earns"><span class="m1-il">${rows[1]}</span>${esc(l.earns)}</div>
        <div class="m1-cell"><span class="m1-il">${rows[2]}</span><span class="m1-cap-t">${esc(l.captures)}<br></span><span class="m1-trend ${l.trend}"><span class="m1-ar" aria-hidden="true">${ar[0]}</span>${ar[1]}</span></div>
        <div class="m1-cell"><span class="m1-il">${rows[3]}</span><span class="m1-kpi">${esc(l.kpi.value)}</span><span class="m1-kpi-t">${esc(l.kpi.text)}${lowK}</span>${l.ours ? '<span class="m1-ours">◆ Our Flexibility Manager</span>' : ''}</div>
        <div class="m1-cell m1-c-players"><span class="m1-il">${rows[4]}</span><div class="m1-chips">${chips}</div><span class="m1-pooltag">${esc(poolTag[l.id] || '')}</span></div>
      </div>`;
    });
    h += '</div>';
    /* pool brackets below the chain (wide layout only, via CSS) */
    h += `<div class="m1-pools" aria-label="BCG value pools mapped to layers">
      <div class="m1-pool m1-out" style="grid-column:2">Outside BCG HEMS pools<span>device hardware revenue</span></div>
      <div class="m1-pool" style="grid-column:3 / 6">BCG traditional EMS pool: €300–350 M (2025) → €600–800 M (2035)<span>EMS hardware + software incl. installation; shrinks ~10 % after 2030</span></div>
      <div class="m1-pool m1-out" style="grid-column:6">Outside BCG HEMS pools<span>retail supply margin</span></div>
      <div class="m1-pool" style="grid-column:7">BCG flex pool<span>€10–20 M (2025) → €1.15–1.35 bn (2035)</span></div>
      <div class="m1-pool m1-out" style="grid-column:8">EMS installation is in the traditional pool</div>
    </div>`;
    host.innerHTML = h;
    const more = $('m1-vc-more');
    if (more && !more.dataset.bound) {
      more.dataset.bound = '1';
      more.onclick = () => {
        const on = host.classList.toggle('m1-compact') === false;
        more.setAttribute('aria-pressed', String(on));
        more.textContent = on ? 'Hide descriptions' : 'Show descriptions';
      };
    }
  }
  reg(drawValueChain);

  /* =====================================================================
     Chapter 2a: definition matters
     ===================================================================== */
  function drawDefBars() {
    const el = $('m1-defbars'); if (!el) return;
    const w = width(el);
    const bergDE = pt(ser('hems_base_germany_berg_derived'), 2024);
    const eu23 = pt(ser('ems_count_efh_eupd'), 2023), eu24 = pt(ser('ems_count_efh_eupd'), 2024);
    const lcp = pt(ser('hems_base_lcp'), 2023, (p) => p.geo_detail === 'DE');
    const bcg = pt(ser('hems_dynamic_capable_bcg'), 2025);
    const rows = [
      { name: 'Berg Insight', def: 'Broad: PV + battery + app', yr: 'end 2024, derived', p: bergDE, v: bergDE && bergDE.value, est: true },
      { name: 'EUPD / Lichtblick', def: 'EMS in 1–2 family homes', yr: 'end 2023; 2024 est. dashed', p: eu23, v: eu23 && eu23.value, v2: eu24 && eu24.value, p2: eu24 },
      { name: 'LCP Delta', def: 'Installed HEMS', yr: 'end 2023', p: lcp, v: lcp && lcp.value },
      { name: 'BCG', def: 'Narrow: optimises on dynamic prices', yr: '2025', p: bcg, v: bcg && bcg.value },
    ].filter((r) => r.v);
    const narrow = w < 430;
    const lw = narrow ? 0 : 204, rowH = narrow ? 56 : 46, top = 4;
    const h = top + rows.length * rowH + 34;
    const svg = mkSvg(el, w, h, 'Installed HEMS in Germany by definition');
    const hp = hatch(svg, C('--ink'));
    const x0 = lw, x1 = w - 76;
    const x = d3.scaleLinear([0, 2e6], [x0, x1]);
    const g = svg.append('g');
    [0, 1e6, 2e6].forEach((t) => {
      g.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', top).attr('y2', top + rows.length * rowH).attr('stroke', C('--line'));
      g.append('text').attr('class', 'ax').attr('x', x(t)).attr('y', top + rows.length * rowH + 13).attr('text-anchor', 'middle').attr('fill', C('--grey')).text(t === 0 ? '0' : (t / 1e6) + ' M');
    });
    rows.forEach((r, i) => {
      const y0 = top + i * rowH;
      const by = narrow ? y0 + 30 : y0 + 12, bh = 16;
      if (narrow) {
        g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', y0 + 12).text(r.name);
        g.append('text').attr('x', 0).attr('y', y0 + 25).attr('font-size', 10.5).text(`${r.def} · ${r.yr}`);
      } else {
        g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', y0 + 18).text(r.name);
        g.append('text').attr('x', 0).attr('y', y0 + 31).attr('font-size', 10.5).text(r.def);
        g.append('text').attr('x', 0).attr('y', y0 + 42).attr('font-size', 10).attr('fill', C('--grey')).text(r.yr);
      }
      const est = r.est || isLow(r.p);
      g.append('rect').attr('x', x(0)).attr('y', by).attr('width', Math.max(1, x(r.v) - x(0))).attr('height', bh)
        .attr('fill', est ? hp : C('--ink')).attr('stroke', C('--ink')).attr('stroke-width', est ? 1.2 : 0).attr('stroke-dasharray', est ? '3 2' : null);
      let end = x(r.v);
      if (r.v2) {
        g.append('rect').attr('x', x(r.v)).attr('y', by).attr('width', x(r.v2) - x(r.v)).attr('height', bh)
          .attr('fill', hp).attr('stroke', C('--ink')).attr('stroke-width', 1.2).attr('stroke-dasharray', '3 2');
        end = x(r.v2);
      }
      const lowTxt = (isLow(r.p) || isLow(r.p2)) ? ', low conf.' : '';
      const lab = r.v2 ? `${fmtM(r.v)} → ${fmtM(r.v2)} est.${lowTxt}` : `${est ? '~' : ''}${fmtM(r.v)}${est ? ' est.' : ''}${lowTxt}`;
      g.append('text').attr('class', 'lab').attr('x', end + 6).attr('y', by + 12).text(lab);
      const hit = g.append('rect').attr('x', 0).attr('y', y0).attr('width', w).attr('height', rowH).attr('fill', 'transparent');
      UI.bindTip(hit.datum(r), (d) => `<b>${esc(d.name)}</b><br>${esc(d.def)}${tipRow('Value', fmtM(d.v) + ' (' + d.yr + ')')}${d.v2 ? tipRow('2024 est.', fmtM(d.v2)) : ''}<br>${esc((d.p && d.p.note) || '')}${d.p && d.p.confidence ? '<br>Confidence: ' + esc(d.p.confidence) : ''}`);
    });
    const b = rows[0].v, n = rows[rows.length - 1].v;
    svg.append('text').attr('x', 0).attr('y', h - 4).attr('font-size', 11).attr('fill', C('--muted'))
      .text(`Broadest vs narrowest count: factor ≈ ${(b / n).toFixed(1)}`);
  }
  reg(drawDefBars);

  let defScale = 'log';
  function drawDefLines() {
    const el = $('m1-deflines'); if (!el) return;
    const segEl = $('m1-def-scale');
    if (segEl && !segEl.dataset.bound) {
      segEl.dataset.bound = '1';
      segEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        defScale = b.dataset.v; segEl.querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); drawDefLines();
      }));
    }
    const w = width(el), h = 268;
    const m = { t: 14, r: 16, b: 24, l: 44 };
    const S = [
      { id: 'berg', name: 'Berg Insight, Europe (broad)', short: 'Berg, Europe', s: ser('hems_base_europe_berg'), col: C('--grey') },
      { id: 'eupd', name: 'EUPD, DE homes with EMS', short: 'EUPD, DE', s: ser('ems_count_efh_eupd'), col: C('--ink') },
      { id: 'bcg', name: 'BCG, DE dynamic-price-capable', short: 'BCG, DE', s: ser('hems_dynamic_capable_bcg'), col: C('--a1') },
    ];
    // legend above (identity never by colour alone: direct labels too)
    el.innerHTML = '';
    const lg = document.createElement('div'); lg.className = 'legend'; lg.style.marginBottom = '6px';
    lg.innerHTML = S.map((s) => `<span><i style="background:${s.col}"></i>${esc(s.name)}</span>`).join('') +
      `<span><svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke="${C('--muted')}" stroke-width="2" stroke-dasharray="4 3"/></svg>forecast, estimate or low confidence</span>`;
    el.appendChild(lg);
    const holder = document.createElement('div'); el.appendChild(holder);
    const svg = d3.select(holder).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'HEMS installed base by source 2021-2035');
    const x = d3.scaleLinear([2020.6, 2035.4], [m.l, w - m.r]);
    const y = defScale === 'log' ? d3.scaleLog([1e5, 2e7], [h - m.b, m.t]) : d3.scaleLinear([0, 12e6], [h - m.b, m.t]);
    const ticks = defScale === 'log' ? [1e5, 3e5, 1e6, 3e6, 1e7] : [0, 3e6, 6e6, 9e6, 12e6];
    const g = svg.append('g');
    yGrid(g, y, m.l, w - m.r, ticks, (t) => (t === 0 ? '0' : (+(t / 1e6).toFixed(1)) + ' M'));
    const xt = w < 420 ? [2021, 2025, 2030, 2035] : [2021, 2023, 2025, 2027, 2029, 2031, 2033, 2035];
    xt.forEach((t) => g.append('text').attr('class', 'ax').attr('fill', C('--grey')).attr('x', x(t)).attr('y', h - 6).attr('text-anchor', 'middle').text(t));
    // "today" marker
    g.append('line').attr('x1', x(2026.9)).attr('x2', x(2026.9)).attr('y1', m.t).attr('y2', h - m.b).attr('stroke', C('--muted')).attr('stroke-dasharray', '2 3');
    g.append('text').attr('x', x(2026.9) + 4).attr('y', h - m.b - 5).attr('font-size', 10).attr('fill', C('--grey')).text('Nov 2026');
    S.forEach((s) => {
      const P = (s.s.points || []).filter((p) => p.value > 0).sort((a, b) => a.year - b.year);
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i];
        const dash = isEst(a) || isEst(b);
        g.append('line').attr('x1', x(a.year)).attr('y1', y(a.value)).attr('x2', x(b.year)).attr('y2', y(b.value))
          .attr('stroke', s.col).attr('stroke-width', 2).attr('stroke-dasharray', dash ? '5 4' : null);
      }
      P.forEach((p) => {
        const hollow = isEst(p);
        g.append('circle').attr('cx', x(p.year)).attr('cy', y(p.value)).attr('r', 4.5)
          .attr('fill', hollow ? C('--panel') : s.col).attr('stroke', hollow ? s.col : C('--panel')).attr('stroke-width', 2);
        const hit = g.append('circle').attr('cx', x(p.year)).attr('cy', y(p.value)).attr('r', 10).attr('fill', 'transparent');
        UI.bindTip(hit.datum(p), (d) => `<b>${esc(s.name)}</b><br>${d.year}: <b>${fmtM(d.value)}</b>${d.estimate ? ' (estimate/forecast)' : ''}<br>${esc(d.note || '')}<br>Confidence: ${esc(d.confidence || '–')}`);
      });
      const last = P[P.length - 1];
      if (!last) return;
      // direct labels
      let lx, ly, anchor;
      if (s.id === 'berg') { lx = x(last.year) - 8; ly = y(last.value) - 9; anchor = 'end'; }
      else if (s.id === 'bcg') { lx = x(last.year) - 4; ly = y(last.value) - 10; anchor = 'end'; }
      else { lx = x(last.year) + 8; ly = y(last.value) - 6; anchor = 'start'; }
      g.append('text').attr('class', 'lab').attr('x', lx).attr('y', ly).attr('text-anchor', anchor).text(`${s.short} ${fmtM(last.value)}`);
    });
  }
  reg(drawDefLines);

  /* =====================================================================
     Chapter 2b: driver assets small multiples
     ===================================================================== */
  function drawDrivers() {
    const host = $('m1-drivers'); if (!host) return;
    host.innerHTML = '';
    const hpS = ser('hp_sales_de'), hpShare = ser('hp_market_share_heat_generators');
    const pvA = ser('pv_add_gw_dc'), pvH = ser('pv_home_segment_add_gw'), pvC = ser('pv_cum_gw_dc');
    const bat = ser('home_storage_stock_count'), att = ser('battery_attach_rate_home_pv');
    const bev = ser('bev_stock_de'), bevReg = ser('bev_new_reg_de');
    const imq = ser('imsys_mandatory_quota'), ims = ser('imsys_share_all_meters');
    const v = (s, y) => (pt(s, y) || {}).value;

    const hp25 = v(hpS, 2025), hp24 = v(hpS, 2024);
    const bat25 = v(bat, 2025), bat24 = v(bat, 2024), bat20 = v(bat, 2020);
    const bevEnd25 = v(bev, 2026);
    const q = (imq.points || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const qLast = q[q.length - 1] || {};
    const allLast = (ims.points || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop() || {};

    const panels = [
      { key: 'hp', h: 'Heat pumps sold per year', unit: 'thousand units',
        t: `Sales recovered to ${Math.round(hp25 / 1e3)}k in 2025 (+${Math.round((hp25 / hp24 - 1) * 100)} %), ${v(hpShare, 2025)} % of all heat generators sold; BWP expects ~${Math.round(v(hpS, 2026) / 1e3)}k in 2026.` },
      { key: 'pv', h: 'PV added per year', unit: 'GWp (DC)',
        t: `Total additions plateau at ~17 GWp/yr (stock ${v(pvC, 2026)} GWp, Nov 2026); home rooftops ≤30 kWp fell from ${v(pvH, 2024)} to ${v(pvH, 2025)} GWp in 2025.` },
      { key: 'bat', h: 'Home batteries in operation', unit: 'million units, year end',
        t: `${fmtM(bat25)} at end 2025, ${(bat25 / bat20).toFixed(1)}× the 2020 stock (+${Math.round((bat25 / bat24 - 1) * 100)} % in 2025); ~${v(att, 2025)} % of new home PV comes with a battery.` },
      { key: 'bev', h: 'Battery-electric cars in stock', unit: 'million cars, year end',
        t: `${fmtM(bevEnd25)} at end 2025 (4.1 % of all cars); ${Math.round(v(bevReg, 2025) / 1e3)}k new registrations in 2025 (+${Math.round((v(bevReg, 2025) / v(bevReg, 2024) - 1) * 100)} %).` },
      { key: 'sm', h: 'Smart meters (iMSys) in mandatory cases', unit: '% of mandatory installation cases',
        t: `${qLast.value} % of mandatory cases had an iMSys on 30.06.2026 (legal target 20 % by end 2025), but only ${allLast.value} % of all 54.1 M metering points.` },
    ];
    panels.forEach((p) => {
      const div = document.createElement('div');
      div.innerHTML = `<p class="m1-panel-h" title="${esc(p.t)}">${esc(p.h)} <span class="grey" style="font-weight:400">· ${esc(p.unit)}</span></p><div class="m1-pc" title="${esc(p.t)}"></div>`;
      host.appendChild(div);
      p.el = div.querySelector('.m1-pc');
    });
    const key = document.createElement('div');
    key.className = 'm1-key';
    const ink = C('--ink');
    key.innerHTML = `<p class="m1-panel-h" style="margin:0">How to read</p>
      <div><svg width="16" height="12"><rect x="1" y="1" width="14" height="10" fill="${ink}"/></svg>Reported value</div>
      <div><svg width="16" height="12"><rect x="1" y="1" width="14" height="10" fill="none" stroke="${ink}" stroke-dasharray="3 2"/></svg>Forecast or low-confidence value</div>
      <div><svg width="16" height="12"><defs><pattern id="m1keyh" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="${ink}" stroke-width="1.4"/></pattern></defs><rect x="1" y="1" width="14" height="10" fill="url(#m1keyh)" stroke="${ink}"/></svg>Year to date (2026)</div>
      <div><svg width="16" height="12"><circle cx="8" cy="6" r="4" fill="${C('--panel')}" stroke="${ink}" stroke-width="2"/></svg>Hollow marker = estimate</div>`;
    host.appendChild(key);

    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    function frame(el, yMax, ticks, fmt, label) {
      const w = width(el), h = 150, m = { t: 16, r: 8, b: 20, l: 36 };
      const svg = mkSvg(el, w, h, label);
      const x = d3.scaleLinear([2019, 2027], [m.l, w - m.r]);
      const y = d3.scaleLinear([0, yMax], [h - m.b, m.t]);
      const g = svg.append('g');
      yGrid(g, y, m.l, w - m.r, ticks, fmt);
      const step = w < 330 ? 2 : 1;
      years.forEach((yr, i) => {
        if (i % step && yr !== 2026) return;
        g.append('text').attr('class', 'ax').attr('fill', C('--grey')).attr('x', x(yr + 0.5)).attr('y', h - 5).attr('text-anchor', 'middle').text("'" + String(yr).slice(2));
      });
      const bw = Math.max(4, (x(1) - x(0)) * 0.66);
      return { svg, g, x, y, w, h, m, bw, hp: hatch(svg, C('--ink')) };
    }
    function bar(F, yr, val, style, tip) {
      const { g, x, y, bw } = F;
      const r = g.append('rect').attr('x', x(yr + 0.5) - bw / 2).attr('y', y(val)).attr('width', bw).attr('height', Math.max(0.5, y(0) - y(val)));
      if (style === 'est') r.attr('fill', C('--panel')).attr('stroke', C('--ink')).attr('stroke-width', 1.2).attr('stroke-dasharray', '3 2');
      else if (style === 'ytd') r.attr('fill', F.hp).attr('stroke', C('--ink')).attr('stroke-width', 1);
      else if (style === 'grey') r.attr('fill', C('--grey'));
      else r.attr('fill', C('--ink'));
      if (tip) { const hit = g.append('rect').attr('x', x(yr) ).attr('y', F.m.t).attr('width', x(1) - x(0)).attr('height', y(0) - F.m.t).attr('fill', 'transparent'); UI.bindTip(hit, () => tip); }
      return r;
    }
    function vlab(F, yr, val, text, dy) {
      F.g.append('text').attr('class', 'lab').attr('x', F.x(yr + 0.5)).attr('y', F.y(val) - (dy || 5)).attr('text-anchor', 'middle').attr('font-size', 10.5).text(text);
    }

    /* 1 heat pumps */
    (function () {
      const P = panels[0];
      const F = frame(P.el, 450e3, [0, 200e3, 400e3], (t) => (t ? t / 1e3 + 'k' : '0'), 'Heat pump sales Germany');
      (hpS.points || []).forEach((p) => {
        const sh = pt(hpShare, p.year);
        if (p.estimate) {
          bar(F, p.year, p.value, 'est', `<b>${p.year} forecast</b>: ${Math.round(p.value / 1e3)}k<br>${esc(p.note || '')}`);
        } else bar(F, p.year, p.value, 'ink', `<b>${p.year}</b>: ${Math.round(p.value / 1e3)}k units${sh ? '<br>Share of heat generators: ' + sh.value + ' %' : ''}<br>${esc(p.note || '')}`);
      });
      const h1 = (hpS.extra_points || []).find((p) => p.period === 'H1');
      if (h1) {
        bar(F, h1.year, h1.value, 'grey');
        F.g.append('text').attr('x', F.x(h1.year + 0.5)).attr('y', F.y(h1.value / 2) + 3).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', C('--bg')).text('H1');
      }
      vlab(F, 2023, v(hpS, 2023), Math.round(v(hpS, 2023) / 1e3) + 'k');
      vlab(F, 2024, v(hpS, 2024), Math.round(v(hpS, 2024) / 1e3) + 'k');
      vlab(F, 2025, hp25, Math.round(hp25 / 1e3) + 'k');
      vlab(F, 2026, v(hpS, 2026), Math.round(v(hpS, 2026) / 1e3) + 'k F');
    })();

    /* 2 PV */
    (function () {
      const P = panels[1];
      const F = frame(P.el, 20, [0, 10, 20], (t) => String(t), 'PV additions Germany');
      (pvA.points || []).forEach((p) => {
        const ytd = p.year === 2026;
        bar(F, p.year, p.value, ytd ? 'ytd' : 'ink', `<b>${p.year}${ytd ? ' Jan–Nov' : ''}</b>: ${p.value} GWp added (all sizes, DC)<br>Derived from year-end stock (Energy-Charts)`);
      });
      vlab(F, 2024, v(pvA, 2024), String(v(pvA, 2024).toFixed(1)));
      vlab(F, 2026, v(pvA, 2026), v(pvA, 2026).toFixed(1));
      const col = C('--a2');
      const H = (pvH.points || []).slice().sort((a, b) => a.year - b.year);
      const line = d3.line().x((p) => F.x(p.year + 0.5)).y((p) => F.y(p.value));
      for (let i = 1; i < H.length; i++) {
        F.g.append('path').attr('d', line([H[i - 1], H[i]])).attr('fill', 'none').attr('stroke', C('--panel')).attr('stroke-width', 5);
        F.g.append('path').attr('d', line([H[i - 1], H[i]])).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2).attr('stroke-dasharray', isEst(H[i - 1]) ? '4 3' : null);
      }
      H.forEach((p) => {
        const c = F.g.append('circle').attr('cx', F.x(p.year + 0.5)).attr('cy', F.y(p.value)).attr('r', 4).attr('fill', isEst(p) ? C('--panel') : col).attr('stroke', isEst(p) ? col : C('--panel')).attr('stroke-width', 2);
        UI.bindTip(c, () => `<b>Home segment ≤30 kWp, ${p.year}</b>: ${p.value} GWp<br>${esc(p.note || '')}<br>Confidence: ${esc(p.confidence)}`);
      });
      const l = H[H.length - 1];
      const lgd = document.createElement('div'); lgd.className = 'legend'; lgd.style.margin = '-4px 0 4px';
      lgd.innerHTML = `<span><i style="background:${C('--ink')}"></i>all sizes</span><span><i style="background:${col}"></i>homes ≤30 kWp (${l.value} GWp in ${l.year})</span>`;
      P.el.parentNode.insertBefore(lgd, P.el);
    })();

    /* 3 batteries */
    (function () {
      const P = panels[2];
      const F = frame(P.el, 2.6e6, [0, 1e6, 2e6], (t) => (t ? t / 1e6 + ' M' : '0'), 'Home batteries in operation');
      (bat.points || []).forEach((p) => bar(F, p.year, p.value, isLow(p) ? 'est' : 'ink', `<b>End ${p.year}</b>: ${fmtM(p.value)} home batteries (BSW, ≤20 kWh)${p.note ? '<br>' + esc(p.note) : ''}`));
      vlab(F, 2020, bat20, fmtM(bat20).replace(' M', '').replace('k', 'k'));
      vlab(F, 2023, v(bat, 2023), fmtM(v(bat, 2023)));
      vlab(F, 2025, bat25, fmtM(bat25));
      F.g.append('text').attr('x', F.x(2019.5)).attr('y', F.y(0) - 4).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', C('--grey')).text('n/a');
    })();

    /* 4 BEV (KBA stock on 1 Jan shifted to previous year end) */
    (function () {
      const P = panels[3];
      const F = frame(P.el, 2.3e6, [0, 1e6, 2e6], (t) => (t ? t / 1e6 + ' M' : '0'), 'Battery electric cars in stock');
      (bev.points || []).forEach((p) => {
        const yr = p.year - 1; if (yr < 2019) return;
        bar(F, yr, p.value, isLow(p) ? 'est' : 'ink', `<b>End ${yr}</b> (KBA 1 Jan ${p.year}): ${fmtM(p.value)} BEV<br>Confidence: ${esc(p.confidence)}${p.note ? '<br>' + esc(p.note) : ''}`);
      });
      vlab(F, 2022, v(bev, 2023), fmtM(v(bev, 2023)));
      vlab(F, 2025, bevEnd25, fmtM(bevEnd25));
    })();

    /* 5 smart meters on the mandatory-quota axis */
    (function () {
      const P = panels[4];
      const F = frame(P.el, 30, [0, 10, 20, 30], (t) => t + ' %', 'Smart meter quota in mandatory cases');
      const dx = (s) => { const d = pd(s); return d.getFullYear() + (d.getMonth() + d.getDate() / 31) / 12; };
      // target
      const tg = (imq.target || [])[0];
      if (tg) {
        F.g.append('line').attr('x1', F.x(2019.1)).attr('x2', F.x(2026.05)).attr('y1', F.y(tg.value)).attr('y2', F.y(tg.value)).attr('stroke', C('--muted')).attr('stroke-dasharray', '4 3').attr('stroke-width', 1.3);
        F.g.append('text').attr('x', F.x(2019.1)).attr('y', F.y(tg.value) - 4).attr('font-size', 10).attr('fill', C('--muted')).text('legal target: 20 % by end 2025');
      }
      const line = d3.line().x((p) => F.x(dx(p.date))).y((p) => F.y(p.value));
      F.g.append('path').attr('d', line(q)).attr('fill', 'none').attr('stroke', C('--ink')).attr('stroke-width', 2);
      q.forEach((p) => {
        const c = F.g.append('circle').attr('cx', F.x(dx(p.date))).attr('cy', F.y(p.value)).attr('r', 3.6).attr('fill', C('--ink')).attr('stroke', C('--panel')).attr('stroke-width', 1.5);
        UI.bindTip(c, () => `<b>${esc(p.date)}</b>: ${p.value} % of mandatory cases${p.note ? '<br>' + esc(p.note) : ''}`);
      });
      const f = q[0];
      F.g.append('text').attr('x', F.x(dx(f.date))).attr('y', F.y(f.value) + 15).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', C('--ink')).text(f.value.toFixed(1) + ' %');
      F.g.append('text').attr('x', F.x(dx(qLast.date))).attr('y', F.y(qLast.value) - 8).attr('text-anchor', 'middle').attr('class', 'lab-strong').text(qLast.value + ' %');
      F.g.append('text').attr('x', F.x(2019.1)).attr('y', F.y(9)).attr('font-size', 10.5).attr('fill', C('--muted')).text('Reported since end 2024');
      F.g.append('text').attr('x', F.x(2019.1)).attr('y', F.y(9) + 12).attr('font-size', 10.5).attr('fill', C('--muted')).text(`All meter points: ${allLast.value} %`);
      F.g.append('text').attr('x', F.x(2019.1)).attr('y', F.y(9) + 24).attr('font-size', 10.5).attr('fill', C('--muted')).text('Target 2032: 90 %');
    })();
  }
  reg(drawDrivers);

  /* =====================================================================
     Chapter 2c: BCG value pools
     ===================================================================== */
  function drawPools() {
    const el = $('m1-pools'); if (!el) return;
    // chart top = top of the right-hand list (.m1-why), x-axis (€0 line) = its bottom edge; year labels hang below (26.11.)
    const why = el.closest('.exhibit')?.querySelector('.m1-why');
    // side column is sticky, so measure the list relative to its own column (both columns start on the same grid row)
    const side = why && why.closest('.side');
    const listBottom = () => (why && why.offsetParent === side ? why.offsetTop + why.offsetHeight : 0); // sticky .side is the offsetParent
    const besideList = side && side.getBoundingClientRect().left >= el.getBoundingClientRect().right;
    const lb = besideList ? listBottom() : 0;
    drawPools.lastB = lb;
    // redraw when the list end moves: ui.js moves the headline out of .side on DOMContentLoaded, fonts load, text wraps
    if (side && !drawPools.watch) {
      drawPools.watch = true;
      const recheck = () => {
        const nb = side.getBoundingClientRect().left >= el.getBoundingClientRect().right ? listBottom() : 0;
        if (Math.abs(nb - drawPools.lastB) > 2) drawPools();
      };
      if (window.ResizeObserver) { const ro = new ResizeObserver(recheck); ro.observe(side); ro.observe(why); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(recheck, 0));
      window.addEventListener('load', recheck);
      document.fonts?.ready.then(recheck);
    }
    const w = width(el);
    const narrow = w < 440;
    const m = { t: 22, r: narrow ? 12 : 92, b: 24, l: 46 };
    const h = lb ? Math.max(260, Math.round(lb + m.b)) : 290;
    const svg = mkSvg(el, w, h, 'BCG value pools Germany 2025-2035');
    const toPts = (s) => (s.points || []).map((p) => ({ year: p.year, mid: p.value, lo: p.low, hi: p.high, p }));
    const pools = [
      { id: 'classic', name: 'Classic EMS', sub: 'hardware + software', d: toPts(ser('value_pool_de_classic_bcg')), col: C('--grey') },
      { id: 'flex', name: 'Flex pool', sub: 'trading, balancing', d: toPts(ser('value_pool_de_flex_bcg')), col: C('--ink') },
    ];
    const x = d3.scaleLinear([2024.3, 2035.7], [m.l, w - m.r]);
    const y = d3.scaleLinear([0, 1450], [h - m.b, m.t]);
    const g = svg.append('g');
    yGrid(g, y, m.l, w - m.r, [0, 400, 800, 1200], (t) => '€' + t + ' M');
    [2025, 2030, 2035].forEach((t) => g.append('text').attr('class', 'ax').attr('fill', C('--grey')).attr('x', x(t)).attr('y', h - 6).attr('text-anchor', 'middle').text(t));
    // crossover (linear interpolation 2030-2035)
    const c = pools[0].d.find((d) => d.year === 2030), c2 = pools[0].d.find((d) => d.year === 2035);
    const f = pools[1].d.find((d) => d.year === 2030), f2 = pools[1].d.find((d) => d.year === 2035);
    const cross = (a1, a2, b1, b2) => 2030 + 5 * (a1 - b1) / ((b2 - b1) - (a2 - a1));
    const xm = cross(c.mid, c2.mid, f.mid, f2.mid), xe = cross(c.lo, c2.lo, f.hi, f2.hi), xl = cross(c.hi, c2.hi, f.lo, f2.lo);
    g.append('rect').attr('x', x(xe)).attr('width', x(xl) - x(xe)).attr('y', m.t).attr('height', h - m.b - m.t).attr('fill', C('--panel-2'));
    g.append('line').attr('x1', x(xm)).attr('x2', x(xm)).attr('y1', m.t).attr('y2', h - m.b).attr('stroke', C('--ink')).attr('stroke-dasharray', '3 3');
    g.append('text').attr('x', narrow ? x(xm) - 6 : x(xm) + 6).attr('text-anchor', narrow ? 'end' : 'start').attr('y', h - m.b - 20).attr('class', 'lab-strong').text(`Crossover ≈ ${Math.round(xm)}`);
    pools.forEach((P) => {
      const area = d3.area().x((d) => x(d.year)).y0((d) => y(d.lo)).y1((d) => y(d.hi));
      g.append('path').attr('d', area(P.d)).attr('fill', P.col).attr('fill-opacity', 0.18);
      g.append('path').attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.mid))(P.d)).attr('fill', 'none').attr('stroke', P.col).attr('stroke-width', 2).attr('stroke-dasharray', '0');
      P.d.forEach((d) => {
        g.append('line').attr('x1', x(d.year)).attr('x2', x(d.year)).attr('y1', y(d.lo)).attr('y2', y(d.hi)).attr('stroke', P.col).attr('stroke-width', 2);
        [d.lo, d.hi].forEach((vv) => g.append('line').attr('x1', x(d.year) - 5).attr('x2', x(d.year) + 5).attr('y1', y(vv)).attr('y2', y(vv)).attr('stroke', P.col).attr('stroke-width', 1.5));
        g.append('circle').attr('cx', x(d.year)).attr('cy', y(d.mid)).attr('r', 4).attr('fill', P.col).attr('stroke', C('--panel')).attr('stroke-width', 2);
        const above = (P.id === 'classic' && d.year <= 2030) || (P.id === 'flex' && d.year !== 2030);
        const ty = above ? y(d.hi) - 7 : y(d.lo) + 15;
        const anchor = d.year === 2025 ? 'start' : d.year === 2035 ? 'end' : 'middle';
        const tx = d.year === 2025 ? x(d.year) - 4 : d.year === 2035 ? x(d.year) + 4 : x(d.year);
        const lab = d.hi >= 1000 ? `€${(d.lo / 1000).toFixed(2)}–${(d.hi / 1000).toFixed(2)} bn` : `€${d.lo}–${d.hi} M`;
        g.append('text').attr('class', 'lab').attr('x', tx).attr('y', ty).attr('text-anchor', anchor).text(lab);
        const hit = g.append('circle').attr('cx', x(d.year)).attr('cy', y(d.mid)).attr('r', 14).attr('fill', 'transparent');
        UI.bindTip(hit, () => `<b>${esc(P.name)} ${d.year}</b><br>€${d.lo}–${d.hi} M (midpoint €${d.mid} M)${d.p.note ? '<br>' + esc(d.p.note) : ''}<br>${d.p.estimate ? 'BCG projection' : 'BCG estimate'}`);
      });
      const last = P.d[P.d.length - 1];
      if (!narrow) {
        g.append('text').attr('class', 'lab-strong').attr('x', x(last.year) + 12).attr('y', y(last.mid) + (P.id === 'flex' ? -2 : 4)).text(P.name);
        g.append('text').attr('x', x(last.year) + 12).attr('y', y(last.mid) + (P.id === 'flex' ? 11 : 17)).attr('font-size', 10.5).text(P.sub);
      }
    });
    if (narrow) {
      g.append('text').attr('class', 'lab-strong').attr('x', x(2026.3)).attr('y', y(240)).attr('fill', C('--ink')).text('Flex pool');
      g.append('text').attr('class', 'lab-strong').attr('x', x(2027.3)).attr('y', y(620)).attr('text-anchor', 'middle').text('Classic EMS');
    }
    g.append('text').attr('x', narrow ? x(xm) - 6 : x(xm) + 6).attr('text-anchor', narrow ? 'end' : 'start').attr('y', h - m.b - 6).attr('font-size', 10).attr('fill', C('--grey')).text(`range ${xe.toFixed(0)}–${xl.toFixed(0)}`);
  }
  reg(drawPools);

  /* =====================================================================
     Chapter 2d: TAM / SAM funnel (own estimate)
     ===================================================================== */
  function drawFunnel() {
    const el = $('m1-funnel'); if (!el) return;
    const T = MS.tam_sam; if (!T) { el.textContent = 'TAM/SAM data missing.'; return; }
    const st = (id) => (T.steps || []).find((s) => s.id === id) || {};
    const U = T.universe || [];
    const rows = [
      { lab: '1–2 family homes', tag: '', v: U[0].value, yr: '2024', conf: U[0].confidence },
      { lab: 'PV-suitable homes', tag: '', v: U[1].value, yr: '2024', conf: U[1].confidence },
      { lab: 'Homes with rooftop PV', tag: '', ...rng(st('pv_homes_2025e')), yr: 'end 2025 est. (3.97 M end 2024)' },
      { lab: 'PV + battery, heat pump or EV', tag: 'TAM', ...rng(st('tam_pv_plus_flex')), yr: '2025, own estimate' },
      { lab: 'PV homes with smart meter', tag: 'SAM today', ...rng(st('sam_dynamic_ready')), yr: '2025, own estimate' },
    ];
    function rng(s) { return { v: s.value, lo: s.low, hi: s.high, conf: s.confidence, est: true, logic: s.logic }; }
    const comp = [
      { lab: 'Homes with any EMS (EUPD, 2024 est.)', v: st('hems_installed_vs_tam').value },
      { lab: 'Price-capable HEMS (BCG, 2025)', v: ser('hems_dynamic_capable_bcg').points.find((p) => p.year === 2025).value },
      { lab: '§14a sites, new regime (end 2024)', v: st('sam_par14a').value },
    ];
    const w = width(el);
    const narrow = w < 600;
    const lw = narrow ? 0 : Math.min(240, w * 0.42);
    const rowH = narrow ? 56 : 42, cH = narrow ? 34 : 24;
    const h = rows.length * rowH + 30 + comp.length * cH + 8;
    const svg = mkSvg(el, w, h, 'TAM SAM funnel German homes');
    const hp = hatch(svg, C('--ink'));
    const x0 = lw, x1 = w - (narrow ? 70 : 92);
    const x = d3.scaleLinear([0, 16.3e6], [x0, x1]);
    const g = svg.append('g');
    rows.forEach((r, i) => {
      const y0 = i * rowH, by = narrow ? y0 + 30 : y0 + 8, bh = 18;
      if (narrow) {
        g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', y0 + 11).text((r.tag ? r.tag + ': ' : '') + r.lab);
        g.append('text').attr('x', 0).attr('y', y0 + 24).attr('font-size', 10).attr('fill', C('--grey')).text(r.yr);
      } else {
        g.append('text').attr(r.tag ? 'class' : 'class', r.tag ? 'lab-strong' : 'lab').attr('x', 0).attr('y', y0 + 18).text((r.tag ? r.tag + ': ' : '') + r.lab);
        g.append('text').attr('x', 0).attr('y', y0 + 31).attr('font-size', 10).attr('fill', C('--grey')).text(r.yr);
      }
      const rect = g.append('rect').attr('x', x0).attr('y', by).attr('width', Math.max(2, x(r.v) - x0)).attr('height', bh);
      if (r.est) rect.attr('fill', hp).attr('stroke', C('--ink')).attr('stroke-dasharray', '3 2').attr('stroke-width', 1.2);
      else rect.attr('fill', C('--ink'));
      if (r.lo != null) {
        const ym = by + bh / 2;
        g.append('line').attr('x1', x(r.lo)).attr('x2', x(r.hi)).attr('y1', ym).attr('y2', ym).attr('stroke', C('--ink')).attr('stroke-width', 1.5);
        [r.lo, r.hi].forEach((vv) => g.append('line').attr('x1', x(vv)).attr('x2', x(vv)).attr('y1', ym - 5).attr('y2', ym + 5).attr('stroke', C('--ink')).attr('stroke-width', 1.5));
      }
      const endX = Math.max(x(r.v), r.hi ? x(r.hi) : 0) + 6;
      g.append('text').attr('class', 'lab-strong').attr('x', endX).attr('y', by + 13).text((r.est ? '~' : '') + fmtM(r.v));
      if (i > 0) {
        const share = Math.round((r.v / rows[i - 1].v) * 100);
        g.append('text').attr('x', w).attr('y', by + 13).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', C('--grey')).text(`${share} % of step above`);
      }
      const hit = g.append('rect').attr('x', 0).attr('y', y0).attr('width', w).attr('height', rowH).attr('fill', 'transparent');
      UI.bindTip(hit, () => `<b>${esc((r.tag ? r.tag + ': ' : '') + r.lab)}</b><br>${fmtM(r.v)}${r.lo ? ` (range ${fmtM(r.lo)}–${fmtM(r.hi)})` : ''}<br>${esc(r.yr)}${r.logic ? '<br>' + esc(r.logic) : ''}<br>Confidence: ${esc(r.conf || '–')}`);
    });
    const yc = rows.length * rowH + 18;
    g.append('line').attr('x1', 0).attr('x2', w).attr('y1', yc - 12).attr('y2', yc - 12).attr('stroke', C('--line'));
    g.append('text').attr('x', 0).attr('y', yc).attr('font-size', 10.5).attr('fill', C('--grey')).text('FOR COMPARISON').attr('letter-spacing', '.06em');
    comp.forEach((c, i) => {
      const y0 = yc + 8 + i * cH;
      const by = narrow ? y0 + 18 : y0 + 6;
      g.append('text').attr('x', 0).attr('y', narrow ? y0 + 11 : y0 + 13).attr('font-size', 11).text(c.lab);
      g.append('rect').attr('x', x0).attr('y', by).attr('width', Math.max(2, x(c.v) - x0)).attr('height', 8).attr('fill', C('--grey'));
      g.append('text').attr('class', 'lab').attr('x', x(c.v) + 6).attr('y', by + 8).text(fmtM(c.v));
    });
  }
  reg(drawFunnel);

  /* =====================================================================
     Chapter 3a: regulatory timeline
     ===================================================================== */
  const ST_LABEL = { in_force: 'In force', planned: 'Planned', not_passed: 'Not passed', abolished: 'Abolished' };
  let regSel = null;
  function regDetail(it, lanes) {
    const el = $('m1-reg-detail'); if (!el || !it) return;
    const lane = (lanes.find((l) => l.id === it.lane) || {}).label || '';
    const d = pd(it.date);
    el.innerHTML = `<div class="m1-dh"><span class="grey">${d.toLocaleDateString('en-GB', it.month_only ? { month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short', year: 'numeric' })}</span><b>${esc(it.short)}</b><span class="m1-st ${it.status}">${ST_LABEL[it.status]}</span><span class="grey">${esc(lane)}</span></div>
      <p>${esc(it.what)}</p><p><strong>Impact on HEMS:</strong> ${esc(it.impact)}</p>`;
  }
  function marker(g, cx, cy, it, sel) {
    const ink = C('--ink');
    if (it.key) g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 10).attr('fill', C('--accent'));
    if (sel) g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 13).attr('fill', 'none').attr('stroke', ink).attr('stroke-width', 1.5);
    const c = g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 6);
    if (it.status === 'in_force') c.attr('fill', ink).attr('stroke', ink);
    else if (it.status === 'planned') c.attr('fill', C('--panel')).attr('stroke', ink).attr('stroke-width', 2).attr('stroke-dasharray', '2.5 1.5');
    else if (it.status === 'not_passed') {
      c.attr('fill', C('--panel')).attr('stroke', C('--bad')).attr('stroke-width', 2).attr('stroke-dasharray', '2.5 1.5');
      g.append('path').attr('d', `M${cx - 3},${cy - 3}L${cx + 3},${cy + 3}M${cx + 3},${cy - 3}L${cx - 3},${cy + 3}`).attr('stroke', C('--bad')).attr('stroke-width', 1.5);
    } else {
      c.attr('fill', C('--grey')).attr('stroke', C('--grey'));
      g.append('line').attr('x1', cx - 8).attr('x2', cx + 8).attr('y1', cy + 8).attr('y2', cy - 8).attr('stroke', C('--grey')).attr('stroke-width', 1.5);
    }
  }
  function drawRegulation() {
    const el = $('m1-reg'); if (!el) return;
    const D = X.m1_regulation; if (!D) { el.textContent = 'Regulation data missing (data/m1_regulation.json).'; return; }
    const lanes = D.lanes, items = D.items.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (!regSel) regSel = items.find((i) => i.short.includes('Modul 3')) || items[0];
    // legend
    const lg = $('m1-reg-legend');
    if (lg) {
      const ink = C('--ink');
      const sw = (inner) => `<svg width="18" height="18" viewBox="0 0 18 18">${inner}</svg>`;
      lg.innerHTML = [
        `<span>${sw(`<circle cx="9" cy="9" r="5.5" fill="${ink}"/>`)}In force</span>`,
        `<span>${sw(`<circle cx="9" cy="9" r="5" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="2.5 1.5"/>`)}Planned / draft in process</span>`,
        `<span>${sw(`<circle cx="9" cy="9" r="5" fill="none" stroke="${C('--bad')}" stroke-width="2" stroke-dasharray="2.5 1.5"/><path d="M6,6L12,12M12,6L6,12" stroke="${C('--bad')}" stroke-width="1.5"/>`)}Not passed</span>`,
        `<span>${sw(`<circle cx="9" cy="9" r="5.5" fill="${C('--grey')}"/><line x1="2" y1="16" x2="16" y2="2" stroke="${C('--grey')}" stroke-width="1.5"/>`)}Abolished</span>`,
        `<span>${sw(`<circle cx="9" cy="9" r="8.5" fill="${C('--accent')}"/><circle cx="9" cy="9" r="4.5" fill="${ink}"/>`)}Highlighted in this report</span>`,
      ].join('');
    }
    const w = width(el);
    const detail = $('m1-reg-detail');
    if (w < 720) {
      /* narrow: vertical list, complete at rest */
      if (detail) detail.hidden = true;
      let html = '<div class="m1-list">', yr = null;
      items.forEach((it) => {
        const y = it.date.slice(0, 4);
        if (y !== yr) { html += `<div class="m1-yr">${y}</div>`; yr = y; }
        const lane = (lanes.find((l) => l.id === it.lane) || {}).label || '';
        const d = pd(it.date);
        html += `<div class="m1-li${it.key ? ' m1-keyi' : ''}"><span class="m1-dot ${it.status}"></span><div>
          <div class="m1-meta">${d.toLocaleDateString('en-GB', it.month_only ? { month: 'short' } : { day: '2-digit', month: 'short' })} · ${esc(lane)} <span class="m1-st ${it.status}">${ST_LABEL[it.status]}</span></div>
          <b>${esc(it.short)}</b><p>${esc(it.impact)}</p></div></div>`;
      });
      el.innerHTML = html + '</div>';
      return;
    }
    if (detail) detail.hidden = false;
    const laneH = 50, m = { t: 42, r: 14, b: 8, l: 132 };
    const h = m.t + lanes.length * laneH + m.b;
    const svg = mkSvg(el, w, h, 'Regulatory timeline 2023-2029');
    const x = d3.scaleTime([pd('2023-01-01'), pd('2029-07-01')], [m.l, w - m.r]);
    const g = svg.append('g');
    for (let yv = 2023; yv <= 2029; yv++) {
      const xx = x(pd(`${yv}-01-01`));
      g.append('line').attr('x1', xx).attr('x2', xx).attr('y1', m.t - 8).attr('y2', h - m.b).attr('stroke', C('--line'));
      g.append('text').attr('class', 'ax').attr('fill', C('--grey')).attr('x', xx + 4).attr('y', m.t - 12).text(yv);
    }
    const today = pd(D.asof || '2026-11-25');
    g.append('rect').attr('x', x(today)).attr('y', m.t - 8).attr('width', x(pd('2029-07-01')) - x(today)).attr('height', h - m.b - m.t + 8).attr('fill', C('--panel-2')).attr('opacity', 0.55);
    g.append('line').attr('x1', x(today)).attr('x2', x(today)).attr('y1', 16).attr('y2', h - m.b).attr('stroke', C('--ink')).attr('stroke-width', 1.2);
    g.append('text').attr('class', 'lab-strong').attr('x', x(today)).attr('y', 11).attr('text-anchor', 'middle').text('Today (25 Nov 2026)');
    lanes.forEach((l, i) => {
      const yc = m.t + i * laneH + laneH / 2;
      g.append('line').attr('x1', 0).attr('x2', w - m.r).attr('y1', m.t + (i + 1) * laneH).attr('y2', m.t + (i + 1) * laneH).attr('stroke', C('--line'));
      g.append('text').attr('class', 'lab').attr('x', 0).attr('y', yc + 4).text(l.label);
    });
    const laneY = (id) => m.t + lanes.findIndex((l) => l.id === id) * laneH + laneH / 2;
    // spans: 65 % rule period; AgNes draft -> start
    const geg = items.find((i) => i.lane === 'heating' && i.status === 'abolished');
    const gm = items.find((i) => i.lane === 'heating' && i.status === 'in_force');
    if (geg && gm) g.append('line').attr('x1', x(pd(geg.date))).attr('x2', x(pd(gm.date))).attr('y1', laneY('heating')).attr('y2', laneY('heating')).attr('stroke', C('--grey')).attr('stroke-width', 2);
    const ag = items.filter((i) => i.short.startsWith('AgNes'));
    if (ag.length === 2) g.append('line').attr('x1', x(pd(ag[0].date))).attr('x2', x(pd(ag[1].date))).attr('y1', laneY('grid_fees_14a')).attr('y2', laneY('grid_fees_14a')).attr('stroke', C('--ink')).attr('stroke-width', 1.3).attr('stroke-dasharray', '4 3');
    // markers
    const mg = svg.append('g'), tg = svg.append('g');
    items.forEach((it) => marker(mg, x(pd(it.date)), laneY(it.lane), it, regSel === it));
    // labels: greedy, key items first; rows mid / above / below per lane
    const occ = {}; // lane -> row -> [[a,b]]
    const free = (lane, row, a, b) => !(occ[lane]?.[row] || []).some(([p, q]) => a < q + 4 && b > p - 4);
    const take = (lane, row, a, b) => { occ[lane] = occ[lane] || {}; (occ[lane][row] = occ[lane][row] || []).push([a, b]); };
    items.forEach((it) => { const cx = x(pd(it.date)); take(it.lane, 'mid', cx - 9, cx + 9); });
    lanes.forEach((l) => { // span lines occupy mid row
      if (l.id === 'heating' && geg && gm) take('heating', 'mid', x(pd(geg.date)), x(pd(gm.date)));
      if (l.id === 'grid_fees_14a' && ag.length === 2) take('grid_fees_14a', 'mid', x(pd(ag[0].date)), x(pd(ag[1].date)));
    });
    const order = items.slice().sort((a, b) => (b.key - a.key) || a.date.localeCompare(b.date));
    order.forEach((it) => {
      const cx = x(pd(it.date)), cy = laneY(it.lane);
      const t = tg.append('text').attr('class', it.key ? 'lab-strong' : 'lab').text(it.short);
      if (!it.key) t.attr('font-size', 11);
      const tw = t.node().getComputedTextLength();
      const opts = [];
      ['mid', 'above', 'below'].forEach((row) => {
        opts.push({ row, a: cx + 11, b: cx + 11 + tw, anchor: 'start', tx: cx + 11 });
        opts.push({ row, a: cx - 11 - tw, b: cx - 11, anchor: 'end', tx: cx - 11 });
      });
      // for above/below rows, labels may also start at marker x
      ['above', 'below'].forEach((row) => opts.push({ row, a: cx - 4, b: cx - 4 + tw, anchor: 'start', tx: cx - 4 }));
      const ok = opts.find((o) => o.a >= m.l - 2 && o.b <= w - 2 && free(it.lane, o.row, o.a, o.b));
      if (!ok) { t.remove(); return; }
      take(it.lane, ok.row, ok.a, ok.b);
      const ty = ok.row === 'mid' ? cy + 4 : ok.row === 'above' ? cy - 12 : cy + 20;
      t.attr('x', ok.tx).attr('y', ty).attr('text-anchor', ok.anchor);
      if (it.status === 'abolished') t.attr('fill', C('--grey'));
      if (it.status === 'not_passed') t.attr('fill', C('--bad'));
    });
    // hit targets
    items.forEach((it) => {
      const hit = svg.append('circle').attr('class', 'm1-svg-tap').attr('cx', x(pd(it.date))).attr('cy', laneY(it.lane)).attr('r', 14).attr('fill', 'transparent')
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', it.short);
      UI.bindTip(hit, () => `<b>${esc(it.short)}</b> · ${ST_LABEL[it.status]}<br>${esc(it.impact)}`);
      const pick = () => { regSel = it; drawRegulation(); };
      hit.on('click', pick).on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    });
    regDetail(regSel, lanes);
  }
  reg(drawRegulation);

  /* =====================================================================
     Chapter 3b: negative-price hours and daily spread
     ===================================================================== */
  let priceView = 'year';
  function drawPrices() {
    const el = $('m1-prices'); if (!el) return;
    const segEl = $('m1-price-view');
    if (segEl && !segEl.dataset.bound) {
      segEl.dataset.bound = '1';
      segEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        priceView = b.dataset.v; segEl.querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); drawPrices();
      }));
    }
    const w = width(el);
    const neg = rser('negative_price_hours_de').points || [], spr = rser('dayahead_avg_daily_spread_de').points || [];
    const mean = rser('dayahead_mean_price_de').points || [];
    const m = { l: 44, r: 12 };
    if (priceView === 'month') {
      const m25 = rser('negative_price_hours_de_monthly_2025').points || [], m26 = rser('negative_price_hours_de_monthly_2026').points || [];
      const h = 260, t = 34, b = 24;
      const svg = mkSvg(el, w, h, 'Negative price hours by month 2025 vs 2026');
      const x = d3.scaleBand(d3.range(1, 13), [m.l, w - m.r]).padding(0.25);
      const xi = d3.scaleBand(['2025', '2026'], [0, x.bandwidth()]).padding(0.08);
      const y = d3.scaleLinear([0, 150], [h - b, t]);
      const g = svg.append('g');
      yGrid(g, y, m.l, w - m.r, [0, 50, 100, 150], (v) => v + ' h');
      const mn = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      const mnL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      d3.range(1, 13).forEach((mm) => g.append('text').attr('class', 'ax').attr('fill', C('--grey')).attr('x', x(mm) + x.bandwidth() / 2).attr('y', h - 6).attr('text-anchor', 'middle').text(w < 520 ? mn[mm - 1] : mnL[mm - 1]));
      [['2025', m25, C('--grey')], ['2026', m26, C('--ink')]].forEach(([yr, P, col]) => {
        P.forEach((p) => {
          const r = g.append('rect').attr('x', x(p.month) + xi(yr)).attr('width', xi.bandwidth()).attr('y', y(p.value)).attr('height', y(0) - y(p.value)).attr('fill', col);
          if (yr === '2026' && p.month === 11) r.attr('fill', hatch(svg, C('--ink'))).attr('stroke', C('--ink')).attr('height', Math.max(1, y(0) - y(p.value)));
          UI.bindTip(r, () => `<b>${mnL[p.month - 1]} ${yr}</b>: ${p.value} h negative${yr === '2026' && p.month === 11 ? ' (to 24 Nov)' : ''}`);
        });
      });
      const lbl = (yr, mm, val) => g.append('text').attr('class', 'lab').attr('x', x(mm) + xi(yr) + xi.bandwidth() / 2).attr('y', y(val) - 4).attr('text-anchor', 'middle').attr('font-size', 10.5).text(val);
      lbl('2025', 6, 141); lbl('2026', 4, 123);
      if (!m26.find((p) => p.month === 12)) g.append('text').attr('x', x(12) + x.bandwidth() * 0.75).attr('y', y(0) - 4).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', C('--grey')).text('n/a');
      const lg = svg.append('g').attr('transform', `translate(${m.l},10)`);
      [['2025 (576 h)', C('--grey')], ['2026 to 24 Nov (475 h)', C('--ink')]].forEach(([t2, col], i) => {
        lg.append('rect').attr('x', i * 140).attr('y', 0).attr('width', 10).attr('height', 10).attr('fill', col);
        lg.append('text').attr('x', i * 140 + 15).attr('y', 9).attr('font-size', 11).text(t2);
      });
      return;
    }
    // annual view: two stacked panels sharing x (no dual axis)
    const h1 = 170, h2 = 150, gap = 26, top = 22;
    const h = top + h1 + gap + h2 + 22;
    const svg = mkSvg(el, w, h, 'Negative price hours and daily spread 2019-2026');
    const hp = hatch(svg, C('--ink'));
    const years = neg.map((p) => p.year);
    const x = d3.scaleBand(years, [m.l, w - m.r]).padding(0.3);
    const cx = (yr) => x(yr) + x.bandwidth() / 2;
    const yN = d3.scaleLinear([0, 650], [top + h1, top + 14]);
    const g = svg.append('g');
    g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', 12).text('Hours with negative day-ahead price');
    yGrid(g, yN, m.l, w - m.r, [0, 200, 400, 600], (v) => v + ' h');
    const maxN = d3.max(neg, (p) => p.value), minN = d3.min(neg, (p) => p.value);
    neg.forEach((p) => {
      const ytd = !!p.note;
      const r = g.append('rect').attr('x', x(p.year)).attr('width', x.bandwidth()).attr('y', yN(p.value)).attr('height', yN(0) - yN(p.value))
        .attr('fill', ytd ? hp : C('--ink')).attr('stroke', ytd ? C('--ink') : null);
      UI.bindTip(r, () => `<b>${p.year}${ytd ? ' (01.01.–24.11.)' : ''}</b>: ${p.value} h with negative price${(pt({ points: mean }, p.year) || {}).value ? '<br>Mean price: €' + pt({ points: mean }, p.year).value.toFixed(1) + '/MWh' : ''}`);
      if (p.value === maxN || p.value === minN || p.year >= 2024 || p.year === 2019) {
        g.append('text').attr('class', 'lab').attr('x', cx(p.year)).attr('y', yN(p.value) - 5).attr('text-anchor', 'middle').attr('font-size', 10.5).text(p.value + (ytd ? ' YTD' : ''));
      }
    });
    // spread panel
    const t2 = top + h1 + gap;
    const yS = d3.scaleLinear([0, 200], [t2 + h2, t2 + 16]);
    g.append('text').attr('class', 'lab-strong').attr('x', 0).attr('y', t2 + 2).text('Average daily spread (max − min hourly price), €/MWh');
    yGrid(g, yS, m.l, w - m.r, [0, 100, 200], (v) => '€' + v);
    const line = d3.line().x((p) => cx(p.year)).y((p) => yS(p.value));
    const early = spr.filter((p) => p.year <= 2023), late = spr.filter((p) => p.year >= 2023);
    g.append('path').attr('d', line(early)).attr('fill', 'none').attr('stroke', C('--grey')).attr('stroke-width', 1.6);
    g.append('path').attr('d', line(late)).attr('fill', 'none').attr('stroke', C('--ink')).attr('stroke-width', 2.5);
    spr.forEach((p) => {
      const ytd = !!p.note;
      const c = g.append('circle').attr('cx', cx(p.year)).attr('cy', yS(p.value)).attr('r', 4.5)
        .attr('fill', ytd ? C('--panel') : (p.year >= 2023 ? C('--ink') : C('--grey'))).attr('stroke', ytd ? C('--ink') : C('--panel')).attr('stroke-width', 2);
      const hit = g.append('circle').attr('cx', cx(p.year)).attr('cy', yS(p.value)).attr('r', 12).attr('fill', 'transparent');
      UI.bindTip(hit, () => `<b>${p.year}${ytd ? ' (01.01.–24.11.)' : ''}</b>: average daily spread €${p.value.toFixed(1)}/MWh`);
      void c;
      if ([2019, 2022, 2023, 2025, 2026].includes(p.year)) {
        const below = p.year === 2023;
        g.append('text').attr('class', p.year === 2026 ? 'lab-strong' : 'lab').attr('x', cx(p.year)).attr('y', below ? yS(p.value) + 17 : yS(p.value) - 9).attr('text-anchor', 'middle').attr('font-size', 10.5)
          .text('€' + Math.round(p.value) + (p.year === 2022 && w > 520 ? ' (gas crisis)' : ''));
      }
    });
    const s23 = pt({ points: spr }, 2023), s26 = pt({ points: spr }, 2026);
    if (s23 && s26 && w > 420) {
      g.append('text').attr('x', cx(2024)).attr('y', yS(s26.value) - 8).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', C('--ink'))
        .text(`+${Math.round((s26.value / s23.value - 1) * 100)} % since 2023`);
    }
    years.forEach((yr) => g.append('text').attr('class', 'ax').attr('fill', C('--grey')).attr('x', cx(yr)).attr('y', h - 4).attr('text-anchor', 'middle').text(yr === 2026 ? (w < 460 ? "'26*" : '2026*') : (w < 460 ? "'" + String(yr).slice(2) : yr)));
  }
  reg(drawPrices);

  draws.forEach((f) => f());
})();

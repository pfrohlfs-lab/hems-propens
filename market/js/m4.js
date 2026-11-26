/* m4: chapter 7 (white spaces) and appendix.
   Data: MD.extra.m4_positioning, MD.extra.m4_niches, MD.extra.m4_factcheck (curated, see their "derivation"). */
(function () {
  'use strict';
  const MD = window.MD, UI = window.UI, d3 = window.d3;
  if (!MD || !UI || !d3) return;
  const X = MD.extra || {};
  const C = (t) => UI.css(t) || '#888';
  const $ = (id) => document.getElementById(id);
  const esc = UI.esc;
  const widthOf = (el) => Math.max(280, Math.floor(el.getBoundingClientRect().width || el.clientWidth || 640));

  function mkSvg(el, w, h, label) {
    el.innerHTML = '';
    return d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%')
      .attr('role', 'img').attr('aria-label', label).style('height', 'auto');
  }
  /* shared.css styles 'svg text' (fill, font-size), which beats presentation attributes:
     copy fill / font-size / font-weight attributes into inline style after drawing */
  function fixText(root) {
    d3.select(root).selectAll('text, tspan').each(function () {
      ['fill', 'font-size', 'font-weight'].forEach((a) => { const v = this.getAttribute(a); if (v != null) this.style.setProperty(a, /^[0-9.]+$/.test(v) && a === 'font-size' ? v + 'px' : v); });
    });
  }
  /* text width via a hidden measuring svg (falls back to an estimate) */
  let meas = null;
  function tw(s, size, weight) {
    try {
      if (!meas) {
        meas = d3.select('body').append('svg').attr('aria-hidden', 'true')
          .style('position', 'absolute').style('left', '-9999px').style('top', '0').style('width', '10px').style('height', '10px');
        meas.append('text');
      }
      const t = meas.select('text').style('font-size', size + 'px').style('font-weight', weight || 400).style('font-family', 'var(--sans)').text(s);
      const w = t.node().getComputedTextLength();
      if (w > 0) return w;
    } catch (e) { /* ignore */ }
    return String(s).length * size * 0.56;
  }
  /* wrap a string into lines of max width */
  function wrap(s, maxW, size, weight) {
    const words = String(s).split(' '); const lines = []; let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (tw(t, size, weight) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }

  /* ================= Exhibit: positioning matrix ================= */
  const SHORT = { 'Consolinno Leaflet': 'Consolinno', 'gridX XENON': 'gridX', 'Kiwigrid KiwiOS': 'Kiwigrid', 'SMA Sunny Home Manager': 'SMA SHM',
    'Intelligent Octopus': 'Octopus', '1KOMMA5° Heartbeat': '1KOMMA5°', 'Solar Manager': 'Solar Mgr.', 'thermondo smart': 'thermondo',
    'Consolinno FlexA for homes': 'FlexA (ann.)', 'Flexibility Manager': 'Flex Manager' };
  let selId = 'ours';

  function posLegend(P) {
    const el = $('m4-pos-legend'); if (!el) return;
    const used = [...new Set(P.players.filter((p) => !p.ours).map((p) => p.arch))];
    const arch = UI.ARCH.filter((a) => used.includes(a.id));
    const dot = (fill, stroke, extra) => `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${extra || ''}<circle cx="8" cy="8" r="4.5" fill="${fill}" stroke="${stroke}" /></svg>`;
    const ink = C('--ink'), grey = C('--grey');
    el.innerHTML = arch.map((a) => `<span><i style="background:${C(a.tok)}"></i>${esc(a.short)}</span>`).join('') +
      `<span>${dot(grey, 'none', `<circle cx="8" cy="8" r="7" fill="none" stroke="${ink}" stroke-width="1"/>`)}Ring: acts on §14a or VPP signals</span>` +
      `<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="${ink}" stroke-width="1"/><path d="M8 3 A5 5 0 0 1 8 13 Z" fill="${ink}"/></svg>Heat side only partly</span>` +
      `<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="${ink}" stroke-width="1.2" stroke-dasharray="2 2"/></svg>Announced, not shipped</span>` +
      `<span><i style="background:${C('--accent')};outline:1px solid ${ink}"></i>Our prototype</span>`;
  }

  function posDetail(P) {
    const el = $('m4-pos-detail'); if (!el) return;
    const p = P.players.find((q) => q.id === selId) || P.players.find((q) => q.ours);
    const conf = p.confidence === 'prototype' ? '<span class="conf">prototype</span>' : UI.conf(p.confidence);
    const tag = p.announced ? ' <span class="conf low">announced 2026</span>' : '';
    el.innerHTML = `<div class="m4-dh"><b>${esc(p.name)}</b>${conf}${tag}<span class="muted" style="font-size:12px">${esc(P.axes.x[p.x - 1])} · ${esc(P.axes.y[p.y - 1])}</span></div>
      <dl><dt>Assets optimised</dt><dd>${esc(p.why_x)}</dd><dt>Plan and grid</dt><dd>${esc(p.why_y)}</dd><dt>Grid signals</dt><dd>${esc(p.signal)}</dd><dt>Source</dt><dd>${esc(p.source)}</dd></dl>
      <span class="m4-hint">Click or tap another product to compare.</span>`;
  }

  function drawPositioning() {
    const el = $('m4-pos'); const P = X.m4_positioning;
    if (!el || !P) return;
    posLegend(P);
    const W = widthOf(el);
    const narrow = W < 640;
    const ink = C('--ink'), muted = C('--muted'), grey = C('--grey'), line = C('--line'), bg = C('--bg'), acc = C('--accent'), accInk = C('--accent-ink');
    const LW = narrow ? 0 : Math.min(170, Math.round(W * 0.16));
    const TOP = narrow ? 34 : 22;            // y-axis title (desktop) / column headers (narrow)
    const BOT = narrow ? 18 : 58;            // x-axis labels (desktop)
    const colW = (W - LW) / 3;
    const fs = narrow ? 10.5 : 12.5;
    const chipH = narrow ? 20 : 26;
    const padX = narrow ? 6 : 10, padTop = narrow ? 8 : 12, padBot = 10;
    const rowBand = narrow ? 18 : 0;         // row label band in narrow mode

    /* chips per cell, laid out left to right with wrap */
    const placed = P.players;
    const cells = {};
    placed.forEach((p) => { const k = p.x + '-' + p.y; (cells[k] = cells[k] || []).push(p); });
    const order = (a, b) => (b.ours ? -1 : 0) || (a.heat_partial === b.heat_partial ? 0 : a.heat_partial ? 1 : -1) || 0;
    const lay = {};
    Object.entries(cells).forEach(([k, list]) => {
      const froms = new Set(P.players.filter((q) => q.from).map((q) => q.from));
      list.sort((a, b) => (froms.has(b.id) ? 1 : 0) - (froms.has(a.id) ? 1 : 0) || order(a, b));
      const maxW = colW - 2 * padX;
      let cx = 0, cy = 0;
      lay[k] = list.map((p) => {
        let label = p.name + (p.announced ? ' (announced)' : '') + (p.ours ? ' (prototype)' : '');
        const lw = (s) => tw(s, fs, p.ours ? 600 : 400);
        if (18 + lw(label) + 6 > maxW || narrow) label = SHORT[p.name] ? SHORT[p.name] + (p.ours && !narrow ? ' (prototype)' : '') : label;
        if (18 + lw(label) + 6 > maxW) label = SHORT[p.name] || label;
        const w = Math.min(maxW, 18 + lw(label) + (p.heat_partial ? 16 : 6) + (p.ours ? 8 : 0));
        if (cx > 0 && cx + w > maxW) { cx = 0; cy += chipH; }
        const o = { p, label, x: cx, y: cy, w };
        cx += w + 8;
        return o;
      });
    });
    const rowsH = [1, 2, 3].map((y) => {
      let m = 0;
      [1, 2, 3].forEach((x) => { const l = lay[x + '-' + y]; if (l) m = Math.max(m, l[l.length - 1].y + chipH); });
      return Math.max(narrow ? 56 : 92, rowBand + padTop + m + padBot + (y === 3 ? 0 : 0));
    });
    const H = TOP + rowsH[0] + rowsH[1] + rowsH[2] + BOT;
    const rowY = { 3: TOP, 2: TOP + rowsH[2], 1: TOP + rowsH[2] + rowsH[1] };
    const rowHt = { 1: rowsH[0], 2: rowsH[1], 3: rowsH[2] };
    const colX = (x) => LW + (x - 1) * colW;

    const svg = mkSvg(el, W, H, 'Positioning matrix of HEMS products: breadth of jointly optimised assets against grid orientation and transparency');
    const defs = svg.append('defs');
    defs.append('marker').attr('id', 'm4-arr').attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5)
      .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto-start-reverse')
      .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', ink);
    const hatch = defs.append('pattern').attr('id', 'm4-ws').attr('patternUnits', 'userSpaceOnUse').attr('width', 7).attr('height', 7).attr('patternTransform', 'rotate(45)');
    hatch.append('rect').attr('width', 7).attr('height', 7).attr('fill', bg);
    hatch.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 7).attr('stroke', acc).attr('stroke-width', 2.2).attr('opacity', 0.45);

    /* cells */
    const g = svg.append('g');
    [1, 2, 3].forEach((y) => [1, 2, 3].forEach((x) => {
      const ws = x === 3 || y === 3;
      g.append('rect').attr('x', colX(x) + 1).attr('y', rowY[y] + rowBand + 1).attr('width', colW - 2).attr('height', rowHt[y] - rowBand - 2)
        .attr('fill', ws ? 'url(#m4-ws)' : bg).attr('stroke', ws ? acc : line).attr('stroke-width', ws ? 1 : 1);
      const list = lay[x + '-' + y];
      if (!list) {
        g.append('text').attr('x', colX(x) + colW / 2).attr('y', rowY[y] + rowBand + (rowHt[y] - rowBand) / 2 + 4).attr('text-anchor', 'middle')
          .attr('font-size', narrow ? 10 : 11).attr('fill', grey).style('font-style', 'italic').text('none found');
      }
    }));
    /* white-space label */
    if (!narrow) {
      g.append('text').attr('x', colX(3) + colW - 10).attr('y', rowY[3] + rowHt[3] - 10).attr('text-anchor', 'end').attr('class', 'lab-strong')
        .attr('font-size', 11).text('White space: no product on sale');
    }

    /* row labels */
    const yl = P.axes.y;
    [1, 2, 3].forEach((y) => {
      if (narrow) {
        svg.append('text').attr('x', 4).attr('y', rowY[y] + 13).attr('font-size', 10).attr('fill', muted)
          .attr('font-weight', 500).text(`${y} · ${yl[y - 1]}`);
      } else {
        const lines = wrap(yl[y - 1], LW - 18, 12, 500);
        const cy = rowY[y] + rowHt[y] / 2 - (lines.length - 1) * 7.5;
        svg.append('text').attr('x', LW - 12).attr('y', cy - 8).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', grey).text(`Level ${y}`);
        lines.forEach((l, i) => svg.append('text').attr('x', LW - 12).attr('y', cy + 8 + i * 15).attr('text-anchor', 'end').attr('class', 'lab').attr('font-size', 12).text(l));
      }
    });
    /* column labels */
    const xl = P.axes.x;
    [1, 2, 3].forEach((x) => {
      if (narrow) {
        const lines = wrap(xl[x - 1], colW - 6, 10, 500);
        lines.slice(0, 2).forEach((l, i) => svg.append('text').attr('x', colX(x) + colW / 2).attr('y', 11 + i * 12).attr('text-anchor', 'middle')
          .attr('font-size', 10).attr('fill', muted).attr('font-weight', 500).text(l));
      } else {
        svg.append('text').attr('x', colX(x) + colW / 2).attr('y', TOP + rowsH[0] + rowsH[1] + rowsH[2] + 18).attr('text-anchor', 'middle').attr('class', 'lab').attr('font-size', 12).text(xl[x - 1]);
      }
    });
    if (!narrow) {
      const by = H - 14;
      svg.append('line').attr('x1', LW).attr('x2', W - 4).attr('y1', by - 4).attr('y2', by - 4).attr('stroke', ink).attr('marker-end', 'url(#m4-arr)');
      svg.append('text').attr('x', LW).attr('y', by + 10).attr('font-size', 11).attr('fill', muted).text('Breadth of assets optimised together against price');
      svg.append('text').attr('x', LW).attr('y', 13).attr('font-size', 11).attr('fill', muted).text('↑ Grid orientation and transparency of the plan');
    } else {
      svg.append('text').attr('x', W).attr('y', H - 4).attr('text-anchor', 'end').attr('font-size', 9.5).attr('fill', grey).text('x: assets optimised together · y: plan transparency');
    }

    /* chips */
    const pos = {};
    const chips = svg.append('g');
    Object.entries(lay).forEach(([k, list]) => {
      const [x, y] = k.split('-').map(Number);
      list.forEach((o) => {
        const p = o.p;
        const gx = colX(x) + padX + o.x, gy = rowY[y] + rowBand + padTop + o.y;
        const cg = chips.append('g').attr('class', 'm4-chip').attr('transform', `translate(${gx},${gy})`)
          .attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${p.name}: ${xl[p.x - 1]}, ${yl[p.y - 1]}`).datum(p);
        const cyy = chipH / 2;
        pos[p.id] = { x: gx, y: gy + cyy, w: o.w };
        if (p.ours) {
          cg.append('rect').attr('x', -4).attr('y', 1).attr('width', o.w + 4).attr('height', chipH - 2).attr('fill', acc).attr('stroke', ink).attr('stroke-width', 1);
        }
        cg.append('rect').attr('class', 'm4-hit').attr('x', -3).attr('y', 1).attr('width', o.w + 2).attr('height', chipH - 2).attr('fill', 'transparent')
          .attr('stroke', p.id === selId && !p.ours ? ink : 'none').attr('stroke-dasharray', p.id === selId ? '2 2' : null);
        const col = p.ours ? ink : UI.archColor(p.arch);
        if (p.grid_signal) cg.append('circle').attr('cx', 7).attr('cy', cyy).attr('r', 7).attr('fill', 'none').attr('stroke', p.ours ? accInk : ink).attr('stroke-width', 1);
        if (p.announced) {
          cg.append('circle').attr('cx', 7).attr('cy', cyy).attr('r', 4.5).attr('fill', bg).attr('stroke', col).attr('stroke-width', 1.4).attr('stroke-dasharray', '2 1.6');
        } else {
          cg.append('circle').attr('cx', 7).attr('cy', cyy).attr('r', 4.5).attr('fill', p.ours ? accInk : col);
        }
        const t = cg.append('text').attr('x', 18).attr('y', cyy + 4).attr('font-size', fs)
          .attr('fill', p.ours ? accInk : ink).attr('font-weight', p.ours ? 600 : 400).text(o.label);
        if (p.announced) t.attr('fill', muted).style('font-style', 'italic');
        if (p.heat_partial) {
          const hx = 18 + tw(o.label, fs) + 9;
          cg.append('circle').attr('cx', hx).attr('cy', cyy).attr('r', 4.5).attr('fill', 'none').attr('stroke', ink).attr('stroke-width', 1);
          cg.append('path').attr('d', `M${hx} ${cyy - 4.5} A4.5 4.5 0 0 1 ${hx} ${cyy + 4.5} Z`).attr('fill', ink);
        }
      });
    });

    /* FlexA arrow: from Consolinno Leaflet to the announced position */
    const fa = P.players.find((p) => p.announced);
    if (fa && pos[fa.from] && pos[fa.id]) {
      const a = pos[fa.from], b = pos[fa.id];
      const x1 = a.x + Math.min(a.w, 60) / 2 + 6, y1 = a.y - 8, x2 = b.x + 2, y2 = b.y + 9;
      const mx = (x1 + x2) / 2, my = Math.min(y1, y2) + (Math.abs(y2 - y1)) * 0.25;
      const ys = a.y - chipH / 2 + 1;
      const dPath = narrow ? `M${x1},${y1} Q${mx - 20},${my} ${x2},${y2}`
        : `M${x1},${ys} C${x1 + 120},${ys - 4} ${x2 - 50},${ys - 12} ${x2},${y2}`;
      svg.append('path').attr('d', dPath).attr('fill', 'none').attr('stroke', ink)
        .attr('stroke-width', 1.2).attr('stroke-dasharray', '4 3').attr('marker-end', 'url(#m4-arr)').style('pointer-events', 'none');
      if (!narrow) {
        svg.append('text').attr('x', b.x + 18).attr('y', b.y + chipH / 2 + 12).attr('font-size', 10.5).attr('fill', muted)
          .text('24–48 h plans announced 01/2026');
      }
    }

    const sel = chips.selectAll('.m4-chip');
    UI.bindTip(sel, (p) => `<b>${esc(p.name)}</b>${p.announced ? ' (announced)' : ''}<br>${esc(xl[p.x - 1])} · ${esc(yl[p.y - 1])}<br><span style="opacity:.8">${esc(p.why_y)}</span>`);
    const pick = (ev, p) => { selId = p.id; posDetail(P); sel.select('rect.m4-hit').attr('stroke', (q) => (q.id === selId && !q.ours ? ink : 'none')).attr('stroke-dasharray', '2 2'); };
    sel.on('click', pick).on('keydown', (ev, p) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(ev, p); } });
    fixText(el);
    posDetail(P);
  }

  /* ================= Exhibit: niches table ================= */
  function harvey(score, low) {
    const ink = C('--ink'), bg = C('--bg');
    const r = 7, cx = 8, cy = 8; const f = Math.max(0, Math.min(4, score)) / 4;
    let path = '';
    if (f >= 1) path = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/>`;
    else if (f > 0) {
      const a = f * 2 * Math.PI, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
      path = `<path d="M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)} Z" fill="${ink}"/>`;
    }
    return `<svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-label="${score} of 4"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${ink}" stroke-width="1"${low ? ' stroke-dasharray="2 1.5"' : ''}/>${path}</svg>`;
  }
  function drawNiches() {
    const el = $('m4-niches'); const N = X.m4_niches;
    if (!el || !N) return;
    const crit = N.criteria;
    const head = `<thead><tr><th>Niche (priority)</th>${crit.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th>Verdict</th></tr></thead>`;
    const rows = N.niches.slice().sort((a, b) => a.rank - b.rank).map((n, i) => {
      const cells = crit.map((c) => {
        const v = n[c.id] || {};
        return `<td data-l="${esc(c.label)}"><div class="m4-hv">${harvey(v.score, v.low)}<span>${esc(v.text)}${v.low ? '<span class="m4-est">est.</span>' : ''}</span></div></td>`;
      }).join('');
      const vd = String(n.verdict); const ix = vd.indexOf(':');
      const verdict = ix > 0 ? `<b>${esc(vd.slice(0, ix))}:</b>${esc(vd.slice(ix + 1))}` : esc(vd);
      return `<tr class="${i === 0 ? 'm4-first' : ''}"><td class="m4-nn"><span class="m4-rk">${n.rank}</span><b>${esc(n.name)}</b><span class="m4-role">${esc(n.role)}</span></td>${cells}<td class="m4-vd" data-l="Verdict">${verdict}</td></tr>`;
    }).join('');
    el.innerHTML = `<table class="t m4-nt">${head}<tbody>${rows}</tbody></table>`;
    const r = $('m4-reco');
    if (r) r.innerHTML = `<span>Recommendation</span><div>${esc(N.recommendation)}</div>`;
  }

  /* ================= Exhibit: fact-check outcome ================= */
  function drawFactcheck() {
    const el = $('m4-fc'); const F = X.m4_factcheck;
    if (!el || !F) return;
    const W = widthOf(el);
    const narrow = W < 560;
    const ink = C('--ink'), muted = C('--muted'), grey = C('--grey'), bg = C('--bg'), bad = C('--bad');
    const KEYS = [
      { k: 'confirmed', l: 'Confirmed', fill: ink, txt: bg },
      { k: 'corrected', l: 'Corrected', fill: grey, txt: bg },
      { k: 'unverifiable', l: 'Unverifiable (kept, low confidence)', fill: 'none', txt: ink, dash: true },
      { k: 'refuted', l: 'Refuted (removed)', fill: bad, txt: bg },
    ];
    const rows = F.streams.slice().sort((a, b) => b.confirmed / b.n - a.confirmed / a.n);
    rows.push({ label: 'All streams', used_in: '', ...F.total, total: true });
    const LW = narrow ? 0 : 190, RW = 48, bh = 16, gap = narrow ? 34 : 12, top = 30;
    const H = top + rows.length * (bh + gap) + 8 + 6;
    const svg = mkSvg(el, W, H, 'Fact-check verdicts per research stream');
    const maxN = d3.max(rows.filter((r) => !r.total), (r) => r.n);
    const x = d3.scaleLinear().domain([0, maxN]).range([0, W - LW - RW]);
    /* key */
    let kx = 0;
    KEYS.forEach((k) => {
      const g = svg.append('g').attr('transform', `translate(${kx},6)`);
      g.append('rect').attr('width', 10).attr('height', 10).attr('fill', k.fill === 'none' ? bg : k.fill).attr('stroke', k.dash ? ink : 'none').attr('stroke-dasharray', k.dash ? '2 2' : null);
      const label = narrow ? k.l.replace(' (kept, low confidence)', '').replace(' (removed)', '') : k.l;
      g.append('text').attr('x', 15).attr('y', 9).attr('font-size', 11).attr('fill', muted).text(label);
      kx += 15 + tw(label, 11) + 16;
    });
    rows.forEach((r, i) => {
      const y = top + i * (bh + gap) + (narrow ? 16 : 0) + (r.total ? 8 : 0);
      if (r.total) svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y - (narrow ? 22 : 7)).attr('y2', y - (narrow ? 22 : 7)).attr('stroke', ink);
      const lx = narrow ? 0 : LW - 10, ly = narrow ? y - 5 : y + 12;
      const t = svg.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', narrow ? 'start' : 'end').attr('font-size', 12)
        .attr('fill', ink).attr('font-weight', r.total ? 600 : 400).text(r.label);
      if (r.used_in && !narrow) t.append('tspan').attr('fill', grey).attr('font-size', 10.5).text('  ' + r.used_in);
      const sx = r.total ? d3.scaleLinear().domain([0, r.n]).range([0, W - LW - RW]) : x;
      let cx = LW;
      KEYS.forEach((k) => {
        const v = r[k.k] || 0; if (!v) return;
        const w = sx(v);
        const rect = svg.append('rect').attr('x', cx + 0.5).attr('y', y).attr('width', Math.max(1, w - 1)).attr('height', bh)
          .attr('fill', k.fill === 'none' ? bg : k.fill).attr('stroke', k.dash ? ink : 'none').attr('stroke-dasharray', k.dash ? '2 2' : null)
          .datum({ r, k, v });
        UI.bindTip(rect, (d) => `<b>${esc(d.r.label)}</b><br>${esc(d.k.l)}: ${d.v} of ${d.r.n} claims (${Math.round((d.v / d.r.n) * 100)} %)`);
        if (w > 18) svg.append('text').attr('x', cx + w / 2).attr('y', y + 12).attr('text-anchor', 'middle').attr('font-size', 10.5)
          .attr('fill', k.txt).style('pointer-events', 'none').text(v);
        cx += w;
      });
      svg.append('text').attr('x', W).attr('y', y + 12).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', r.total ? ink : muted)
        .attr('font-weight', r.total ? 600 : 400).text(`n = ${r.n}`);
    });
    fixText(el);
    if (!rows.length) el.textContent = 'No data';
  }

  function all() {
    try { drawPositioning(); } catch (e) { console.error('m4 positioning', e); }
    try { drawNiches(); } catch (e) { console.error('m4 niches', e); }
    try { drawFactcheck(); } catch (e) { console.error('m4 factcheck', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
  UI.onTheme(all);
  
  /* public build: the summary (#m0-loss) repeats the loss count of the profit chart (#m3-pr-title, computed by m3.js from the filtered data) */
  try { const t = $('m3-pr-title'), o = $('m0-loss'), m = t && /^(\d+) of (\d+)/.exec(t.textContent); if (o && m) o.textContent = `${m[1]} of ${m[2]}`; } catch (e) { console.error('m4 summary count', e); }
  
})();

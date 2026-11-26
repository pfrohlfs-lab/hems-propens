/* Part m2: chapter 4 "Competitive landscape".
   (a) market-entry map + timeline, (b) company-size bubbles, (c) feature heatmap, (d) strategic groups.
   Data: window.MD (r.entrants_timeline, r.company_size, r.business_models, matrix, map, extra.m2_*). */
(function () {
  'use strict';
  if (!window.MD || !window.UI || !window.d3) return;
  const MD = window.MD, UI = window.UI, d3 = window.d3;
  const X = MD.extra || {};
  const esc = UI.esc, fmt = UI.fmt;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = (t) => UI.css(t);
  const archLabel = (id) => (UI.archById[id] ? UI.archById[id].label : 'Other / not matched');
  const archShort = (id) => (UI.archById[id] ? UI.archById[id].short : 'Other');
  const archTok = (id) => (UI.archById[id] ? UI.archById[id].tok : '--grey');
  const ARCH_IDS = UI.ARCH.map((a) => a.id);

  /* text measuring for label placement */
  const ctx = document.createElement('canvas').getContext('2d');
  function textW(s, size = 11, weight = 400) {
    ctx.font = `${weight} ${size}px Geist, ui-sans-serif, system-ui, sans-serif`;
    return ctx.measureText(s).width;
  }
  /* greedy label placer: items {x,y,r,text,size,weight,force}; returns placed with lx,ly,anchor */
  function placeLabels(items, bounds, obstacles = []) {
    const boxes = obstacles.map((o) => ({ x0: o.x - o.r, y0: o.y - o.r, x1: o.x + o.r, y1: o.y + o.r }));
    const hit = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    const out = [];
    items.forEach((it) => {
      const w = textW(it.text, it.size || 11, it.weight || 400), h = (it.size || 11) + 2, g = it.r + 3;
      const cands = [
        [it.x + g, it.y + h / 2 - 2, 'start'], [it.x - g, it.y + h / 2 - 2, 'end'],
        [it.x, it.y - g - 2, 'middle'], [it.x, it.y + g + h - 2, 'middle'],
        [it.x + g - 2, it.y - g, 'start'], [it.x - g + 2, it.y - g, 'end'],
        [it.x + g - 2, it.y + g + h - 4, 'start'], [it.x - g + 2, it.y + g + h - 4, 'end'],
      ];
      let chosen = null;
      for (const [lx, ly, a] of cands) {
        const x0 = a === 'start' ? lx : a === 'end' ? lx - w : lx - w / 2;
        const b = { x0: x0 - 1, y0: ly - h + 2, x1: x0 + w + 1, y1: ly + 2 };
        if (b.x0 < bounds.x0 || b.x1 > bounds.x1 || b.y0 < bounds.y0 || b.y1 > bounds.y1) continue;
        if (hit(b)) continue;
        chosen = { lx, ly, anchor: a, b }; break;
      }
      if (!chosen && it.force) {
        const [lx, ly, a] = it.x + g + w < bounds.x1 ? cands[0] : cands[1];
        const x0 = a === 'start' ? lx : lx - w;
        chosen = { lx, ly, anchor: a, b: { x0, y0: ly - h + 2, x1: x0 + w, y1: ly + 2 } };
      }
      if (chosen) { boxes.push(chosen.b); out.push(Object.assign({}, it, chosen)); }
    });
    return out;
  }
  function segBind(el, onChange) {
    if (!el) return;
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-v]'); if (!b) return;
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange(b.dataset.v);
    });
  }
  const confNote = (c) => (c ? ` ${UI.conf(c)}` : '');

  /* =====================================================================================
     (a) Market-entry map + timeline
     ===================================================================================== */
  const ET = MD.r.entrants_timeline || { providers: [], events: [] };
  const MOVES = (X.m2_moves && X.m2_moves.moves) || [];
  const YEARS = d3.range(2011, 2027);
  const state = { year: 2026, filter: new Set(ARCH_IDS), playing: false, timer: null, hi: null, unkOpen: false };
  const provs = ET.providers.map((p, i) => Object.assign({ i }, p));
  const movesBy = d3.group(MOVES.filter((m) => m.provider), (m) => m.provider);
  const zolar = MOVES.filter((m) => !m.provider);
  const KEY_MAP = new Set(['gridX GmbH', 'Consolinno Energy GmbH', 'sonnen GmbH', 'SMA Solar Technology AG', '1KOMMA5°', 'Enpal', 'Kiwigrid GmbH',
    'E.ON (E.ON Home)', 'SENEC GmbH', 'E3/DC (Hager Group)', 'Viessmann Climate Solutions', 'Fronius International GmbH', 'Solar Manager AG',
    'tado GmbH', 'Octopus Energy Germany (Kraken)', 'EnBW (Mavi)', 'thermondo GmbH', 'FENECON', 'Clever-PV', 'Rabot Energy']);
  const KEY_PHONE = new Set(['gridX GmbH', 'Consolinno Energy GmbH', 'sonnen GmbH', '1KOMMA5°', 'Enpal', 'SMA Solar Technology AG', 'SENEC GmbH']);
  const SHORT = {
    'SMA Solar Technology AG': 'SMA', 'E3/DC (Hager Group)': 'E3/DC', 'sonnen GmbH': 'sonnen', 'SENEC GmbH': 'SENEC', 'Fronius International GmbH': 'Fronius',
    'KOSTAL Solar Electric GmbH': 'KOSTAL', 'Solarwatt GmbH': 'Solarwatt', 'Huawei (FusionSolar)': 'Huawei', 'Enphase Energy': 'Enphase', 'EcoFlow Inc.': 'EcoFlow',
    'RCT Power GmbH': 'RCT Power', 'M-TEC Energy Systems GmbH': 'M-TEC', 'neoom International GmbH': 'neoom', 'Smappee NV': 'Smappee',
    'Viessmann Climate Solutions': 'Viessmann', 'Bosch Home Comfort Group': 'Bosch', 'E.ON (E.ON Home)': 'E.ON Home', 'EnBW (Mavi)': 'EnBW Mavi',
    'Yello Strom GmbH': 'Yello', 'NEW AG': 'NEW', 'Stadtwerke Gütersloh': 'SW Gütersloh', 'beegy GmbH (MVV)': 'beegy (MVV)', 'thermondo GmbH': 'thermondo',
    'Energieversum (EnBW group)': 'Energieversum', 'Solaraero GmbH Gruppe': 'Solaraero', 'Consolinno Energy GmbH': 'Consolinno', 'Wendeware AG': 'Wendeware',
    'Dafi GmbH (SMARTFOX)': 'SMARTFOX', 'Solar Manager AG': 'Solar Manager', 'EcoPhi Renewables Engineering GmbH': 'EcoPhi', 'enisyst GmbH': 'enisyst',
    'energielenker solutions GmbH': 'energielenker', 'TQ-Systems GmbH': 'TQ', 'Tinkerforge GmbH': 'Tinkerforge', 'myGEKKO (Ekon GmbH)': 'myGEKKO',
    'ise Individuelle Software und Elektronik GmbH': 'ise', 'Symcon GmbH': 'Symcon', 'Nexxtlab S.A.': 'Nexxtlab', 'Hager (flow)': 'Hager flow',
    'Schneider Electric': 'Schneider', 'Theben AG': 'Theben', 'gridX GmbH': 'gridX', 'Kiwigrid GmbH': 'Kiwigrid', 'Zerofy OÜ': 'Zerofy',
    'Emulate Energy AB': 'Emulate', 'enyo GmbH': 'enyo', 'RAZO Energy': 'RAZO', 'Powernaut BV': 'Powernaut', 'Octopus Energy Germany (Kraken)': 'Octopus',
    'Rabot Energy': 'Rabot', 'openWB GmbH & Co. KG': 'openWB', 'OpenEMS (Association)': 'OpenEMS', 'tado GmbH': 'tado', 'Stiebel Eltron': 'Stiebel Eltron',
  };
  const shortName = (n) => SHORT[n] || n.replace(/\s+\(.*\)$/, '').replace(/ GmbH$| AG$/, '').trim();
  provs.forEach((p) => { p.short = shortName(p.name); });

  const MAP = MD.map;
  const proj = (lon, lat) => [(lon - MAP.LON0) * MAP.C * MAP.K, (MAP.LAT1 - lat) * MAP.K];
  const CROP = { lon0: 2.55, lon1: 17.3, lat0: 46.25, lat1: 55.15 };
  const [cx0, cy0] = proj(CROP.lon0, CROP.lat1), [cx1, cy1] = proj(CROP.lon1, CROP.lat0);
  const onMap = (p) => p.lat != null && p.lon != null && p.lon >= CROP.lon0 && p.lon <= CROP.lon1 && p.lat >= CROP.lat0 && p.lat <= CROP.lat1;
  const region = (p) => {
    if (p.lat == null) return 'Community projects (no HQ)';
    if (['NO', 'SE', 'EE', 'DK', 'FI'].includes(p.country)) return 'Nordics & Baltics';
    if (['CN', 'US', 'IL'].includes(p.country)) return 'HQ outside Europe';
    return 'Rest of Europe';
  };
  const dated = provs.filter((p) => p.hems_start);
  const undated = provs.filter((p) => !p.hems_start);
  const inF = (p) => state.filter.has(p.archetype);
  const exitYear = (p) => { const m = (movesBy.get(p.name) || []).filter((x) => x.type !== 'acquired'); return m.length ? d3.min(m, (x) => x.year) : null; };
  const acqYear = (p) => { const m = (movesBy.get(p.name) || []).filter((x) => x.type === 'acquired'); return m.length ? d3.min(m, (x) => x.year) : null; };
  const statusText = (p) => {
    const ms = movesBy.get(p.name) || [];
    if (ms.length) return ms.map((m) => `${esc(m.date)}: ${esc(m.label)}`).join('<br>');
    return esc(p.status) + (p.status_detail ? ': ' + esc(p.status_detail) : '');
  };
  const provTip = (p) => `<b>${esc(p.name)}</b><br>${esc(p.product || '')}<br>` +
    `<span style="opacity:.75">${esc(archLabel(p.archetype))}</span><br>` +
    `HQ ${esc(p.hq)} (${esc(p.country)}) · founded ${p.founded || 'n/a'}<br>` +
    `HEMS start: ${p.hems_start ? p.hems_start + (p.hems_start_flag === 'min' ? ' or earlier (oldest source)' : '') : 'not found'}<br>` +
    `Status: ${statusText(p)}<br><span style="opacity:.75">Confidence: ${esc(p.confidence)}</span>`;

  function buildChips() {
    const el = document.getElementById('m2-chips'); if (!el) return;
    el.innerHTML = '';
    const all = document.createElement('button');
    all.type = 'button'; all.className = 'm2-chip'; all.textContent = 'All groups';
    all.setAttribute('aria-pressed', String(state.filter.size === ARCH_IDS.length));
    all.onclick = () => { state.filter = new Set(ARCH_IDS); buildChips(); drawEntry(); };
    el.appendChild(all);
    UI.ARCH.forEach((a) => {
      const n = provs.filter((p) => p.archetype === a.id).length;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'm2-chip';
      b.setAttribute('aria-pressed', String(state.filter.has(a.id) && state.filter.size !== ARCH_IDS.length ? true : state.filter.has(a.id)));
      b.innerHTML = `<i style="background:var(${a.tok})"></i>${esc(a.short)} <span class="grey">${n}</span>`;
      b.title = `${a.label}. Click to show only this group; click again to add or remove`;
      b.onclick = () => {
        if (state.filter.size === ARCH_IDS.length) state.filter = new Set([a.id]);
        else if (state.filter.has(a.id)) { state.filter.delete(a.id); if (!state.filter.size) state.filter = new Set(ARCH_IDS); }
        else state.filter.add(a.id);
        buildChips(); drawEntry();
      };
      el.appendChild(b);
    });
  }

  let mapLayout = null; // cached positions per width
  function layoutMap(w) {
    const s = w / (cx1 - cx0);
    const h = (cy1 - cy0) * s;
    const r = w < 460 ? 4 : 5.2;
    const nodes = provs.filter(onMap).map((p) => { const [x, y] = proj(p.lon, p.lat); return { p, tx: (x - cx0) * s, ty: (y - cy0) * s, x: (x - cx0) * s, y: (y - cy0) * s }; });
    zolar.forEach((m) => { const [x, y] = proj(m.lon, m.lat); nodes.push({ z: m, tx: (x - cx0) * s, ty: (y - cy0) * s, x: (x - cx0) * s + 3, y: (y - cy0) * s + 3 }); });
    const sim = d3.forceSimulation(nodes).force('x', d3.forceX((d) => d.tx).strength(0.9)).force('y', d3.forceY((d) => d.ty).strength(0.9))
      .force('c', d3.forceCollide(r + 1.1)).stop();
    for (let i = 0; i < 160; i++) sim.tick();
    return { w, h, s, r, nodes };
  }

  function drawEntry() {
    drawMap(); drawSide(); drawTimeline(); drawUnknown();
    const out = document.getElementById('m2-year-out'), inp = document.getElementById('m2-year');
    if (out) out.textContent = state.year; if (inp) inp.value = state.year;
    const pb = document.getElementById('m2-play');
    if (pb) pb.innerHTML = state.playing ? '<svg viewBox="0 0 10 10"><rect x="1" y="0" width="3" height="10"/><rect x="6" y="0" width="3" height="10"/></svg>Pause'
      : '<svg viewBox="0 0 10 10"><path d="M1 0 L10 5 L1 10 Z"/></svg>' + (state.year === 2026 ? 'Play 2011–2026' : 'Play');
  }

  function drawMap() {
    const host = document.getElementById('m2-map'); if (!host) return;
    const w = Math.max(260, host.clientWidth || 600);
    if (!mapLayout || mapLayout.w !== w) mapLayout = layoutMap(w);
    const L = mapLayout, y = state.year;
    host.innerHTML = '';
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${w} ${L.h}`).attr('width', '100%').attr('role', 'img')
      .style('overflow', 'hidden').attr('aria-label', `Map of HEMS provider headquarters, state ${y}`);
    const g0 = svg.append('g').attr('transform', `translate(${-cx0 * L.s},${-cy0 * L.s}) scale(${L.s})`);
    const fillOther = C('--bg'), fillDE = C('--panel-2'), stroke = C('--line'), ink = C('--ink');
    MAP.paths.forEach((pa) => {
      g0.append('path').attr('d', pa.d).attr('fill', pa.c === 'DE' ? fillDE : fillOther)
        .attr('stroke', pa.c === 'DE' ? C('--grey') : stroke).attr('stroke-width', pa.c === 'DE' ? 0.9 : 0.7)
        .attr('vector-effect', 'non-scaling-stroke').attr('stroke-linejoin', 'round');
    });
    // country labels
    const CL = [['GERMANY', 10.2, 51.35, true], ['AT', 14.6, 47.55], ['CH', 8.0, 46.75], ['NL', 5.6, 52.6], ['BE', 4.6, 50.6], ['CZ', 15.4, 49.85], ['PL', 16.6, 52.4], ['FR', 3.6, 48.0], ['DK', 9.2, 54.95], ['IT', 11.0, 46.4]];
    CL.forEach(([t, lo, la, big]) => {
      const [x, yy] = proj(lo, la); const px = (x - cx0) * L.s, py = (yy - cy0) * L.s;
      if (px < 10 || px > w - 10 || py < 10 || py > L.h - 4) return;
      svg.append('text').attr('x', px).attr('y', py).attr('text-anchor', 'middle')
        .style('fill', C('--grey')).style('font-size', big ? (w < 460 ? '12px' : '15px') : '10px').style('letter-spacing', big ? '.35em' : '.1em')
        .style('opacity', big ? 0.55 : 0.8).text(t);
    });
    const r = L.r;
    const vis = (n) => n.p ? (n.p.hems_start && n.p.hems_start <= y && inF(n.p)) : (n.z.year <= y && state.filter.has(n.z.archetype));
    const nodes = L.nodes.filter((n) => (n.p ? n.p.hems_start : true));
    const gLead = svg.append('g'), gDot = svg.append('g'), gLab = svg.append('g');
    // leader lines for displaced dots
    nodes.filter((n) => vis(n) && Math.hypot(n.x - n.tx, n.y - n.ty) > r * 0.9).forEach((n) => {
      gLead.append('line').attr('x1', n.tx).attr('y1', n.ty).attr('x2', n.x).attr('y2', n.y).attr('stroke', C('--grey')).attr('stroke-width', 0.6).attr('opacity', 0.7);
    });
    const dot = gDot.selectAll('g').data(nodes.filter(vis)).join('g').attr('transform', (n) => `translate(${n.x},${n.y})`).style('cursor', 'default');
    dot.each(function (n) {
      const g = d3.select(this);
      if (n.z) { // Zolar: exit-only marker
        const k = r * 0.85;
        g.append('circle').attr('r', r + 1).attr('fill', C('--bg')).attr('stroke', UI.archColor(n.z.archetype)).attr('stroke-width', 1.4).attr('stroke-dasharray', '2 1.5');
        g.append('path').attr('d', `M${-k},${-k}L${k},${k}M${-k},${k}L${k},${-k}`).attr('stroke', C('--bad')).attr('stroke-width', 2);
        return;
      }
      const p = n.p, col = UI.archColor(p.archetype), isNew = state.playing && p.hems_start === y;
      const ay = acqYear(p), ey = exitYear(p);
      if (ay && ay <= y) g.append('circle').attr('r', r + 3.2).attr('fill', 'none').attr('stroke', ink).attr('stroke-width', 1.1);
      const c = g.append('circle').attr('r', r).attr('fill', p.hems_start_flag === 'min' ? C('--bg') : col).attr('stroke', col).attr('stroke-width', p.hems_start_flag === 'min' ? 1.8 : 0.8);
      if (p.confidence === 'low') c.attr('stroke', ink).attr('stroke-width', 1.3).attr('stroke-dasharray', '2 1.5');
      if (p.name === 'gridX GmbH' || p.name === 'Consolinno Energy GmbH') c.attr('stroke', ink).attr('stroke-width', 1.6);
      if (isNew && !reduce) {
        c.attr('r', 0).transition().duration(420).attr('r', r);
        g.insert('circle', ':first-child').attr('r', r).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2)
          .transition().duration(900).attr('r', r * 4).attr('stroke-opacity', 0).remove();
      }
      if (ey && ey <= y) { const k = r * 0.9; g.append('path').attr('d', `M${-k},${-k}L${k},${k}M${-k},${k}L${k},${-k}`).attr('stroke', C('--bad')).attr('stroke-width', 2.2).attr('stroke-linecap', 'square'); }
    });
    UI.bindTip(dot, (n) => n.z ? `<b>${esc(n.z.name)}</b> (${esc(n.z.hq)})<br>${esc(archLabel(n.z.archetype))}<br>${esc(n.z.date)}: ${esc(n.z.label)}<br><span style="opacity:.75">Installer, not in the HEMS provider list</span>` : provTip(n.p));
    // highlight from unknown strip
    if (state.hi) {
      const n = L.nodes.find((q) => q.p && q.p.name === state.hi);
      if (n) {
        svg.append('circle').attr('cx', n.x).attr('cy', n.y).attr('r', r + 1).attr('fill', 'none').attr('stroke', UI.archColor(n.p.archetype)).attr('stroke-width', 1.8).attr('stroke-dasharray', '2 2');
        svg.append('circle').attr('cx', n.x).attr('cy', n.y).attr('r', r + 7).attr('fill', 'none').attr('stroke', ink).attr('stroke-width', 1.2);
        svg.append('text').attr('x', n.x + r + 10).attr('y', n.y + 4).attr('class', 'lab-strong').text(n.p.short);
      }
    }
    // direct labels for key providers
    const keys = w < 460 ? KEY_PHONE : KEY_MAP;
    const shown = nodes.filter((n) => n.p && vis(n));
    const items = shown.filter((n) => keys.has(n.p.name)).sort((a, b) => (b.p.name === 'gridX GmbH' || b.p.name === 'Consolinno Energy GmbH') - (a.p.name === 'gridX GmbH' || a.p.name === 'Consolinno Energy GmbH'))
      .map((n) => ({ x: n.x, y: n.y, r: r + 1, text: n.p.short, size: 11, weight: (n.p.name === 'gridX GmbH' || n.p.name === 'Consolinno Energy GmbH') ? 600 : 400, force: n.p.name === 'gridX GmbH' || n.p.name === 'Consolinno Energy GmbH' }));
    const placed = placeLabels(items, { x0: 2, y0: 2, x1: w - 2, y1: L.h - 2 }, shown.map((n) => ({ x: n.x, y: n.y, r: r + 0.5 })));
    placed.forEach((l) => {
      gLab.append('text').attr('x', l.lx).attr('y', l.ly).attr('text-anchor', l.anchor).attr('class', l.weight === 600 ? 'lab-strong' : 'lab')
        .style('paint-order', 'stroke').style('stroke', C('--bg')).style('stroke-width', '3px').style('stroke-linejoin', 'round').text(l.text);
    });
  }

  function drawSide() {
    const el = document.getElementById('m2-side'); if (!el) return;
    const y = state.year;
    const cum = dated.filter((p) => p.hems_start <= y && inF(p)).length;
    const nw = dated.filter((p) => p.hems_start === y && inF(p));
    const exits = MOVES.filter((m) => m.type !== 'acquired' && m.year <= y && state.filter.has(m.archetype || (provs.find((p) => p.name === m.provider) || {}).archetype)).length;
    const off = dated.filter((p) => !onMap(p) && inF(p)).sort((a, b) => a.hems_start - b.hems_start);
    const li = (p) => {
      const tok = archTok(p.archetype), dim = p.hems_start > y;
      const dotStyle = p.hems_start_flag === 'min' ? `color:var(${tok});background:var(--bg)` : `color:var(${tok});background:var(${tok})`;
      return `<li class="${dim ? 'off' : ''}" data-n="${esc(p.name)}"><span class="m2-dot" style="${dotStyle}"></span>${esc(p.short)} <span class="grey">${p.hems_start}</span></li>`;
    };
    el.innerHTML = `
      <div class="m2-big"><span class="y">${y}</span><span class="muted">${y === 2026 ? 'state at 25.11.2026' : 'state at year end'}</span></div>
      <div class="m2-kpis">
        <div><b>${cum}</b><span>dated launches so far</span></div>
        <div><b>+${nw.length}</b><span>new in ${y}</span></div>
        <div><b class="${exits ? 'm2-x' : ''}">${exits}</b><span>insolvent or sales stop</span></div>
      </div>
      <div><p class="m2-h">New in ${y}</p>${nw.length ? `<ul class="m2-list">${nw.map(li).join('')}</ul>` : '<p class="m2-note">None dated.</p>'}</div>
      <div><p class="m2-h" title="HQ outside the map or no HQ (community projects); hover a name for the region">Not on the map (${off.length})</p><ul class="m2-list">${off.map(li).join('')}</ul></div>
      <div class="m2-marks" aria-label="Marks">
        <span title="Launch year documented"><svg viewBox="-7 -7 14 14"><circle r="5" fill="${C('--grey')}"/></svg>documented</span>
        <span title="Launched this year or earlier (oldest source found)"><svg viewBox="-7 -7 14 14"><circle r="4.4" fill="${C('--bg')}" stroke="${C('--grey')}" stroke-width="1.8"/></svg>this year or earlier</span>
        <span title="Taken over by a larger group"><svg viewBox="-9 -9 18 18"><circle r="8" fill="none" stroke="${C('--ink')}" stroke-width="1.1"/><circle r="5" fill="${C('--grey')}"/></svg>taken over</span>
        <span title="Insolvent or stopped new sales"><svg viewBox="-7 -7 14 14"><circle r="5" fill="${C('--grey')}"/><path d="M-4.5,-4.5L4.5,4.5M-4.5,4.5L4.5,-4.5" stroke="${C('--bad')}" stroke-width="2.2"/></svg>insolvent / sales stop</span>
        <span title="Launch year low confidence"><svg viewBox="-7 -7 14 14"><circle r="5" fill="${C('--grey')}" stroke="${C('--ink')}" stroke-width="1.3" stroke-dasharray="2 1.5"/></svg>low confidence</span>
      </div>`;
    const sel = d3.select(el).selectAll('li[data-n]');
    sel.on('mouseenter mousemove', function (ev) {
      const p = provs.find((q) => q.name === this.dataset.n);
      if (p) UI.tip(provTip(p) + (onMap(p) ? '' : `<br><span style="opacity:.75">Not on the map: ${esc(region(p))}</span>`), ev);
    }).on('mouseleave', () => UI.tip(null));
  }

  function drawTimeline() {
    const host = document.getElementById('m2-timeline'); if (!host) return;
    host.innerHTML = '';
    const w = Math.max(300, host.clientWidth || 800), phone = w < 520;
    const m = { t: 8, r: 10, b: 24, l: phone ? 30 : 40 };
    const hCum = phone ? 44 : 52, gapC = 30, hUp = phone ? 118 : 136, hDn = phone ? 46 : 54;
    const h = m.t + hCum + gapC + hUp + hDn + m.b;
    const x = d3.scaleBand().domain(YEARS).range([m.l, w - m.r]).paddingInner(0.22).paddingOuter(0.1);
    const bw = x.bandwidth(), step = x.step(), xc = (yr) => x(yr) + bw / 2;
    const fp = dated.filter(inF);
    const byYear = YEARS.map((yr) => { const ps = fp.filter((p) => p.hems_start === yr); return { yr, ps, n: ps.length }; });
    const maxN = Math.max(4, d3.max(byYear, (d) => d.n));
    const yB0 = m.t + hCum + gapC, y0 = yB0 + hUp;
    const yU = d3.scaleLinear().domain([0, maxN]).range([y0, yB0 + 22]).nice();
    let cum = 0; const cumS = byYear.map((d) => (cum += d.n, { yr: d.yr, c: cum }));
    const yC = d3.scaleLinear().domain([0, Math.max(10, cum)]).range([m.t + hCum, m.t + 12]);
    const mv = MOVES.filter((q) => state.filter.has(q.archetype || (provs.find((p) => p.name === q.provider) || {}).archetype));
    const mvBy = YEARS.map((yr) => ({ yr, ex: mv.filter((q) => q.year === yr && q.type !== 'acquired'), ac: mv.filter((q) => q.year === yr && q.type === 'acquired') }));
    const maxD = Math.max(3, d3.max(mvBy, (d) => d.ex.length + d.ac.length));
    const unit = Math.min(12, (hDn - 8) / maxD);
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img')
      .attr('aria-label', 'Cumulative dated HEMS launches, new launches per year by strategic group, and exits per year');
    svg.append('rect').attr('x', x(state.year) - (step - bw) / 2).attr('y', m.t).attr('width', step).attr('height', h - m.t - m.b + 4).attr('fill', C('--panel-2'));
    const lbl = (tx, ty, t, anchor = 'start', col = '--grey') => svg.append('text').attr('x', tx).attr('y', ty).attr('text-anchor', anchor).style('fill', C(col)).style('font-size', '10.5px').text(t);
    // panel 1: cumulative
    lbl(m.l, m.t + 8, 'Cumulative dated launches');
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', m.t + hCum).attr('y2', m.t + hCum).attr('stroke', C('--line'));
    svg.append('path').datum(cumS).attr('d', d3.area().x((d) => xc(d.yr)).y0(m.t + hCum).y1((d) => yC(d.c)).curve(d3.curveMonotoneX)).attr('fill', C('--ink')).attr('opacity', 0.07);
    svg.append('path').datum(cumS.filter((d) => d.yr <= state.year)).attr('d', d3.line().x((d) => xc(d.yr)).y((d) => yC(d.c)).curve(d3.curveMonotoneX))
      .attr('fill', 'none').attr('stroke', C('--ink')).attr('stroke-width', 1.6);
    svg.append('path').datum(cumS.filter((d) => d.yr >= state.year)).attr('d', d3.line().x((d) => xc(d.yr)).y((d) => yC(d.c)).curve(d3.curveMonotoneX))
      .attr('fill', 'none').attr('stroke', C('--grey')).attr('stroke-width', 1).attr('stroke-dasharray', '2 2');
    const selC = cumS.find((d) => d.yr === state.year);
    svg.append('circle').attr('cx', xc(state.year)).attr('cy', yC(selC.c)).attr('r', 3.4).attr('fill', C('--ink'));
    svg.append('text').attr('class', 'lab-strong').attr('x', xc(state.year) + (state.year > 2019 ? -7 : 7)).attr('y', yC(selC.c) - 5)
      .attr('text-anchor', state.year > 2019 ? 'end' : 'start').text(selC.c);
    // panel 2: new per year
    lbl(m.l, yB0 - 8, 'New launches per year');
    const gy = svg.append('g').attr('class', 'ax');
    yU.ticks(3).forEach((t) => {
      gy.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', yU(t)).attr('y2', yU(t)).attr('stroke', C('--line'));
      gy.append('text').attr('x', m.l - 6).attr('y', yU(t) + 3.5).attr('text-anchor', 'end').text(t);
    });
    const gB = svg.append('g');
    byYear.forEach((d) => {
      let acc = 0; const fut = d.yr > state.year;
      UI.ARCH.forEach((a) => {
        d.ps.filter((p) => p.archetype === a.id).sort((p, q) => (p.hems_start_flag === 'min') - (q.hems_start_flag === 'min')).forEach((p) => {
          const yTop = yU(acc + 1), yBot = yU(acc); acc += 1;
          const col = UI.archColor(a.id), hollow = p.hems_start_flag === 'min';
          const rc = gB.append('rect').attr('x', x(d.yr) + 0.7).attr('y', yTop + 0.9).attr('width', bw - 1.4).attr('height', Math.max(1, yBot - yTop - 1.8))
            .attr('fill', hollow ? C('--bg') : col).attr('stroke', p.confidence === 'low' ? C('--ink') : col).attr('stroke-width', p.confidence === 'low' ? 1.2 : (hollow ? 1.4 : 0))
            .attr('stroke-dasharray', p.confidence === 'low' ? '2 1.5' : null).attr('opacity', fut ? 0.16 : 1);
          UI.bindTip(rc.datum(p), provTip);
        });
      });
      if (d.n) gB.append('text').attr('x', xc(d.yr)).attr('y', yU(d.n) - 4).attr('text-anchor', 'middle').attr('class', 'lab').style('font-size', phone ? '10px' : '11px').style('opacity', fut ? 0.3 : 1).text(d.n);
    });
    // wave bracket 2023-2024 (numbers from data)
    const wave = byYear.filter((d) => d.yr === 2023 || d.yr === 2024), wn = d3.sum(wave, (d) => d.n);
    if (wn && fp.length) {
      const xa = x(2023), xb = x(2024) + bw, by = yU(maxN) - 18;
      svg.append('path').attr('d', `M${xa},${by + 4}V${by}H${xb}V${by + 4}`).attr('fill', 'none').attr('stroke', C('--ink')).attr('stroke-width', 1);
      svg.append('text').attr('class', 'lab-strong').attr('x', xa - 6).attr('y', by + 4).attr('text-anchor', 'end')
        .text(phone ? `${wn} of ${fp.length}` : `${wn} of ${fp.length} dated launches in 2023–24`);
    }
    // panel 3: exits (solid) and takeovers (hollow), stacked downward
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y0).attr('y2', y0).attr('stroke', C('--ink'));
    mvBy.forEach((d) => {
      let acc = 0; const fut = d.yr > state.year;
      d.ex.concat(d.ac).forEach((q) => {
        const yy = y0 + 2 + acc * unit; acc++;
        const isEx = q.type !== 'acquired';
        const rc = svg.append('rect').attr('x', x(d.yr) + 0.7).attr('y', yy + 0.6).attr('width', bw - 1.4).attr('height', unit - 1.2)
          .attr('fill', isEx ? C('--bad') : C('--bg')).attr('stroke', isEx ? C('--bad') : C('--ink')).attr('stroke-width', isEx ? 0 : 1.1).attr('opacity', fut ? 0.2 : 1);
        UI.bindTip(rc.datum(q), (z) => `<b>${esc(z.provider ? shortName(z.provider) : z.name)}</b><br>${esc(z.date)}: ${esc(z.label)}<br><span style="opacity:.75">${z.type === 'acquired' ? 'Takeover (change of owner)' : 'Exit (insolvency or sales stop)'}</span>`);
      });
    });
    svg.append('text').attr('x', m.l - 6).attr('y', y0 + 11).style('fill', C('--bad')).style('font-size', '10px').attr('text-anchor', 'end').text('out');
    if (!phone) lbl(x(2011) + 2, y0 + hDn - 6, 'Below: exits (solid), takeovers (hollow)', 'start', '--muted');
    const gx = svg.append('g').attr('class', 'ax');
    YEARS.forEach((yr) => {
      if (phone && !(yr % 5 === 1 || yr === 2026 || yr === state.year)) return;
      gx.append('text').attr('x', xc(yr)).attr('y', h - 6).attr('text-anchor', 'middle')
        .style('font-weight', yr === state.year ? 600 : 400).style('fill', yr === state.year ? C('--ink') : null)
        .text(phone && yr !== state.year ? "'" + String(yr).slice(2) : String(yr));
    });
    svg.append('g').selectAll('rect').data(YEARS).join('rect').attr('class', 'yr').attr('x', (yr) => x(yr) - (step - bw) / 2).attr('y', m.t)
      .attr('width', step).attr('height', h - m.t).attr('fill', 'transparent')
      .on('click', (ev, yr) => { stop(); state.year = yr; drawEntry(); })
      .lower();
  }

  function drawUnknown() {
    const el = document.getElementById('m2-unknown'); if (!el) return;
    const us = undated.filter(inF).sort((a, b) => d3.ascending(ARCH_IDS.indexOf(a.archetype), ARCH_IDS.indexOf(b.archetype)) || d3.ascending(a.short, b.short));
    // folded by default; open state survives the redraws on year and filter changes
    el.innerHTML = `<details class="more"${state.unkOpen ? ' open' : ''}><summary>Launch year not found: ${us.length} of ${undated.filter(inF).length + dated.filter(inF).length} providers</summary><p class="m2-note">Hover a name to locate it on the map.</p><ul class="m2-list">${us.map((p) => {
      const ex = exitYear(p);
      return `<li data-n="${esc(p.name)}" tabindex="0"><span class="m2-dot" style="color:var(${archTok(p.archetype)});background:var(${archTok(p.archetype)})"></span>${esc(p.short)}${ex ? ' <span class="m2-x">×</span>' : ''}</li>`;
    }).join('')}</ul></details>`;
    const det = el.querySelector('details');
    if (det) det.addEventListener('toggle', () => { state.unkOpen = det.open; });
    d3.select(el).selectAll('li[data-n]')
      .on('mouseenter focus', function (ev) { const p = provs.find((q) => q.name === this.dataset.n); state.hi = p && onMap(p) ? p.name : null; drawMap(); if (p) UI.tip(provTip(p) + (onMap(p) ? '' : '<br><i>HQ not on the map</i>'), ev.clientX ? ev : { clientX: 40, clientY: 40 }); })
      .on('mousemove', function (ev) { const p = provs.find((q) => q.name === this.dataset.n); if (p) UI.tip(provTip(p), ev); })
      .on('mouseleave blur', () => { state.hi = null; drawMap(); UI.tip(null); });
  }

  function stop() { state.playing = false; clearInterval(state.timer); state.timer = null; }
  function play() {
    if (state.playing) { stop(); drawEntry(); return; }
    if (state.year >= 2026) state.year = 2011;
    state.playing = true; drawEntry();
    state.timer = setInterval(() => {
      if (state.year >= 2026) { stop(); drawEntry(); return; }
      state.year += 1; drawEntry();
      if (state.year >= 2026) { stop(); drawEntry(); }
    }, reduce ? 1000 : 900);
  }
  function initEntry() {
    if (!document.getElementById('m2-map')) return;
    buildChips();
    const pb = document.getElementById('m2-play'); if (pb) pb.addEventListener('click', play);
    const inp = document.getElementById('m2-year');
    if (inp) inp.addEventListener('input', () => { stop(); state.year = +inp.value; drawEntry(); });
    drawEntry();
    UI.onTheme(() => { mapLayout = null; buildChips(); drawEntry(); });
  }

  /* =====================================================================================
     (b) Company-size bubble chart
     ===================================================================================== */
  // Public build (window.MD_PUBLIC): records and values without a public source are removed by bauen.py.
  // A company whose main headcount has no public source falls back to employees_alt (press, register or accounts).
  const PUB = !!window.MD_PUBLIC;
  const COMP = ((X.m2_companies && X.m2_companies.companies) || []).map((c) => {
    const o = Object.assign({}, c), a = c.employees_alt;
    if (o.employees == null && a) Object.assign(o, { employees: a.n, employees_date: a.date, employees_confidence: a.conf });
    return o;
  }).filter((c) => c.employees);
  const SHOW_FUND = !PUB; // funding totals are not public for most companies, so the public build uses equal dots
  const fund = (c) => (c.funding ? c.funding.eur_m : 0);
  const pbTag = (o, sep) =>  '';
  const ND = PUB ? 'no public figure' : 'not disclosed';
  function bubTitle() { // short action title (side text); the size span goes to a key point, see bubSpan()
    const core = COMP.filter((c) => c.hems_role === 'core' && c.ni), loss = core.filter((c) => c.ni.eur_m < 0);
    const head = loss.length === core.length ? `All ${core.length}` : `${loss.length} of the ${core.length}`;
    return `${head} HEMS-focused companies with known results lose money`;
  }
  function bubSpan() {
    const lo = d3.min(COMP, (c) => c.employees), hi = d3.max(COMP, (c) => c.employees);
    const ord = ['less than one order', 'one order', 'two orders', 'three orders', 'four orders', 'five orders'][Math.floor(Math.log10(hi / lo))];
    return `<b>${fmt(lo)}–${fmt(hi)}</b>employees: size spans ${ord} of magnitude`;
  }
  let bubMode = 'rev';
  function drawBubble() {
    const host = document.getElementById('m2-bubble'); if (!host) return;
    host.innerHTML = '';
    const w = Math.max(300, host.clientWidth || 800), phone = w < 560;
    const m = { t: 16, r: phone ? 14 : 24, b: 40, l: phone ? 46 : 58 };
    const hPlot = phone ? 330 : 440, hStrip = 58, gap = 18;
    const h = m.t + hPlot + gap + hStrip + m.b;
    const isRev = bubMode === 'rev';
    const val = (c) => (isRev ? c.rev : c.ni);
    const has = COMP.filter((c) => val(c) && c.employees), not = COMP.filter((c) => !val(c) && c.employees);
    const x = d3.scaleLog().domain([Math.min(8, d3.min(COMP, (c) => c.employees) * 0.8), 40000]).range([m.l, w - m.r]);
    const y = isRev ? d3.scaleLog().domain([0.3, 30000]).range([m.t + hPlot, m.t])
      : d3.scaleSymlog().constant(1).domain([-400, 250]).range([m.t + hPlot, m.t]);
    const fMax = d3.max(COMP, fund) || 1;
    const rS = d3.scaleSqrt().domain([0, fMax]).range([0, phone ? 24 : 32]);
    const rOf = (c) => (!SHOW_FUND ? (phone ? 5.5 : 7) : fund(c) ? Math.max(3.5, rS(fund(c))) : (phone ? 4.5 : 5.5));
    const filledOf = (c) => !SHOW_FUND || !!fund(c);
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img')
      .attr('aria-label', isRev ? 'Bubble chart of employees versus revenue' : 'Bubble chart of employees versus net income');
    const ax = svg.append('g').attr('class', 'ax');
    // y grid
    const yt = isRev ? [1, 10, 100, 1000, 10000] : [-300, -100, -30, -10, -1, 0, 1, 10, 100];
    yt.forEach((t) => {
      ax.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', t === 0 ? C('--ink') : C('--line'));
      ax.append('text').attr('x', m.l - 6).attr('y', y(t) + 3.5).attr('text-anchor', 'end').text(isRev ? fmt(t) : (t > 0 ? '+' : '') + fmt(t));
    });
    if (!isRev) {
      svg.append('rect').attr('x', m.l).attr('y', y(0)).attr('width', w - m.r - m.l).attr('height', y(-400) - y(0)).attr('fill', C('--bad')).attr('opacity', 0.05);
      svg.append('text').attr('x', w - m.r - 4).attr('y', y(0) + 14).attr('text-anchor', 'end').style('fill', C('--bad')).style('font-size', '11px').style('font-weight', 600).text('LOSS');
      svg.append('text').attr('x', w - m.r - 4).attr('y', y(0) - 6).attr('text-anchor', 'end').style('fill', C('--good')).style('font-size', '11px').style('font-weight', 600).text('PROFIT');
    }
    svg.append('text').attr('transform', `translate(12,${m.t + hPlot / 2}) rotate(-90)`).attr('text-anchor', 'middle').style('fill', C('--grey')).style('font-size', '10.5px')
      .text(isRev ? 'Revenue, M EUR (log)' : 'Net income, M EUR (symmetric log)');
    // x grid + axis
    const xt = [10, 100, 1000, 10000];
    const yStrip = m.t + hPlot + gap, yAxis = yStrip + hStrip;
    xt.forEach((t) => {
      ax.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', yAxis).attr('stroke', C('--line'));
      ax.append('text').attr('x', x(t)).attr('y', yAxis + 16).attr('text-anchor', 'middle').text(fmt(t));
    });
    svg.append('text').attr('x', (m.l + w - m.r) / 2).attr('y', yAxis + 32).attr('text-anchor', 'middle').style('fill', C('--grey')).style('font-size', '10.5px').text('Employees (log)');
    // strip for undisclosed
    svg.append('rect').attr('x', m.l).attr('y', yStrip).attr('width', w - m.r - m.l).attr('height', hStrip).attr('fill', C('--panel-2'));
    svg.append('text').attr('x', w - m.r - 6).attr('y', yStrip + 13).attr('text-anchor', 'end').style('fill', C('--muted')).style('font-size', '10.5px')
      .text(PUB ? (isRev ? 'No public revenue figure' : 'No public net income figure') : (isRev ? 'Revenue not disclosed' : 'Net income not disclosed'));
    const colOf = (c) => isRev ? UI.archColor(c.archetype) : (val(c).eur_m < 0 ? C('--bad') : C('--good'));
    const pts = has.map((c) => ({ c, x: x(c.employees), y: y(val(c).eur_m), r: rOf(c) }));
    const sPts = not.map((c) => ({ c, x: x(c.employees), y: yStrip + 34, r: phone ? 4 : 5 }));
    // small collision nudge in strip
    const sim = d3.forceSimulation(sPts).force('x', d3.forceX((d) => d.x).strength(1)).force('y', d3.forceY(yStrip + 34).strength(0.5)).force('c', d3.forceCollide((d) => d.r + 1)).stop();
    for (let i = 0; i < 80; i++) sim.tick();
    sPts.forEach((d) => { d.y = Math.max(yStrip + d.r + 18, Math.min(yStrip + hStrip - d.r - 12, d.y)); });
    const all = pts.concat(sPts);
    const g = svg.append('g');
    const node = g.selectAll('g').data(pts.sort((a, b) => b.r - a.r)).join('g').attr('transform', (d) => `translate(${d.x},${d.y})`);
    node.each(function (d) {
      const s = d3.select(this), c = d.c, col = colOf(c), v = val(c), low = v.conf === 'low' || c.employees_confidence === 'low';
      const filled = filledOf(c);
      s.append('circle').attr('r', d.r).attr('fill', filled ? col : C('--bg')).attr('fill-opacity', filled ? 0.78 : 1)
        .attr('stroke', low ? C('--ink') : col).attr('stroke-width', low ? 1.4 : (filled ? 1 : 1.8)).attr('stroke-dasharray', low ? '3 2' : null);
      if (c.short === 'gridX' || c.short === 'Consolinno') s.append('circle').attr('r', d.r + 3).attr('fill', 'none').attr('stroke', C('--ink')).attr('stroke-width', 1.2);
    });
    const sNode = g.selectAll('g.s').data(sPts).join('g').attr('class', 's').attr('transform', (d) => `translate(${d.x},${d.y})`);
    sNode.each(function (d) {
      const s = d3.select(this), col = UI.archColor(d.c.archetype);
      const low = d.c.employees_confidence === 'low';
      s.append('circle').attr('r', d.r).attr('fill', filledOf(d.c) ? col : C('--bg')).attr('stroke', low ? C('--ink') : col).attr('stroke-width', low ? 1.4 : 1.6).attr('stroke-dasharray', low ? '3 2' : null);
      if (d.c.short === 'gridX' || d.c.short === 'Consolinno') s.append('circle').attr('r', d.r + 3).attr('fill', 'none').attr('stroke', C('--ink')).attr('stroke-width', 1.2);
    });
    if (!reduce && drawBubble.prevMode && drawBubble.prevMode !== bubMode) {
      node.attr('opacity', 0).transition().duration(450).attr('opacity', 1);
    }
    drawBubble.prevMode = bubMode;
    const line = (lab, o) => o ? `${lab}: <b>${o.eur_m < 0 ? '−' : ''}${fmt(Math.abs(o.eur_m), Math.abs(o.eur_m) < 10 ? 2 : 0)} M EUR</b> (${o.year}; ${esc(o.orig)}; ${esc(o.scope)}${esc(o.scope_pb || '')}${pbTag(o, '; ')})${confNote(o.conf)}${o.note ? '<br><span style="opacity:.75">' + esc(o.note) + '</span>' : ''}` : `${lab}: ${ND}`;
    const fundLine = (c) => c.funding ? `Funding raised: <b>${fmt(c.funding.eur_m)} M EUR</b> (${esc(c.funding.orig)}${pbTag(c.funding, ', ')})`
      : SHOW_FUND ? 'Funding raised: none recorded (corporate, undisclosed or self-funded)' : '';
    const tipC = (d) => { const c = d.c; return `<b>${esc(c.name)}</b><br><span style="opacity:.75">${esc(archLabel(c.archetype))}${c.hems_role === 'core' ? ' · HEMS-focused' : ''}</span><br>` +
      `Employees: <b>${fmt(c.employees)}</b> (${esc(c.employees_date || '')})${confNote(c.employees_confidence)}<br>${line('Revenue', c.rev)}<br>${line('Net income', c.ni)}` +
      `${fundLine(c) ? '<br>' + fundLine(c) : ''}` +
      `${c.note ? '<br><span style="opacity:.75">' + esc(c.note) + '</span>' : ''}${c.rev_note ? '<br><span style="opacity:.75">' + esc(c.rev_note) + '</span>' : ''}`; };
    UI.bindTip(node, tipC); UI.bindTip(sNode, tipC);
    // labels
    const keyFirst = (a, b) => (b.c.key - a.c.key) || (b.r - a.r);
    const items = all.slice().sort(keyFirst).filter((d) => !phone || d.c.key)
      .map((d) => ({ x: d.x, y: d.y, r: d.r, text: d.c.short, size: d.c.key ? 11.5 : 10.5, weight: (d.c.short === 'gridX' || d.c.short === 'Consolinno') ? 600 : (d.c.key ? 500 : 400), force: d.c.key, strip: d.y > yStrip }));
    const placed = placeLabels(items, { x0: m.l, y0: m.t, x1: w - 2, y1: yStrip + hStrip }, all.map((d) => ({ x: d.x, y: d.y, r: d.r * 0.8 })).concat(d3.range(0, 130, 10).map((k) => ({ x: w - m.r - 10 - k, y: yStrip + 9, r: 6 }))));
    placed.forEach((l) => {
      svg.append('text').attr('x', l.lx).attr('y', l.ly).attr('text-anchor', l.anchor).attr('class', l.weight >= 500 ? 'lab-strong' : 'lab')
        .style('font-size', l.size + 'px').style('font-weight', l.weight).style('fill', l.weight >= 500 ? C('--ink') : C('--muted'))
        .style('paint-order', 'stroke').style('stroke', C('--panel')).style('stroke-width', '3px').style('stroke-linejoin', 'round').text(l.text);
    });
    // key
    const key = document.getElementById('m2-bub-key');
    if (key) {
      const sz = [100, 1000];
      key.innerHTML = (isRev ? UI.ARCH.filter((a) => COMP.some((c) => c.archetype === a.id)).map((a) => `<span><i style="width:9px;height:9px;border-radius:50%;display:inline-block;background:var(${a.tok})"></i>${esc(a.short)}</span>`).join('')
        : `<span><i style="width:9px;height:9px;border-radius:50%;display:inline-block;background:var(--bad)"></i>loss</span><span><i style="width:9px;height:9px;border-radius:50%;display:inline-block;background:var(--good)"></i>profit</span>`) +
        (!SHOW_FUND ? '' : sz.map((v) => `<span><svg viewBox="${-rS(v) - 1} ${-rS(v) - 1} ${2 * rS(v) + 2} ${2 * rS(v) + 2}" style="width:${2 * rS(v) + 2}px;height:${2 * rS(v) + 2}px"><circle r="${rS(v)}" fill="none" stroke="${C('--muted')}"/></svg>${fmt(v)} M EUR funding</span>`).join('') +
        `<span><svg viewBox="-7 -7 14 14"><circle r="5" fill="none" stroke="${C('--muted')}" stroke-width="1.8"/></svg>no funding recorded</span>`) +
        `<span><svg viewBox="-7 -7 14 14"><circle r="5" fill="none" stroke="${C('--ink')}" stroke-dasharray="3 2" stroke-width="1.4"/></svg>low confidence</span>`;
    }
    // short unit line in the side text; the full explanation sits in "Sources & notes"
    const subS = document.getElementById('m2-bub-sub');
    if (subS) subS.textContent = isRev ? `Employees vs revenue (M EUR), log scales · ${COMP.length} companies`
      : `Employees vs net income (M EUR) · ${has.length} with a known result`;
    const sub = document.getElementById('m2-bub-sub-long');
    if (sub && PUB) sub.textContent = isRev
      ? `Employees (log scale) against latest annual revenue in M EUR (log scale), coloured by strategic group; ${COMP.length} companies with a headcount from a public source.`
      : `Employees (log scale) against latest annual net income in M EUR (symmetric log scale, losses below zero); ${has.length} companies with a known result.`;
    else if (sub) sub.textContent = isRev
      ? `Employees (log scale) against latest annual revenue in M EUR (log scale); bubble area = total funding raised in M EUR; ${COMP.length} companies with a known headcount.`
      : `Employees (log scale) against latest annual net income in M EUR (symmetric log scale, losses below zero); bubble area = total funding raised; ${has.length} companies with a known result.`;
  }
  function initBubble() {
    if (!document.getElementById('m2-bubble')) return;
    const t = document.getElementById('m2-bub-title'); if (t && COMP.length) t.textContent = bubTitle();
    const sp = document.getElementById('m2-bub-span'); if (sp && COMP.length) sp.innerHTML = bubSpan();
    segBind(document.getElementById('m2-bub-mode'), (v) => { bubMode = v; drawBubble(); });
    drawBubble(); UI.onTheme(drawBubble);
  }

  /* =====================================================================================
     (c) Feature heatmap
     ===================================================================================== */
  /* Core view for end consumers (team member 26.11.2026): only app features and device connections.
     Removed from the exhibit (data kept): sales channels, system type, immersion heater, EV via API,
     §9 EEG, DIN-rail, ISO 27001, plan for the grid operator. */
  const COLS = [
    ['Forecast', [['PV forecast', [20]], ['Load forecast', [21]]]],
    ['PV surplus to', [['Battery', [3]], ['Heat pump', [6]], ['Wallbox', [4]], ['Smart plugs', [34]]]],
    ['Dynamic tariff', [['Battery', [8]], ['Heat pump', [11]], ['Wallbox', [9]]]],
    ['EV charging', [['Car SoC', [17]], ['1/3-phase switching', [16]]]],
    ['Grid rules', [['§14a dimming', [22, 45, 23]], ['Variable grid fees', [24, 36, 37]]]],
    ['Device connection', [['Modbus', [27, 29, 30, 31, 32, 39, 41, 47]], ['EEBUS', [26, 28, 43]], ['OCPP (wallbox)', [33]], ['Cloud API', [38, 40, 42]], ['Local API / MQTT', [49, 50, 51, 52, 53]]]],
  ];
  const MISS_SHOW = ['CHP (BHKW) optimisation', 'Buffer tank', 'Schedule as start view'];
  let hmSort = 'n';
  function hmData() {
    const M = MD.matrix, P = (X.m2_producers && X.m2_producers.producers) || {};
    const by = d3.group(M.systems, (s) => s.producer);
    return [...by].map(([prod, sys]) => {
      const f = new Set(sys.flatMap((s) => s.f));
      const meta = P[prod] || { short: prod, archetype: 'other', provider: null };
      return { prod, short: meta.short, arch: meta.archetype, provider: meta.provider, sys: sys.map((s) => s.name), f, n: f.size };
    });
  }
  function drawHeatmap() {
    const host = document.getElementById('m2-heatmap'); if (!host) return;
    const rows = hmData(), nP = rows.length, nF = MD.matrix.features.length;
    const miss = X.m2_missing || { columns: [], rows: [] };
    const missBy = Object.fromEntries(miss.rows.map((r) => [r.key, r]));
    const flat = COLS.flatMap(([g, cs]) => cs.map(([lab, idx]) => ({ g, lab, idx, prev: rows.filter((r) => idx.some((i) => r.f.has(i))).length / nP })));
    rows.forEach((r) => { r.nc = flat.filter((c) => c.idx.some((i) => r.f.has(i))).length; });
    const mk = miss.columns.map((c, k) => k).filter((k) => MISS_SHOW.includes(miss.columns[k]));
    const featName = (i) => { const f = MD.matrix.features[i]; return `${f.cat}: ${f.name}`; };
    // our TUM HEMS: value per hems-finder feature index (1 / 0.5 / 'a' / missing = no); column = best of its fields
    const OF = X.m2_ours_features || null;
    const ourF = (i) => (OF && OF.v[String(i)] != null ? OF.v[String(i)] : 0);
    const rank = (v) => (v === 1 ? 3 : v === 0.5 ? 2 : v === 'a' ? 1 : 0);
    const ourVal = (idx) => idx.map(ourF).reduce((a, b) => (rank(b) > rank(a) ? b : a), 0);
    const ourN = OF ? Object.values(OF.v).reduce((s, v) => { s.full += v === 1; s.part += v === 0.5; s.plan += v === 'a'; return s; }, { full: 0, part: 0, plan: 0 }) : null;
    const ourCore = OF ? flat.filter((c) => ourVal(c.idx) === 1).length : null;
    let order = rows.slice();
    if (hmSort === 'n') order.sort((a, b) => b.nc - a.nc || d3.ascending(a.short.toLowerCase(), b.short.toLowerCase()));
    if (hmSort === 'name') order.sort((a, b) => d3.ascending(a.short.toLowerCase(), b.short.toLowerCase()));
    const archOrder = ARCH_IDS.concat(['other']);
    if (hmSort === 'arch') order.sort((a, b) => archOrder.indexOf(a.arch) - archOrder.indexOf(b.arch) || b.nc - a.nc);
    const cellMiss = (v) => v === 1 ? 'on' : v === 0.5 ? 'half' : v === 'a' ? 'ann' : v === 0 ? 'no' : 'na';
    const missText = (v) => v === 1 ? 'yes' : v === 0.5 ? 'partly' : v === 'a' ? 'announced, not shipped' : v === 0 ? 'no' : 'not researched';
    const narrow = (host.clientWidth || 800) < 520, RW = narrow ? 132 : 196, GW = 14,
      CW = narrow ? 18 : Math.max(18, Math.min(30, Math.floor(((host.clientWidth || 800) - RW - GW - 4) / (flat.length + mk.length)))), TW = RW + flat.length * CW + GW + mk.length * CW;
    let h = `<table class="m2-hm" style="width:${TW}px"><colgroup><col style="width:${RW}px">${flat.map(() => `<col style="width:${CW}px">`).join('')}<col style="width:${GW}px">${mk.map(() => `<col style="width:${CW}px">`).join('')}</colgroup><thead><tr class="grp"><th class="rowh"></th>`;
    COLS.forEach(([g, cs], gi) => { h += `<th colspan="${cs.length}"><span class="${gi % 2 ? 'lo' : 'hi'}">${esc(g)}</span></th>`; });
    h += `<th class="gap"></th><th colspan="${mk.length}"><span class="${COLS.length % 2 ? 'lo' : 'hi'}" style="color:var(--ink)">Not on hems-finder</span></th></tr><tr class="cols"><th class="rowh" style="vertical-align:bottom;padding-bottom:6px;font-weight:500;font-size:11px;color:var(--muted)">Vendor <span style="float:right">core of ${flat.length}</span></th>`;
    flat.forEach((c, j) => {
      h += `<th class="c" data-j="${j}"><span class="lb">${esc(c.lab)}</span><span class="pv"><b style="height:${(c.prev * 100).toFixed(1)}%"></b></span><span class="pc">${Math.round(c.prev * 100)}</span></th>`;
    });
    h += '<th class="gap"></th>';
    mk.forEach((k) => { const c = miss.columns[k]; h += `<th class="c miss"><span class="lb">${esc(c)}</span><span class="pv"></span><span class="pc">–</span></th>`; });
    h += '</tr></thead><tbody>';
    const rowHtml = (r, cls, cells, missRow) => {
      let s = `<tr class="${cls}" data-p="${esc(r.prod || '')}"><td class="rowh" title="${esc(r.prod || r.short)}"><i style="background:var(${r.arch === 'ours' ? '--accent' : archTok(r.arch)})"></i><span class="nm" style="max-width:${narrow ? 84 : 150}px">${esc(r.short)}</span><span class="n">${r.nc == null ? '' : r.nc}</span></td>`;
      s += cells; s += '<td class="gap"></td>';
      mk.forEach((k) => { const v = missRow ? missRow.v[k] : null; s += `<td class="c" data-m="${k}"><span class="${cellMiss(v)}"></span></td>`; });
      return s + '</tr>';
    };
    // our TUM HEMS on top of every sort order (benchmark row, team member 26.11.2026); values = own assessment, data/m2_ours_features.json
    const ours = missBy.ours;
    if (ours && OF) {
      const oursCells = flat.map((c, j) => `<td class="c" data-j="${j}"><span class="${cellMiss(ourVal(c.idx))}"></span></td>`).join('');
      h += `<tr class="gh ours-gh"><td class="rowh">Our prototype</td><td colspan="${flat.length + 1 + mk.length}"></td></tr>`;
      h += rowHtml({ short: narrow ? 'TUM HEMS' : (OF.label || 'TUM HEMS (ours)'), arch: 'ours', nc: ourCore, prod: '' }, 'ours', oursCells, ours);
      if (hmSort !== 'arch') h += `<tr class="gh"><td class="rowh">Market (${nP} vendors)</td><td colspan="${flat.length + 1 + mk.length}"></td></tr>`;
    }
    let lastArch = null;
    order.forEach((r) => {
      if (hmSort === 'arch' && r.arch !== lastArch) {
        lastArch = r.arch;
        const cnt = order.filter((q) => q.arch === r.arch).length;
        h += `<tr class="gh"><td class="rowh">${esc(archLabel(r.arch))} (${cnt})</td><td colspan="${flat.length + 1 + mk.length}"></td></tr>`;
      }
      const cells = flat.map((c, j) => `<td class="c" data-j="${j}"><span class="${c.idx.some((i) => r.f.has(i)) ? 'on' : 'off'}"></span></td>`).join('');
      const hl = r.provider === 'gridX GmbH' || r.provider === 'Consolinno Energy GmbH';
      h += rowHtml(r, hl ? 'hl' : '', cells, missBy[r.provider]);
    });
    h += '</tbody></table>';
    host.innerHTML = h;
    // tooltips (delegated)
    const byProd = new Map(rows.map((r) => [r.prod, r]));
    host.onmousemove = (ev) => {
      const td = ev.target.closest('td.c, th.c, td.rowh'); if (!td) { UI.tip(null); return; }
      const tr = td.closest('tr');
      if (td.tagName === 'TH') {
        const j = +td.dataset.j; if (Number.isNaN(j)) { UI.tip('<b>Not tracked by hems-finder</b><br>Filled only for our Flexibility Manager, gridX and Consolinno (own research)', ev); return; }
        const c = flat[j];
        UI.tip(`<b>${esc(c.g)}: ${esc(c.lab)}</b><br>${Math.round(c.prev * 100)} % of ${nP} vendors (${Math.round(c.prev * nP)})<br><span style="opacity:.75">${c.idx.map(featName).map(esc).join('<br>')}</span>`, ev); return;
      }
      const r = byProd.get(tr.dataset.p);
      const isOurs = tr.classList.contains('ours');
      if (td.classList.contains('rowh')) {
        if (isOurs) { UI.tip(`<b>TUM HEMS (ours): Flexibility Manager prototype</b><br>Own assessment against the hems-finder list, not a hems-finder entry<br>${ourCore} of ${flat.length} core features built<br>Full hems-finder list: ${ourN.full} of ${nF} built, ${ourN.part} partly, ${ourN.plan} planned`, ev); return; }
        if (!r) { UI.tip(null); return; }
        UI.tip(`<b>${esc(r.prod)}</b><br>${esc(archLabel(r.arch))}<br>Systems: ${r.sys.map(esc).join(', ')}<br>${r.nc} of ${flat.length} core features claimed (${r.n} of ${nF} on hems-finder)`, ev); return;
      }
      if (td.dataset.m != null) {
        const k = +td.dataset.m; const mr = isOurs ? missBy.ours : (r ? missBy[r.provider] : null);
        const nm = isOurs ? 'TUM HEMS' : (r ? r.short : '');
        UI.tip(`<b>${esc(nm)}: ${esc(miss.columns[k])}</b><br>${mr ? esc(missText(mr.v[k])) + '<br><span style="opacity:.75">' + esc(mr.notes[k]) + '</span>' : 'not researched'}`, ev); return;
      }
      const j = +td.dataset.j; const c = flat[j];
      if (isOurs) {
        const lab = (v) => (v === 1 ? 'yes (built)' : v === 0.5 ? 'partly' : v === 'a' ? 'planned' : 'no');
        const lines = c.idx.map((i) => `${esc(featName(i))}: <b>${lab(ourF(i))}</b>${OF.notes[String(i)] ? '<br><span style="opacity:.75">' + esc(OF.notes[String(i)]) + '</span>' : ''}`);
        UI.tip(`<b>TUM HEMS: ${esc(c.g)}, ${esc(c.lab)}</b><br>${lines.join('<br>')}<br><span style="opacity:.75">Market: ${Math.round(c.prev * 100)} % of ${nP} vendors claim it</span>`, ev); return;
      }
      if (!r) { UI.tip(null); return; }
      const hitF = c.idx.filter((i) => r.f.has(i));
      UI.tip(`<b>${esc(r.short)}: ${esc(c.g)}, ${esc(c.lab)}</b><br>${hitF.length ? 'yes (vendor claim)<br><span style="opacity:.75">' + hitF.map(featName).map(esc).join('<br>') + '</span>' : 'not claimed'}`, ev);
    };
    host.onmouseleave = () => UI.tip(null);
    const key = document.getElementById('m2-hm-key');
    if (key) key.innerHTML = `<span><em style="background:var(--ink);opacity:.82"></em>claimed</span><span><em style="box-shadow:inset 0 0 0 1px var(--line)"></em>not claimed</span>` +
      `<span><em style="box-shadow:inset 0 0 0 1.5px var(--muted)"></em>no (our research)</span>` +
      `<span><em style="background:linear-gradient(90deg,var(--ink) 50%,transparent 50%);box-shadow:inset 0 0 0 1px var(--ink)"></em>partly</span>` +
      `<span><em style="outline:1px dashed var(--ink);outline-offset:-1px;background:repeating-linear-gradient(135deg,transparent 0 2px,var(--line) 2px 3px)"></em>announced / planned</span>` +
      `<span><em style="background:color-mix(in srgb,var(--accent) 40%,var(--panel));box-shadow:inset 0 0 0 1.5px var(--accent)"></em>our TUM HEMS</span>`;
  }
  function initHeatmap() {
    if (!document.getElementById('m2-heatmap')) return;
    segBind(document.getElementById('m2-hm-sort'), (v) => { hmSort = v; drawHeatmap(); });
    drawHeatmap(); UI.onTheme(drawHeatmap);
  }

  /* =====================================================================================
     (d) Strategic groups
     ===================================================================================== */
  const BM = MD.r.business_models || { players: [], meta: { layers: [] } };
  const SG = X.m2_strategic || { players: {}, value_capture: {}, ours: null };
  const LAYERS = (BM.meta && BM.meta.layers) || ['device', 'gateway', 'optimization', 'app', 'tariff', 'flex', 'installation'];
  const LAYER_LAB = { device: 'Device', gateway: 'Gateway', optimization: 'Optimisation', app: 'App', tariff: 'Tariff', flex: 'Flex / VPP', installation: 'Installation' };
  let sgMode = 'matrix';
  const players = () => BM.players.map((p) => Object.assign({}, p, SG.players[p.name] || { short: p.name, archetype: p.archetype, rm_index: null }));
  function drawSG() {
    const host = document.getElementById('m2-sg'); if (!host) return;
    host.innerHTML = '';
    // short unit line in the side text; the full explanation sits in "Sources & notes"
    const subS = document.getElementById('m2-sg-sub');
    const sub = document.getElementById('m2-sg-sub-long');
    const ps = players();
    const VC = SG.value_capture || {};
    if (sgMode === 'matrix') {
      if (subS) subS.textContent = `Share of players per group active in each layer · n = ${ps.length}`;
      if (sub) sub.textContent = `Share of profiled players per strategic group that are active in each value-chain layer; n = ${ps.length} players; circle area = share, label = players active / players in group.`;
      const wrap = document.createElement('div'); wrap.className = 'm2-sgwrap'; host.appendChild(wrap);
      const maxD = 30;
      // compact: value capture per layer and player names per group are shown on hover, not as cell text
      let h = '<table class="m2-sg"><thead><tr><th class="l">Strategic group</th>';
      LAYERS.forEach((l) => {
        const n = ps.filter((p) => p.layers.includes(l)).length;
        h += `<th class="${l === 'flex' ? 'flex' : ''}" data-l="${l}"><span class="lb">${esc(LAYER_LAB[l] || l)}</span> <span class="grey" style="font-weight:400">${n}</span></th>`;
      });
      h += '</tr></thead><tbody>';
      const cell = (k, n, tok, l) => {
        const share = n ? k / n : 0, d = Math.sqrt(share) * maxD;
        return `<td class="${l === 'flex' ? 'flex' : ''}" data-l="${l}"><span class="cv">${k ? `<i style="width:${d.toFixed(1)}px;height:${d.toFixed(1)}px;background:var(${tok})"></i>` : '<i style="width:4px;height:1px;background:var(--line)"></i>'}<small>${k ? k + '/' + n : ''}</small></span></td>`;
      };
      if (SG.ours) {
        h += `<tr class="ours"><td class="l"><b>${esc(SG.ours.short)}</b></td>`;
        LAYERS.forEach((l) => { h += SG.ours.layers.includes(l) ? cell(1, 1, '--ink', l) : cell(0, 1, '--ink', l); });
        h += '</tr>';
      }
      UI.ARCH.forEach((a) => {
        const g = ps.filter((p) => p.archetype === a.id); if (!g.length) return;
        h += `<tr data-a="${a.id}"><td class="l"><b><i style="display:inline-block;width:9px;height:9px;margin-right:7px;background:var(${a.tok})"></i>${esc(a.label)}</b></td>`;
        LAYERS.forEach((l) => { h += cell(g.filter((p) => p.layers.includes(l)).length, g.length, a.tok, l); });
        h += '</tr>';
      });
      h += '</tbody></table>';
      wrap.innerHTML = h;
      wrap.onmousemove = (ev) => {
        const th = ev.target.closest('th[data-l]');
        if (th) { // layer header: players active + value capture
          const l = th.dataset.l, n = ps.filter((p) => p.layers.includes(l)).length;
          UI.tip(`<b>${esc(LAYER_LAB[l] || l)}</b><br>${n} of ${ps.length} players active<br><span style="opacity:.75">${esc(VC[l] || '')}</span>`, ev); return;
        }
        const tl = ev.target.closest('td.l');
        if (tl) { // row label: players in the group, or the note on our prototype
          const tr = tl.closest('tr');
          if (tr.classList.contains('ours')) { UI.tip(`<b>${esc(SG.ours.short)}</b><br>${esc(SG.ours.note)}`, ev); return; }
          const a = tr.dataset.a, g = ps.filter((p) => p.archetype === a);
          UI.tip(`<b>${esc(archLabel(a))}</b><br>${g.length} profiled: ${g.map((p) => esc(p.short)).join(', ')}`, ev); return;
        }
        const td = ev.target.closest('td[data-l]'); if (!td) { UI.tip(null); return; }
        const tr = td.closest('tr'), l = td.dataset.l;
        if (tr.classList.contains('ours')) { UI.tip(`<b>Flexibility Manager, ${esc(LAYER_LAB[l])}</b><br>${SG.ours.layers.includes(l) ? 'covered (prototype)' : 'not covered'}`, ev); return; }
        const a = tr.dataset.a, g = ps.filter((p) => p.archetype === a), inL = g.filter((p) => p.layers.includes(l));
        UI.tip(`<b>${esc(archLabel(a))}, ${esc(LAYER_LAB[l])}</b><br>${inL.length} of ${g.length}: ${inL.map((p) => esc(p.short)).join(', ') || 'none'}<br><span style="opacity:.75">${esc(VC[l] || '')}</span>`, ev);
      };
      wrap.onmouseleave = () => UI.tip(null);
      return;
    }
    // positioning map
    if (subS) subS.textContent = `Layers covered vs revenue-model index (own classification) · n = ${ps.length}`;
    if (sub) sub.textContent = `Each profiled player by number of value-chain layers covered (x) and revenue-model index (y: 0 = hardware and installation, 1 = tariff, flex and trading; own classification); n = ${ps.length}.`;
    const w = Math.max(300, host.clientWidth || 800), phone = w < 560;
    const m = { t: 22, r: 16, b: 44, l: phone ? 36 : 48 }, hP = phone ? 360 : 440, h = m.t + hP + m.b;
    const x = d3.scaleLinear().domain([0.5, 7.5]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([-0.08, 1.08]).range([m.t + hP, m.t]);
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Positioning map of players by breadth and revenue model');
    // quadrants
    const xm = x(3.5), ym = y(0.5);
    svg.append('rect').attr('x', xm).attr('y', m.t).attr('width', w - m.r - xm).attr('height', ym - m.t).attr('fill', C('--accent')).attr('opacity', 0.13);
    const ql = (tx, ty, anchor, t1, t2) => {
      const tt = svg.append('text').attr('x', tx).attr('y', ty).attr('text-anchor', anchor).style('fill', C('--muted')).style('font-size', phone ? '9.5px' : '10.5px').style('letter-spacing', '.04em');
      tt.append('tspan').attr('x', tx).text(t1); if (t2) tt.append('tspan').attr('x', tx).attr('dy', 12).text(t2);
    };
    ql(w - m.r - 6, m.t + 14, 'end', 'BROAD + TARIFF/FLEX-LED', phone ? '' : 'recurring revenue, owns the household');
    ql(m.l + 6, m.t + 14, 'start', 'NARROW + TARIFF/FLEX-LED', phone ? '' : 'tariff and flex specialists');
    ql(m.l + 6, m.t + hP - 18, 'start', 'NARROW + HARDWARE-LED', phone ? '' : 'one-off sale, price pressure');
    ql(w - m.r - 6, m.t + hP - 18, 'end', 'BROAD + HARDWARE-LED', phone ? '' : 'margin from devices and installation');
    const ax = svg.append('g').attr('class', 'ax');
    d3.range(1, 8).forEach((t) => {
      ax.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', m.t + hP).attr('stroke', C('--line'));
      ax.append('text').attr('x', x(t)).attr('y', m.t + hP + 16).attr('text-anchor', 'middle').text(t);
    });
    [0, 0.5, 1].forEach((t) => {
      ax.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', t === 0.5 ? C('--grey') : C('--line')).attr('stroke-dasharray', t === 0.5 ? '3 3' : null);
      ax.append('text').attr('x', m.l - 6).attr('y', y(t) + 3.5).attr('text-anchor', 'end').text(t);
    });
    svg.append('line').attr('x1', xm).attr('x2', xm).attr('y1', m.t).attr('y2', m.t + hP).attr('stroke', C('--grey')).attr('stroke-dasharray', '3 3');
    svg.append('text').attr('x', (m.l + w - m.r) / 2).attr('y', m.t + hP + 34).attr('text-anchor', 'middle').style('fill', C('--grey')).style('font-size', '10.5px').text('Value-chain layers covered (of 7)');
    svg.append('text').attr('transform', `translate(11,${m.t + hP / 2}) rotate(-90)`).attr('text-anchor', 'middle').style('fill', C('--grey')).style('font-size', '10.5px').text('Revenue model: hardware → tariff / flex');
    // our prototype: x known (2 layers), y open -> vertical band
    if (SG.ours) {
      const xo = x(SG.ours.layers.length);
      svg.append('line').attr('x1', xo).attr('x2', xo).attr('y1', y(1.04)).attr('y2', y(-0.04)).attr('stroke', C('--accent')).attr('stroke-width', 6).attr('opacity', 0.55);
      svg.append('text').attr('x', xo + 6).attr('y', y(1.04) + 2).attr('class', 'lab-strong').style('font-size', '11px').text(phone ? 'Ours: model open' : 'Flexibility Manager: 2 layers, revenue model open');
    }
    const pts = ps.filter((p) => p.rm_index != null).map((p) => ({ p, tx: x(p.layers.length), ty: y(p.rm_index), x: x(p.layers.length), y: y(p.rm_index) }));
    const r = phone ? 4.5 : 5.5;
    const sim = d3.forceSimulation(pts).force('x', d3.forceX((d) => d.tx).strength(0.6)).force('y', d3.forceY((d) => d.ty).strength(0.9)).force('c', d3.forceCollide(r + 1.5)).stop();
    for (let i = 0; i < 160; i++) sim.tick();
    const g = svg.append('g').selectAll('g').data(pts).join('g').attr('transform', (d) => `translate(${d.x},${d.y})`);
    g.append('circle').attr('r', r).attr('fill', (d) => UI.archColor(d.p.archetype)).attr('stroke', (d) => d.p.confidence === 'low' ? C('--ink') : C('--bg'))
      .attr('stroke-dasharray', (d) => d.p.confidence === 'low' ? '2 1.5' : null).attr('stroke-width', 1);
    g.filter((d) => d.p.short === 'gridX' || d.p.short === 'Consolinno').append('circle').attr('r', r + 3).attr('fill', 'none').attr('stroke', C('--ink')).attr('stroke-width', 1.2);
    UI.bindTip(g, (d) => `<b>${esc(d.p.name)}</b><br>${esc(archLabel(d.p.archetype))}<br>Layers (${d.p.layers.length}): ${d.p.layers.map((l) => esc(LAYER_LAB[l] || l)).join(', ')}<br>Revenue lines: ${d.p.revenue_model.map(esc).join('; ')}<br>Index: ${fmt(d.p.rm_index, 2)}<br>Payer: ${esc(d.p.payer || '')}${confNote(d.p.confidence)}`);
    const KEYS = new Set(['gridX', 'Consolinno', '1KOMMA5°', 'Enpal', 'Tibber', 'Octopus', 'E.ON Home', 'Kiwigrid', 'SMA', 'sonnen', 'EnBW Mavi', 'Viessmann', 'Rabot', 'Podero', 'Flexa']);
    const items = pts.slice().sort((a, b) => KEYS.has(b.p.short) - KEYS.has(a.p.short)).filter((d) => !phone || KEYS.has(d.p.short))
      .map((d) => ({ x: d.x, y: d.y, r, text: d.p.short, size: KEYS.has(d.p.short) ? 11 : 10, weight: (d.p.short === 'gridX' || d.p.short === 'Consolinno') ? 600 : 400, force: d.p.short === 'gridX' || d.p.short === 'Consolinno' }));
    placeLabels(items, { x0: m.l, y0: m.t + 28, x1: w - m.r, y1: m.t + hP - 26 }, pts.map((d) => ({ x: d.x, y: d.y, r }))).forEach((l) => {
      svg.append('text').attr('x', l.lx).attr('y', l.ly).attr('text-anchor', l.anchor).attr('class', l.weight === 600 ? 'lab-strong' : 'lab')
        .style('font-size', l.size + 'px').style('paint-order', 'stroke').style('stroke', C('--panel')).style('stroke-width', '3px').style('stroke-linejoin', 'round').text(l.text);
    });
  }
  function initSG() {
    if (!document.getElementById('m2-sg')) return;
    segBind(document.getElementById('m2-sg-mode'), (v) => { sgMode = v; drawSG(); });
    drawSG(); UI.onTheme(drawSG);
  }

  function fillCounts() {
    const n = { prov: provs.length, dated: dated.length, events: (ET.events || []).length, comp: COMP.length };
    document.querySelectorAll('[data-m2n]').forEach((el) => { const v = n[el.dataset.m2n]; if (v != null) el.textContent = fmt(v); });
  }
  function init() {
    try { fillCounts(); } catch (e) { console.error('m2 counts', e); }
    try { initEntry(); } catch (e) { console.error('m2 entry', e); }
    try { initBubble(); } catch (e) { console.error('m2 bubble', e); }
    try { initHeatmap(); } catch (e) { console.error('m2 heatmap', e); }
    try { initSG(); } catch (e) { console.error('m2 strategic', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* heatmap: first rows only, button shows all vendors (compact layout, 26.11.2026) */
(function () {
  const w = document.getElementById('m2-heatmap'), b = document.getElementById('m2-hm-all');
  if (!w || !b) return;
  b.addEventListener('click', () => {
    const open = w.classList.toggle('m2-clip') === false;
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? 'Show fewer vendors' : 'Show all 80 vendors';
  });
})();

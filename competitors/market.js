/* 02 Hersteller-Karte mit Zeitstrahl und Funktionsfilter */
(function(){
  const {el, esc, tip, r} = window.UI;
  const M = window.HEMS_MAP, FE = window.HEMS_FEATURES, SY = window.HEMS_SYSTEMS, PR = window.HEMS_PRODUCERS, HS = window.HEMS_START || {};
  const proj = (lat, lon) => [(lon - M.LON0) * M.C * M.K, (M.LAT1 - lat) * M.K];
  const COL = {match: '#000', recent: '#ffcf22', off: '#cfcfcf', bg: '#fff'};

  /* Hersteller aggregieren */
  const prods = {};
  SY.forEach(([id, name, prod, feats]) => {
    const p = prods[prod] || (prods[prod] = {name: prod, systems: [], meta: PR[prod] || null});
    p.systems.push({id, name, feats: new Set(feats)});
  });
  const plist = Object.values(prods);

  /* Positionen, gleiche Orte auffächern */
  const seen = {};
  plist.forEach(p => {
    if (!p.meta || p.meta[1] == null) return;
    const [x, y] = proj(p.meta[1], p.meta[2]);
    const key = Math.round(x / 6) + ':' + Math.round(y / 6);
    const k = seen[key] = (seen[key] || 0) + 1, a = (k - 1) * 2.1;
    p.x = x + (k > 1 ? Math.cos(a) * 9 : 0);
    p.y = y + (k > 1 ? Math.sin(a) * 9 : 0);
  });

  /* Filter-Chips */
  const cats = {};
  FE.forEach(([id, cat, name]) => (cats[cat] = cats[cat] || []).push({id, name}));
  const catOrder = ['System type', 'Sales channel', 'Algorithm', 'Dynamic tariff', 'PV surplus', 'Heat pump', 'Electric vehicle', '§14a control', '§9 EEG control', 'Variable grid fees', 'Installation and commissioning', 'Certification'];
  const featCount = {};
  SY.forEach(s => s[3].forEach(f => featCount[f] = (featCount[f] || 0) + 1));
  const selected = new Set();
  const fbox = el('mk-feats');
  catOrder.forEach(cat => {
    if (!cats[cat]) return;
    const wrap = document.createElement('div'); wrap.className = 'mk-cat';
    const h = document.createElement('h4'); h.textContent = cat;
    const chips = document.createElement('div'); chips.className = 'chips';
    cats[cat].forEach(f => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.f = f.id; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="box"></span>${esc(f.name)}<span class="n">${featCount[f.id] || 0}</span>`;
      b.addEventListener('click', () => { selected.has(f.id) ? selected.delete(f.id) : selected.add(f.id); setPreset(null); update(); });
      chips.append(b);
    });
    wrap.append(h, chips); fbox.append(wrap);
  });
  const presets = {flex: [3, 8, 1, 2], '14a': [26, 3], wl: [21], os: [28], none: []};
  function setPreset(k){ document.querySelectorAll('[data-mkp]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mkp === k)); }
  document.querySelectorAll('[data-mkp]').forEach(b => b.addEventListener('click', () => {
    selected.clear(); presets[b.dataset.mkp].forEach(f => selected.add(f)); setPreset(b.dataset.mkp); update();
  }));

  /* Zeitachse */
  let mode = 'found';
  const yearOf = p => mode === 'found' ? (p.meta ? p.meta[3] : null) : (HS[p.name] ? HS[p.name][0] : null);
  const isLate = p => HS[p.name] && p.meta && p.meta[3] != null && HS[p.name][0] - p.meta[3] >= 15;
  const inMode = p => mode === 'found' || !!HS[p.name];
  const range = () => mode === 'found' ? [1990, 2026] : [2010, 2026];
  const short = n => n.replace(/( Holding International)? GmbH$| Solar Technology AG$| Energie Baden-Württemberg AG$| Strom GmbH$| Home Comfort Group$| GmbH & Co\. KG$| AG$| SE$/, '');

  function drawHist(cur){
    const host = el('mk-hist'), W = Math.max(300, host.clientWidth), H = 48;
    const [y0, y1] = range(), n = y1 - y0 + 1, bw = W / n, cnt = {};
    plist.forEach(p => { const y = yearOf(p); if (y == null) return; const k = Math.max(y, y0); cnt[k] = (cnt[k] || 0) + 1; });
    const max = Math.max(1, ...Object.values(cnt));
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    for (let y = y0; y <= y1; y++) {
      const c = cnt[y] || 0; if (!c) continue;
      const h = c / max * (H - 16), x = (y - y0) * bw;
      s += `<rect x="${x + 1}" y="${H - 14 - h}" width="${Math.max(1, bw - 2)}" height="${h}" fill="${y <= cur ? '#000' : '#d6d6d6'}"><title>${y === y0 && mode === 'found' ? 'up to ' + y0 : y}: ${c} vendors</title></rect>`;
    }
    s += `<line x1="0" x2="${W}" y1="${H - 13.5}" y2="${H - 13.5}" stroke="#000"/>`;
    (mode === 'found' ? [1990, 2000, 2010, 2020] : [2010, 2014, 2018, 2022, 2026]).forEach(y => {
      s += `<text x="${Math.min((y - y0) * bw + 1, W - 28)}" y="${H - 1}">${y === 1990 && mode === 'found' ? '≤ 1990' : y}</text>`;
    });
    host.innerHTML = s + '</svg>';
  }

  function drawInsight(){
    const t = el('mk-insight');
    if (mode === 'found') { t.textContent = 'Year the company was founded. Many vendors are decades old and entered the HEMS business late; the second timeline shows this.'; return; }
    const ys = Object.values(HS).map(v => v[0]);
    const a = ys.filter(y => y <= 2015).length, b = ys.filter(y => y > 2015 && y <= 2020).length, c = ys.filter(y => y > 2020).length;
    const late = plist.filter(isLate).map(p => short(p.name));
    t.textContent = `Of ${ys.length} researched vendors, ${a} launched their HEMS by 2015, ${b} between 2016 and 2020 and ${c} from 2021. Late entrants: ${late.join(', ')}.`;
  }

  function sysMatch(s){ for (const f of selected) if (!s.feats.has(f)) return false; return true; }
  function drawMap(year){
    const host = el('mk-map');
    let s = `<svg viewBox="0 0 ${M.W} ${M.H}" role="img" aria-label="Map of HEMS vendors in Germany and neighbouring countries"><defs><clipPath id="mkclip"><rect width="${M.W}" height="${M.H}"/></clipPath></defs><g clip-path="url(#mkclip)">`;
    M.paths.forEach(p => { s += `<path class="mk-country${p.c === 'DE' ? ' de' : ''}" d="${p.d}"/>`; });
    s += '</g>';
    const vis = plist.filter(p => p.x != null && inMode(p) && (yearOf(p) == null || yearOf(p) <= year));
    vis.sort((a, b) => (a.match - b.match) || (b.systems.length - a.systems.length));
    let labels = '';
    vis.forEach(p => {
      const rr = 4.5 + Math.sqrt(p.systems.length) * 2.4, y = yearOf(p);
      const recent = y != null && y > year - 3 && y <= year;
      const open = y == null, minOnly = mode === 'hems' && HS[p.name] && HS[p.name][1] === 'min';
      const fill = !p.match ? COL.off : open || minOnly ? COL.bg : recent ? COL.recent : COL.match;
      const stroke = !p.match ? '#fff' : open || minOnly || recent ? '#000' : '#fff';
      const cx = p.x.toFixed(1), cy = p.y.toFixed(1);
      const isFocus = p.name === 'gridX GmbH' || p.name === 'Consolinno Energy GmbH';
      s += `<g class="mk-dot" tabindex="0" data-p="${encodeURIComponent(p.name)}">`;
      if (mode === 'hems' && isLate(p)) s += `<circle cx="${cx}" cy="${cy}" r="${rr + 3.5}" fill="none" stroke="#000" stroke-width="1" opacity="${p.match ? 1 : .4}"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${fill}" stroke="${stroke}" stroke-width="${open || minOnly ? 1.8 : 1}"${minOnly ? ' stroke-dasharray="3 2"' : ''}/>`;
      s += '</g>';
      if (isFocus) labels += `<text x="${(+cx + rr + 4).toFixed(1)}" y="${(+cy + 4).toFixed(1)}" style="font:500 12px var(--sans);fill:#000;paint-order:stroke;stroke:#fff;stroke-width:3px;pointer-events:none">${p.name === 'gridX GmbH' ? 'gridX' : 'Consolinno'}</text>`;
    });
    host.innerHTML = s + labels + '</svg>';
    host.querySelectorAll('.mk-dot').forEach(g => {
      const p = prods[decodeURIComponent(g.dataset.p)];
      const show = e => {
        const m = p.meta, h = HS[p.name], ms = p.systems.filter(sysMatch).length;
        let html = `<div class="h">${esc(p.name)}</div>` + r('Location', esc(m[0])) + r('Founded', (m[3] ?? 'unknown') + (m[4] === 'w' ? ' *' : '')) +
          r('HEMS launch', h ? (h[1] === 'min' ? 'by ' : '') + h[0] : 'not researched') +
          r(selected.size ? 'match filter' : 'Features', selected.size ? `${ms} of ${p.systems.length}` : `${Math.max(...p.systems.map(x => x.feats.size))} of 36`);
        html += `<div class="note">${esc(p.systems.map(x => x.name).join(', '))}${h ? '<br>' + esc(h[2]) : ''}</div>`;
        if (e && e.clientX != null) tip(html, e);
        else { const b = g.getBoundingClientRect(); tip(html, {clientX: b.right, clientY: b.top}); }
      };
      g.addEventListener('mousemove', show); g.addEventListener('focus', show);
      g.addEventListener('mouseleave', () => tip()); g.addEventListener('blur', () => tip());
    });
    const onMap = plist.filter(p => p.x != null && inMode(p));
    const dated = onMap.filter(p => yearOf(p) != null && yearOf(p) <= year).length;
    el('mk-status').textContent = mode === 'found'
      ? `In ${year}: ${dated} vendors with a known founding year, ${vis.length - dated} more without a year, ${vis.length} of ${onMap.length} on the map.`
      : `In ${year}: ${dated} of ${onMap.length} researched vendors on the map have a residential HEMS on the market.`;
    const abroad = plist.filter(p => p.meta && p.meta[4] === 'a' && inMode(p) && (yearOf(p) == null || yearOf(p) <= year));
    const noLoc = mode === 'hems' ? plist.filter(p => HS[p.name] && !p.meta && HS[p.name][0] <= year) : [];
    const parts = abroad.map(p => `${short(p.name)} (${p.meta[0]}${yearOf(p) ? ', ' + yearOf(p) : ''})`).concat(noLoc.map(p => `${short(p.name)} (no location, ${HS[p.name][0]})`));
    el('mk-abroad').textContent = parts.length ? 'Outside the map area: ' + parts.join(' · ') : '';
  }

  function drawList(){
    const tb = el('mk-rows');
    const rows = SY.map(([id, name, prod, feats]) => ({name, prod, n: feats.length, ok: sysMatch({feats: new Set(feats)}), meta: PR[prod], h: HS[prod]}))
      .filter(x => x.ok).sort((a, b) => b.n - a.n);
    tb.innerHTML = rows.map(x => {
      const m = x.meta, hl = x.prod === 'gridX GmbH' || x.prod === 'Consolinno Energy GmbH';
      return `<tr${hl ? ' class="hl"' : ''}><td>${esc(x.name)}</td><td>${esc(short(x.prod))}</td><td>${m ? esc(m[0]) + (m[4] === 'w' ? ' *' : '') : 'unknown'}</td><td class="r">${m && m[3] ? m[3] : '–'}</td><td class="r">${x.h ? (x.h[1] === 'min' ? '≤ ' : '') + x.h[0] : '–'}</td><td class="r">${x.n} / 36</td></tr>`;
    }).join('');
  }

  function update(){
    plist.forEach(p => p.match = p.systems.some(sysMatch));
    el('mk-hits').textContent = SY.filter(s => sysMatch({feats: new Set(s[3])})).length;
    document.querySelectorAll('#mk-feats button').forEach(b => b.setAttribute('aria-pressed', selected.has(+b.dataset.f)));
    drawMap(+el('mk-year').value); drawList();
  }
  const yr = el('mk-year');
  yr.addEventListener('input', () => { el('mk-year-v').textContent = yr.value; drawHist(+yr.value); drawMap(+yr.value); });
  function setMode(m){
    mode = m;
    const [y0, y1] = range(); yr.min = y0; yr.max = y1; yr.value = y1; el('mk-year-v').textContent = y1;
    document.querySelectorAll('[data-mkmode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mkmode === m));
    document.querySelectorAll('.mk-hemsonly').forEach(x => x.hidden = m !== 'hems');
    drawInsight(); drawHist(y1); drawMap(y1);
  }
  document.querySelectorAll('[data-mkmode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mkmode)));
  let timer = null;
  const play = el('mk-play');
  play.addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = null; play.textContent = '▶ Play'; return; }
    if (+yr.value >= +yr.max) yr.value = mode === 'found' ? 2000 : 2010;
    play.textContent = '❚❚ Pause';
    timer = setInterval(() => {
      yr.value = +yr.value + 1; yr.dispatchEvent(new Event('input'));
      if (+yr.value >= +yr.max) { clearInterval(timer); timer = null; play.textContent = '▶ Play'; }
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 500);
  });
  update(); setMode('found');
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => drawHist(+yr.value), 120); });
})();

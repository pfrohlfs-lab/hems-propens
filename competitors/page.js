/* Seite: Hilfsfunktionen, Markt-Balken, Finanzen, Funktionsvergleich, Matrix, Preise, Break-even */
(function(){
  const el = id => document.getElementById(id);
  const fmt = (n, d = 0) => n.toLocaleString('en-GB', {minimumFractionDigits: d, maximumFractionDigits: d});
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const C = {ink: '#000', g: '#141414', c: '#9a9a9a', o: '#ffcf22', grey: '#8f8f8f', line: '#e1e1e1', loss: '#b9b9b9'};

  /* Tooltip */
  const tipEl = el('tip');
  function tip(html, e){
    if (!html) { tipEl.hidden = true; return; }
    tipEl.innerHTML = html; tipEl.hidden = false;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
  }
  const r = (k, v, col) => `<div class="r"><span>${col ? `<i style="background:${col}${col === C.o ? ';outline:1px solid #000' : ''}"></i>` : ''}${k}</span><span>${v}</span></div>`;
  window.UI = {el, fmt, esc, tip, r, C};

  /* Index: aktuelle Sektion markieren */
  const links = [...document.querySelectorAll('#nav .it')];
  const targets = links.map(a => document.querySelector(a.getAttribute('href')));
  function spy(){
    const y = (window.innerWidth > 1000 ? 58 : 0) + 120;
    let k = 0;
    targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top <= y) k = i; });
    links.forEach((a, i) => a.setAttribute('aria-current', i === k ? 'true' : 'false'));
  }
  addEventListener('scroll', spy, {passive: true}); spy();

  /* ---------- 01 Markt-Balken ---------- */
  const SY = window.HEMS_SYSTEMS;
  const gx = SY.find(s => s[2] === 'gridX GmbH'), co = SY.find(s => s[2] === 'Consolinno Energy GmbH');
  const has = (s, ids) => ids.some(f => s[3].includes(f));
  const mrows = [
    ['PV surplus to heat pump', [17]],
    ['PV surplus to battery', [12]],
    ['PV surplus to wallbox', [16]],
    ['Dynamic tariff (at least one device)', [3, 4, 5, 6, 7, 8]],
    ['PV forecast', [2]],
    ['Local without cloud', [20]],
    ['§14a control', [26, 27, 38]],
    ['White label for B2B', [21]],
    ['§9 EEG control', [34, 35]],
    ['Variable grid fees', [39, 40, 41]],
    ['ISO 27001', [36]],
    ['Open source', [28]],
    ['CHP and buffer together', null]
  ];
  (function(){
    const host = el('mkt-bars');
    let h = '<div style="display:grid;gap:7px">';
    mrows.forEach(([name, ids]) => {
      const n = ids ? SY.filter(s => has(s, ids)).length : 0;
      const p = n / SY.length * 100;
      const g = ids && has(gx, ids), c = ids && has(co, ids);
      const sq = (on, col) => `<i style="width:10px;height:10px;display:inline-block;${on ? 'background:' + col : 'border:1px solid #c4c4c4'}"></i>`;
      h += `<div class="bar mb" style="grid-template-columns:minmax(150px,230px) minmax(0,1fr) 44px 34px" data-n="${n}" data-name="${esc(name)}" data-g="${g ? 1 : 0}" data-c="${c ? 1 : 0}">
        <span style="text-align:left;${ids ? '' : 'font-weight:500'}">${esc(name)}</span>
        <span class="tr"><b style="width:${Math.max(p, .6)}%;background:${ids ? C.ink : C.o};${ids ? '' : 'outline:1px solid #000'}"></b></span>
        <span>${fmt(p)} %</span>
        <span style="display:inline-flex;gap:4px;justify-content:flex-end">${sq(g, C.g)}${sq(c, C.c)}</span></div>`;
    });
    host.innerHTML = h + '</div>';
    host.querySelectorAll('.mb').forEach(b => {
      b.addEventListener('mousemove', e => tip(`<div class="h">${b.dataset.name}</div>` + r('Systems', b.dataset.n + ' of 83') +
        r('gridX', b.dataset.g === '1' ? 'yes' : 'no', C.g) + r('Consolinno', b.dataset.c === '1' ? 'yes' : 'no', C.c) +
        (b.dataset.name.startsWith('CHP') ? '<div class="note">Not a feature in the database, and no vendor advertises it. The Flexibility Manager is the only approach with this logic.</div>' : ''), e));
      b.addEventListener('mouseleave', () => tip());
    });
  })();

  /* ---------- 01b Marktgröße ---------- */
  (function(){
    const rows = [['Rooftop PV', 18, C.ink], ['Battery storage', 10, C.ink], ['Electric car', 10, C.ink], ['Heat pump', 9, C.ink], ['Smart meter (share of metering points)', 5.9, C.o], ['CHP (estimate)', 0.8, '#b9b9b9']];
    el('size-bars').innerHTML = '<div style="display:grid;gap:9px">' + rows.map(([n, v, col]) => `<div class="bar" style="grid-template-columns:minmax(150px,260px) minmax(0,1fr) 56px"><span style="text-align:left${col === C.o ? ';font-weight:500' : ''}">${n}</span><span class="tr"><b style="width:${v / 20 * 100}%;background:${col}${col === C.o ? ';outline:1px solid #000;outline-offset:-1px' : ''}"></b></span><span>${n.startsWith('CHP') ? '< 1' : fmt(v, v % 1 ? 1 : 0)} %</span></div>`).join('') + '</div>';
  })();

  /* ---------- 04 Finanzbrücke ---------- */
  const fin = [
    {y: 2020, ein: 3.674, dar: 1.182, cum: 4.602, jf: 1.671, ek: -0.928, kasse: 0.128, ma: null},
    {y: 2021, ein: 7.085, dar: 4.103, cum: 8.395, jf: 3.792, ek: -1.310, kasse: 2.470, ma: 59},
    {y: 2022, ein: 7.085, dar: 16.776, cum: 16.294, jf: 7.899, ek: -9.209, kasse: 6.664, ma: 94},
    {y: 2023, ein: 7.085, dar: 25.936, cum: 28.549, jf: 12.255, ek: -21.464, kasse: 2.030, ma: 158},
    {y: 2024, ein: 50.461, dar: 0, cum: 44.666, jf: 16.117, ek: 5.795, kasse: 2.545, ma: 190}
  ];
  function drawFin(){
    const host = el('fin-chart');
    const W = Math.max(340, host.clientWidth), H = 300, m = {t: 22, r: 96, b: 26, l: 34};
    const iw = W - m.l - m.r, ih = H - m.t - m.b, max = 58;
    const Y = v => m.t + ih - v / max * ih, gw = iw / fin.length, bw = Math.min(46, gw * .3);
    let s = `<svg width="${W}" height="${H}" role="img" aria-label="gridX funding and accumulated losses 2020 to 2024">`;
    for (let v = 0; v <= 50; v += 10) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    fin.forEach((d, i) => {
      const cx = m.l + gw * i + gw / 2, x1 = cx - bw - 3, x2 = cx + 3;
      const tot = d.ein + d.dar;
      s += `<g class="fy" data-i="${i}"><rect x="${m.l + gw * i}" y="${m.t}" width="${gw}" height="${ih}" fill="transparent"/>`;
      s += `<rect x="${x1}" y="${Y(d.ein)}" width="${bw}" height="${Y(0) - Y(d.ein)}" fill="${C.ink}"/>`;
      if (d.dar) s += `<rect x="${x1 + .5}" y="${Y(tot) + .5}" width="${bw - 1}" height="${Y(d.ein) - Y(tot) - 1}" fill="${C.o}" stroke="#000"/>`;
      s += `<rect x="${x2}" y="${Y(d.cum)}" width="${bw}" height="${Y(0) - Y(d.cum)}" fill="${C.loss}"/>`;
      s += `<text class="dl" x="${x1 + bw / 2}" y="${Y(tot) - 6}" text-anchor="middle">${fmt(tot, 1)}</text>`;
      s += i === 4 ? `<text x="${x2 + bw / 2}" y="${Y(d.cum) + 15}" text-anchor="middle" style="fill:#000">${fmt(d.cum, 1)}</text>` : `<text x="${x2 + bw / 2}" y="${Y(d.cum) - 6}" text-anchor="middle">${fmt(d.cum, 1)}</text>`;
      s += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${d.y}</text></g>`;
    });
    // Puffer 2024
    const d = fin[4], cx = m.l + gw * 4 + gw / 2;
    const xr = cx + bw + 3;
    s += `<line x1="${cx - bw - 3}" x2="${xr + 8}" y1="${Y(d.ein)}" y2="${Y(d.ein)}" stroke="#000" stroke-dasharray="2 2"/>`;
    s += `<path d="M${xr + 8},${Y(d.ein)}V${Y(d.cum)}" stroke="#000"/><path d="M${xr + 4},${Y(d.cum)}H${xr + 8}" stroke="#000"/>`;
    s += `<text class="dl" x="${xr + 14}" y="${Y((d.ein + d.cum) / 2) - 2}">Equity</text><text class="dl" x="${xr + 14}" y="${Y((d.ein + d.cum) / 2) + 12}">€${fmt(d.ek, 1)}m</text>`;
    const c3 = m.l + gw * 3 + gw / 2, x3 = c3 - bw - 3;
    s += `<defs><marker id="ar" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#000"/></marker></defs>`;
    s += `<path d="M${x3 + bw / 2},${Y(36.5)} C${x3 + bw / 2},${Y(44)} ${cx - bw - 30},${Y(44)} ${cx - bw - 7},${Y(44)}" fill="none" stroke="#000" marker-end="url(#ar)"/>`;
    s += `<text class="dl" x="${cx - bw - 12}" y="${Y(49)}" text-anchor="end">Loans become equity</text>`;
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#000"/></svg>`;
    host.innerHTML = s;
    host.querySelectorAll('.fy').forEach(g => {
      const d = fin[+g.dataset.i];
      const show = e => {
        tip(`<div class="h">gridX ${d.y}</div>` + r('Paid-in capital', '€' + fmt(d.ein, 1) + 'm', C.ink) + r('Shareholder loans', '€' + fmt(d.dar, 1) + 'm', C.o) +
          r('Accumulated losses', '€' + fmt(d.cum, 1) + 'm', C.loss) + r('of which loss in year', '€' + fmt(d.jf, 1) + 'm') +
          r('Equity', (d.ek < 0 ? '−' : '') + '€' + fmt(Math.abs(d.ek), 1) + 'm') + r('Cash', '€' + fmt(d.kasse, 1) + 'm') +
          r('Employees', d.ma ?? 'not stated') +
          `<div class="note">${d.ek < 0 ? 'Paid-in capital does not cover the losses; shareholder loans close the gap.' : 'Loans dissolved, capital reserve increased by €43.4m.'}</div>`, e);
        el('fin-n').innerHTML = `€${fmt(d.cum, 1)}<small>m</small>`; el('fin-l').textContent = `accumulated losses to ${d.y}`;
      };
      g.addEventListener('mousemove', show);
      g.addEventListener('mouseleave', () => { tip(); el('fin-n').innerHTML = '€44.7<small>m</small>'; el('fin-l').textContent = 'accumulated losses to 2024'; });
    });
  }
  function miniBars(id, rows, unit, d){
    const max = Math.max(...rows.map(x => x[1]));
    el(id).innerHTML = rows.map(([n, v, col]) => `<div class="bar"><span style="text-align:left">${n}</span><span class="tr"><b style="width:${v / max * 100}%;background:${col}"></b></span><span>${fmt(v, d)} ${unit}</span></div>`).join('');
  }
  miniBars('fin-loss', [['gridX', 16.1, C.g], ['Consolinno', 1.3, C.c]], '', 1);
  (function(){
    const rows = [['gridX', 5.8, C.g], ['Consolinno', -0.9, C.c]], max = 6;
    el('fin-ma').innerHTML = rows.map(([n, v, col]) => {
      const w = Math.abs(v) / max * 50;
      const bar = v >= 0 ? `<b style="position:absolute;left:50%;width:${w}%;background:${col}"></b>` : `<b style="position:absolute;right:50%;width:${w}%;background:${col}"></b>`;
      return `<div class="bar"><span style="text-align:left">${n}</span><span class="tr" style="position:relative;height:10px">${bar}<i style="position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:#000"></i></span><span>${v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}</span></div>`;
    }).join('');
  })();

  /* ---------- 05a Datenbank-Vergleich ---------- */
  const FE = window.HEMS_FEATURES;
  const catOrder = ['System type', 'Sales channel', 'Algorithm', 'Dynamic tariff', 'PV surplus', 'Heat pump', 'Electric vehicle', '§14a control', '§9 EEG control', 'Variable grid fees', 'Installation and commissioning', 'Certification'];
  // Unsere Einschätzung: Optimierungsfunktionen ja, Hardware/Relais/Regulatorik/Vertrieb nein
  const OURS = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 24, 28, 39, 40, 41];
  let fdMode = 'all';
  function drawFD(){
    const tb = el('fd-rows'); let h = '';
    catOrder.forEach(cat => {
      const fs = FE.filter(f => f[1] === cat).filter(f => { if (fdMode === 'all') return true; const a = gx[3].includes(f[0]), b = co[3].includes(f[0]), c = OURS.includes(f[0]); return !(a === b && b === c); });
      fs.forEach((f, i) => {
        const n = SY.filter(s => s[3].includes(f[0])).length, p = n / SY.length * 100;
        const cell = (on, col) => `<td class="c">${on ? `<span class="yes" style="background:${col}"></span>` : '<span class="no-f"></span>'}</td>`;
        h += `<tr><td class="k">${i ? '' : esc(cat)}</td><td>${esc(f[2])}</td>${cell(gx[3].includes(f[0]), C.g)}${cell(co[3].includes(f[0]), C.c)}${OURS.includes(f[0]) ? '<td class="c"><span class="yes" style="background:#ffcf22;outline:1px solid #000;outline-offset:-1px"></span></td>' : '<td class="c"><span class="no-f"></span></td>'}<td><span style="display:grid;grid-template-columns:minmax(0,1fr) 36px;gap:8px;align-items:center"><span style="background:#fff;height:8px"><b style="display:block;height:8px;width:${p}%;background:#000"></b></span><span class="num" style="text-align:right">${fmt(p)} %</span></span></td></tr>`;
      });
    });
    tb.innerHTML = h;
  }
  document.querySelectorAll('[data-fd]').forEach(b => b.addEventListener('click', () => {
    fdMode = b.dataset.fd;
    document.querySelectorAll('[data-fd]').forEach(x => x.setAttribute('aria-pressed', x === b));
    drawFD();
  }));
  drawFD();

  /* ---------- 05b Matrix ---------- */
  const crit = [
    ['PV and battery self-consumption', 3, 3, 3, 'Standard for all'],
    ['Dynamic power tariff', 3, 3, 3, 'gridX Tariff Timer, Consolinno EPEX day-ahead, ours: price curve in the optimiser'],
    ['Forecast-based optimisation', 3, 2, 3, 'gridX tariff and forecast; Consolinno spot price and charging modes; ours MILP over 48 h'],
    ['§14a control', 3, 3, 1, 'gridX EEBUS proven, Consolinno control box and relays, ours a concept (Grid Helper)'],
    ['§9 EEG and variable grid fees', 2, 3, 0, 'Consolinno all variants per hems-finder, gridX EEBUS and postcode'],
    ['Flexibility trading', 3, 0, 0, 'gridX pools flexibility for E.ON trading'],
    ['Works without internet', 3, 3, 0, 'Both local, our prototype runs in the cloud'],
    ['Device integration', 3, 3, 1, 'gridX “Ready for gridX”, Consolinno detects devices automatically, ours planned'],
    ['White label and B2B', 3, 2, 0, 'gridX core product, Consolinno also white label per hems-finder'],
    ['Fuse-box installation', 1, 3, 0, 'Consolinno DIN rail with control box, gridX its own gridBox gateway'],
    ['Power and heat optimised together', 0, 1, 3, 'Only ours for homes, incl. buffer and CHP; Consolinno only for commercial sites, gridX treats heat devices as consumers'],
    ['Schedule as main view', 1, 1, 3, 'Others show the live flow, we show the plan for the next 24 to 48 h'],
    ['“Why?” explanation', 1, 0, 2, 'gridX reports “optimised 3×”, we explain every plan block'],
    ['Savings with vs. without HEMS', 3, 1, 2, 'gridX cost balance per kWh and in euros, Consolinno only self-sufficiency in percent'],
    ['Copilot and autopilot', 1, 1, 3, 'Others: pick a mode; ours: levels with confirmation'],
    ['CO₂ and impact', 1, 0, 3, 'gridX shows CO₂ savings, we optimise for CO₂ and show the donation'],
    ['Plan for the grid operator', 0, 0, 3, 'Only ours, shareable as a schedule'],
    ['ISO 27001 certification', 3, 3, 0, 'Both certified, gridX since November 2026'],
    ['Technology openness', 2, 2, 3, 'gridX and Consolinno: integrated or certified devices; ours: any device, given enough data']
  ].map(([k, g, c, o, n]) => ({k, g, c, o, n}));
  const W = {
    gleich: crit.map(() => 1),
    power:  [2, 3, 3, 1, 1, 0, 1, 2, 0, 0, 3, 3, 3, 2, 3, 2, 1, 1, 3],
    b2b:    [2, 3, 2, 3, 2, 3, 2, 3, 3, 1, 0, 1, 1, 2, 1, 1, 1, 3, 1],
    inst:   [2, 2, 1, 3, 3, 0, 3, 3, 1, 3, 1, 0, 0, 1, 0, 0, 0, 2, 2]
  };
  let w = W.gleich.slice();
  const sides = [['g', 'gridX'], ['c', 'Consolinno'], ['o', 'Our HEMS']];
  function scoreBtn(i, s){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'score ' + s;
    const paint = () => { b.innerHTML = [0, 1, 2].map(k => `<i class="${k < crit[i][s] ? 'f' : ''}"></i>`).join(''); b.setAttribute('aria-label', `${sides.find(x => x[0] === s)[1]}, ${crit[i].k}: ${crit[i][s]} of 3 points, click to change`); };
    paint();
    b.addEventListener('click', () => { crit[i][s] = (crit[i][s] + 1) % 4; paint(); totals(); });
    return b;
  }
  function buildMx(){
    const tb = el('mx-rows'); tb.textContent = '';
    crit.forEach((c, i) => {
      const tr = document.createElement('tr');
      const t1 = document.createElement('td'); t1.textContent = c.k;
      const t2 = document.createElement('td');
      const rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 3; rg.step = 1; rg.value = w[i]; rg.className = 'wsel'; rg.id = 'w' + i;
      rg.setAttribute('aria-label', 'Weight ' + c.k);
      rg.addEventListener('input', () => { w[i] = +rg.value; document.querySelectorAll('[data-w]').forEach(x => x.setAttribute('aria-pressed', 'false')); totals(); });
      t2.append(rg);
      tr.append(t1, t2);
      sides.forEach(([s]) => { const td = document.createElement('td'); td.className = 'c'; td.append(scoreBtn(i, s)); tr.append(td); });
      const t6 = document.createElement('td'); t6.className = 'mx-note'; t6.textContent = c.n; tr.append(t6);
      tb.append(tr);
    });
  }
  function totals(){
    const max = w.reduce((a, b) => a + b * 3, 0) || 1;
    const vals = sides.map(([s, n]) => [n, crit.reduce((a, c, i) => a + c[s] * w[i], 0) / max * 100, C[s]]);
    const best = Math.max(...vals.map(v => v[1]));
    el('mx-tot').innerHTML = vals.map(([n, v, col]) => `<div class="bar big"><span style="text-align:left;${v === best ? 'font-weight:500' : ''}">${n}</span><span class="tr"><b style="width:${v}%;background:${col};${col === C.o ? 'outline:1px solid #000;outline-offset:-1px' : ''}"></b></span><span>${fmt(v)} %</span></div>`).join('');
  }
  document.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
    w = W[b.dataset.w].slice();
    document.querySelectorAll('[data-w]').forEach(x => x.setAttribute('aria-pressed', x === b));
    w.forEach((v, i) => { el('w' + i).value = v; }); totals();
  }));
  buildMx(); totals();

  /* ---------- 09 Preisvergleich ---------- */
  function drawPrice(){
    const host = el('pr-chart');
    const W2 = Math.max(340, host.clientWidth), H = 300, m = {t: 14, r: 12, b: 34, l: 48};
    const iw = W2 - m.l - m.r, ih = H - m.t - m.b, T = 10, YM = 1600;
    const X = t => m.l + t / T * iw, Y = v => m.t + ih - Math.min(v, YM) / YM * ih;
    const eon = t => 199 + 4.99 * 12 * t, old = t => 199 + 9.99 * 12 * t;
    let s = `<svg width="${W2}" height="${H}" role="img" aria-label="Cumulative cost per household over ten years">`;
    for (let v = 0; v <= YM; v += 400) s += `<line x1="${m.l}" x2="${W2 - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
    for (let t = 0; t <= T; t += 2) s += `<text x="${X(t)}" y="${H - 16}" text-anchor="middle">${t}</text>`;
    s += `<text x="${m.l + iw / 2}" y="${H - 1}" text-anchor="middle">Years</text>`;
    s += `<rect x="${X(0)}" y="${Y(800)}" width="${iw}" height="${Y(500) - Y(800)}" fill="${C.c}" opacity=".35"/>`;
    s += `<line x1="${X(0)}" x2="${X(T)}" y1="${Y(650)}" y2="${Y(650)}" stroke="${C.c}" stroke-width="2"/>`;
    s += `<path d="M${X(0)},${Y(old(0))}L${X(T)},${Y(old(T))}" fill="none" stroke="${C.g}" stroke-width="1.5" stroke-dasharray="5 4" opacity=".55"/>`;
    s += `<path d="M${X(0)},${Y(eon(0))}L${X(T)},${Y(eon(T))}" fill="none" stroke="${C.g}" stroke-width="2"/>`;
    const to = (650 - 199) / (9.99 * 12);
    s += `<circle cx="${X(to)}" cy="${Y(650)}" r="3.5" fill="#fff" stroke="${C.g}" opacity=".7"/><text x="${X(to) - 8}" y="${Y(650) - 10}" text-anchor="end">previously ${fmt(to, 1)} years</text>`;
    s += `<text x="${X(T) - 4}" y="${Y(old(T)) - 8}" text-anchor="end">previously €${fmt(old(T))}</text>`;
    const tc = (650 - 199) / (4.99 * 12);
    s += `<circle cx="${X(tc)}" cy="${Y(650)}" r="4.5" fill="#fff" stroke="#000" stroke-width="1.5"/><text class="dl" x="${X(tc) + 8}" y="${Y(650) + 16}">${fmt(tc, 1)} years</text>`;
    s += `<text x="${X(0) + 4}" y="${Y(800) - 6}">Consolinno €500 to €800</text>`;
    s += `<text class="dl" x="${X(T) - 4}" y="${Y(eon(T)) - 10}" text-anchor="end">Basic new €${fmt(eon(T))}</text>`;
    s += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" stroke="#000" stroke-opacity=".35" visibility="hidden"/>`;
    s += `<line x1="${m.l}" x2="${W2 - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#000"/>`;
    s += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
    host.innerHTML = s;
    const xh = host.querySelector('.xh');
    host.querySelector('.hit').addEventListener('mousemove', e => {
      const bx = host.getBoundingClientRect().left;
      const t = Math.max(0, Math.min(T, (e.clientX - bx - m.l) / iw * T));
      xh.setAttribute('x1', X(t)); xh.setAttribute('x2', X(t)); xh.setAttribute('visibility', 'visible');
      tip(`<div class="h">after ${fmt(t, 1)} years</div>` + r('E.ON Basic new', '€' + fmt(eon(t)), C.g) + r('E.ON Basic previously', '€' + fmt(old(t))) + r('Consolinno', '€500 to €800', C.c) +
        `<div class="note">Basic new costs more than Consolinno after ${fmt((500 - 199) / 59.88, 1)} years (€500) or ${fmt((800 - 199) / 59.88, 1)} years (€800).</div>`, e);
    });
    host.querySelector('.hit').addEventListener('mouseleave', () => { xh.setAttribute('visibility', 'hidden'); tip(); });
  }

  /* ---------- 09 Break-even ---------- */
  const presets = {base: {enduser: 4.19, share: 30, mc: 1}, old: {enduser: 8.39, share: 30, mc: 1}, double: {enduser: 8.39 * 2, share: 30, mc: 1}};
  function calc(){
    const loss = +el('loss').value * 1e6, assets = +el('assets').value, aph = +el('aph').value,
          eu = +el('enduser').value, share = +el('share').value / 100, mc = +el('mc').value;
    el('loss-v').textContent = '€' + fmt(+el('loss').value, 1) + 'm';
    el('assets-v').textContent = fmt(assets);
    el('aph-v').textContent = fmt(aph, 1);
    el('enduser-v').textContent = '€' + fmt(eu, 2);
    el('share-v').textContent = fmt(share * 100) + ' %';
    el('mc-v').textContent = '€' + fmt(mc, 2);
    const hh = assets / aph, db = eu * share - mc, gap = loss / hh / 12;
    el('r-hh').textContent = fmt(Math.round(hh / 1000) * 1000);
    el('r-db').textContent = '€' + fmt(db, 2);
    el('r-gap').textContent = '€' + fmt(gap, 2);
    const v = el('r-verdict');
    if (db <= 0) {
      el('r-need').textContent = 'not reachable';
      v.textContent = 'The contribution margin is zero or negative: every additional household increases the loss.';
    } else {
      const need = loss / (db * 12), f = need / hh;
      el('r-need').innerHTML = need >= 1e6 ? `${fmt(need / 1e6, 1)}<small>m</small>` : fmt(Math.round(need / 1000) * 1000);
      v.textContent = `That is ${fmt(f, 1)} times today's households. ` +
        (f > 3 ? 'Hardly realistic through volume alone; the lever is price or extra revenue such as flexibility trading.'
               : f > 1 ? 'Only feasible with strong growth at constant fixed costs.'
                       : 'At this price level, modest growth is enough.');
    }
    drawBE(loss, hh, db);
  }
  function drawBE(loss, hh, db){
    const host = el('bechart');
    const Wd = Math.max(320, host.clientWidth), H = 250, m = {t: 14, r: 16, b: 36, l: 58};
    const iw = Wd - m.l - m.r, ih = H - m.t - m.b, xMax = 25, yMin = 1e4, yMax = 5e6;
    const X = v => m.l + v / xMax * iw;
    const Y = v => { const c = Math.min(yMax, Math.max(yMin, v)); return m.t + ih - (Math.log10(c) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)) * ih; };
    const need = d => loss / (d * 12), dBE = loss / (hh * 12);
    let s = `<svg width="${Wd}" height="${H}" role="img" aria-label="Households needed by contribution margin">`;
    [1e4, 3e4, 1e5, 3e5, 1e6, 3e6].forEach(v => { s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v >= 1e6 ? fmt(v / 1e6) + 'm' : fmt(v / 1e3) + 'k'}</text>`; });
    for (let x = 0; x <= xMax; x += 5) s += `<text x="${X(x)}" y="${H - 18}" text-anchor="middle">€${x}</text>`;
    s += `<text x="${m.l + iw / 2}" y="${H - 2}" text-anchor="middle">Contribution margin per household per month</text>`;
    if (dBE < xMax) s += `<rect x="${X(dBE)}" y="${m.t}" width="${X(xMax) - X(dBE)}" height="${ih}" fill="#fff" opacity=".7"/>`;
    let d = '';
    for (let i = 0; i <= 200; i++) { const x = .3 + i * (xMax - .3) / 200; d += (i ? 'L' : 'M') + X(x).toFixed(1) + ',' + Y(need(x)).toFixed(1); }
    s += `<path d="${d}" fill="none" stroke="#000" stroke-width="2"/>`;
    s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${Y(hh)}" y2="${Y(hh)}" stroke="${C.grey}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    s += `<text x="${m.l + 4}" y="${Y(hh) + 15}">today ${fmt(Math.round(hh / 1000))}k households</text>`;
    if (dBE < xMax) s += `<text class="dl" x="${X(dBE) + 6}" y="${Y(hh) - 7}">from €${fmt(dBE, 1)} the current base suffices</text>`;
    if (db > 0 && db <= xMax) {
      const n = need(db), right = X(db) < m.l + iw * .6;
      s += `<line x1="${X(db)}" x2="${X(db)}" y1="${m.t}" y2="${m.t + ih}" stroke="#000" stroke-opacity=".25"/>`;
      s += `<rect x="${X(db) - 6}" y="${Y(n) - 6}" width="12" height="12" fill="${C.o}" stroke="#000"/>`;
      s += `<text class="dm" x="${X(db) + (right ? 12 : -12)}" y="${Y(n) - 10}" text-anchor="${right ? 'start' : 'end'}">${n >= 1e6 ? fmt(n / 1e6, 1) + 'm' : fmt(Math.round(n / 1000)) + 'k'} needed</text>`;
    } else if (db <= 0) {
      s += `<text class="dm" x="${m.l + 8}" y="${m.t + 16}">Contribution margin ≤ €0: no break-even possible</text>`;
    }
    s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${m.t + ih}" y2="${m.t + ih}" stroke="#000"/></svg>`;
    host.innerHTML = s;
  }
  ['loss', 'assets', 'aph', 'enduser', 'share', 'mc'].forEach(id => el(id).addEventListener('input', () => {
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false')); calc();
  }));
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = presets[b.dataset.preset];
    el('enduser').value = p.enduser; el('share').value = p.share; el('mc').value = p.mc;
    document.querySelectorAll('[data-preset]').forEach(x => x.setAttribute('aria-pressed', x === b)); calc();
  }));

  const redraw = () => { drawFin(); drawPrice(); calc(); };
  redraw();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redraw, 120); });
  if (document.fonts) document.fonts.ready.then(redraw);
})();

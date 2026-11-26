/* 06 App-Dummies: ein simuliertes Haus, drei Darstellungen (schematischer Nachbau, keine Originale) */
(function(){
  const {el, fmt, tip, r} = window.UI;
  const N = 96, dt = .25;
  const bump = (h, c, w, a) => a * Math.exp(-(((h - c) / w) ** 2));
  const hhmm = i => { const m = ((i % N) + N) % N * 15; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const kw = v => fmt(Math.abs(v), 1) + ' kW';
  const W_ = v => Math.round(Math.abs(v) * 1000) + ' W';

  /* ---------- Simulation ---------- */
  function sim(sunny){
    const price = sunny ? [27,26,26,25,26,28,31,35,36,33,28,23,19,18,19,22,27,33,38,40,37,34,31,29]
                        : [28,27,27,27,28,31,35,38,37,34,32,31,31,31,32,35,39,42,41,38,34,32,30,29];
    const tomorrow = price.map((p, i) => Math.round(p + 3 * Math.sin(i * 1.3) + (sunny && i > 10 && i < 16 ? 4 : 0)));
    let soc = sunny ? .12 : .30, evs = sunny ? .42 : .38;
    const S = [];
    for (let i = 0; i < N; i++) {
      const h = i / 4;
      const pv = sunny ? 5.2 * Math.pow(Math.max(0, Math.sin(Math.PI * (h - 5.5) / 15)), 1.3)
                       : 1.7 * Math.pow(Math.max(0, Math.sin(Math.PI * (h - 8.5) / 8)), 1.2);
      const house = .34 + bump(h, 7.3, .8, .55) + bump(h, 12.5, .5, .35) + bump(h, 19.5, 1.4, .9);
      const wp = sunny ? ((h >= 11.5 && h < 14) ? 1.3 : (h >= 21 && h < 21.5) ? .9 : 0)
                       : ((h < 5) ? 1.0 : (h < 9) ? 1.9 : (h < 11) ? 1.2 : (h < 15) ? 1.6 : (h < 17) ? 1.0 : (h < 20) ? .5 : 1.2);
      const load = house + wp, p = price[Math.floor(h)];
      const plugged = sunny ? (h >= 9.5 && h < 16.75) : (h >= 18 || h < 7);
      let sur = pv - load, ch = 0, dis = 0, ev = 0;
      const room = Math.max(0, (.97 - soc) * 10 / dt), left = Math.max(0, (soc - .08) * 10 / dt);
      if (sunny) {
        if (sur > 0) {
          if (plugged && soc >= .9 && sur >= 1.4) { ev = Math.min(11, sur); ch = Math.min(5, sur - ev, room); }
          else { ch = Math.min(5, sur, room); const rest = sur - ch; if (plugged && rest >= 1.4) ev = Math.min(11, rest); }
        } else dis = Math.min(5, -sur, left);
      } else {
        if (h >= 2 && h < 5) ch = Math.min(3, room);               // günstig aus dem Netz laden
        else if (sur > 0) ch = Math.min(5, sur, room);
        else if (p >= 35) dis = Math.min(5, -sur, left);            // nur in teuren Stunden entladen
        if (h >= 1 && h < 4) ev = 3.7;
      }
      const grid = load + ev - pv + ch - dis;
      soc += (ch * .95 - dis / .95) * dt / 10; evs += ev * .92 * dt / 60;
      S.push({i, h, pv, house, wp, load, ev, ch, dis, bat: ch - dis, grid, soc, evs, p, plugged, ph: ev > 0 ? (ev < 4.2 ? 1 : 3) : 0});
    }
    // Pufferspeicher: Wärme aus der WP minus Bedarf mit Morgen- und Abendspitze
    const cop = sunny ? 3.2 : 3.0, avg = S.reduce((a, s) => a + s.wp * cop, 0) / N;
    const shape = h => sunny ? (bump(h, 7, 1, 1) + bump(h, 20.5, 1.3, 1)) : (bump(h, 7.5, 1.6, 1) + bump(h, 19, 2, 1));
    const sh = S.reduce((a, s) => a + shape(s.h), 0) / N;
    let puf = 50;
    S.forEach(s => { puf += (s.wp * cop - avg * (1 + .6 * (shape(s.h) - sh))) * 2.9 * dt * .5; s.puf = puf; });
    // kumulierte Tageswerte
    let imp = 0, exp = 0, cons = 0, pvE = 0, cost = 0, ref = 0, evE = 0, evStart = null;
    S.forEach(s => {
      imp += Math.max(0, s.grid) * dt; exp += Math.max(0, -s.grid) * dt; cons += (s.load + s.ev) * dt; pvE += s.pv * dt;
      cost += Math.max(0, s.grid) * dt * s.p / 100; ref += (s.load + s.ev) * dt * s.p / 100;
      if (s.ev > 0 && evStart == null) evStart = s.i; evE += s.ev * dt;
      Object.assign(s, {imp, exp, cons, pvE, cost, ref, feed: exp * .079, evE, evStart});
    });
    const avgP = price.reduce((a, b) => a + b) / 24;
    return {S, price, tomorrow, avgP, sunny};
  }
  const sims = {sun: sim(true), cloud: sim(false)};
  let D = sims.sun, t = 52;
  const view = {g: 'home', c: 'home', o: 'plan'};
  const st = {gRange: 'live', cDay: 'heute', ok: false};

  /* ---------- kleine Grafik-Bausteine ---------- */
  const ICON = {
    sun: '<circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.3"/>',
    grid: '<path d="M9 1.5 3.5 9h4L6.5 14.5 12.5 7h-4z" fill="currentColor"/>',
    house: '<path d="M2.5 7.5 8 3l5.5 4.5V14h-11z" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    bat: '<rect x="2" y="4.5" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="13.3" y="6.5" width="1.6" height="3" fill="currentColor"/><rect x="3.4" y="6" width="5" height="4" fill="currentColor"/>',
    hp: '<rect x="2" y="2.5" width="12" height="11" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1"/>',
    car: '<path d="M2 10.5V8l1.6-3.2h8.8L14 8v2.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="11.5" r="1.4" fill="currentColor"/><circle cx="11" cy="11.5" r="1.4" fill="currentColor"/>'
  };
  const ic = (k, sz = 14) => `<svg width="${sz}" height="${sz}" viewBox="0 0 16 16" aria-hidden="true">${ICON[k]}</svg>`;
  const sbar = () => `<div class="sb"><span>${hhmm(t)}</span><span>▮▮▮ ◔</span></div>`;
  function stepPath(arr, w, h, min, max, close){
    let d = '';
    arr.forEach((v, i) => { const x0 = i / arr.length * w, x1 = (i + 1) / arr.length * w, y = h - (v - min) / (max - min) * h; d += (i ? 'L' : 'M') + x0.toFixed(1) + ',' + y.toFixed(1) + 'L' + x1.toFixed(1) + ',' + y.toFixed(1); });
    return close ? d + `L${w},${h}L0,${h}Z` : d;
  }

  /* ---------- gridX-Nachbau (Aufbau wie die White-Label-App von gridX) ---------- */
  const ICON2 = {
    home: '<path d="M2.5 7.5 8 3l5.5 4.5V14h-11z" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    chart: '<path d="M3 13V8M6.5 13V4M10 13V7M13.5 13V10" stroke="currentColor" stroke-width="1.6"/>',
    bolt: '<path d="M9 1.5 3.5 9h4L6.5 14.5 12.5 7h-4z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" stroke-width="1.4"/>',
    back: '<path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    water: '<path d="M8 2.5C6 5.5 4.5 7.5 4.5 9.5a3.5 3.5 0 0 0 7 0C11.5 7.5 10 5.5 8 2.5z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    pct: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 8V2.5A5.5 5.5 0 0 1 13.5 8z" fill="currentColor"/>',
    euro: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10 5.6a3 3 0 1 0 0 4.8M4.8 7.2h4M4.8 8.8h4" fill="none" stroke="currentColor" stroke-width="1.1"/>'
  };
  Object.assign(ICON, ICON2);
  function renderG(){
    const s = D.S[t], cons = s.load + s.ev, live = st.gRange === 'live';
    const day = k => D.S.slice(0, t + 1).reduce((a, x) => a + x[k] * dt, 0);
    const v = (p, e) => live ? `${fmt(Math.abs(p), 1)} kW` : `${fmt(e, 1)} kWh`;
    const val = (label, value, sub, cls = '') => `<div class="val ${cls}"><small>${label}</small><b>${value}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    let body = '';
    if (view.g === 'home') {
      // Hausbogen: Anteile der Quellen am Verbrauch
      const fromPV = Math.min(s.pv, cons), fromBat = s.dis, fromGrid = Math.max(0, s.grid), tot = fromPV + fromBat + fromGrid || 1;
      const R = 46, cx = 55, cy = 58; let a0 = Math.PI, arcs = '';
      [[fromPV / tot, '#1f2733'], [fromBat / tot, '#6f7b8b'], [fromGrid / tot, '#c3cbd5']].forEach(([f, col]) => {
        if (f <= 0) return; const a1 = a0 + f * Math.PI;
        arcs += `<path d="M${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} A${R},${R} 0 0 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}" fill="none" stroke="${col}" stroke-width="9"/>`; a0 = a1;
      });
      const gauge = `<svg viewBox="0 0 110 92" width="100%"><path d="M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}" fill="none" stroke="#eef1f4" stroke-width="9"/>${arcs}
        <path d="M${cx - 30},${cy + 30} V${cy - 2} L${cx},${cy - 26} L${cx + 30},${cy - 2} V${cy + 30}" fill="none" stroke="#cfd6de" stroke-width="1.2"/>
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="7" fill="#4a5361">Total consumption</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="12.5" font-weight="500" fill="#1f2733">${live ? fmt(cons, 1) + ' kW' : fmt(s.cons, 1) + ' kWh'}</text>
        <text x="${cx}" y="${cy + 27}" text-anchor="middle" font-size="7" fill="#4a5361">Info ⓘ</text></svg>`;
      body = `<div class="st">System overview</div>
      <div class="top">${val(s.grid >= 0 ? 'Grid supply' : 'Grid feed-in', v(s.grid, s.grid >= 0 ? s.imp : s.exp))}<div class="pr">current power price:<br>${fmt(s.p, 2)} ct/kWh</div></div>
      <div class="mid">
        <div class="col">${val('PV production', v(s.pv, s.pvE), '', 'l')}${val(s.bat >= 0 ? 'Battery charging' : 'Battery discharging', v(s.bat, day('dis')), fmt(s.soc * 100) + ' %', 'l')}</div>
        <div>${gauge}</div>
        <div class="col r">${val('Household', v(s.house, day('house')), '', 'l')}${val('Heat pump', v(s.wp, day('wp')), '', 'l')}</div>
      </div>
      <div class="ev">${val('EV', s.plugged ? v(s.ev, s.evE) : '–', s.plugged ? fmt(s.evs * 100) + ' %' : 'not connected')}<span class="ic">${ic('car', 34)}</span>
        <div class="row2"><span style="font-size:10px">My car ▾</span><span class="btn-g r8 ${s.ev > 0 && D.sunny ? '' : 'off'}">Solar charge ☼</span></div></div>
      <div class="tg r8" data-act="grange"><span class="r8 ${live ? 'on' : ''}">Live</span><span class="r8 ${live ? '' : 'on'}">Today</span></div>`;
    } else if (view.g === 'report') {
      const pd = Math.max(0, (s.cost - s.feed) / s.cons), ref = s.ref / s.cons;
      const w = 240, h = 58, mn = 10, mx = 45, xNow = Math.floor(t / 4) / 24 * w, yAvg = h - (D.avgP - mn) / (mx - mn) * h;
      const last = D.S.slice(Math.max(0, t - 23), t + 1);
      const ev = last.map((b, k) => { if (!k) return 0; const a = last[k - 1]; return (Math.sign(Math.round(a.bat * 10)) !== Math.sign(Math.round(b.bat * 10)) || (a.ev > 0) !== (b.ev > 0) || (a.wp > 0) !== (b.wp > 0)) ? 1 : 0; });
      const n = ev.reduce((a, b) => a + b, 0);
      body = `<div class="cardg r12"><div class="h"><span>Dynamic power price ⓘ</span></div><div class="v">${fmt(s.p, 2)}<small>ct/kWh</small></div>
        <span style="font-size:8.5px;color:#4a5361">current price period: ${hhmm(Math.floor(t / 4) * 4)}–${hhmm(Math.floor(t / 4) * 4 + 4)}</span>
        <svg viewBox="0 0 ${w} ${h + 10}" width="100%"><rect x="${xNow}" y="0" width="${w / 24}" height="${h}" fill="#dfe5ec"/><path d="${stepPath(D.price, w, h, mn, mx)}" fill="none" stroke="#1f2733" stroke-width="1.3"/><line x1="0" x2="${w}" y1="${yAvg}" y2="${yAvg}" stroke="#1f2733" stroke-dasharray="3 3"/><text x="2" y="${yAvg - 3}" font-size="7.5" fill="#4a5361">Ø ${fmt(D.avgP, 1)} ct/kWh</text><text x="0" y="${h + 9}" font-size="7.5" fill="#4a5361">00:00</text><text x="${w / 2}" y="${h + 9}" font-size="7.5" fill="#4a5361" text-anchor="middle">12:00</text><text x="${w}" y="${h + 9}" font-size="7.5" fill="#4a5361" text-anchor="end">24:00</text></svg></div>
      <div class="cardg r12"><div class="h"><span>Cost balance ⓘ</span></div><span style="font-size:9px;color:#4a5361">Paid today</span><div class="v">${fmt(pd, 2)}<small>€/kWh</small></div>
        <span style="font-size:8.5px;color:#4a5361">Without HEMS you would have paid €${fmt(ref, 2)}/kWh</span>
        <div class="tri"><div class="r8">Savings<b>€${fmt(s.ref - s.cost + s.feed, 2)}</b></div><div class="r8">Feed-in earnings<b>€${fmt(s.feed, 2)}</b></div><div class="r8">Grid supply costs<b>€${fmt(s.cost, 2)}</b></div></div>
        <div class="seg3 r8"><span class="on r8">Today</span><span>Yesterday</span><span>Last week</span></div></div>
      <div class="cardg r12"><div class="h"><span>Smart steering ⓘ</span></div><div class="v">${n} times</div><span style="font-size:8.5px;color:#4a5361">additionally optimised based on power prices, last 6 h</span>
        <svg viewBox="0 0 240 12" width="100%">${ev.map((e, k) => `<circle cx="${k * 10 + 5}" cy="6" r="${e ? 3.2 : 1.6}" fill="${e ? '#1f2733' : '#c3cbd5'}"/>`).join('')}</svg></div>`;
    } else {
      const pr = (k, t1, t2) => `<div class="prio r8"><span><small>Priority ${k}</small><span class="ic">${ic(t1, 18)}</span></span><span>Use solar power to ${t2}</span></div>`;
      body = `<div class="st">Manager</div>
      <div style="font-size:10.5px;font-weight:500">Priorities for solar power</div>
      ${pr(1, 'bat', 'charge the battery')}${pr(2, 'water', 'heat water')}${pr(3, 'car', 'charge the EV')}${pr(4, 'hp', 'run the heat pump')}
      <div class="cardg r12"><div class="li"><span>Charging mode</span><b style="font-weight:500">Solar charge ›</b></div><div class="li"><span>Mobility needs</span><b style="font-weight:500">80 % by 07:00 ›</b></div></div>
      <div class="cardg r12"><div class="h"><span>Push notifications</span></div><div class="li"><span>§14a restrictions</span><span class="sw-t rf"></span></div><div class="li"><span>Surplus periods</span><span class="sw-t rf"></span></div></div>`;
    }
    const nav = (k, icon, label) => `<span class="${view.g === k ? 'on' : ''}">${ic(icon, 15)}${label}</span>`;
    el('scr-g').innerHTML = sbar() + `<div class="body">${body}</div><div class="nav">${nav('home', 'home', 'Home')}${nav('report', 'chart', 'Report')}${nav('manager', 'bolt', 'Manager')}</div>`;
  }

  /* ---------- Consolinno-Nachbau (Aufbau wie die App zum Leaflet HEMS) ---------- */
  function renderC(){
    const s = D.S[t], cons = s.load + s.ev;
    const hd = (title, back) => `<div class="hd">${back ? ic('back', 14) : ic('menu', 14)}<span class="t">${title || ''}</span><span style="width:14px"></span></div>`;
    let head = hd(''), body = '';
    if (view.c === 'home') {
      // Flüsse zwischen den Kacheln: Solar (oben links), Netz (oben rechts), Batterie (unten links), Verbrauch (unten rechts)
      const P = {s: [25, 25], n: [75, 25], b: [25, 75], v: [75, 75]};
      const ln = (a, b, on) => on ? `<line class="fl" x1="${P[a][0]}%" y1="${P[a][1]}%" x2="${P[b][0]}%" y2="${P[b][1]}%" stroke="#2e3a2e" stroke-width="4"/>` : '';
      const pvUsed = Math.min(s.pv, cons), exp = Math.max(0, -s.grid), imp = Math.max(0, s.grid);
      const flows = ln('s', 'v', pvUsed > .05) + ln('s', 'n', exp > .05) + ln('n', 'v', imp > .05 && imp >= s.ch) + ln('n', 'b', imp > .05 && s.ch > .05 && s.pv < .05) + ln('s', 'b', s.ch > .05 && s.pv > .05) + ln('b', 'v', s.dis > .05);
      const aut = Math.max(0, 1 - s.imp / s.cons) * 100, eig = s.pvE > .01 ? Math.max(0, 1 - s.exp / s.pvE) * 100 : null;
      const tile = (icon, label, v) => `<div class="tl r8"><span class="ic">${ic(icon, 14)}</span><small>${label}</small><b>${Math.round(Math.abs(v) * 1000)} <i>W</i></b></div>`;
      body = `<div class="pnl r12"><b>Live status</b><div class="tiles"><svg aria-hidden="true">${flows}</svg>
          ${tile('sun', 'Solar', s.pv)}${tile('grid', 'Grid', s.grid)}${tile('bat', 'Battery', s.bat)}${tile('bolt', 'Consumption', cons)}</div></div>
        <div class="pnl r12"><b>Energy status</b>
          <div class="rowc r8"><span>${ic('house', 13)}Self-sufficiency</span><b>${fmt(aut)} %</b></div>
          <div class="rowc r8"><span>${ic('pct', 13)}Self-consumption</span><b>${eig == null ? '– %' : fmt(eig) + ' %'}</b></div>
          <div class="rowc r8"><span>${ic('euro', 13)}EPEX Day-Ahead</span><b>${fmt(s.p, 1)} ct/kWh</b></div></div>
        <div class="pnl r12"><b>Inverters</b><div class="rowc r8"><span>Inverter 1</span><b>${Math.round(s.pv * 1000)} W</b></div></div>`;
    } else if (view.c === 'wallbox') {
      head = hd('Wallbox', true);
      const mins = s.evStart != null && s.ev > 0 ? (t - s.evStart) * 15 : 0;
      const since = s.evStart != null && s.ev > 0 ? D.S.slice(s.evStart, t + 1).reduce((a, x) => a + x.ev * dt, 0) : 0;
      const status = s.ev > 0 ? 'Running' : s.plugged ? 'Waiting' : 'Off';
      body = `<div style="background:#fff;margin:-8px -10px 0;padding:8px 12px;flex:1">
        <div class="kv"><span>Car plugged in:</span><span class="rf" style="width:9px;height:9px;${s.plugged ? 'background:#2e3a2e' : 'border:1px solid #2e3a2e'}"></span></div>
        <div class="h2c">Charging configuration</div>
        <div class="kv"><span>Charging mode</span><span>${D.sunny ? 'Solar only' : 'Next trip'}</span></div>
        <div class="kv"><span>${D.sunny ? 'Low solar availability' : 'Target'}</span><span>${D.sunny ? 'Minimal current' : '80 % by 07:00'}</span></div>
        <div class="kv"><span>Phase count</span><span>3</span></div>
        <div class="h2c">Status<span class="pill rf ${s.ev > 0 ? '' : 'off'}">${status}</span></div>
        <div class="kv"><span>Charging power</span><span>${fmt(s.ev, 2)} kW</span></div>
        <div class="kv"><span>Energy charged</span><span>${fmt(since, 2)} kWh</span></div>
        <div class="kv"><span>Time elapsed</span><span>${mins} min</span></div>
        <div class="kv"><span>Active phases</span><span>${s.ph || 0}</span></div>
        <div class="btnc r8">CANCEL &amp; RECONFIGURE CHARGING MODE</div></div>`;
    } else {
      const arr = st.cDay === 'heute' ? D.price : D.tomorrow, avg = arr.reduce((a, b) => a + b) / 24;
      const w = 240, h = 70, ox = 22, iw = w - ox, Yp = v => h - v / 45 * h;
      const step = arr.map((v, i) => `${i ? 'L' : 'M'}${(ox + i / 24 * iw).toFixed(1)},${Yp(v).toFixed(1)}L${(ox + (i + 1) / 24 * iw).toFixed(1)},${Yp(v).toFixed(1)}`).join('');
      const grid = [0, 10, 20, 30, 40].map(v => `<line x1="${ox}" x2="${w}" y1="${Yp(v)}" y2="${Yp(v)}" stroke="#dde0da"/><text x="${ox - 3}" y="${Yp(v) + 3}" font-size="6.5" fill="#6b746b" text-anchor="end">${v} ct</text>`).join('');
      const xl = ['00:00', '06:00', '12:00', '18:00', '00:00'].map((l, k) => `<text x="${ox + k / 4 * iw}" y="${h + 9}" font-size="6.5" fill="#6b746b" text-anchor="middle">${l}</text>`).join('');
      const nowDot = st.cDay === 'heute' ? `<circle cx="${ox + t / N * iw}" cy="${Yp(s.p)}" r="2.5" fill="#2e3a2e"/>` : '';
      const area = (vals, top, base) => { let d = ''; vals.forEach((v, i) => { d += (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ',' + (46 - (Math.min(v + base[i], top)) / top * 44).toFixed(1); }); for (let i = vals.length - 1; i >= 0; i--) d += 'L' + (i / (vals.length - 1) * w).toFixed(1) + ',' + (46 - Math.min(base[i], top) / top * 44).toFixed(1); return d + 'Z'; };
      const upto = D.S.map((x, i) => i <= t ? x : {pv: 0, grid: 0, dis: 0});
      const pvU = upto.map(x => Math.min(x.pv, (x.load || 0) + (x.ev || 0))), dis = upto.map(x => x.dis), imp = upto.map(x => Math.max(0, x.grid));
      const z = pvU.map(() => 0), b1 = pvU, b2 = pvU.map((v, i) => v + dis[i]);
      body = `<div style="background:#fff;margin:-8px -10px 0;padding:6px 10px;flex:1;display:flex;flex-direction:column;gap:6px">
        <div class="ctr" style="font-size:11px;font-weight:500;color:#263026">Dynamic electricity tariff</div>
        <div class="seg2 r8" data-act="cday"><span class="r8 ${st.cDay === 'heute' ? 'on' : ''}">today</span><span class="r8 ${st.cDay === 'morgen' ? 'on' : ''}">tomorrow</span></div>
        <div class="ctr">${st.cDay === 'heute' ? `Current electricity price: ${fmt(s.p, 2)} ct/kWh<br>` : ''}Average electricity price: ${fmt(avg, 2)} ct/kWh</div>
        <svg viewBox="0 0 ${w} ${h + 12}" width="100%">${grid}<line x1="${ox}" x2="${w}" y1="${Yp(avg)}" y2="${Yp(avg)}" stroke="#9aa39a" stroke-width="1.2"/><path d="${step}" fill="none" stroke="#2e3a2e" stroke-width="1.3"/>${nowDot}${xl}</svg>
        <div style="display:flex;gap:10px;justify-content:center;font-size:7.5px;color:#6b746b"><span>■ Current electricity price</span><span style="color:#9aa39a">■ Average</span></div>
        <div class="ctr" style="font-size:11px;font-weight:500;color:#263026">My power balance history</div>
        <div class="seg2 r8"><span>Hours</span><span class="on r8">Days</span><span>Weeks</span><span>Months</span></div>
        <svg viewBox="0 0 ${w} 48" width="100%"><path d="${area(pvU, 7, z)}" fill="#c9cec6"/><path d="${area(dis, 7, b1)}" fill="#8d968b"/><path d="${area(imp, 7, b2)}" fill="#2e3a2e"/></svg>
        <div style="display:flex;gap:8px;justify-content:center;font-size:7.5px;color:#6b746b"><span>■ PV</span><span>■ Battery</span><span style="color:#2e3a2e">■ Grid</span></div></div>`;
    }
    el('scr-c').innerHTML = sbar() + head + `<div class="body">${body}</div><div class="nav"><span class="${view.c === 'home' ? 'on' : ''}">${ic('home', 14)}</span><span class="${view.c === 'stats' ? 'on' : ''}">${ic('chart', 14)}</span></div>`;
  }

  /* ---------- Flexibility Manager ---------- */
  function nextEvent(){
    for (let k = 1; k < N; k++) {
      const a = D.S[(t + k - 1) % N], b = D.S[(t + k) % N], j = (t + k) % N;
      if (a.wp === 0 && b.wp > 0) return {j, what: 'Heat pump on', b};
      if (a.ev === 0 && b.ev > 0) return {j, what: 'Charge EV', b};
      if (a.dis < .05 && b.dis >= .05) return {j, what: 'Discharge battery', b};
      if (a.ch < .05 && b.ch >= .05 && b.soc < .85) return {j, what: 'Charge battery', b};
    }
    return null;
  }
  function why(e){
    if (!e) return 'No change in the next 24 h.';
    const s = e.b, surplus = s.pv - s.house;
    const rel = s.p < D.avgP - 3 ? `Price ${fmt(s.p)} ct is below the daily average of ${fmt(D.avgP)} ct` : s.p > D.avgP + 3 ? `Price ${fmt(s.p)} ct is above the daily average of ${fmt(D.avgP)} ct` : `Price ${fmt(s.p)} ct`;
    if (e.what === 'Heat pump on') return surplus > .5 ? `${fmt(surplus, 1)} kW PV surplus expected, ${rel}. The buffer pre-heats for the evening.` : `${rel}. The buffer is charged before the expensive evening peak.`;
    if (e.what === 'Charge EV') return surplus > .5 ? `The battery is almost full by then, the remaining PV surplus goes to the car. Target: 80 % by 07:00.` : `${rel}. Cheapest window before departure at 07:00.`;
    if (e.what === 'Discharge battery') return `${rel}. Stored power replaces expensive grid supply.`;
    return surplus > .3 ? `PV surplus of ${fmt(surplus, 1)} kW is stored instead of fed in for 7.9 ct.` : `${rel}. Battery is charged for the morning peak.`;
  }
  function renderO(){
    const s = D.S[t];
    let body = '';
    const idx = Array.from({length: N}, (_, k) => D.S[(t + k) % N]);
    const lane = (label, cells) => `<div class="lane"><span>${label}</span><svg viewBox="0 0 ${N} 14" preserveAspectRatio="none">${cells}</svg></div>`;
    const blocks = (f, col) => idx.map((x, k) => f(x) ? `<rect x="${k}" y="2" width="1.02" height="10" fill="${col}"/>` : '').join('');
    if (view.o === 'plan') {
      const e = nextEvent();
      const pmn = Math.min(...D.price) - 2, pmx = Math.max(...D.price) + 2;
      const pr = idx.map(x => x.p), pv = idx.map(x => x.pv), pf = idx.map(x => x.puf);
      const pfmn = Math.min(...pf) - 1, pfmx = Math.max(...pf) + 1;
      const line = (arr, mn, mx) => arr.map((v, k) => `${k},${(13 - (v - mn) / (mx - mn) * 12).toFixed(2)}`).join(' ');
      const ticks = [0, 24, 48, 72].map(k => `<span style="position:absolute;left:${k / N * 100}%">${hhmm(t + k)}</span>`).join('');
      const sug = D.sunny ? (t < 44 ? ['Charge EV with solar power from 11:00', 'saves about €2.40 versus charging in the evening'] : ['Heat buffer with PV tomorrow 11:30 to 14:00', 'heat pump runs on surplus instead of at 21:00']) : ['Charge EV 01:00 to 04:00', '26 ct instead of 42 ct at 18:00'];
      body = `<div class="ttl">Plan<small>next 24 h · Copilot</small></div>
      <div class="crd r12" style="gap:4px">
        ${lane('Price', `<polyline points="${line(pr, pmn, pmx)}" fill="none" stroke="#bdbdbd" stroke-width="1" vector-effect="non-scaling-stroke"/>`)}
        ${lane('PV', `<polygon points="0,14 ${line(pv, 0, 6)} ${N},14" fill="#5a5a5a"/>`)}
        ${lane('Battery', blocks(x => x.ch > .05, '#ffcf22') + blocks(x => x.dis > .05, '#8a8a8a'))}
        ${lane('EV', blocks(x => x.ev > 0, '#ffcf22'))}
        ${lane('Heat pump', blocks(x => x.wp > 0, '#ffcf22'))}
        ${lane('Buffer', `<polyline points="${line(pf, pfmn, pfmx)}" fill="none" stroke="#ffcf22" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`)}
        ${lane('CHP –', '<line x1="0" x2="96" y1="7" y2="7" stroke="#3a3a3a" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>')}
        <div style="position:relative;height:12px;margin-left:64px;font-size:8.5px;color:#9a9a9a">${ticks}</div>
      </div>
      <div class="crd r12"><div class="h"><span>Next block${e ? ' · ' + hhmm(e.j) : ''}</span><span class="why rf">Why?</span></div><b style="font-size:11.5px">${e ? e.what : '–'}</b><span style="color:#bdbdbd;font-size:10px">${why(e)}</span></div>
      <div class="crd r12"><div class="h"><span>Copilot suggestion</span></div><div class="cp"><span style="font-size:10.5px">${sug[0]}<br><span style="color:#9a9a9a">${sug[1]}</span></span><span class="b r8" data-act="ok">${st.ok ? 'Confirmed ✓' : 'Confirm'}</span></div></div>
      <div class="crd r12"><div class="h"><span>Today versus a home without HEMS</span></div><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="big y">€${fmt(s.ref - s.cost + s.feed, 2)}</span><span class="big">${fmt(Math.max(0, s.cons - s.imp) * .38, 1)}<small>kg CO₂</small></span></div></div>`;
    } else if (view.o === 'overview') {
      const pd = Math.max(0, (s.cost - s.feed) / s.cons * 100), ref = s.ref / s.cons * 100;
      const c = (k, v, sub) => `<div class="crd r12"><div class="h"><span>${k}</span></div><div class="big">${v}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
      body = `<div class="ttl">Overview<small>${hhmm(t)}</small></div>
      <div class="crd r12"><div class="h"><span>My power price today</span><span>without HEMS</span></div><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="big y">${fmt(pd, 1)}<small>ct/kWh</small></span><span class="big" style="color:#9a9a9a">${fmt(ref, 1)}</span></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${c('PV', fmt(s.pv, 1), 'kW')}${c(s.grid >= 0 ? 'Grid supply' : 'Grid feed-in', fmt(Math.abs(s.grid), 1), 'kW')}${c('Battery', fmt(s.soc * 100), '%')}${c('EV', fmt(s.evs * 100), '%')}${c('Heat pump', fmt(s.wp, 1), 'kW')}${c('Buffer', fmt(s.puf, 0), '°C')}</div>`;
    } else {
      const co2 = Math.max(0, (s.cons - s.imp)) * .38, don = s.feed * .5;
      const g = (k, v) => `<div class="goal"><span>${k}</span><span class="t"><b style="width:${v}%"></b></span><span style="text-align:right;color:#9a9a9a">${v}</span></div>`;
      body = `<div class="ttl">Impact<small>today until ${hhmm(t)}</small></div>
      <div class="crd r12"><div class="h"><span>Optimiser objectives</span></div>${g('Cost', 40)}${g('CO₂', 30)}${g('Comfort', 20)}${g('Grid', 10)}</div>
      <div class="crd r12"><div class="h"><span>Savings versus reference</span></div><div class="big y">€${fmt(s.ref - s.cost + s.feed, 2)}<small>today</small></div></div>
      <div class="crd r12"><div class="h"><span>CO₂ avoided</span></div><div class="big">${fmt(co2, 1)}<small>kg</small></div></div>
      <div class="crd r12"><div class="h"><span>Donation from feed-in earnings</span><span>50 %</span></div><div class="big">€${fmt(don, 2)}<small>to a biochar project</small></div></div>`;
    }
    el('scr-o').innerHTML = sbar() + `<div class="body">${body}</div><div class="nav"><span class="${view.o === 'plan' ? 'on' : ''}">Plan</span><span class="${view.o === 'overview' ? 'on' : ''}">Overview</span><span class="${view.o === 'impact' ? 'on' : ''}">Impact</span><span>Comfort</span></div>`;
  }

  /* ---------- Tagesverlauf über den Handys ---------- */
  function drawDay(){
    const host = el('ap-day'), Wd = Math.max(320, host.clientWidth), H = 120, m = {t: 10, r: 40, b: 20, l: 34};
    const iw = Wd - m.l - m.r, ih = H - m.t - m.b, X = i => m.l + i / N * iw, Y = v => m.t + ih - v / 7 * ih;
    const pmn = 10, pmx = 45, YP = v => m.t + ih - (v - pmn) / (pmx - pmn) * ih;
    let s = `<svg width="${Wd}" height="${H}" role="img" aria-label="Daily profile of the simulated home">`;
    [0, 2, 4, 6].forEach(v => s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e1e1e1"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`);
    [20, 30, 40].forEach(v => s += `<text x="${Wd - m.r + 6}" y="${YP(v) + 4}">${v} ct</text>`);
    let a = `M${X(0)},${Y(0)}`; D.S.forEach((x, i) => a += `L${X(i + .5).toFixed(1)},${Y(x.pv).toFixed(1)}`); a += `L${X(N)},${Y(0)}Z`;
    s += `<path d="${a}" fill="#ffcf22" opacity=".85"/>`;
    let c = ''; D.S.forEach((x, i) => c += (i ? 'L' : 'M') + X(i + .5).toFixed(1) + ',' + Y(x.load + x.ev).toFixed(1));
    s += `<path d="${c}" fill="none" stroke="#000" stroke-width="1.5"/>`;
    s += `<g transform="translate(${m.l},${m.t})"><path d="${stepPath(D.price, iw, ih, pmn, pmx)}" fill="none" stroke="#8f8f8f" stroke-width="1.2" stroke-dasharray="4 3"/></g>`;
    for (let hh = 0; hh <= 24; hh += 3) s += `<text x="${X(hh * 4)}" y="${H - 4}" text-anchor="middle">${hh}</text>`;
    s += `<line x1="${m.l}" x2="${Wd - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#000"/>`;
    s += `<line x1="${X(t + .5)}" x2="${X(t + .5)}" y1="${m.t - 4}" y2="${m.t + ih}" stroke="#000" stroke-width="1.5"/><rect x="${X(t + .5) - 4}" y="${m.t - 8}" width="8" height="8" fill="#000"/>`;
    s += `<text class="dl" x="${m.l + 4}" y="${m.t + 8}">kW</text>`;
    s += `<rect class="hit" x="${m.l}" y="0" width="${iw}" height="${H}" fill="transparent" style="cursor:ew-resize"/></svg>`;
    host.innerHTML = s;
    const hit = host.querySelector('.hit');
    const pick = e => { const bx = host.getBoundingClientRect().left; setT(Math.max(0, Math.min(N - 1, Math.floor((e.clientX - bx - m.l) / iw * N)))); };
    hit.addEventListener('pointerdown', e => { hit.setPointerCapture(e.pointerId); pick(e); });
    hit.addEventListener('pointermove', e => {
      if (e.buttons) pick(e);
      const bx = host.getBoundingClientRect().left, i = Math.max(0, Math.min(N - 1, Math.floor((e.clientX - bx - m.l) / iw * N))), x = D.S[i];
      tip(`<div class="h">${hhmm(i)}</div>` + r('PV', kw(x.pv), '#ffcf22') + r('Consumption', kw(x.load + x.ev), '#000') + r('Power price', fmt(x.p) + ' ct/kWh', '#8f8f8f') + r('Battery', fmt(x.soc * 100) + ' %') + '<div class="note">Click or drag to set the time.</div>', e);
    });
    hit.addEventListener('pointerleave', () => tip());
  }

  function renderAll(){ el('ap-time').textContent = hhmm(t); renderG(); renderC(); renderO(); drawDay(); }
  function setT(v){ t = v; el('ap-t').value = v; renderAll(); }

  el('ap-t').addEventListener('input', e => setT(+e.target.value));
  document.querySelectorAll('.ph-tabs').forEach(g => g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    view[g.dataset.app] = b.dataset.v;
    g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderAll();
  })));
  document.querySelectorAll('[data-wx]').forEach(b => b.addEventListener('click', () => {
    D = sims[b.dataset.wx]; st.ok = false;
    document.querySelectorAll('[data-wx]').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderAll();
  }));
  // Klicks im Handy: Live/Heute, Heute/Morgen, Copilot bestätigen
  el('scr-g').addEventListener('click', e => { if (e.target.closest('[data-act="grange"]')) { st.gRange = st.gRange === 'live' ? 'heute' : 'live'; renderG(); } });
  el('scr-c').addEventListener('click', e => { if (e.target.closest('[data-act="cday"]')) { st.cDay = st.cDay === 'heute' ? 'morgen' : 'heute'; renderC(); } });
  el('scr-o').addEventListener('click', e => { if (e.target.closest('[data-act="ok"]')) { st.ok = !st.ok; renderO(); } });

  let timer = null; const play = el('ap-play');
  play.addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = null; play.textContent = '▶ Play day'; return; }
    play.textContent = '❚❚ Pause';
    timer = setInterval(() => { setT((t + 1) % N); if (t === N - 1) { clearInterval(timer); timer = null; play.textContent = '▶ Play day'; } }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 400 : 160);
  });
  renderAll();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawDay, 120); });
})();

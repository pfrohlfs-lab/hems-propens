/* Shared helpers for the HEMS market pages. Global: window.UI */
(function () {
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* Strategic groups (archetypes), fixed order and color token */
  const ARCH = [
    { id: 'hardware_oem_storage_inverter', label: 'Storage & inverter OEMs', short: 'Hardware OEM', tok: '--a1' },
    { id: 'heating_oem', label: 'Heating OEMs', short: 'Heating OEM', tok: '--a2' },
    { id: 'utility_or_utility_platform', label: 'Utilities & utility platforms', short: 'Utility', tok: '--a3' },
    { id: 'full_stack_installer', label: 'Full-stack installers', short: 'Installer', tok: '--a4' },
    { id: 'independent_hems_specialist', label: 'Independent HEMS specialists', short: 'HEMS specialist', tok: '--a5' },
    { id: 'tariff_and_flex_player', label: 'Tariff & flexibility players', short: 'Tariff & flex', tok: '--a6' },
    { id: 'software_pure_play', label: 'Software pure plays', short: 'Software', tok: '--a7' },
    { id: 'open_source', label: 'Open source', short: 'Open source', tok: '--a8' },
  ];
  const archById = Object.fromEntries(ARCH.map((a) => [a.id, a]));
  const archColor = (id) => css((archById[id] || { tok: '--grey' }).tok) || '#888';

  /* tooltip */
  let tipEl = null;
  function tip(html, ev) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.hidden = true; document.body.appendChild(tipEl); }
    if (html == null) { tipEl.hidden = true; return; }
    tipEl.innerHTML = html; tipEl.hidden = false;
    const pad = 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
    tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
  }
  function bindTip(sel, htmlFn) { // sel: d3 selection
    sel.on('mouseenter mousemove', (ev, d) => tip(htmlFn(d), ev)).on('mouseleave', () => tip(null));
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d = 0) => v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtEUR = (v, d = 0) => v == null ? '–' : '€' + fmt(v, d);
  const conf = (c) => c ? `<span class="conf ${c === 'low' ? 'low' : ''}">${esc(c)}</span>` : '';

  /* redraw on theme change so SVG colors follow the tokens */
  const redraws = [];
  function onTheme(fn) { redraws.push(fn); }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', () => redraws.forEach((f) => f()));
  new MutationObserver(() => redraws.forEach((f) => f())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  /* redraw on width change (debounced) */
  let rt = null; let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) < 40) return; lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(() => redraws.forEach((f) => f()), 150); });

  /* table of contents: highlight current chapter */
  function toc() {
    const links = [...document.querySelectorAll('.toc a[href^="#"]')];
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { links.forEach((l) => l.removeAttribute('aria-current')); map.get(e.target.id)?.setAttribute('aria-current', 'true'); } });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
  document.addEventListener('DOMContentLoaded', toc);
  /* split and wide exhibits: headline (takeaway) + chart description go above the chart, full width (26.11.2026) */
  function headlines() {
    document.querySelectorAll('.exhibit.split > .side, .exhibit.wide > .side').forEach((side) => {
      const fig = side.parentElement;
      if (fig.querySelector(':scope > .xhead')) return;
      const parts = side.querySelectorAll(':scope > .xno, :scope > h3, :scope > .sub, :scope > .m1-brand');
      if (!parts.length) return; /* e.g. the app mock-ups: no headline to move */
      const head = document.createElement('div'); head.className = 'xhead';
      parts.forEach((el) => head.appendChild(el));
      fig.insertBefore(head, fig.firstChild);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', headlines); else headlines();
  /* number exhibits in page order: <span class="xno"></span> -> "Exhibit N" */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.exhibit .xno').forEach((el, i) => { el.textContent = 'Exhibit ' + (i + 1); });
  });

  window.UI = { css, ARCH, archById, archColor, tip, bindTip, esc, fmt, fmtEUR, conf, onTheme };
})();

// Admin interactions
(() => {
  // Mobile sidebar
  const sidebar = document.querySelector('[data-sidebar]');
  document.querySelector('[data-sidebar-open]')?.addEventListener('click', () => sidebar.classList.add('open'));
  document.querySelector('[data-sidebar-close]')?.addEventListener('click', () => sidebar.classList.remove('open'));

  // Confirm destructive actions
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-confirm]');
    if (el && !confirm(el.dataset.confirm)) e.preventDefault();
  });

  // Clickable table rows
  document.querySelectorAll('[data-href]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('a, button, input, select, form')) return;
      window.location = row.dataset.href;
    });
  });

  // Auto-submit selects
  document.querySelectorAll('[data-autosubmit]').forEach(el => el.addEventListener('change', () => el.form.requestSubmit()));

  // Bulk selection on product list
  const bulk = document.querySelector('[data-bulk]');
  if (bulk) {
    const bar = bulk.querySelector('[data-bulk-bar]');
    const count = bulk.querySelector('[data-bulk-count]');
    const boxes = [...bulk.querySelectorAll('[data-check]')];
    const all = bulk.querySelector('[data-check-all]');
    const update = () => {
      const n = boxes.filter(b => b.checked).length;
      bar.hidden = n === 0;
      count.textContent = `${n} selected`;
      all.checked = n > 0 && n === boxes.length;
      all.indeterminate = n > 0 && n < boxes.length;
    };
    boxes.forEach(b => b.addEventListener('change', update));
    all?.addEventListener('change', () => { boxes.forEach(b => (b.checked = all.checked)); update(); });
    bulk.addEventListener('submit', e => {
      if (bulk.querySelector('[name=action]').value === 'delete' && !confirm('Delete the selected products? This can’t be undone.')) e.preventDefault();
    });
  }

  // Image previews before upload
  document.querySelectorAll('[data-preview]').forEach(input => {
    input.addEventListener('change', () => {
      const target = input.closest('.dropzone').querySelector('[data-preview-target]');
      target.innerHTML = '';
      [...input.files].forEach(file => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        target.appendChild(img);
      });
    });
  });

  // Order page: show restock option only when cancelling/refunding
  const statusSelect = document.querySelector('[data-status-select]');
  const restock = document.querySelector('[data-restock]');
  if (statusSelect && restock) {
    const sync = () => { restock.hidden = !['cancelled', 'refunded'].includes(statusSelect.value); };
    statusSelect.addEventListener('change', sync);
    sync();
  }
  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

  // ---------- Revenue chart (single series → no legend; title names it) ----------
  const chartEl = document.querySelector('[data-chart]');
  if (chartEl) {
    const data = JSON.parse(chartEl.querySelector('[data-chart-data]').textContent);
    const tooltip = chartEl.querySelector('[data-chart-tooltip]');
    const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
    const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
    const compact = v => (v >= 1000 ? `£${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : `£${v}`);
    const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

    const niceMax = max => {
      if (max <= 0) return 100;
      const pow = Math.pow(10, Math.floor(Math.log10(max)));
      const step = [1, 2, 2.5, 5, 10].find(s => s * pow * 4 >= max) * pow;
      return step * 4;
    };

    function draw() {
      chartEl.querySelector('svg')?.remove();
      const W = chartEl.clientWidth, H = chartEl.clientHeight;
      const m = { top: 12, right: 8, bottom: 26, left: 48 };
      const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
      const values = data.map(d => d.revenue / 100);
      const yMax = niceMax(Math.max(...values));
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Daily revenue column chart' });

      // Gridlines + y ticks
      const grid = el('g', { class: 'grid' }), axis = el('g', { class: 'axis' });
      for (let i = 0; i <= 4; i++) {
        const v = (yMax / 4) * i, y = m.top + ih - (v / yMax) * ih;
        grid.appendChild(el('line', { x1: m.left, x2: W - m.right, y1: y, y2: y }));
        const t = el('text', { x: m.left - 8, y: y + 4, 'text-anchor': 'end' });
        t.textContent = compact(v);
        axis.appendChild(t);
      }
      svg.append(grid, axis);

      // Columns: thin, 4px rounded top, square at baseline, capped at 24px
      const slot = iw / data.length;
      const bw = Math.max(2, Math.min(24, slot - 2));
      const r = Math.min(4, bw / 2);
      const bars = el('g', {});
      const hits = el('g', {});
      data.forEach((d, i) => {
        const v = values[i];
        const h = (v / yMax) * ih;
        const x = m.left + i * slot + (slot - bw) / 2;
        const y = m.top + ih - h;
        if (h > 0) {
          const rr = Math.min(r, h);
          const path = `M${x},${m.top + ih} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + bw - rr} Q${x + bw},${y} ${x + bw},${y + rr} V${m.top + ih} Z`;
          bars.appendChild(el('path', { d: path, class: 'bar', 'data-i': i }));
        }
        // Full-height hit target, bigger than the mark
        const hit = el('rect', { x: m.left + i * slot, y: m.top, width: slot, height: ih, class: 'hit', 'data-i': i });
        hits.appendChild(hit);
      });
      svg.append(bars);

      // X labels: first, last and a few in between
      const every = Math.ceil(data.length / (W < 500 ? 4 : 7));
      data.forEach((d, i) => {
        if (i % every !== 0 && i !== data.length - 1) return;
        if (i !== data.length - 1 && data.length - 1 - i < every / 2) return;
        const t = el('text', { x: m.left + i * slot + slot / 2, y: H - 6, 'text-anchor': 'middle' });
        t.textContent = fmtDay(d.d);
        axis.appendChild(t);
      });
      svg.append(hits);

      const show = i => {
        const d = data[i];
        bars.querySelectorAll('.bar').forEach(b => b.classList.toggle('dim', Number(b.dataset.i) !== i));
        tooltip.innerHTML = `<strong>${gbp2.format(d.revenue / 100)}</strong>${fmtDay(d.d)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`;
        tooltip.hidden = false;
        const x = m.left + i * slot + slot / 2;
        const y = m.top + ih - (values[i] / yMax) * ih;
        tooltip.style.left = `${Math.min(Math.max(x, 70), W - 70)}px`;
        tooltip.style.top = `${y}px`;
      };
      const hide = () => { tooltip.hidden = true; bars.querySelectorAll('.bar').forEach(b => b.classList.remove('dim')); };
      hits.addEventListener('pointermove', e => { const i = e.target.dataset.i; if (i !== undefined) show(Number(i)); });
      hits.addEventListener('pointerleave', hide);
      chartEl.prepend(svg);
    }
    draw();
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 120); });
  }
})();

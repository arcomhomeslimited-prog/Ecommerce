// Storefront interactions – progressive enhancement only; every form still works without JS.
(() => {
  // Mobile menu
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Mobile filters drawer
  const filters = document.querySelector('[data-filters]');
  document.querySelector('[data-filters-open]')?.addEventListener('click', () => filters?.classList.add('open'));
  document.querySelector('[data-filters-close]')?.addEventListener('click', () => filters?.classList.remove('open'));

  // Auto-submit selects/checkboxes (sort, filters, basket qty)
  document.querySelectorAll('[data-autosubmit]').forEach(el => {
    el.addEventListener('change', () => {
      // Don't auto-submit filter checkboxes on mobile; the drawer has an Apply button
      if (filters && filters.contains(el) && window.matchMedia('(max-width: 900px)').matches) return;
      el.form.requestSubmit();
    });
  });

  // Quantity steppers
  document.querySelectorAll('[data-qty]').forEach(box => {
    const input = box.querySelector('input');
    box.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const min = Number(input.min || 1), max = Number(input.max || 99);
        const next = Math.min(max, Math.max(min, Number(input.value || 1) + Number(btn.dataset.step)));
        if (next !== Number(input.value)) {
          input.value = next;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  });

  // Product gallery
  const main = document.querySelector('[data-gallery-main]');
  document.querySelectorAll('[data-gallery-thumb]').forEach(btn => {
    btn.addEventListener('click', () => {
      main.src = btn.dataset.galleryThumb;
      document.querySelectorAll('[data-gallery-thumb]').forEach(b => b.classList.toggle('on', b === btn));
    });
  });
})();

const crypto = require('node:crypto');
const { db, getSettings } = require('./db');

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// Prices are stored as integer pence.
function money(pence) {
  return gbp.format((Number(pence) || 0) / 100);
}

function toPence(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(String(value).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function uniqueSlug(table, base, excludeId = null) {
  let slug = slugify(base);
  let i = 2;
  const stmt = db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id IS NOT ?`);
  while (stmt.get(slug, excludeId)) slug = `${slugify(base)}-${i++}`;
  return slug;
}

function formatDate(value, withTime = false) {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('en-GB', opts);
}

function orderNumber() {
  return 'AH' + Date.now().toString().slice(-6) + crypto.randomInt(100, 999);
}

// UK postcode (loose check – accepts all valid formats incl. BFPO-style spacing variations)
function isUkPostcode(pc) {
  return /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(String(pc).trim());
}

function isEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());
}

const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

// ---------- Products ----------
const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.department,
    (SELECT path FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
    (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.product_id = p.id AND approved = 1) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND approved = 1) AS review_count
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

function productImages(productId) {
  return db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(productId);
}

// ---------- Basket ----------
// The basket lives in the signed session cookie as { productId: qty }.
function getCart(session) {
  const raw = session.cart || {};
  const ids = Object.keys(raw).map(Number).filter(Boolean);
  if (!ids.length) return emptyCart(session);
  const rows = db.prepare(`${PRODUCT_SELECT} WHERE p.id IN (${ids.map(() => '?').join(',')}) AND p.active = 1`).all(...ids);
  const items = rows.map(p => {
    const qty = Math.max(1, Math.min(Number(raw[p.id]) || 1, Math.max(p.stock, 0) || 1));
    return { product: p, qty, line: p.price * qty };
  });
  const subtotal = items.reduce((s, i) => s + i.line, 0);
  return totals(session, items, subtotal);
}

function emptyCart(session) {
  return totals(session, [], 0);
}

function totals(session, items, subtotal) {
  const settings = getSettings();
  const count = items.reduce((s, i) => s + i.qty, 0);
  let discount = 0;
  let discountCode = null;
  let discountError = null;
  if (session.discount && items.length) {
    const result = evaluateDiscount(session.discount, subtotal);
    if (result.ok) { discount = result.amount; discountCode = result.code; }
    else discountError = result.error;
  }
  const threshold = Number(settings.free_shipping_threshold) || 0;
  const afterDiscount = subtotal - discount;
  const shipping = !items.length ? 0 : (afterDiscount >= threshold ? 0 : Number(settings.shipping_flat_rate) || 0);
  const total = Math.max(0, afterDiscount + shipping);
  const vat = Math.round(total - total / 1.2); // UK prices include 20% VAT
  return {
    items, count, subtotal, discount, discountCode, discountError, shipping, total, vat,
    freeShippingRemaining: items.length && afterDiscount < threshold ? threshold - afterDiscount : 0
  };
}

function evaluateDiscount(code, subtotal) {
  const d = db.prepare('SELECT * FROM discount_codes WHERE code = ? AND active = 1').get(String(code).trim());
  if (!d) return { ok: false, error: 'That discount code is not valid.' };
  if (d.expires_at && new Date(d.expires_at + 'T23:59:59') < new Date()) return { ok: false, error: 'That discount code has expired.' };
  if (d.max_uses !== null && d.uses >= d.max_uses) return { ok: false, error: 'That discount code has reached its usage limit.' };
  if (subtotal < d.min_spend) return { ok: false, error: `Spend ${money(d.min_spend)} or more to use this code.` };
  const amount = d.type === 'percent' ? Math.round(subtotal * d.value / 100) : Math.min(d.value, subtotal);
  return { ok: true, amount, code: d.code, id: d.id };
}

module.exports = {
  money, toPence, slugify, uniqueSlug, formatDate, orderNumber, isUkPostcode, isEmail,
  ORDER_STATUSES, PRODUCT_SELECT, productImages, getCart, evaluateDiscount
};

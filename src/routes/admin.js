const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { db, getSettings, setSetting, transaction, DEFAULT_SETTINGS } = require('../db');
const { toPence, uniqueSlug, ORDER_STATUSES, PRODUCT_SELECT, productImages, isEmail } = require('../helpers');
const { loginLimiter, requireAdmin } = require('../auth');

const router = express.Router();
const PAGE_SIZE = 25;
const PAID = "('paid','processing','shipped','delivered')";

// ---------- Uploads ----------
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, Boolean(ALLOWED[file.mimetype]))
});

function removeUpload(p) {
  if (p && p.startsWith('/uploads/')) fs.rm(path.join(uploadDir, path.basename(p)), { force: true }, () => {});
}

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const int = (v, d = 0) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // prevent spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function sendCsv(res, filename, header, rows) {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
  res.send([header, ...rows].map(r => r.map(csvCell).join(',')).join('\n'));
}

function paginate(total, req) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, int(req.query.page, 1)));
  return { page, pages, offset: (page - 1) * PAGE_SIZE, total };
}

// ---------- Auth ----------
router.use((req, res, next) => {
  res.locals.adminPath = req.path;
  next();
});

router.get('/login', (req, res) => {
  if (res.locals.user && res.locals.user.role === 'admin') return res.redirect('/admin');
  res.render('admin/login', { error: null, email: '', next: req.query.next || '' });
});

router.post('/login', loginLimiter, (req, res) => {
  const email = str(req.body.email);
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'").get(email);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) {
    req.loginFailed();
    return res.status(401).render('admin/login', { error: 'Incorrect email or password.', email, next: req.body.next || '' });
  }
  req.session.userId = user.id;
  const next = String(req.body.next || '');
  res.redirect(next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin');
});

router.post('/logout', (req, res) => {
  delete req.session.userId;
  res.redirect('/admin/login');
});

router.use(requireAdmin);

// Sidebar badge counts
router.use((req, res, next) => {
  res.locals.badges = {
    orders: db.prepare("SELECT COUNT(*) n FROM orders WHERE status IN ('pending','paid','processing')").get().n,
    reviews: db.prepare('SELECT COUNT(*) n FROM reviews WHERE approved = 0').get().n,
    messages: db.prepare('SELECT COUNT(*) n FROM messages WHERE is_read = 0').get().n
  };
  res.locals.ORDER_STATUSES = ORDER_STATUSES;
  next();
});

// ---------- Dashboard ----------
router.get('/', (req, res) => {
  const days = [7, 30, 90].includes(int(req.query.days)) ? int(req.query.days) : 30;
  const since = `-${days} days`, prevSince = `-${days * 2} days`;
  const kpi = (from, to) => db.prepare(`SELECT COALESCE(SUM(total),0) revenue, COUNT(*) orders FROM orders
    WHERE status IN ${PAID} AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`).get(from, to);
  const cur = kpi(since, '+1 day');
  const prev = kpi(prevSince, since);
  const newCustomers = db.prepare("SELECT COUNT(*) n FROM users WHERE role='customer' AND created_at >= datetime('now', ?)").get(since).n;
  const prevCustomers = db.prepare("SELECT COUNT(*) n FROM users WHERE role='customer' AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)").get(prevSince, since).n;

  // Daily revenue, with zero-filled days
  const rows = db.prepare(`SELECT date(created_at) d, SUM(total) revenue, COUNT(*) orders FROM orders
    WHERE status IN ${PAID} AND created_at >= date('now', ?) GROUP BY d`).all(`-${days - 1} days`);
  const byDay = Object.fromEntries(rows.map(r => [r.d, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    series.push({ d, revenue: byDay[d] ? byDay[d].revenue : 0, orders: byDay[d] ? byDay[d].orders : 0 });
  }

  const statusCounts = db.prepare("SELECT status, COUNT(*) n FROM orders WHERE created_at >= datetime('now', ?) GROUP BY status").all(since);
  const topProducts = db.prepare(`SELECT oi.product_id, oi.name, oi.finish, oi.image, SUM(oi.qty) units, SUM(oi.qty * oi.price) revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ${PAID} AND o.created_at >= datetime('now', ?) GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 5`).all(since);
  const threshold = int(getSettings().low_stock_threshold, 5);
  const lowStock = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.stock <= ? ORDER BY p.stock ASC LIMIT 8`).all(threshold);
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8').all();

  res.render('admin/dashboard', {
    title: 'Dashboard', days, cur, prev, newCustomers, prevCustomers, series, statusCounts, topProducts, lowStock, recentOrders,
    aov: cur.orders ? Math.round(cur.revenue / cur.orders) : 0,
    prevAov: prev.orders ? Math.round(prev.revenue / prev.orders) : 0
  });
});

// ---------- Products ----------
router.get('/products', (req, res) => {
  const where = ['1=1'], params = [];
  const q = str(req.query.q);
  if (q) { where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.finish LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (req.query.category) { where.push('p.category_id = ?'); params.push(int(req.query.category)); }
  if (req.query.status === 'active') where.push('p.active = 1');
  if (req.query.status === 'draft') where.push('p.active = 0');
  if (req.query.stock === 'low') { where.push('p.stock > 0 AND p.stock <= ?'); params.push(int(getSettings().low_stock_threshold, 5)); }
  if (req.query.stock === 'out') where.push('p.stock <= 0');
  if (req.query.sale) where.push('p.compare_price > p.price');
  const total = db.prepare(`SELECT COUNT(*) n FROM products p WHERE ${where.join(' AND ')}`).get(...params).n;
  const pg = paginate(total, req);
  const sorts = { name: 'p.name', price: 'p.price DESC', stock: 'p.stock ASC', newest: 'p.created_at DESC' };
  const sort = sorts[req.query.sort] ? req.query.sort : 'newest';
  const products = db.prepare(`${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${sorts[sort]}, p.id DESC LIMIT ? OFFSET ?`).all(...params, PAGE_SIZE, pg.offset);
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY sort_order, name').all();
  res.render('admin/products', { title: 'Products', products, categories, pg, q, sort, threshold: int(getSettings().low_stock_threshold, 5) });
});

function productForm(res, product, images, errors = {}) {
  const categories = db.prepare('SELECT id, name, department FROM categories ORDER BY department, sort_order, name').all();
  res.render('admin/product-form', { title: product.id ? `Edit ${product.name}` : 'New product', product, images, categories, errors });
}

router.get('/products/new', (req, res) => {
  productForm(res, { brand: 'ArcomHomes', active: 1, stock: 0 }, []);
});

router.get('/products/:id', (req, res, next) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(int(req.params.id));
  if (!product) return next();
  productForm(res, product, productImages(product.id));
});

function readProduct(body) {
  return {
    name: str(body.name, 160),
    sku: str(body.sku, 60),
    category_id: int(body.category_id) || null,
    short_description: str(body.short_description, 300),
    description: str(body.description, 10000),
    price: toPence(body.price),
    compare_price: toPence(body.compare_price),
    stock: int(body.stock),
    finish: str(body.finish, 60),
    brand: str(body.brand, 60) || 'ArcomHomes',
    material: str(body.material, 120),
    dimensions: str(body.dimensions, 160),
    warranty: str(body.warranty, 120),
    featured: body.featured ? 1 : 0,
    is_new: body.is_new ? 1 : 0,
    active: body.active ? 1 : 0
  };
}

function validateProduct(p) {
  const errors = {};
  if (!p.name) errors.name = 'Name is required';
  if (p.price === null || p.price < 0) errors.price = 'Enter a valid price';
  if (p.compare_price !== null && p.compare_price <= p.price) p.compare_price = null; // "was" price only makes sense if higher
  return errors;
}

function saveImages(productId, files) {
  if (!files || !files.length) return;
  let order = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM product_images WHERE product_id = ?').get(productId).m;
  const ins = db.prepare('INSERT INTO product_images (product_id, path, sort_order) VALUES (?, ?, ?)');
  for (const f of files) ins.run(productId, `/uploads/${f.filename}`, ++order);
}

router.post('/products', upload.array('images', 10), (req, res) => {
  const p = readProduct(req.body);
  const errors = validateProduct(p);
  if (Object.keys(errors).length) {
    (req.files || []).forEach(f => removeUpload(`/uploads/${f.filename}`));
    return productForm(res.status(400), p, [], errors);
  }
  const slug = uniqueSlug('products', p.finish ? `${p.name} ${p.finish}` : p.name);
  const id = Number(db.prepare(`INSERT INTO products (name, slug, sku, category_id, short_description, description, price, compare_price, stock, finish, brand, material, dimensions, warranty, featured, is_new, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    p.name, slug, p.sku, p.category_id, p.short_description, p.description, p.price, p.compare_price, p.stock,
    p.finish, p.brand, p.material, p.dimensions, p.warranty, p.featured, p.is_new, p.active).lastInsertRowid);
  if (!p.sku) db.prepare('UPDATE products SET sku = ? WHERE id = ?').run(`AH-${1000 + id}`, id);
  saveImages(id, req.files);
  req.flash('success', 'Product created.');
  res.redirect(`/admin/products/${id}`);
});

router.post('/products/bulk', (req, res) => {
  const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
  const action = req.body.action;
  if (ids.length) {
    const list = ids.map(() => '?').join(',');
    const actions = {
      activate: `UPDATE products SET active = 1 WHERE id IN (${list})`,
      deactivate: `UPDATE products SET active = 0 WHERE id IN (${list})`,
      feature: `UPDATE products SET featured = 1 WHERE id IN (${list})`,
      unfeature: `UPDATE products SET featured = 0 WHERE id IN (${list})`
    };
    if (actions[action]) db.prepare(actions[action]).run(...ids);
    if (action === 'delete') {
      const imgs = db.prepare(`SELECT path FROM product_images WHERE product_id IN (${list})`).all(...ids);
      db.prepare(`DELETE FROM products WHERE id IN (${list})`).run(...ids);
      imgs.forEach(i => removeUpload(i.path));
    }
    req.flash('success', `Updated ${ids.length} product${ids.length === 1 ? '' : 's'}.`);
  }
  res.redirect(req.get('referer') || '/admin/products');
});

router.post('/products/:id', upload.array('images', 10), (req, res, next) => {
  const id = int(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return next();
  const p = readProduct(req.body);
  const errors = validateProduct(p);
  if (Object.keys(errors).length) {
    (req.files || []).forEach(f => removeUpload(`/uploads/${f.filename}`));
    return productForm(res.status(400), { ...existing, ...p }, productImages(id), errors);
  }
  const slug = str(req.body.slug) ? uniqueSlug('products', req.body.slug, id) : existing.slug;
  if (!p.sku) p.sku = existing.sku || `AH-${1000 + id}`;
  db.prepare(`UPDATE products SET name=?, slug=?, sku=?, category_id=?, short_description=?, description=?, price=?, compare_price=?, stock=?,
    finish=?, brand=?, material=?, dimensions=?, warranty=?, featured=?, is_new=?, active=?, updated_at=datetime('now') WHERE id=?`).run(
    p.name, slug, p.sku, p.category_id, p.short_description, p.description, p.price, p.compare_price, p.stock,
    p.finish, p.brand, p.material, p.dimensions, p.warranty, p.featured, p.is_new, p.active, id);
  saveImages(id, req.files);
  req.flash('success', 'Product saved.');
  res.redirect(`/admin/products/${id}`);
});

router.post('/products/:id/stock', (req, res) => {
  db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(Math.max(0, int(req.body.stock)), int(req.params.id));
  res.redirect(req.get('referer') || '/admin/products');
});

router.post('/products/:id/duplicate', (req, res, next) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(int(req.params.id));
  if (!p) return next();
  const newId = transaction(() => {
    const id = Number(db.prepare(`INSERT INTO products (name, slug, sku, category_id, short_description, description, price, compare_price, stock, finish, brand, material, dimensions, warranty, featured, is_new, active)
      SELECT name || ' (copy)', ?, '', category_id, short_description, description, price, compare_price, 0, finish, brand, material, dimensions, warranty, 0, is_new, 0 FROM products WHERE id = ?`)
      .run(uniqueSlug('products', p.slug + '-copy'), p.id).lastInsertRowid);
    db.prepare('UPDATE products SET sku = ? WHERE id = ?').run(`AH-${1000 + id}`, id);
    db.prepare('INSERT INTO product_images (product_id, path, sort_order) SELECT ?, path, sort_order FROM product_images WHERE product_id = ?').run(id, p.id);
    return id;
  });
  req.flash('success', 'Product duplicated as a draft.');
  res.redirect(`/admin/products/${newId}`);
});

router.post('/products/:id/delete', (req, res) => {
  const id = int(req.params.id);
  const imgs = db.prepare('SELECT path FROM product_images WHERE product_id = ?').all(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  // Only remove files that no other product still uses
  imgs.forEach(i => { if (!db.prepare('SELECT 1 FROM product_images WHERE path = ?').get(i.path)) removeUpload(i.path); });
  req.flash('success', 'Product deleted.');
  res.redirect('/admin/products');
});

router.post('/products/:id/images/:imageId/delete', (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(int(req.params.imageId), int(req.params.id));
  if (img) {
    db.prepare('DELETE FROM product_images WHERE id = ?').run(img.id);
    if (!db.prepare('SELECT 1 FROM product_images WHERE path = ?').get(img.path)) removeUpload(img.path);
  }
  res.redirect(`/admin/products/${int(req.params.id)}#images`);
});

router.post('/products/:id/images/:imageId/primary', (req, res) => {
  const pid = int(req.params.id);
  transaction(() => {
    db.prepare('UPDATE product_images SET sort_order = sort_order + 1 WHERE product_id = ?').run(pid);
    db.prepare('UPDATE product_images SET sort_order = 0 WHERE id = ? AND product_id = ?').run(int(req.params.imageId), pid);
  });
  res.redirect(`/admin/products/${pid}#images`);
});

router.get('/products-export.csv', (req, res) => {
  const rows = db.prepare(`${PRODUCT_SELECT} ORDER BY p.id`).all();
  sendCsv(res, 'arcomhomes-products.csv',
    ['ID', 'SKU', 'Name', 'Finish', 'Category', 'Price (£)', 'Was (£)', 'Stock', 'Active', 'Featured', 'URL'],
    rows.map(p => [p.id, p.sku, p.name, p.finish, p.category_name, (p.price / 100).toFixed(2), p.compare_price ? (p.compare_price / 100).toFixed(2) : '', p.stock, p.active ? 'yes' : 'no', p.featured ? 'yes' : 'no', `/p/${p.slug}`]));
});

// ---------- Categories ----------
router.get('/categories', (req, res) => {
  const categories = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
    FROM categories c ORDER BY c.department, c.sort_order, c.name`).all();
  res.render('admin/categories', { title: 'Categories', categories });
});

router.get('/categories/new', (req, res) => res.render('admin/category-form', { title: 'New category', category: { department: 'bathroom', active: 1, sort_order: 0 }, errors: {} }));

router.get('/categories/:id', (req, res, next) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(int(req.params.id));
  if (!category) return next();
  res.render('admin/category-form', { title: `Edit ${category.name}`, category, errors: {} });
});

function readCategory(body) {
  return {
    name: str(body.name, 80),
    department: ['bathroom', 'kitchen'].includes(body.department) ? body.department : 'bathroom',
    description: str(body.description, 500),
    sort_order: int(body.sort_order),
    active: body.active ? 1 : 0
  };
}

router.post('/categories', upload.single('image'), (req, res) => {
  const c = readCategory(req.body);
  if (!c.name) return res.status(400).render('admin/category-form', { title: 'New category', category: c, errors: { name: 'Name is required' } });
  const image = req.file ? `/uploads/${req.file.filename}` : '';
  db.prepare('INSERT INTO categories (name, slug, department, description, image, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(c.name, uniqueSlug('categories', c.name), c.department, c.description, image, c.sort_order, c.active);
  req.flash('success', 'Category created.');
  res.redirect('/admin/categories');
});

router.post('/categories/:id', upload.single('image'), (req, res, next) => {
  const id = int(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return next();
  const c = readCategory(req.body);
  if (!c.name) return res.status(400).render('admin/category-form', { title: 'Edit category', category: { ...existing, ...c }, errors: { name: 'Name is required' } });
  let image = existing.image;
  if (req.file) { removeUpload(existing.image); image = `/uploads/${req.file.filename}`; }
  const slug = str(req.body.slug) ? uniqueSlug('categories', req.body.slug, id) : existing.slug;
  db.prepare('UPDATE categories SET name=?, slug=?, department=?, description=?, image=?, sort_order=?, active=? WHERE id=?')
    .run(c.name, slug, c.department, c.description, image, c.sort_order, c.active, id);
  req.flash('success', 'Category saved.');
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', (req, res) => {
  const id = int(req.params.id);
  const n = db.prepare('SELECT COUNT(*) n FROM products WHERE category_id = ?').get(id).n;
  if (n) req.flash('error', `This category still has ${n} product(s). Move or delete them first.`);
  else {
    const c = db.prepare('SELECT image FROM categories WHERE id = ?').get(id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    if (c) removeUpload(c.image);
    req.flash('success', 'Category deleted.');
  }
  res.redirect('/admin/categories');
});

// ---------- Orders ----------
function orderFilters(req) {
  const where = ['1=1'], params = [];
  const q = str(req.query.q);
  if (q) { where.push("(o.number LIKE ? OR o.email LIKE ? OR (o.first_name || ' ' || o.last_name) LIKE ? OR o.postcode LIKE ?)"); params.push(...Array(4).fill(`%${q}%`)); }
  if (ORDER_STATUSES.includes(req.query.status)) { where.push('o.status = ?'); params.push(req.query.status); }
  if (req.query.from) { where.push('date(o.created_at) >= date(?)'); params.push(str(req.query.from, 10)); }
  if (req.query.to) { where.push('date(o.created_at) <= date(?)'); params.push(str(req.query.to, 10)); }
  return { where, params, q };
}

router.get('/orders', (req, res) => {
  const { where, params, q } = orderFilters(req);
  const total = db.prepare(`SELECT COUNT(*) n FROM orders o WHERE ${where.join(' AND ')}`).get(...params).n;
  const pg = paginate(total, req);
  const orders = db.prepare(`SELECT o.*, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) item_count FROM orders o
    WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params, PAGE_SIZE, pg.offset);
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM orders GROUP BY status').all().map(r => [r.status, r.n]));
  res.render('admin/orders', { title: 'Orders', orders, pg, q, counts });
});

router.get('/orders-export.csv', (req, res) => {
  const { where, params } = orderFilters(req);
  const rows = db.prepare(`SELECT o.* FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC`).all(...params);
  sendCsv(res, 'arcomhomes-orders.csv',
    ['Order', 'Date', 'Status', 'Payment', 'Customer', 'Email', 'Postcode', 'Subtotal', 'Discount', 'Shipping', 'Total', 'VAT', 'Code', 'Tracking'],
    rows.map(o => [o.number, o.created_at, o.status, o.payment_status, `${o.first_name} ${o.last_name}`, o.email, o.postcode,
      (o.subtotal / 100).toFixed(2), (o.discount / 100).toFixed(2), (o.shipping / 100).toFixed(2), (o.total / 100).toFixed(2), (o.vat / 100).toFixed(2), o.discount_code, o.tracking_number]));
});

router.get('/orders/:id', (req, res, next) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(int(req.params.id));
  if (!order) return next();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const events = db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC, id DESC').all(order.id);
  const customerOrders = order.user_id ? db.prepare('SELECT COUNT(*) n FROM orders WHERE user_id = ?').get(order.user_id).n : 1;
  res.render('admin/order', { title: `Order ${order.number}`, order, items, events, customerOrders });
});

router.post('/orders/:id', (req, res, next) => {
  const id = int(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return next();
  const status = ORDER_STATUSES.includes(req.body.status) ? req.body.status : order.status;
  const tracking = str(req.body.tracking_number, 80);
  const note = str(req.body.note, 1000);
  const paymentStatus = ['unpaid', 'paid', 'refunded', 'void'].includes(req.body.payment_status) ? req.body.payment_status : order.payment_status;
  transaction(() => {
    // Return stock to inventory when an order is cancelled/refunded for the first time
    const restock = ['cancelled', 'refunded'].includes(status) && !['cancelled', 'refunded'].includes(order.status) && req.body.restock;
    if (restock) {
      for (const it of db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(id)) {
        if (it.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.qty, it.product_id);
      }
    }
    db.prepare("UPDATE orders SET status = ?, tracking_number = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, tracking, paymentStatus, id);
    if (status !== order.status || note || tracking !== order.tracking_number) {
      const parts = [note];
      if (tracking !== order.tracking_number && tracking) parts.push(`Tracking: ${tracking}`);
      if (restock) parts.push('Items returned to stock');
      db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(id, status, parts.filter(Boolean).join(' · '));
    }
  });
  req.flash('success', 'Order updated.');
  res.redirect(`/admin/orders/${id}`);
});

// ---------- Customers ----------
router.get('/customers', (req, res) => {
  const q = str(req.query.q);
  const where = ["u.role = 'customer'"], params = [];
  if (q) { where.push("(u.email LIKE ? OR (u.first_name || ' ' || u.last_name) LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  const total = db.prepare(`SELECT COUNT(*) n FROM users u WHERE ${where.join(' AND ')}`).get(...params).n;
  const pg = paginate(total, req);
  const customers = db.prepare(`SELECT u.*,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) order_count,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.status IN ${PAID}) spent,
      (SELECT MAX(created_at) FROM orders o WHERE o.user_id = u.id) last_order
    FROM users u WHERE ${where.join(' AND ')} ORDER BY spent DESC, u.created_at DESC LIMIT ? OFFSET ?`).all(...params, PAGE_SIZE, pg.offset);
  res.render('admin/customers', { title: 'Customers', customers, pg, q });
});

router.get('/customers/:id', (req, res, next) => {
  const customer = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").get(int(req.params.id));
  if (!customer) return next();
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(customer.id);
  const spent = orders.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status)).reduce((s, o) => s + o.total, 0);
  const address = orders[0] || null;
  const subscribed = !!db.prepare('SELECT 1 FROM subscribers WHERE email = ?').get(customer.email);
  res.render('admin/customer', { title: `${customer.first_name} ${customer.last_name}`, customer, orders, spent, address, subscribed });
});

router.post('/customers/:id/delete', (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'customer'").run(int(req.params.id));
  req.flash('success', 'Customer account deleted. Their past orders have been kept.');
  res.redirect('/admin/customers');
});

// ---------- Discount codes ----------
router.get('/discounts', (req, res) => {
  const codes = db.prepare('SELECT * FROM discount_codes ORDER BY active DESC, created_at DESC').all();
  res.render('admin/discounts', { title: 'Discount codes', codes });
});

router.get('/discounts/new', (req, res) => res.render('admin/discount-form', { title: 'New discount code', code: { type: 'percent', active: 1 }, errors: {} }));
router.get('/discounts/:id', (req, res, next) => {
  const code = db.prepare('SELECT * FROM discount_codes WHERE id = ?').get(int(req.params.id));
  if (!code) return next();
  res.render('admin/discount-form', { title: `Edit ${code.code}`, code, errors: {} });
});

function readDiscount(body) {
  const type = body.type === 'fixed' ? 'fixed' : 'percent';
  return {
    code: str(body.code, 40).toUpperCase().replace(/\s+/g, ''),
    type,
    value: type === 'fixed' ? toPence(body.value) : int(body.value),
    min_spend: toPence(body.min_spend) || 0,
    max_uses: str(body.max_uses) ? int(body.max_uses) : null,
    expires_at: /^\d{4}-\d{2}-\d{2}$/.test(str(body.expires_at)) ? str(body.expires_at) : null,
    active: body.active ? 1 : 0
  };
}

function saveDiscount(req, res, id) {
  const d = readDiscount(req.body);
  const errors = {};
  if (!/^[A-Z0-9_-]{3,40}$/.test(d.code)) errors.code = 'Use 3–40 letters, numbers, - or _';
  else if (db.prepare('SELECT id FROM discount_codes WHERE code = ? AND id IS NOT ?').get(d.code, id)) errors.code = 'That code already exists';
  if (!d.value || d.value <= 0) errors.value = 'Enter a value above zero';
  if (d.type === 'percent' && d.value > 100) errors.value = 'Percentage cannot exceed 100';
  if (Object.keys(errors).length) {
    return res.status(400).render('admin/discount-form', { title: 'Discount code', code: { ...d, id }, errors });
  }
  if (id) db.prepare('UPDATE discount_codes SET code=?, type=?, value=?, min_spend=?, max_uses=?, expires_at=?, active=? WHERE id=?').run(d.code, d.type, d.value, d.min_spend, d.max_uses, d.expires_at, d.active, id);
  else db.prepare('INSERT INTO discount_codes (code, type, value, min_spend, max_uses, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(d.code, d.type, d.value, d.min_spend, d.max_uses, d.expires_at, d.active);
  req.flash('success', `Discount code ${d.code} saved.`);
  res.redirect('/admin/discounts');
}
router.post('/discounts', (req, res) => saveDiscount(req, res, null));
router.post('/discounts/:id', (req, res) => saveDiscount(req, res, int(req.params.id)));
router.post('/discounts/:id/delete', (req, res) => {
  db.prepare('DELETE FROM discount_codes WHERE id = ?').run(int(req.params.id));
  req.flash('success', 'Discount code deleted.');
  res.redirect('/admin/discounts');
});

// ---------- Reviews ----------
router.get('/reviews', (req, res) => {
  const filter = ['pending', 'approved'].includes(req.query.filter) ? req.query.filter : 'pending';
  const reviews = db.prepare(`SELECT r.*, p.name product_name, p.slug product_slug, p.finish FROM reviews r JOIN products p ON p.id = r.product_id
    WHERE r.approved = ? ORDER BY r.created_at DESC LIMIT 200`).all(filter === 'approved' ? 1 : 0);
  res.render('admin/reviews', { title: 'Reviews', reviews, filter });
});
router.post('/reviews/:id/:action', (req, res) => {
  const id = int(req.params.id);
  if (req.params.action === 'approve') db.prepare('UPDATE reviews SET approved = 1 WHERE id = ?').run(id);
  if (req.params.action === 'unapprove') db.prepare('UPDATE reviews SET approved = 0 WHERE id = ?').run(id);
  if (req.params.action === 'delete') db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  res.redirect(req.get('referer') || '/admin/reviews');
});

// ---------- Messages ----------
router.get('/messages', (req, res) => {
  const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 300').all();
  const selected = req.query.id ? messages.find(m => m.id === int(req.query.id)) : null;
  if (selected && !selected.is_read) { db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(selected.id); selected.is_read = 1; res.locals.badges.messages--; }
  res.render('admin/messages', { title: 'Messages', messages, selected });
});
router.post('/messages/:id/delete', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(int(req.params.id));
  res.redirect('/admin/messages');
});
router.post('/messages/:id/unread', (req, res) => {
  db.prepare('UPDATE messages SET is_read = 0 WHERE id = ?').run(int(req.params.id));
  res.redirect('/admin/messages');
});

// ---------- Subscribers ----------
router.get('/subscribers', (req, res) => {
  const subscribers = db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all();
  res.render('admin/subscribers', { title: 'Newsletter subscribers', subscribers });
});
router.get('/subscribers.csv', (req, res) => {
  const rows = db.prepare('SELECT email, created_at FROM subscribers ORDER BY created_at DESC').all();
  sendCsv(res, 'arcomhomes-subscribers.csv', ['Email', 'Subscribed'], rows.map(r => [r.email, r.created_at]));
});
router.post('/subscribers/:id/delete', (req, res) => {
  db.prepare('DELETE FROM subscribers WHERE id = ?').run(int(req.params.id));
  res.redirect('/admin/subscribers');
});

// ---------- Settings ----------
router.get('/settings', (req, res) => res.render('admin/settings', { title: 'Store settings' }));

router.post('/settings', upload.single('hero_image_file'), (req, res) => {
  const textKeys = Object.keys(DEFAULT_SETTINGS).filter(k => !['free_shipping_threshold', 'shipping_flat_rate', 'hero_image', 'low_stock_threshold'].includes(k));
  for (const k of textKeys) if (req.body[k] !== undefined) setSetting(k, str(req.body[k], 500));
  setSetting('free_shipping_threshold', toPence(req.body.free_shipping_threshold) ?? 0);
  setSetting('shipping_flat_rate', toPence(req.body.shipping_flat_rate) ?? 0);
  setSetting('low_stock_threshold', Math.max(0, int(req.body.low_stock_threshold, 5)));
  if (req.file) {
    removeUpload(getSettings().hero_image);
    setSetting('hero_image', `/uploads/${req.file.filename}`);
  }
  req.flash('success', 'Settings saved.');
  res.redirect('/admin/settings');
});

// ---------- Admin users ----------
router.get('/account', (req, res) => {
  const admins = db.prepare("SELECT id, email, first_name, last_name, created_at FROM users WHERE role = 'admin' ORDER BY id").all();
  res.render('admin/account', { title: 'Account & team', admins });
});

router.post('/account/password', (req, res) => {
  const me = db.prepare('SELECT * FROM users WHERE id = ?').get(res.locals.user.id);
  const pw = String(req.body.new_password || '');
  if (!bcrypt.compareSync(String(req.body.current_password || ''), me.password_hash)) req.flash('error', 'Current password is incorrect.');
  else if (pw.length < 10) req.flash('error', 'New password must be at least 10 characters.');
  else if (pw !== req.body.confirm_password) req.flash('error', 'New passwords do not match.');
  else {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(pw, 10), me.id);
    req.flash('success', 'Password changed.');
  }
  res.redirect('/admin/account');
});

router.post('/account/admins', (req, res) => {
  const email = str(req.body.email, 160);
  const pw = String(req.body.password || '');
  if (!isEmail(email)) req.flash('error', 'Enter a valid email.');
  else if (pw.length < 10) req.flash('error', 'Password must be at least 10 characters.');
  else {
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
      req.flash('success', `${email} is now an admin (their existing password is unchanged).`);
    } else {
      db.prepare("INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, 'admin')")
        .run(email, bcrypt.hashSync(pw, 10), str(req.body.first_name, 60), str(req.body.last_name, 60));
      req.flash('success', `Admin ${email} added.`);
    }
  }
  res.redirect('/admin/account');
});

router.post('/account/admins/:id/remove', (req, res) => {
  const id = int(req.params.id);
  if (id === res.locals.user.id) req.flash('error', 'You cannot remove yourself.');
  else {
    db.prepare("UPDATE users SET role = 'customer' WHERE id = ? AND role = 'admin'").run(id);
    req.flash('success', 'Admin access removed.');
  }
  res.redirect('/admin/account');
});

router.use((req, res) => res.status(404).render('admin/not-found', { title: 'Not found' }));

module.exports = router;

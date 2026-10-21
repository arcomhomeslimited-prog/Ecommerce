const express = require('express');
const { db, getSettings, transaction } = require('../db');
const {
  PRODUCT_SELECT, productImages, getCart, evaluateDiscount, orderNumber, isUkPostcode, isEmail
} = require('../helpers');

const router = express.Router();
const PAGE_SIZE = 12;

const asArray = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// ---------- Home ----------
router.get('/', (req, res) => {
  const featured = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.featured = 1 ORDER BY p.id LIMIT 8`).all();
  const newIn = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.is_new = 1 ORDER BY p.created_at DESC LIMIT 4`).all();
  const sale = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.compare_price > p.price ORDER BY (p.compare_price - p.price) DESC LIMIT 4`).all();
  const categories = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order').all();
  res.render('shop/home', { title: null, featured, newIn, sale, categories });
});

// ---------- Product listings ----------
function listing(req, res, { title, intro = '', where = [], params = [], heroImage = null, crumbs = [], category = null }) {
  const base = ['p.active = 1', ...where];
  const baseParams = [...params];

  const q = String(req.query.q || '').trim();
  if (q) {
    base.push('(p.name LIKE ? OR p.short_description LIKE ? OR p.finish LIKE ? OR c.name LIKE ? OR p.sku LIKE ?)');
    baseParams.push(...Array(5).fill(`%${q}%`));
  }

  // Finish facet counts are computed before the finish/price filters are applied
  const finishes = db.prepare(`SELECT p.finish, COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${base.join(' AND ')} AND p.finish != '' GROUP BY p.finish ORDER BY n DESC, p.finish`).all(...baseParams);
  const subcats = category ? [] : db.prepare(`SELECT c.name, c.slug, COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id
    WHERE ${base.join(' AND ')} GROUP BY c.id ORDER BY c.sort_order`).all(...baseParams);

  const filters = [...base];
  const filterParams = [...baseParams];
  const selectedFinishes = asArray(req.query.finish).filter(Boolean);
  if (selectedFinishes.length) {
    filters.push(`p.finish IN (${selectedFinishes.map(() => '?').join(',')})`);
    filterParams.push(...selectedFinishes);
  }
  const min = Number(req.query.min), max = Number(req.query.max);
  if (req.query.min && Number.isFinite(min)) { filters.push('p.price >= ?'); filterParams.push(Math.round(min * 100)); }
  if (req.query.max && Number.isFinite(max)) { filters.push('p.price <= ?'); filterParams.push(Math.round(max * 100)); }
  if (req.query.sale) filters.push('p.compare_price > p.price');
  if (req.query.instock) filters.push('p.stock > 0');

  const sorts = {
    featured: 'p.featured DESC, p.id',
    'price-asc': 'p.price ASC',
    'price-desc': 'p.price DESC',
    newest: 'p.created_at DESC',
    rating: 'rating DESC NULLS LAST, review_count DESC'
  };
  const sort = sorts[req.query.sort] ? req.query.sort : 'featured';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${filters.join(' AND ')}`).get(...filterParams).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  const products = db.prepare(`${PRODUCT_SELECT} WHERE ${filters.join(' AND ')} ORDER BY ${sorts[sort]} LIMIT ? OFFSET ?`)
    .all(...filterParams, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  res.render('shop/listing', {
    title, intro, heroImage, crumbs, products, total, page, pages, sort, q,
    finishes, subcats, selectedFinishes, category
  });
}

router.get('/shop', (req, res) => listing(req, res, { title: 'Shop all', crumbs: [['Shop all']] }));
router.get('/search', (req, res) => listing(req, res, { title: req.query.q ? `Results for “${String(req.query.q).slice(0, 60)}”` : 'Search', crumbs: [['Search']] }));
router.get('/sale', (req, res) => listing(req, res, {
  title: 'Sale', intro: 'Limited-time savings across bathroom and kitchen.', where: ['p.compare_price > p.price'], crumbs: [['Sale']]
}));
router.get('/new', (req, res) => listing(req, res, {
  title: 'New in', intro: 'The latest additions to the ArcomHomes collection.', where: ['p.is_new = 1'], crumbs: [['New in']]
}));

const DEPARTMENTS = {
  bathroom: { title: 'Bathroom', intro: 'Basins, brassware, baths and the finishing touches that make a bathroom feel complete.' },
  kitchen: { title: 'Kitchen', intro: 'Taps, sinks and storage that work as hard as you do – and look good doing it.' }
};
router.get(['/bathroom', '/kitchen'], (req, res) => {
  const key = req.path.slice(1);
  const dept = DEPARTMENTS[key];
  listing(req, res, { ...dept, where: ['c.department = ?'], params: [key], crumbs: [[dept.title]] });
});

router.get('/c/:slug', (req, res, next) => {
  const category = db.prepare('SELECT * FROM categories WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!category) return next();
  const dept = DEPARTMENTS[category.department];
  listing(req, res, {
    title: category.name, intro: category.description, heroImage: category.image, category,
    where: ['p.category_id = ?'], params: [category.id],
    crumbs: [[dept ? dept.title : 'Shop', `/${category.department}`], [category.name]]
  });
});

// ---------- Product ----------
router.get('/p/:slug', (req, res, next) => {
  const product = db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.active = 1`).get(req.params.slug);
  if (!product) return next();
  const images = productImages(product.id);
  const reviews = db.prepare('SELECT * FROM reviews WHERE product_id = ? AND approved = 1 ORDER BY created_at DESC').all(product.id);
  const related = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.category_id = ? AND p.id != ? ORDER BY p.featured DESC, RANDOM() LIMIT 4`)
    .all(product.category_id, product.id);
  // Other finishes of the same product name
  const variants = db.prepare('SELECT slug, finish FROM products WHERE name = ? AND active = 1 ORDER BY id').all(product.name);
  res.render('shop/product', { title: product.name, product, images, reviews, related, variants });
});

router.post('/p/:slug/review', (req, res, next) => {
  const product = db.prepare('SELECT id, slug FROM products WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!product) return next();
  const rating = Math.min(5, Math.max(1, parseInt(req.body.rating, 10) || 0));
  const name = String(req.body.name || '').trim().slice(0, 60);
  const body = String(req.body.body || '').trim().slice(0, 2000);
  if (!name || !body || !rating) {
    req.flash('error', 'Please add your name, a rating and your review.');
  } else {
    db.prepare('INSERT INTO reviews (product_id, name, rating, title, body) VALUES (?, ?, ?, ?, ?)')
      .run(product.id, name, rating, String(req.body.title || '').trim().slice(0, 120), body);
    req.flash('success', 'Thank you! Your review will appear once it has been approved.');
  }
  res.redirect(`/p/${product.slug}#reviews`);
});

// ---------- Basket ----------
router.get('/basket', (req, res) => {
  res.render('shop/basket', { title: 'Your basket', cart: getCart(req.session) });
});

router.post('/basket/add', (req, res) => {
  const id = parseInt(req.body.product_id, 10);
  const qty = Math.max(1, Math.min(99, parseInt(req.body.qty, 10) || 1));
  const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ? AND active = 1').get(id);
  if (!product) return res.redirect('/basket');
  if (product.stock <= 0) {
    req.flash('error', `${product.name} is currently out of stock.`);
    return res.redirect(req.get('referer') || '/basket');
  }
  const cart = { ...(req.session.cart || {}) };
  cart[id] = Math.min(product.stock, (cart[id] || 0) + qty);
  req.session.cart = cart;
  req.flash('success', `${product.name} added to your basket.`);
  res.redirect(req.body.redirect === 'basket' ? '/basket' : (req.get('referer') || '/basket'));
});

router.post('/basket/update', (req, res) => {
  const cart = { ...(req.session.cart || {}) };
  const id = parseInt(req.body.product_id, 10);
  const qty = parseInt(req.body.qty, 10);
  if (cart[id] !== undefined) {
    if (!qty || qty < 1 || req.body.remove) delete cart[id];
    else cart[id] = Math.min(99, qty);
  }
  req.session.cart = cart;
  res.redirect('/basket');
});

router.post('/basket/discount', (req, res) => {
  const code = String(req.body.code || '').trim();
  if (req.body.remove || !code) {
    delete req.session.discount;
    return res.redirect('/basket');
  }
  const cart = getCart(req.session);
  const result = evaluateDiscount(code, cart.subtotal);
  if (result.ok) {
    req.session.discount = result.code;
    req.flash('success', `Code ${result.code} applied.`);
  } else {
    req.flash('error', result.error);
  }
  res.redirect('/basket');
});

// ---------- Checkout ----------
router.get('/checkout', (req, res) => {
  const cart = getCart(req.session);
  if (!cart.items.length) return res.redirect('/basket');
  let defaults = {};
  if (res.locals.user) {
    const last = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(res.locals.user.id) || {};
    defaults = { ...last, email: res.locals.user.email, first_name: res.locals.user.first_name, last_name: res.locals.user.last_name };
  }
  res.render('shop/checkout', { title: 'Checkout', cart, form: defaults, errors: {} });
});

router.post('/checkout', (req, res) => {
  const cart = getCart(req.session);
  if (!cart.items.length) return res.redirect('/basket');

  const f = {};
  for (const k of ['email', 'first_name', 'last_name', 'phone', 'address1', 'address2', 'city', 'county', 'postcode', 'customer_notes', 'payment_method']) {
    f[k] = String(req.body[k] || '').trim().slice(0, k === 'customer_notes' ? 1000 : 120);
  }
  f.postcode = f.postcode.toUpperCase();
  const errors = {};
  if (!isEmail(f.email)) errors.email = 'Enter a valid email address';
  if (!f.first_name) errors.first_name = 'Required';
  if (!f.last_name) errors.last_name = 'Required';
  if (!f.address1) errors.address1 = 'Required';
  if (!f.city) errors.city = 'Required';
  if (!isUkPostcode(f.postcode)) errors.postcode = 'Enter a valid UK postcode';
  if (!req.body.terms) errors.terms = 'Please accept the terms to continue';
  if (!['card', 'bank_transfer'].includes(f.payment_method)) f.payment_method = 'card';

  // Re-check stock at the moment of ordering
  for (const item of cart.items) {
    const stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product.id).stock;
    if (stock < item.qty) errors.stock = `Sorry, only ${stock} of “${item.product.name}” left in stock. Please update your basket.`;
  }

  if (Object.keys(errors).length) {
    return res.status(400).render('shop/checkout', { title: 'Checkout', cart, form: f, errors });
  }

  const number = orderNumber();
  transaction(() => {
    // Demo payment: card orders are marked paid immediately. Connect Stripe/PayPal here for live payments.
    const paid = f.payment_method === 'card';
    const orderId = Number(db.prepare(`INSERT INTO orders
      (number, user_id, email, first_name, last_name, phone, address1, address2, city, county, postcode,
       subtotal, discount, shipping, total, vat, discount_code, status, payment_method, payment_status, customer_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      number, res.locals.user ? res.locals.user.id : null, f.email, f.first_name, f.last_name, f.phone,
      f.address1, f.address2, f.city, f.county, f.postcode,
      cart.subtotal, cart.discount, cart.shipping, cart.total, cart.vat, cart.discountCode || '',
      paid ? 'paid' : 'pending', f.payment_method, paid ? 'paid' : 'unpaid', f.customer_notes
    ).lastInsertRowid);
    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, sku, finish, image, price, qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const { product: p, qty } of cart.items) {
      insItem.run(orderId, p.id, p.name, p.sku, p.finish, p.image || '', p.price, qty);
      decStock.run(qty, p.id);
    }
    if (cart.discountCode) db.prepare('UPDATE discount_codes SET uses = uses + 1 WHERE code = ?').run(cart.discountCode);
    db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'pending', 'Order placed online');
    if (paid) db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'paid', 'Card payment received');
  });

  req.session.cart = {};
  delete req.session.discount;
  req.session.lastOrder = number;
  res.redirect(`/order/${number}`);
});

router.get('/order/:number', (req, res, next) => {
  const order = db.prepare('SELECT * FROM orders WHERE number = ?').get(req.params.number);
  if (!order) return next();
  const ownsOrder = req.session.lastOrder === order.number || (res.locals.user && res.locals.user.id === order.user_id);
  if (!ownsOrder) return next();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.render('shop/order-confirmation', { title: 'Thank you for your order', order, items });
});

// ---------- Newsletter & contact ----------
router.post('/subscribe', (req, res) => {
  const email = String(req.body.email || '').trim().slice(0, 160);
  if (!isEmail(email)) req.flash('error', 'Please enter a valid email address.');
  else {
    db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email);
    req.flash('success', 'Thanks for subscribing – look out for 10% off in your inbox.');
  }
  res.redirect((req.get('referer') || '/') + '#newsletter');
});

router.get('/contact', (req, res) => res.render('shop/contact', { title: 'Contact us', form: {}, errors: {} }));
router.post('/contact', (req, res) => {
  const f = {};
  for (const k of ['name', 'email', 'phone', 'subject', 'body']) f[k] = String(req.body[k] || '').trim().slice(0, k === 'body' ? 4000 : 160);
  const errors = {};
  if (!f.name) errors.name = 'Required';
  if (!isEmail(f.email)) errors.email = 'Enter a valid email address';
  if (!f.body) errors.body = 'Please write a message';
  if (Object.keys(errors).length) return res.status(400).render('shop/contact', { title: 'Contact us', form: f, errors });
  db.prepare('INSERT INTO messages (name, email, phone, subject, body) VALUES (?, ?, ?, ?, ?)').run(f.name, f.email, f.phone, f.subject, f.body);
  req.flash('success', 'Thanks for getting in touch – we’ll reply within one working day.');
  res.redirect('/contact');
});

// ---------- Information pages ----------
const PAGES = {
  about: 'About ArcomHomes',
  delivery: 'Delivery information',
  returns: 'Returns & refunds',
  faq: 'Frequently asked questions',
  terms: 'Terms & conditions',
  privacy: 'Privacy policy'
};
router.get(Object.keys(PAGES).map(p => `/${p}`), (req, res) => {
  const page = req.path.slice(1);
  res.render(`shop/pages/${page}`, { title: PAGES[page], page });
});

module.exports = router;

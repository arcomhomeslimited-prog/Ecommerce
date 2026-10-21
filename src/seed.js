// Seeds the database with the starter catalogue and demo data.
//   npm run seed            – seed only if the database is empty
//   npm run seed -- --force – wipe everything and re-seed
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { db, transaction, setSetting, DEFAULT_SETTINGS } = require('./db');
const { categories, products, lifestyle } = require('./catalog');
const { slugify, orderNumber } = require('./helpers');

const img = id => `/images/catalog/${id}.jpg`;

// Small deterministic PRNG so demo data is the same on every seed
let seed = 20261020;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = arr => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

const MATERIALS = {
  'basins': 'Vitreous china', 'bathroom-taps': 'Solid brass', 'showers': 'Solid brass',
  'baths': 'Reinforced acrylic', 'toilets': 'Vitreous china', 'vanity-units': 'Moisture-resistant MFC & oak veneer',
  'mirrors': 'Copper-free silver mirror glass', 'towel-rails': 'Solid brass', 'bathroom-accessories': 'Glass & stainless steel',
  'kitchen-taps': 'Lead-free brass', 'kitchen-sinks': '304 grade stainless steel', 'kitchen-accessories': 'Mixed natural materials'
};
const DIMENSIONS = {
  'basins': 'W 420–1000mm × D 380–460mm', 'bathroom-taps': 'Spout reach 120mm, height 160–310mm', 'showers': 'Riser 700–1150mm',
  'baths': 'L 1600–1800mm × W 750–800mm', 'toilets': 'H 400–470mm × D 520–650mm', 'vanity-units': 'W 600–1500mm × D 460mm',
  'mirrors': 'Various – see title', 'towel-rails': 'Projection 65mm', 'bathroom-accessories': 'H 180–200mm',
  'kitchen-taps': 'Height 330–480mm', 'kitchen-sinks': 'Bowl depth 200–250mm', 'kitchen-accessories': 'Various'
};
const WARRANTY = {
  'basins': 'Lifetime guarantee', 'bathroom-taps': '10-year guarantee', 'showers': '5-year guarantee', 'baths': '25-year guarantee',
  'toilets': 'Lifetime guarantee', 'vanity-units': '5-year guarantee', 'mirrors': '3-year guarantee', 'towel-rails': '10-year guarantee',
  'bathroom-accessories': '2-year guarantee', 'kitchen-taps': '10-year guarantee', 'kitchen-sinks': '15-year guarantee', 'kitchen-accessories': '2-year guarantee'
};

function longDescription(name, cat, finish, short) {
  return [
    short,
    `The ${name} is finished in ${finish.toLowerCase()} and made to the same exacting standard as everything in the ArcomHomes range – tested for daily use in UK homes and backed by our ${WARRANTY[cat].toLowerCase()}.`,
    'Delivered free to UK mainland addresses on orders over £99. Not quite right? Return it unused within 30 days for a full refund.'
  ].join('\n\n');
}

const FIRST = ['Olivia', 'Amelia', 'Isla', 'Ava', 'Mia', 'Grace', 'Sophie', 'Emily', 'Harry', 'Oliver', 'George', 'Noah', 'Jack', 'Leo', 'Arthur', 'Oscar', 'Charlotte', 'James', 'Priya', 'Aisha', 'Tom', 'Hannah', 'Ellie', 'Mohammed', 'Callum'];
const LAST = ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Patel', 'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Khan', 'Clarke', 'Lewis', 'Hughes', 'Edwards', 'Wood', 'Turner'];
const PLACES = [
  ['London', 'Greater London', 'SW11 4NJ'], ['Manchester', 'Greater Manchester', 'M20 2LS'], ['Bristol', 'Bristol', 'BS8 1QU'],
  ['Leeds', 'West Yorkshire', 'LS6 2AB'], ['Birmingham', 'West Midlands', 'B15 2TT'], ['Edinburgh', 'Midlothian', 'EH10 5QY'],
  ['Brighton', 'East Sussex', 'BN1 6GE'], ['Cardiff', 'South Glamorgan', 'CF10 3NB'], ['Oxford', 'Oxfordshire', 'OX2 6HT'],
  ['Bath', 'Somerset', 'BA1 5LR'], ['York', 'North Yorkshire', 'YO24 1AA'], ['Glasgow', 'Lanarkshire', 'G12 8QQ'],
  ['Nottingham', 'Nottinghamshire', 'NG7 2RD'], ['Cambridge', 'Cambridgeshire', 'CB2 1TN'], ['Reading', 'Berkshire', 'RG1 5AQ']
];
const STREETS = ['High Street', 'Church Road', 'Station Road', 'Victoria Road', 'Park Avenue', 'Mill Lane', 'The Crescent', 'Kings Road', 'Albert Street', 'Queens Walk'];
const REVIEW_TEXT = [
  [5, 'Absolutely love it', 'Looks even better in person. Quality feels really solid and it arrived well packaged.'],
  [5, 'Stunning finish', 'The finish is beautiful and matches the rest of our bathroom perfectly. Would buy again.'],
  [5, 'Great value', 'Comparable to products twice the price. Easy for our plumber to fit.'],
  [4, 'Very pleased', 'Lovely product, delivery took a day longer than expected but customer service kept me updated.'],
  [4, 'Good quality', 'Well made and looks smart. Instructions could be a little clearer.'],
  [5, 'Perfect for our renovation', 'Exactly what we were looking for to finish our new bathroom.'],
  [3, 'Nice but smaller than expected', 'Good quality, but do check the dimensions carefully before ordering.'],
  [5, 'Fast delivery', 'Ordered on Monday, arrived Wednesday. Really happy with it.']
];

function run({ force = false } = {}) {
  const hasData = db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0;
  if (hasData && !force) {
    console.log('Database already has data – skipping seed (use `npm run seed -- --force` to reset).');
    return null;
  }

  let adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');

  transaction(() => {
    for (const t of ['order_events', 'order_items', 'orders', 'reviews', 'product_images', 'products', 'categories', 'discount_codes', 'messages', 'subscribers', 'users', 'settings']) {
      db.exec(`DELETE FROM ${t}`);
    }
    const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
    setSetting('hero_image', img(lifestyle.hero));

    // Admin user
    db.prepare("INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, 'Store', 'Admin', 'admin')")
      .run(process.env.ADMIN_EMAIL || 'admin@arcomhomes.co.uk', bcrypt.hashSync(adminPassword, 10));

    // Categories
    const catIds = {};
    const insCat = db.prepare('INSERT INTO categories (name, slug, department, description, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    categories.forEach((c, i) => {
      catIds[c.slug] = Number(insCat.run(c.name, c.slug, c.department, c.description, img(c.image), i).lastInsertRowid);
    });

    // Products
    const insProd = db.prepare(`INSERT INTO products
      (name, slug, sku, category_id, short_description, description, price, compare_price, stock, finish, brand, material, dimensions, warranty, featured, is_new, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ArcomHomes', ?, ?, ?, ?, ?, datetime('now', ?))`);
    const insImg = db.prepare('INSERT INTO product_images (product_id, path, sort_order) VALUES (?, ?, ?)');
    const productRows = [];
    const usedSlugs = new Set();
    products.forEach(([name, cat, price, was, finish, stock, imageId, flags, short], i) => {
      let slug = slugify(`${name} ${finish}`);
      while (usedSlugs.has(slug)) slug += '-2';
      usedSlugs.add(slug);
      const sku = `AH-${String(1001 + i)}`;
      const isNew = flags.includes('new');
      const id = Number(insProd.run(
        name, slug, sku, catIds[cat], short, longDescription(name, cat, finish, short),
        Math.round(price * 100), was ? Math.round(was * 100) : null, stock, finish,
        MATERIALS[cat], DIMENSIONS[cat], WARRANTY[cat], flags.includes('featured') ? 1 : 0, isNew ? 1 : 0,
        `-${isNew ? between(1, 14) : between(30, 200)} days`
      ).lastInsertRowid);
      insImg.run(id, img(imageId), 0);
      productRows.push({ id, name, price: Math.round(price * 100), sku, finish, image: img(imageId) });
    });

    // Reviews
    const insRev = db.prepare("INSERT INTO reviews (product_id, name, rating, title, body, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))");
    for (const p of productRows) {
      const n = between(0, 5);
      for (let k = 0; k < n; k++) {
        const [rating, title, body] = pick(REVIEW_TEXT);
        insRev.run(p.id, `${pick(FIRST)} ${pick(LAST)[0]}.`, rating, title, body, 1, `-${between(2, 120)} days`);
      }
    }
    // A couple awaiting moderation
    insRev.run(productRows[0].id, 'Natalie R.', 5, 'Gorgeous basin', 'Really happy with this, looks so elegant on our oak vanity.', 0, '-1 days');
    insRev.run(productRows[14].id, 'Dan P.', 4, 'Great shower', 'Strong flow even on our low pressure system.', 0, '-2 days');

    // Customers
    const customerHash = bcrypt.hashSync('customer123', 10);
    const insUser = db.prepare("INSERT INTO users (email, password_hash, first_name, last_name, phone, role, created_at) VALUES (?, ?, ?, ?, ?, 'customer', datetime('now', ?))");
    const customers = [];
    for (let k = 0; k < 24; k++) {
      const first = FIRST[k], last = LAST[k];
      const email = `${first}.${last}`.toLowerCase() + '@example.co.uk';
      const id = Number(insUser.run(email, customerHash, first, last, `07${between(100, 999)} ${between(100000, 999999)}`, `-${between(5, 120)} days`).lastInsertRowid);
      customers.push({ id, email, first, last, place: pick(PLACES), street: `${between(1, 140)} ${pick(STREETS)}` });
    }

    // Discount codes
    const insCode = db.prepare('INSERT INTO discount_codes (code, type, value, min_spend, max_uses, uses, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insCode.run('WELCOME10', 'percent', 10, 0, null, 14, null, 1);
    insCode.run('BATH25', 'fixed', 2500, 25000, 200, 6, '2026-12-31', 1);
    insCode.run('SUMMER15', 'percent', 15, 5000, null, 31, '2026-08-31', 0);

    // Orders over the last 60 days
    const insOrder = db.prepare(`INSERT INTO orders
      (number, user_id, email, first_name, last_name, phone, address1, city, county, postcode, subtotal, discount, shipping, total, vat, discount_code, status, payment_method, payment_status, tracking_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', ?, ?, datetime('now', ?), datetime('now', ?))`);
    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, sku, finish, image, price, qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insEvent = db.prepare("INSERT INTO order_events (order_id, status, note, created_at) VALUES (?, ?, ?, datetime('now', ?))");
    const usedNumbers = new Set();
    for (let k = 0; k < 86; k++) {
      const c = pick(customers);
      const daysAgo = Math.floor(Math.pow(rand(), 1.3) * 60);
      const offset = `-${daysAgo * 24 + between(0, 20)} hours`;
      const lines = Array.from({ length: between(1, 3) }, () => ({ p: pick(productRows), qty: rand() < 0.8 ? 1 : 2 }));
      const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
      const discountCode = rand() < 0.15 ? 'WELCOME10' : '';
      const discount = discountCode ? Math.round(subtotal * 0.1) : 0;
      const shipping = subtotal - discount >= 9900 ? 0 : 495;
      const total = subtotal - discount + shipping;
      let status;
      if (daysAgo > 7) status = rand() < 0.06 ? 'cancelled' : rand() < 0.04 ? 'refunded' : 'delivered';
      else if (daysAgo > 3) status = pick(['shipped', 'shipped', 'delivered']);
      else status = pick(['paid', 'processing', 'processing', 'pending']);
      const paymentStatus = status === 'pending' ? 'unpaid' : status === 'refunded' ? 'refunded' : status === 'cancelled' ? 'void' : 'paid';
      let number = orderNumber();
      while (usedNumbers.has(number)) number = orderNumber();
      usedNumbers.add(number);
      const tracking = ['shipped', 'delivered'].includes(status) ? `DPD${between(10000000, 99999999)}` : '';
      const orderId = Number(insOrder.run(number, c.id, c.email, c.first, c.last, c.street, c.place[0], c.place[1], c.place[2],
        subtotal, discount, shipping, total, Math.round(total - total / 1.2), discountCode, status, paymentStatus, tracking, offset, offset).lastInsertRowid);
      for (const l of lines) insItem.run(orderId, l.p.id, l.p.name, l.p.sku, l.p.finish, l.p.image, l.p.price, l.qty);
      insEvent.run(orderId, 'pending', 'Order placed', offset);
      if (status !== 'pending') insEvent.run(orderId, status, '', offset);
    }

    // Messages & subscribers
    const insMsg = db.prepare("INSERT INTO messages (name, email, subject, body, is_read, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))");
    insMsg.run('Sarah Mitchell', 'sarah.m@example.co.uk', 'Trade account enquiry', 'Hi, I run a small bathroom fitting company in Kent. Do you offer trade pricing?', 0, '-1 days');
    insMsg.run('Imran Ali', 'imran.ali@example.co.uk', 'Delivery to Northern Ireland', 'Can you deliver the Siena bath to Belfast, and what would it cost?', 0, '-3 days');
    insMsg.run('Kate Bennett', 'kate.b@example.co.uk', 'Matching basin', 'Which basin would you recommend with the Ivy fluted vanity?', 1, '-6 days');
    const insSub = db.prepare("INSERT INTO subscribers (email, created_at) VALUES (?, datetime('now', ?))");
    customers.slice(0, 14).forEach(c => insSub.run(c.email, `-${between(1, 90)} days`));
  });

  console.log('\n✓ Seeded ArcomHomes demo data');
  console.log('  Admin login:  ' + (process.env.ADMIN_EMAIL || 'admin@arcomhomes.co.uk'));
  console.log('  Password:     ' + adminPassword);
  console.log('  (Change it under Admin → Account after signing in.)\n');
  return adminPassword;
}

if (require.main === module) run({ force: process.argv.includes('--force') });

module.exports = { run };

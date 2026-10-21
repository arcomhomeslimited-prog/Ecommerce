const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const cookieSession = require('cookie-session');

const { db, getSettings } = require('./src/db');
const helpers = require('./src/helpers');
const seed = require('./src/seed');

// First run: populate the store with demo data
seed.run();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Session secret – persisted so logins survive restarts
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(__dirname, 'data', 'session.key');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use((req, res, next) => { req.body ??= {}; next(); }); // Express 5 leaves body undefined when a POST has no form data
app.use(cookieSession({
  name: 'ah_sess',
  keys: [sessionSecret()],
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  maxAge: 30 * 24 * 60 * 60 * 1000
}));

// Basic security headers
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

// CSRF protection: reject cross-site form posts (session cookie is also SameSite=Lax)
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const source = req.get('origin') || req.get('referer');
  if (source) {
    try {
      if (new URL(source).host !== req.get('host')) return res.status(403).send('Cross-site request blocked.');
    } catch { return res.status(403).send('Bad request origin.'); }
  }
  next();
});

// Values available in every template
const navStmt = db.prepare('SELECT id, name, slug, department FROM categories WHERE active = 1 ORDER BY sort_order, name');
app.use((req, res, next) => {
  const settings = getSettings();
  const categories = navStmt.all();
  res.locals.settings = settings;
  res.locals.nav = {
    bathroom: categories.filter(c => c.department === 'bathroom'),
    kitchen: categories.filter(c => c.department === 'kitchen')
  };
  res.locals.money = helpers.money;
  res.locals.formatDate = helpers.formatDate;
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.user = req.session.userId
    ? db.prepare('SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = ?').get(req.session.userId)
    : null;
  const cart = req.session.cart || {};
  res.locals.cartCount = Object.values(cart).reduce((s, q) => s + Number(q || 0), 0);
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  req.flash = (type, message) => { req.session.flash = { type, message }; };
  next();
});

app.use('/admin', require('./src/routes/admin'));
app.use('/account', require('./src/routes/account'));
app.use('/', require('./src/routes/shop'));

app.use((req, res) => {
  res.status(404).render('shop/message', { title: 'Page not found', heading: 'We couldn’t find that page', body: 'The page may have moved, or the link may be out of date.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.flash('error', 'Image is too large (max 8MB).');
    return res.redirect(req.get('referer') || '/admin');
  }
  res.status(500).render('shop/message', { title: 'Something went wrong', heading: 'Something went wrong', body: 'Please try again in a moment.' });
});

app.listen(PORT, () => {
  console.log(`ArcomHomes running at http://localhost:${PORT}`);
  console.log(`Admin dashboard:   http://localhost:${PORT}/admin`);
});

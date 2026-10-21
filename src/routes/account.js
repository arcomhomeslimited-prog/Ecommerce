const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { isEmail } = require('../helpers');
const { loginLimiter } = require('../auth');

const router = express.Router();

function requireCustomer(req, res, next) {
  if (!res.locals.user) return res.redirect('/account/login?next=' + encodeURIComponent(req.originalUrl));
  next();
}

const safeNext = n => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/account');

router.get('/login', (req, res) => {
  if (res.locals.user) return res.redirect('/account');
  res.render('shop/login', { title: 'Sign in', next: req.query.next || '', error: null, form: {} });
});

router.post('/login', loginLimiter, (req, res) => {
  const email = String(req.body.email || '').trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) {
    req.loginFailed();
    return res.status(401).render('shop/login', { title: 'Sign in', next: req.body.next || '', error: 'Incorrect email or password.', form: { email } });
  }
  req.session.userId = user.id;
  res.redirect(safeNext(req.body.next));
});

router.get('/register', (req, res) => {
  if (res.locals.user) return res.redirect('/account');
  res.render('shop/register', { title: 'Create an account', errors: {}, form: {} });
});

router.post('/register', (req, res) => {
  const f = {
    first_name: String(req.body.first_name || '').trim().slice(0, 60),
    last_name: String(req.body.last_name || '').trim().slice(0, 60),
    email: String(req.body.email || '').trim().slice(0, 160)
  };
  const password = String(req.body.password || '');
  const errors = {};
  if (!f.first_name) errors.first_name = 'Required';
  if (!f.last_name) errors.last_name = 'Required';
  if (!isEmail(f.email)) errors.email = 'Enter a valid email address';
  else if (db.prepare('SELECT id FROM users WHERE email = ?').get(f.email)) errors.email = 'An account with this email already exists';
  if (password.length < 8) errors.password = 'Use at least 8 characters';
  if (Object.keys(errors).length) return res.status(400).render('shop/register', { title: 'Create an account', errors, form: f });

  const id = db.prepare('INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)')
    .run(f.email, bcrypt.hashSync(password, 10), f.first_name, f.last_name).lastInsertRowid;
  if (req.body.newsletter) db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(f.email);
  req.session.userId = Number(id);
  req.flash('success', `Welcome to ArcomHomes, ${f.first_name}!`);
  res.redirect('/account');
});

router.post('/logout', (req, res) => {
  delete req.session.userId;
  res.redirect('/');
});

router.get('/', requireCustomer, (req, res) => {
  const orders = db.prepare(`SELECT o.*, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS item_count
    FROM orders o WHERE user_id = ? ORDER BY created_at DESC`).all(res.locals.user.id);
  res.render('shop/account', { title: 'My account', orders });
});

router.get('/orders/:number', requireCustomer, (req, res, next) => {
  const order = db.prepare('SELECT * FROM orders WHERE number = ? AND user_id = ?').get(req.params.number, res.locals.user.id);
  if (!order) return next();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.render('shop/order-confirmation', { title: `Order ${order.number}`, order, items, fromAccount: true });
});

router.post('/details', requireCustomer, (req, res) => {
  const first = String(req.body.first_name || '').trim().slice(0, 60);
  const last = String(req.body.last_name || '').trim().slice(0, 60);
  const phone = String(req.body.phone || '').trim().slice(0, 30);
  if (first && last) {
    db.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?').run(first, last, phone, res.locals.user.id);
    req.flash('success', 'Your details have been updated.');
  }
  const pw = String(req.body.new_password || '');
  if (pw) {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(res.locals.user.id);
    if (!bcrypt.compareSync(String(req.body.current_password || ''), user.password_hash)) req.flash('error', 'Your current password is incorrect.');
    else if (pw.length < 8) req.flash('error', 'New password must be at least 8 characters.');
    else {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(pw, 10), res.locals.user.id);
      req.flash('success', 'Password changed.');
    }
  }
  res.redirect('/account#details');
});

module.exports = router;

// Simple in-memory login throttle: 8 failed attempts per IP per 15 minutes.
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 8;

function loginLimiter(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && now - entry.first > WINDOW) attempts.delete(key);
  const current = attempts.get(key);
  if (current && current.count >= MAX) {
    return res.status(429).send('Too many sign-in attempts. Please wait 15 minutes and try again.');
  }
  req.loginFailed = () => {
    const e = attempts.get(key) || { count: 0, first: now };
    e.count++;
    attempts.set(key, e);
  };
  next();
}

function requireAdmin(req, res, next) {
  const user = res.locals.user;
  if (!user || user.role !== 'admin') {
    return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

module.exports = { loginLimiter, requireAdmin };

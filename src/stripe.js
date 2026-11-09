const Stripe = require('stripe');
const { db, transaction } = require('./db');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

function markOrderPaid(order, note = 'Card payment received via Stripe') {
  if (!order || order.payment_status === 'paid') return false;
  transaction(() => {
    db.prepare(`UPDATE orders SET status = 'paid', payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`)
      .run(order.id);
    db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(order.id, 'paid', note);
  });
  return true;
}

async function createCheckoutSession(req, { orderNumber, email, cart }) {
  const stripe = getStripe();
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured');

  const line_items = cart.items.map(({ product: p, qty }) => ({
    quantity: qty,
    price_data: {
      currency: 'gbp',
      unit_amount: p.price,
      product_data: {
        name: p.name,
        description: p.finish || undefined,
        images: p.image && p.image.startsWith('http') ? [p.image] : undefined
      }
    }
  }));

  if (cart.shipping > 0) {
    line_items.push({
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: cart.shipping,
        product_data: { name: 'Delivery' }
      }
    });
  }

  const sessionParams = {
    mode: 'payment',
    customer_email: email,
    line_items,
    success_url: `${appUrl(req)}/order/${encodeURIComponent(orderNumber)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl(req)}/checkout?cancelled=1`,
    metadata: { order_number: orderNumber },
    payment_intent_data: {
      metadata: { order_number: orderNumber }
    }
  };

  if (cart.discount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: cart.discount,
      currency: 'gbp',
      duration: 'once',
      name: cart.discountCode || 'Discount'
    });
    sessionParams.discounts = [{ coupon: coupon.id }];
  }

  return stripe.checkout.sessions.create(sessionParams);
}

async function confirmSessionPayment(sessionId) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return null;

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') return session;

  const orderNumber = session.metadata && session.metadata.order_number;
  if (!orderNumber) return session;

  const order = db.prepare('SELECT * FROM orders WHERE number = ?').get(orderNumber);
  if (order) markOrderPaid(order, 'Card payment confirmed (Stripe Checkout)');
  return session;
}

module.exports = {
  getStripe,
  appUrl,
  markOrderPaid,
  createCheckoutSession,
  confirmSessionPayment
};

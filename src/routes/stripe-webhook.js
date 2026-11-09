const { db } = require('../db');
const { getStripe, markOrderPaid } = require('../stripe');

module.exports = async function stripeWebhook(req, res) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error('Stripe webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).send('Webhook not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      secret
    );
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid' || session.mode === 'payment') {
      const orderNumber = session.metadata && session.metadata.order_number;
      if (orderNumber) {
        const order = db.prepare('SELECT * FROM orders WHERE number = ?').get(orderNumber);
        if (order) markOrderPaid(order, 'Card payment confirmed (Stripe webhook)');
      }
    }
  }

  res.json({ received: true });
};

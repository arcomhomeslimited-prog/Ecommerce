# ArcomHomes.co.uk

Online store for kitchen & bathroom accessories (UK), with a full admin dashboard.

- **Storefront** – homepage, Bathroom/Kitchen mega-menu, category pages with price/finish/stock filters and sorting, search, product pages with gallery, finish variants, specs and reviews, basket with discount codes and free-delivery progress, checkout (UK postcode validation, VAT breakdown), order confirmation, customer accounts with order history, contact form, newsletter sign-up, delivery/returns/FAQ/terms/privacy pages. Mobile-friendly.
- **Admin dashboard** (`/admin`) – sales KPIs and revenue chart, orders (status, payment, tracking, notes, restock on cancel, CSV export, printable packing slip), products (add/edit/duplicate, multiple image upload, stock, sale prices, bestseller/new flags, bulk actions, CSV export), categories, customers, discount codes, review moderation, contact messages, newsletter subscribers (CSV export), store settings (contact details, announcement bar, homepage hero, delivery charges) and admin team accounts.

## Run it

Requires **Node.js 22.13+** (uses the built-in SQLite – no database server needed).

```bash
npm install
npm start            # http://localhost:3000  ·  admin at http://localhost:3000/admin
```

The first start creates `data/arcomhomes.db`, fills it with the demo catalogue, and prints the admin login in the terminal.

| Command | What it does |
|---|---|
| `npm start` | Start the store |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run seed -- --force` | **Wipe everything** and reload the demo data (prints a new admin password) |
| `npm run images` | Re-download the demo photos if any are missing |

Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding to choose the admin login.
Demo customer accounts use the password `customer123` (e.g. `olivia.smith@example.co.uk`).

## Demo content

The 66 starter products are **placeholders with original names and copy** – they are not copied from other retailers. Photos are from [Unsplash](https://unsplash.com/license) (free for commercial use) and are stored locally in `public/images/catalog`. Replace them with your own products and photography from **Admin → Products** before launch.

## Before going live

1. **Payments** – checkout currently runs in demo mode (card orders are marked paid without charging). Connect Stripe or PayPal in `src/routes/shop.js` (`POST /checkout`).
2. **Emails** – order confirmation / dispatch emails are not sent yet. Add a provider such as Postmark, SendGrid or Resend.
3. **Legal pages** – terms and privacy pages are templates; have them reviewed (UK GDPR, Consumer Contracts Regulations).
4. **Settings** – add your company number, VAT number, address and phone under **Admin → Settings**.
5. **Hosting** – run with `NODE_ENV=production` behind HTTPS (e.g. Render, Railway, Fly.io or a VPS). Keep the `data/` folder and `public/uploads/` on persistent storage and back them up. Set `SESSION_SECRET` to a long random string.

## Project structure

```
server.js              App setup, sessions, security headers
src/db.js              SQLite schema + settings
src/catalog.js         Demo catalogue definition
src/seed.js            Demo data loader
src/helpers.js         Money, basket, discount logic
src/routes/shop.js     Storefront routes
src/routes/account.js  Customer accounts
src/routes/admin.js    Admin dashboard routes
views/                 EJS templates (shop/, admin/, partials/)
public/                CSS, JS, images, uploads
```
"# Ecommerce" 

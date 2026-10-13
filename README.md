# Stellar Forge Orders (sf-orders)

Order management for small shops, built on the same stack, look, login, approval and trial flow as **sf-billing**.
React 18 + Vite · Supabase (auth, database, storage) · **Cloudflare Pages** + Pages Functions (`/functions`) · Gmail API for email.

## What it does

| Area | Details |
|---|---|
| **Order lifecycle** | 5 core stages: Received, Processing, Ready to Dispatch, Delivered, Returned. All can be renamed. Up to 2 extra stages can be added **between Processing and Ready** (max 7). Orders move one step forward or back at a time. |
| **New order** | Customer name (required), WhatsApp and email (optional). Add / edit / delete items, optional freight, payment status (Unpaid / Partly paid / Paid / Returned back). Tax is calculated automatically. New orders always start in the first stage. |
| **Fields** | Settings decide which fields appear: category (renamable: Masala, Car Type…), description, unit, tax, freight, notes. |
| **Tax** | Turn Tax on, tick CGST / SGST / IGST, set each percent. Off = no tax anywhere. Prices are tax-exclusive. A product's own % from Excel overrides the shop default. |
| **Products** | Add / edit / delete, **Excel import** (sample file included). Columns: Product Name, Category, CGST %, SGST %, IGST %, Unit, Unit Price, Total Price. Same name = updated. Total Price is always recomputed. |
| **Notifications** | After every status change a pop-up offers WhatsApp (`wa.me`, one tap) and/or email, as chosen in Settings. Messages contain the **tracking link** and the **bill download link**. |
| **Tracking page** | `/track/<random token>`: public, no login. Timeline on top, then items, totals, payment, bill download. |
| **Bill** | At every stage: generate (PDF), upload your own (PDF/PNG/JPG), view/download, print. One bill per order (stored in Supabase Storage). The page warns when the order changed after the bill was made. |
| **Printing** | Thermal (Thermer / Bluetooth Print app, 2 inch / 3 inch) and normal printer (browser print window). Default chosen in Settings; both buttons are on the order page. "Connect printer" guide in English, Hindi, Marathi. |
| **Add next product** | Button on the order page at any stage. |
| **Home** | Recent orders, count and value per status, revenue / collected / to collect (today, this month, all time). Returned orders are highlighted in red, excluded from revenue, and the page says so when there are none. |
| **Orders page** | Filters: today, month, last month, pick a month, year, financial year (Apr–Mar), custom range; status; payment; search. Export CSV, Excel, PDF. Cards on phones, table on tablet/desktop. |
| **Plans** | 15-day trial → Basic → Pro, using the same approval + `entitlements` flow as billing. Pro: custom URL, brand colour, hide "Powered by". Multiple logins and dedicated infra are "contact us" buttons. |

## Setup

1. **Database**: this app uses the shared database owned by **sf-admin-dash**. Add `supabase/migrations/0004_orders.sql` and `supabase/tests/orders.sql` from the updated admin repo and apply the migration. A reference copy of the migration is in `supabase/0004_orders.sql`. It adds the `orders` product, tables, security rules, bill storage and the Expense Tracker sales sync. It also allows `orders` as a product in `start_trial`, `entitlements` and `signup_product`.
2. **Deploy on Cloudflare Pages** (see below).

## Deploy on Cloudflare Pages

1. Push this folder to a Git repo → Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Build settings: **Framework preset** None · **Build command** `npm run build` · **Build output directory** `dist` · root directory empty.
3. **Settings → Variables and Secrets** (add to *Production*, and *Preview* if you use it).

   **Variables** (plain text, needed while building):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `NODE_VERSION` | `20` |

   **Secrets** (everything the functions use at run time):

   | Name | Notes |
   |---|---|
   | `SUPABASE_URL` | same URL as above |
   | `SUPABASE_SERVICE_ROLE_KEY` | server only, never in a `VITE_` variable |
   | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER` | same as billing |
   | `ADMIN_EMAILS`, `ADMIN_DASH_URL` | same as billing |
   | `PRINT_SIGNING_SECRET` | any long random string |
   | `APP_URL` | final public URL, e.g. `https://orders.yourdomain.com` (no trailing slash) |

   `VITE_*` values are baked into the website when it is built, so they are visible to anyone. That is fine for the Supabase URL and anon key, which are public by design. Never put the service-role key in a `VITE_` variable. Redeploy after changing any value; changes to `VITE_*` only take effect on a new build.
4. **Custom domain**: Pages project → Custom domains. Use this domain for `APP_URL`.
5. Nothing else is needed: `public/_routes.json` runs functions only for `/api/*`, and Pages serves `index.html` for every other path, so `/track/<token>` and page refreshes work.

**Local test of the API:** copy `.dev.vars.example` to `.dev.vars`, fill it in, then `npm run pages:dev` (opens http://localhost:8788 with the functions running in the Workers runtime). The functions need no compatibility flags.

**API files** (`functions/api/`): `track` and `bill` (public), `notify-email`, `print-token`, `print-bill`, `start-trial`, `signup`.

## Access and trials

* **New shop**: signs up here → you approve in the admin dashboard → 15-day Orders trial starts (`approve_shop`).
* **Shop already approved in Billing / Expense**: signs in with the same email and sees *Start free trial*. One tap starts its own 15-day Orders trial through `/api/start-trial`, with no second approval. One trial per email per product is enforced by `trial_ledger`.
* **Expense Tracker link**: if the shop has Expense active, Settings shows a switch that adds each day's *Delivered* orders as one sale. Returned orders are removed again.

## Things to check / decide

* Plan **prices** in `src/lib/plans.js` are placeholders copied from billing.
* Paid plans and Pro are set by you in the database (`entitlements.paid_until`, `entitlements.plan`), as for the other products.
* WhatsApp is click-to-send (`wa.me`): the owner taps Send in WhatsApp each time. Fully automatic sending needs the WhatsApp Business API.
* Emails are sent from your Gmail sender with the **shop name** as display name and the shop's email as Reply-To.
* Custom URL (Pro) only changes the links inside messages/QR codes. The domain itself must be added to the Pages project (Custom domains) by you.

## Project map

```
src/lib/orderUtils.js   stages, tax maths, payment, date ranges, links
src/lib/billDoc.js      bill PDF + normal-printer HTML
src/lib/messages.js     WhatsApp text
src/lib/exportUtils.js  CSV / Excel / PDF export, product Excel import + sample
src/pages/              Home, Orders, OrderForm, OrderDetail, Products, Settings, Track (public), Login, Signup, ConnectPrinter
functions/api/track.js       public tracking data      functions/api/bill.js   public bill download (signed link)
functions/api/notify-email.js  professional status email   functions/api/print-token.js + print-bill.js  thermal printing
functions/api/start-trial.js   free trial for shops approved in other apps
functions/api/signup.js        signup (marks shop as an Orders signup)
functions/_shared/             helpers (Supabase client, Gmail, signing)
supabase/orders_schema.sql
```
# Stellar Forge Orders (sf-orders)

Order management for small shops, built on the same stack, look, login, approval and trial flow as **sf-billing**.
React 18 + Vite · Supabase (auth, database, storage) · Vercel serverless functions · Gmail API for email.

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

1. **Database**: open the Supabase SQL editor of the *same project as sf-billing* and run `supabase/orders_schema.sql`. Read the assumptions at the top of that file first.
2. **Env** (Vercel): everything sf-billing has, plus `APP_URL` (the public https URL of this app, used in emails and QR codes):
   `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER, ADMIN_EMAILS, ADMIN_DASH_URL, PRINT_SIGNING_SECRET, APP_URL`
   and `VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY` for the front end.
3. `npm install && npm run dev` (use `vercel dev` to test the `/api` functions locally), `npm run build` for production.
4. **Existing sf-billing shops** do not get Orders automatically. Activate one with the SQL at the bottom of the schema file. New shops that sign up through *this* app get a 15-day trial when you approve them in the admin dashboard (a database trigger creates the entitlement).

## Things to check / decide

* Plan **prices** in `src/lib/plans.js` are placeholders copied from billing.
* `my_shop_id()` in the SQL maps a login to a shop via `shops.owner_id`. If sf-billing already has a helper that also covers staff logins, use its logic there.
* WhatsApp is click-to-send (`wa.me`): the owner taps Send in WhatsApp each time. Fully automatic sending needs the WhatsApp Business API.
* Emails are sent from your Gmail sender with the **shop name** as display name and the shop's email as Reply-To.
* Custom URL (Pro) only changes the links inside messages/QR codes. The domain itself must be pointed at the deployment in Vercel by you.

## Project map

```
src/lib/orderUtils.js   stages, tax maths, payment, date ranges, links
src/lib/billDoc.js      bill PDF + normal-printer HTML
src/lib/messages.js     WhatsApp text
src/lib/exportUtils.js  CSV / Excel / PDF export, product Excel import + sample
src/pages/              Home, Orders, OrderForm, OrderDetail, Products, Settings, Track (public), Login, Signup, ConnectPrinter
api/track.js            public tracking data      api/bill.js          public bill download (signed link)
api/notify-email.js     professional status email api/print-token.js + print-bill.js  thermal printing
api/signup.js           signup (marks shop as an Orders signup)
supabase/orders_schema.sql
```

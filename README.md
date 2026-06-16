# Master Social Confidence eBook Payment Setup

This project keeps the static landing page UI intact and runs payment handling through Vercel Serverless Functions with Razorpay, Supabase, and Resend.

## File Structure

```text
.
├── api/
│   ├── create-order.js
│   └── verify-payment.js
├── index.html
├── script.js
├── style.css
├── thank-you.html
├── supabase-schema.sql
├── package.json
└── .env.example
```

## Install

```bash
npm install
npm run dev
```

Open the local Vercel URL and test checkout with Razorpay test cards/UPI.

## Environment Variables

Set these in Vercel Project Settings > Environment Variables and in a local `.env` file for `vercel dev`:

```bash
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=re_your_resend_api_key
```

Recommended optional variables:

```bash
EBOOK_DOWNLOAD_URL=https://yourdomain.com/downloads/master-social-confidence.pdf
EMAIL_FROM=Master Social Confidence <noreply@yourdomain.com>
```

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run the full contents of `supabase-schema.sql`.
4. Copy `SUPABASE_URL` from Project Settings > API.
5. Copy `SUPABASE_SERVICE_ROLE_KEY` from Project Settings > API.
6. Keep the service role key only in Vercel environment variables.

Tables created:

- `customers`: full name, email, phone, timestamps.
- `orders`: customer relation, Razorpay order/payment IDs, amount, currency, paid date, payment status, email delivery status.

## Razorpay Setup

1. Create or open your Razorpay account.
2. Use Test Mode while testing.
3. Go to Account & Settings > API Keys.
4. Generate keys.
5. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to Vercel.

The frontend receives only the key ID and order ID. The secret key is used only in `/api/create-order.js` and `/api/verify-payment.js`.

## Resend Setup

1. Create a Resend account.
2. Add and verify your sending domain.
3. Create an API key.
4. Add `RESEND_API_KEY` to Vercel.
5. Set `EMAIL_FROM` to a verified sender, for example `Master Social Confidence <noreply@yourdomain.com>`.
6. Set `EBOOK_DOWNLOAD_URL` to the final secure eBook download URL.

## Production Payment Flow

1. Buyer enters name, email, and phone.
2. Frontend validates fields.
3. Frontend calls `/api/create-order`.
4. Backend validates again, saves/updates the customer in Supabase, creates a Razorpay order, and saves an order row.
5. Frontend opens Razorpay Checkout using `order_id`.
6. Razorpay returns payment fields to the frontend callback.
7. Frontend calls `/api/verify-payment`.
8. Backend verifies the Razorpay signature using `RAZORPAY_KEY_SECRET`.
9. Backend marks the order as paid in Supabase.
10. Backend sends the thank-you email, download link, and receipt via Resend.
11. Frontend redirects to `thank-you.html`.

## Deploy To Vercel

```bash
npm install -g vercel
vercel login
vercel
vercel env add RAZORPAY_KEY_ID
vercel env add RAZORPAY_KEY_SECRET
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add RESEND_API_KEY
vercel env add EBOOK_DOWNLOAD_URL
vercel env add EMAIL_FROM
vercel --prod
```

## Security Notes

- Never expose `RAZORPAY_KEY_SECRET` in frontend JavaScript.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend JavaScript.
- Never deliver the eBook from the client-side Razorpay success callback alone.
- Only send the eBook after `/api/verify-payment` confirms the signature.
- Keep the amount controlled by the backend, not by frontend input.

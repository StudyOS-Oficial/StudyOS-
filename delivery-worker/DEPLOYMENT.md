# StudyOS — private eBook delivery V2

## Status
- The PR remains a draft and has not been merged.
- Production remains disabled with `PAYMENTS_ENABLED=false`.
- A separate Stripe test environment is configured in `wrangler.toml`; it uses only sandbox Payment Links and a separate test KV namespace.
- The test Worker has not been deployed yet.

## Flow
1. Stripe Payment Links open Checkout.
2. After a confirmed sandbox payment, Stripe redirects to `/thanks?session_id={CHECKOUT_SESSION_ID}`.
3. The Worker retrieves the Checkout Session from Stripe and verifies `payment_status=paid`.
4. The Worker checks that the Payment Link is one of the four allowed products.
5. A purchase entitlement is stored in KV and a private HttpOnly session is issued for 14 days.
6. The buyer receives private PDF downloads and responsive HTML readers from R2.
7. The webhook reconciles successful checkouts and revocations.

This V2 does not depend on Resend or email.

## Cloudflare resources
- Production KV: `studyos-access`.
- Test KV: `studyos-access-test`.
- R2 bucket: `studyos-private-docs`; Public Access is disabled.
- The six private objects are uploaded under `ebooks/ebook-1.pdf`, `ebooks/ebook-1.html`, `ebooks/ebook-2.pdf`, `ebooks/ebook-2.html`, `ebooks/ebook-3.pdf`, and `ebooks/ebook-3.html`.
- The supplied HTML files were the public home/library/workbook pages, not three product readers. The private HTML readers were generated from the complete PDF text and retain a download link to each original PDF. Images and original page layout remain in the PDF.

## Test setup still required
1. Deploy only the `test` Worker environment as `studyos-private-delivery-test`.
2. Add the Stripe **test-mode** secret key as `STRIPE_SECRET_KEY` and the new sandbox webhook signing secret as `STRIPE_WEBHOOK_SECRET` to that test Worker. Never commit secrets.
3. Create a test-mode webhook endpoint at `/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`; add refund/dispute events for revocation tests.
4. Set the four Stripe sandbox Payment Links to redirect to the deployed test Worker URL with `{CHECKOUT_SESSION_ID}`.
5. Keep production `PAYMENTS_ENABLED=false` throughout testing.
6. Test health, confirmed and unconfirmed checkout, invalid Payment Link, duplicate webhook, expired session, unpurchased ebook access, missing object, each individual product, the pack, and refund/dispute revocation.

The test environment variable `PAYMENTS_ENABLED=true` is isolated from production and uses only the sandbox Payment Links. Production remains `false`.

## Security
- Full eBooks are not in the public repository.
- R2 has no public access; Worker routes require a valid purchase session.
- Stripe signatures are verified before webhook processing.
- Checkout Sessions are verified server-side; browser-supplied price/product values are not trusted.
- Secrets stay outside Git.
- Do not merge this PR or enable live payments until sandbox end-to-end and revocation checks pass.

## Production activation
Only after all testing passes: verify production Payment Link IDs, set production Worker secrets, configure live webhook/redirects, and review applicable Spanish/EU digital-sales tax/legal requirements. Activate production payments only after the user explicitly approves that final step.

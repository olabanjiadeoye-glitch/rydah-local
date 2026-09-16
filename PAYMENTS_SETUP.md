# Rydah Local payment go-live

Rydah uses Paystack for customer card/bank/transfer/USSD checkout and Supabase for the payment ledger.

## Required secret

Add `PAYSTACK_SECRET_KEY` to the **Supabase Edge Functions secrets** for the Rydah Local project. Start with a Paystack test secret (`sk_test_...`). Switch to the live secret only after test checkout, verification and webhook handling all pass.

Never commit a Paystack secret key to GitHub and never expose it through a `NEXT_PUBLIC_` variable.

## Paystack webhook

Configure the Paystack dashboard webhook URL as:

`https://hkrlynzunekdumgzgwcx.supabase.co/functions/v1/paystack-webhook`

The webhook validates the `x-paystack-signature`, independently verifies successful transactions with Paystack, checks the exact expected NGN amount, and then marks the Rydah payment paid.

## Customer flow

1. Provider sends a quote.
2. Customer accepts the quote.
3. Provider completes the job.
4. Customer opens `/payments?job=<job-id>`.
5. Rydah initializes Paystack checkout securely through `paystack-payment`.
6. Customer pays on Paystack.
7. Paystack redirects back to Rydah and the page verifies the reference.
8. The signed webhook provides a second confirmation path if the browser is closed.
9. The payment ledger records commission and provider net earnings.

Cash remains available only for jobs of ₦5,000 or less.

## Test before live mode

Use Paystack test mode first. Confirm that a successful payment changes `payments.status` and `jobs.payment_status` to `paid`, stores the gateway reference/channel/transaction ID, and records Rydah commission plus provider net earnings. Confirm that repeated callbacks do not create a duplicate reference.

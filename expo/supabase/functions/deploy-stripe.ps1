# Run from project root
# Requires Supabase CLI logged in: supabase login

supabase functions deploy create-checkout
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook --no-verify-jwt

Write-Host "\nSet required secrets:" -ForegroundColor Yellow
Write-Host "supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx"
Write-Host "supabase secrets set STRIPE_PRICE_GOLD=price_xxx"
Write-Host "supabase secrets set STRIPE_PRICE_PLATINUM=price_xxx"
Write-Host "supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx"
Write-Host "supabase secrets set APP_URL=rork-app://premium"

Write-Host "\nThen configure Stripe webhook URL:" -ForegroundColor Yellow
Write-Host "https://didkwpenayulngybldkc.supabase.co/functions/v1/stripe-webhook"
Write-Host "Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted"

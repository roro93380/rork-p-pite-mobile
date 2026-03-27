alter table public.profiles
add column if not exists stripe_customer_id text;

create index if not exists profiles_stripe_customer_id_idx
on public.profiles (stripe_customer_id);

-- Optional safety: ensure only expected tiers are used
alter table public.profiles
drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
add constraint profiles_subscription_tier_check
check (subscription_tier in ('free', 'gold', 'platinum'));

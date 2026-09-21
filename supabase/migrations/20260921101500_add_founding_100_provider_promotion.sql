-- Founding 100 provider launch promotion.
-- 40 Lagos + 15 Abuja/FCT + 15 Ibadan/Oyo + 15 Warri/Delta + 15 Port Harcourt/Rivers.
-- Registration is waived permanently for confirmed promotional providers.
-- Provider marketplace access is free for 3 months, then the normal monthly subscription is required.

create extension if not exists pg_cron;

create table if not exists public.provider_launch_promo_markets (
  market_key text primary key,
  city_name text not null unique,
  region_name text not null,
  slot_limit integer not null check (slot_limit > 0),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.provider_launch_promo_markets
  (market_key, city_name, region_name, slot_limit, sort_order, enabled)
values
  ('lagos', 'Lagos', 'Lagos State', 40, 1, true),
  ('abuja_fct', 'Abuja', 'FCT Abuja', 15, 2, true),
  ('ibadan_oyo', 'Ibadan', 'Oyo State', 15, 3, true),
  ('warri_delta', 'Warri', 'Delta State', 15, 4, true),
  ('port_harcourt_rivers', 'Port Harcourt', 'Rivers State', 15, 5, true)
on conflict (market_key) do update
set city_name = excluded.city_name,
    region_name = excluded.region_name,
    slot_limit = excluded.slot_limit,
    sort_order = excluded.sort_order,
    enabled = excluded.enabled,
    updated_at = now();

create table if not exists public.provider_launch_promo_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  market_key text not null references public.provider_launch_promo_markets(market_key) on delete restrict,
  slot_number integer not null check (slot_number > 0),
  campaign_code text not null default 'founding_100',
  claimed_at timestamptz not null default now(),
  free_until timestamptz not null,
  claim_state text not null default 'active' check (claim_state in ('active','expired')),
  reminder_30d_sent_at timestamptz,
  reminder_7d_sent_at timestamptz,
  reminder_1d_sent_at timestamptz,
  expired_alert_sent_at timestamptz,
  unique (market_key, slot_number)
);

create index if not exists provider_launch_promo_claims_market_idx
  on public.provider_launch_promo_claims(market_key, claimed_at);

alter table public.provider_launch_promo_markets enable row level security;
alter table public.provider_launch_promo_claims enable row level security;

revoke all on public.provider_launch_promo_markets from anon, authenticated;
revoke all on public.provider_launch_promo_claims from anon, authenticated;

create or replace function private.provider_launch_market_for_location(p_location text)
returns text
language sql
immutable
set search_path = public, private, pg_temp
as $$
  select case
    when p_location = 'Lagos' or p_location like '%, Lagos' or p_location = 'Other Lagos area' then 'lagos'
    when p_location = 'Abuja' or p_location like '%, Abuja' or p_location = 'Other Abuja area' then 'abuja_fct'
    when p_location = 'Ibadan' or p_location like '%, Ibadan' or p_location = 'Other Ibadan area' then 'ibadan_oyo'
    when p_location = 'Warri' or p_location like '%, Warri' or p_location = 'Other Warri area' then 'warri_delta'
    when p_location = 'Port Harcourt' or p_location like '%, Port Harcourt' or p_location = 'Other Port Harcourt area' then 'port_harcourt_rivers'
    else null
  end;
$$;

create or replace function public.claim_provider_launch_promo(
  p_user_id uuid,
  p_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_market public.provider_launch_promo_markets%rowtype;
  v_existing public.provider_launch_promo_claims%rowtype;
  v_claimed integer := 0;
  v_slot integer;
  v_free_until timestamptz;
  v_registration_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into v_existing
  from public.provider_launch_promo_claims
  where user_id = p_user_id
  limit 1;

  if found then
    select * into v_market from public.provider_launch_promo_markets where market_key = v_existing.market_key;
    return jsonb_build_object(
      'claimed', true, 'already_claimed', true, 'campaign_code', v_existing.campaign_code,
      'market_key', v_existing.market_key, 'city_name', v_market.city_name,
      'region_name', v_market.region_name, 'slot_number', v_existing.slot_number,
      'slot_limit', v_market.slot_limit, 'claimed_at', v_existing.claimed_at,
      'free_until', v_existing.free_until
    );
  end if;

  select registration_status into v_registration_status
  from public.provider_billing
  where user_id = p_user_id
  for update;

  if v_registration_status is null then raise exception 'Provider billing record not found'; end if;
  if v_registration_status = 'paid' then return jsonb_build_object('claimed', false, 'reason', 'registration_already_paid'); end if;
  if v_registration_status = 'pending' then return jsonb_build_object('claimed', false, 'reason', 'registration_payment_pending'); end if;

  select * into v_market
  from public.provider_launch_promo_markets
  where enabled = true and lower(city_name) = lower(trim(p_city))
  for update;

  if not found then return jsonb_build_object('claimed', false, 'reason', 'market_not_eligible'); end if;

  select count(*)::integer into v_claimed
  from public.provider_launch_promo_claims
  where market_key = v_market.market_key;

  if v_claimed >= v_market.slot_limit then
    return jsonb_build_object(
      'claimed', false, 'reason', 'market_full', 'market_key', v_market.market_key,
      'city_name', v_market.city_name, 'region_name', v_market.region_name,
      'slot_limit', v_market.slot_limit, 'claimed_count', v_claimed, 'remaining', 0
    );
  end if;

  v_slot := v_claimed + 1;
  v_free_until := now() + interval '3 months';

  insert into public.provider_launch_promo_claims
    (user_id, market_key, slot_number, claimed_at, free_until, claim_state)
  values
    (p_user_id, v_market.market_key, v_slot, now(), v_free_until, 'active');

  update public.provider_billing
  set registration_status = 'waived',
      registration_paid_at = null,
      next_payment_at = v_free_until,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.notifications (user_id, title, body, kind, link)
  values (
    p_user_id,
    'Founding 100 provider place confirmed',
    format(
      'You secured %s place %s of %s. Your registration fee is waived and your first 3 months are free. Monthly billing starts after %s.',
      v_market.city_name, v_slot, v_market.slot_limit,
      to_char(v_free_until at time zone 'Africa/Lagos', 'DD Mon YYYY')
    ),
    'provider_billing',
    '/provider-onboarding'
  );

  return jsonb_build_object(
    'claimed', true, 'already_claimed', false, 'campaign_code', 'founding_100',
    'market_key', v_market.market_key, 'city_name', v_market.city_name,
    'region_name', v_market.region_name, 'slot_number', v_slot,
    'slot_limit', v_market.slot_limit, 'claimed_count', v_slot,
    'remaining', v_market.slot_limit - v_slot, 'claimed_at', now(),
    'free_until', v_free_until
  );
end;
$$;

revoke all on function public.claim_provider_launch_promo(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_provider_launch_promo(uuid,text) to service_role;

create or replace function private.provider_billing_active(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.provider_billing b
    where b.provider_id = p_provider_id
      and b.registration_status in ('paid','waived')
      and (
        b.subscription_status = 'active'
        or exists (
          select 1 from public.provider_launch_promo_claims promo
          where promo.user_id = b.user_id
            and promo.campaign_code = 'founding_100'
            and promo.free_until > now()
        )
      )
  )
  or coalesce((
    select value_numeric = 0 from public.platform_settings where key='provider_billing_required'
  ), false);
$$;

create or replace function public.enforce_provider_launch_promo_market()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_claim_market text;
  v_location_market text;
begin
  if pg_trigger_depth() > 1
     or coalesce(auth.role(), '') = 'service_role'
     or private.is_rydah_admin()
     or new.user_id is null then
    return new;
  end if;

  select market_key into v_claim_market
  from public.provider_launch_promo_claims
  where user_id = new.user_id and free_until > now()
  limit 1;

  if v_claim_market is null then return new; end if;

  v_location_market := private.provider_launch_market_for_location(new.location);
  if v_location_market is distinct from v_claim_market then
    raise exception 'Your Founding 100 place is reserved for a different launch market. Choose a service area in the city where you claimed the promotion.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_provider_launch_promo_market on public.providers;
create trigger trg_enforce_provider_launch_promo_market
before insert or update of location on public.providers
for each row execute function public.enforce_provider_launch_promo_market();

revoke all on function public.enforce_provider_launch_promo_market() from public, anon, authenticated;

create or replace function public.process_provider_launch_promo_notifications()
returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  r record;
  v_days integer;
begin
  for r in
    select c.id,c.user_id,c.market_key,c.slot_number,c.free_until,
           c.reminder_30d_sent_at,c.reminder_7d_sent_at,c.reminder_1d_sent_at,
           c.expired_alert_sent_at,m.city_name,b.subscription_status,b.provider_id
    from public.provider_launch_promo_claims c
    join public.provider_launch_promo_markets m on m.market_key = c.market_key
    left join public.provider_billing b on b.user_id = c.user_id
    where c.user_id is not null and c.claim_state = 'active'
  loop
    if r.subscription_status = 'active' then continue; end if;

    if r.free_until <= now() then
      if r.expired_alert_sent_at is null then
        insert into public.notifications (user_id,title,body,kind,link)
        values (
          r.user_id,
          'Your 3-month Founding 100 period has ended',
          'Your free provider period has ended. Activate the ₦500/month Rydah provider subscription to remain available for new jobs.',
          'provider_billing',
          '/provider-onboarding'
        );
        update public.provider_launch_promo_claims
        set claim_state='expired', expired_alert_sent_at=now()
        where id=r.id;
        if r.provider_id is not null then
          update public.providers set is_available=false, updated_at=now() where id=r.provider_id;
        end if;
      end if;
      continue;
    end if;

    v_days := greatest(1, ceil(extract(epoch from (r.free_until-now()))/86400.0)::integer);

    if r.free_until <= now() + interval '1 day' and r.reminder_1d_sent_at is null then
      insert into public.notifications (user_id,title,body,kind,link)
      values (r.user_id,'Founding 100 free period ends tomorrow',
              'Your free provider period ends tomorrow. After it ends, activate the ₦500/month subscription to keep receiving jobs.',
              'provider_billing','/provider-onboarding');
      update public.provider_launch_promo_claims set reminder_1d_sent_at=now() where id=r.id;
    elsif r.free_until <= now() + interval '7 days' and r.reminder_7d_sent_at is null then
      insert into public.notifications (user_id,title,body,kind,link)
      values (r.user_id,'Founding 100 free period ends soon',
              format('Your free provider period has about %s days left. Monthly access will be ₦500 after the free period ends.',v_days),
              'provider_billing','/provider-onboarding');
      update public.provider_launch_promo_claims set reminder_7d_sent_at=now() where id=r.id;
    elsif r.free_until <= now() + interval '30 days' and r.reminder_30d_sent_at is null then
      insert into public.notifications (user_id,title,body,kind,link)
      values (r.user_id,'Founding 100 free period: 30-day reminder',
              format('Your free provider period has about %s days left. Your registration stays free; monthly access becomes ₦500 after the free period.',v_days),
              'provider_billing','/provider-onboarding');
      update public.provider_launch_promo_claims set reminder_30d_sent_at=now() where id=r.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.process_provider_launch_promo_notifications() from public, anon, authenticated;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='rydah-provider-founding100-reminders' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'rydah-provider-founding100-reminders',
    '0 8 * * *',
    'select public.process_provider_launch_promo_notifications();'
  );
end $$;

insert into public.platform_settings (key,value_numeric,description)
values
  ('provider_founding_promo_total_slots',100,'Total Founding 100 provider promotional places across launch markets.'),
  ('provider_founding_promo_free_months',3,'Number of free provider subscription months for Founding 100 providers.')
on conflict (key) do update
set value_numeric=excluded.value_numeric,description=excluded.description,updated_at=now();

-- Security QC hardening: require active provider billing consistently
-- at job assignment and arrival verification boundaries.

create or replace function public.prepare_job_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  actor uuid := auth.uid();
  actor_role text;
  provider_ok boolean := false;
  biometric_required numeric := 0;
begin
  if actor is null then
    new.customer_id := null;
  elsif private.is_rydah_admin() then
    new.customer_id := coalesce(new.customer_id, actor);
  else
    select role into actor_role from public.profiles where id = actor;
    if actor_role is distinct from 'customer' then
      raise exception 'Only customer accounts can create customer job requests';
    end if;
    new.customer_id := actor;
  end if;

  if char_length(trim(coalesce(new.service_category,''))) < 2 then
    raise exception 'A valid service category is required';
  end if;
  if char_length(trim(coalesce(new.location,''))) < 2 then
    raise exception 'A valid location is required';
  end if;
  if char_length(trim(coalesce(new.description,''))) < 10 then
    raise exception 'Job description must be at least 10 characters';
  end if;
  if char_length(trim(coalesce(new.contact_name,''))) < 2 then
    raise exception 'A contact name is required';
  end if;
  if char_length(trim(coalesce(new.contact_email,''))) < 3 then
    raise exception 'A contact email is required';
  end if;

  select coalesce(value_numeric,0)
    into biometric_required
  from public.platform_settings
  where key = 'biometric_verification_required';

  if new.provider_id is not null then
    select exists(
      select 1
      from public.providers p
      where p.id = new.provider_id
        and p.user_id is not null
        and p.is_verified = true
        and p.is_available = true
        and private.provider_billing_active(p.id)
        and (
          biometric_required <> 1
          or exists (
            select 1
            from public.provider_verifications pv
            where pv.provider_id = p.id
              and pv.biometric_status = 'verified'
          )
        )
    ) into provider_ok;

    if not provider_ok then
      raise exception 'The selected provider is not currently eligible to receive jobs';
    end if;
  end if;

  new.status := 'open';
  new.quoted_amount := null;
  new.quote_status := 'not_sent';
  new.quote_accepted_at := null;
  new.payment_status := 'unpaid';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.verify_job_arrival(p_job_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions', 'private', 'auth', 'pg_temp'
as $function$
declare
  actor uuid := auth.uid();
  j public.jobs%rowtype;
  provider_ok boolean := false;
  clean_code text := trim(coalesce(p_code, ''));
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into j
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Job not found';
  end if;

  select exists (
    select 1
    from public.providers p
    where p.id = j.provider_id
      and p.user_id = actor
      and p.is_verified = true
      and p.biometric_verified = true
      and private.provider_billing_active(p.id)
  ) into provider_ok;

  if not provider_ok then
    raise exception 'Only the assigned active biometric-verified provider can verify arrival';
  end if;

  if j.status <> 'accepted' or j.quote_status <> 'accepted' then
    raise exception 'This job is not ready for arrival verification';
  end if;

  if j.arrival_verified_at is not null then
    return true;
  end if;

  if j.arrival_code_hash is null or j.arrival_code_expires_at is null then
    raise exception 'Ask the customer to generate an arrival code';
  end if;

  if j.arrival_code_expires_at < now() then
    raise exception 'Arrival code expired. Ask the customer for a new code';
  end if;

  if j.arrival_attempts >= 5 then
    raise exception 'Too many attempts. Ask the customer for a new code';
  end if;

  if encode(extensions.digest(clean_code, 'sha256'), 'hex') <> j.arrival_code_hash then
    perform set_config('rydah.arrival_rpc', '1', true);
    update public.jobs
      set arrival_attempts = arrival_attempts + 1
    where id = p_job_id;
    raise exception 'Arrival code is incorrect';
  end if;

  perform set_config('rydah.arrival_rpc', '1', true);
  update public.jobs
  set arrival_verified_at = now(),
      arrival_verified_by = actor,
      arrival_code_hash = null,
      arrival_code_expires_at = null,
      arrival_attempts = 0
  where id = p_job_id;

  return true;
end;
$function$;

revoke all on table public.provider_billing from anon, authenticated;
revoke all on table public.provider_billing_config from anon, authenticated;

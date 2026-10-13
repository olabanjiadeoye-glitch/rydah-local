-- Persist incorrect arrival PIN attempts instead of rolling them back.
-- An invalid code returns false; success returns true.
-- Preserve assigned-provider, biometric, billing, quote, expiry and lockout gates.
CREATE OR REPLACE FUNCTION public.verify_job_arrival(p_job_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'private', 'auth', 'pg_temp'
AS $function$
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
      set arrival_attempts = coalesce(arrival_attempts, 0) + 1
    where id = p_job_id;
    -- Raising here would roll back the counter update in the same transaction.
    return false;
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

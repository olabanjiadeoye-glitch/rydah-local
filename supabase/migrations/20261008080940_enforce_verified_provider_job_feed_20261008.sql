-- Historical migration already applied to production; tracked here for reproducibility.
-- Do not re-apply manually to the existing production database.

CREATE OR REPLACE FUNCTION public.provider_job_feed()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(feed) order by feed.created_at desc), '[]'::jsonb)
  from (
    select
      j.id,
      j.provider_id,
      j.service_category,
      j.location,
      case when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.landmark_text else null end as landmark_text,
      j.description,
      j.is_urgent,
      j.status,
      j.contact_name,
      case when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.contact_email else null end as contact_email,
      case when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.contact_phone else null end as contact_phone,
      case when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.latitude else null end as latitude,
      case when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.longitude else null end as longitude,
      case when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.location_accuracy_m else null end as location_accuracy_m,
      case when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.location_source else 'manual' end as location_source,
      j.created_at,
      j.quoted_amount,
      j.quote_status,
      j.quote_accepted_at,
      j.payment_status,
      j.arrival_verified_at,
      j.arrival_face_verified_at
    from public.jobs j
    join public.providers p on p.id = j.provider_id
    where p.user_id = auth.uid()
      and p.is_verified = true
      and p.biometric_verified = true
      and private.provider_billing_active(p.id)
  ) as feed;
$function$;

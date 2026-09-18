-- Release private job GPS to the assigned provider only after quote acceptance.
create or replace function public.provider_job_feed()
returns jsonb
language sql
security definer
set search_path = public, private, auth, pg_temp
as $$
  select coalesce(jsonb_agg(to_jsonb(feed) order by feed.created_at desc), '[]'::jsonb)
  from (
    select
      j.id,
      j.provider_id,
      j.service_category,
      j.location,
      j.description,
      j.is_urgent,
      j.status,
      j.contact_name,
      case
        when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.contact_email
        else null
      end as contact_email,
      case
        when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.contact_phone
        else null
      end as contact_phone,
      case
        when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.latitude
        else null
      end as latitude,
      case
        when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.longitude
        else null
      end as longitude,
      case
        when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.location_accuracy_m
        else null
      end as location_accuracy_m,
      case
        when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.location_source
        else 'manual'
      end as location_source,
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
  ) as feed;
$$;

revoke all on function public.provider_job_feed() from public, anon;
grant execute on function public.provider_job_feed() to authenticated;

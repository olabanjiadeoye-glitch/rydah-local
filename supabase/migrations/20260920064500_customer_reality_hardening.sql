-- Customer-reality hardening for Nigerian addressing and trustworthy public review summaries.

alter table public.jobs
  add column if not exists landmark_text text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_landmark_text_length'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_landmark_text_length
      check (landmark_text is null or char_length(trim(landmark_text)) <= 160);
  end if;
end
$$;

create or replace function public.provider_job_feed()
returns jsonb
language sql
security definer
set search_path to 'public', 'private', 'auth', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(to_jsonb(feed) order by feed.created_at desc), '[]'::jsonb)
  from (
    select
      j.id,
      j.provider_id,
      j.service_category,
      j.location,
      case
        when j.quote_status = 'accepted' and j.status in ('accepted','in_progress','completed') then j.landmark_text
        else null
      end as landmark_text,
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
      and private.provider_billing_active(p.id)
  ) as feed;
$function$;

create or replace function public.public_provider_review_summary(p_provider_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'review_count', count(r.id),
    'average_rating', coalesce(round(avg(r.rating)::numeric, 1), 0),
    'recent', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'rating', rr.rating,
            'comment', rr.comment,
            'created_at', rr.created_at
          )
          order by rr.created_at desc
        )
        from (
          select rating, comment, created_at
          from public.reviews
          where provider_id = p_provider_id
            and comment is not null
            and char_length(trim(comment)) >= 3
          order by created_at desc
          limit 3
        ) rr
      ),
      '[]'::jsonb
    )
  )
  from public.reviews r
  where r.provider_id = p_provider_id
    and exists (
      select 1
      from public.providers p
      where p.id = p_provider_id
        and p.is_verified = true
        and p.biometric_verified = true
    );
$function$;

revoke all on function public.public_provider_review_summary(uuid) from public;
grant execute on function public.public_provider_review_summary(uuid) to anon, authenticated, service_role;

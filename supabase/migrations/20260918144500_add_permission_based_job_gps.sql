-- Permission-based customer job GPS.
-- Provider exact GPS is intentionally not stored in the public providers table.
alter table public.jobs
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_source text not null default 'manual',
  add column if not exists location_updated_at timestamptz;

alter table public.jobs
  drop constraint if exists jobs_latitude_range_check,
  drop constraint if exists jobs_longitude_range_check,
  drop constraint if exists jobs_location_accuracy_check,
  drop constraint if exists jobs_location_source_check,
  drop constraint if exists jobs_gps_pair_check;

alter table public.jobs
  add constraint jobs_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  add constraint jobs_longitude_range_check
    check (longitude is null or longitude between -180 and 180),
  add constraint jobs_location_accuracy_check
    check (location_accuracy_m is null or location_accuracy_m >= 0),
  add constraint jobs_location_source_check
    check (location_source in ('manual','gps')),
  add constraint jobs_gps_pair_check
    check (
      (latitude is null and longitude is null and location_source = 'manual')
      or
      (latitude is not null and longitude is not null and location_source = 'gps')
    );

create or replace function public.protect_job_location_coordinates()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if pg_trigger_depth() > 1
     or coalesce(auth.role(), '') = 'service_role'
     or private.is_rydah_admin() then
    return new;
  end if;

  if new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude
     or new.location_accuracy_m is distinct from old.location_accuracy_m
     or new.location_source is distinct from old.location_source
     or new.location_updated_at is distinct from old.location_updated_at then
    raise exception 'Job GPS coordinates are fixed when the request is created';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_job_location_coordinates on public.jobs;
create trigger trg_protect_job_location_coordinates
before update on public.jobs
for each row
execute function public.protect_job_location_coordinates();

revoke all on function public.protect_job_location_coordinates() from public, anon, authenticated;

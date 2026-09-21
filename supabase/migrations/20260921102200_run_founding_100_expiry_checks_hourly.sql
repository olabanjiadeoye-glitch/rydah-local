-- Check Founding 100 expiry and billing reminders hourly so access changes
-- and provider alerts happen close to the exact three-month expiry timestamp.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'rydah-provider-founding100-reminders'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'rydah-provider-founding100-reminders',
    '0 * * * *',
    'select public.process_provider_launch_promo_notifications();'
  );
end $$;

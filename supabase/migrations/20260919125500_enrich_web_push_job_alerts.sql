-- Enrich web-push payloads so incoming provider job requests can use
-- distinct notification behavior without changing the notification table.

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net', 'pg_temp'
as $function$
declare
  v_token text;
begin
  select decrypted_secret
  into v_token
  from vault.decrypted_secrets
  where name = 'RYDAH_WEB_PUSH_DISPATCH_TOKEN'
  limit 1;

  if v_token is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://hkrlynzunekdumgzgwcx.supabase.co/functions/v1/push-dispatch',
    body := jsonb_build_object(
      'notification_id', new.id,
      'user_id', new.user_id,
      'title', new.title,
      'body', new.body,
      'kind', new.kind,
      'link', coalesce(new.link, '/notifications')
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rydah-push-token', v_token
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$function$;

-- Allow a browser push endpoint to move safely between Rydah accounts.
-- A push endpoint is unique to a browser subscription, but the same device/browser
-- can sign out of one Rydah account and into another. The old invoker function hit
-- RLS on the conflict-update path because the existing row belonged to the prior user.
--
-- Keep table RLS strict. This function is the single narrow authenticated transfer path.

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(length(p_endpoint), 0) < 20
     or coalesce(length(p_endpoint), 0) > 4096
     or coalesce(length(p_p256dh), 0) < 20
     or coalesce(length(p_p256dh), 0) > 1024
     or coalesce(length(p_auth), 0) < 8
     or coalesce(length(p_auth), 0) > 512 then
    raise exception 'Invalid push subscription';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth_key,
    user_agent,
    enabled,
    updated_at
  )
  values (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    left(p_user_agent, 500),
    true,
    now()
  )
  on conflict (endpoint) do update
    set user_id = v_user_id,
        p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        enabled = true,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.save_push_subscription(text,text,text,text) from public, anon;
grant execute on function public.save_push_subscription(text,text,text,text) to authenticated, service_role;

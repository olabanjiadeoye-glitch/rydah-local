-- Block off-platform contact details in job descriptions at the database boundary.
-- This complements the immediate browser warning and prevents API/browser tampering
-- from storing phone numbers, email addresses, social handles or external links.

create or replace function public.enforce_job_description_no_contact()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  text_value text := coalesce(new.description, '');
begin
  if
    text_value ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}'
    or text_value ~* '(https?://|www[.]|wa[.]me|t[.]me|bit[.]ly|tinyurl[.]com|[[:alnum:]-]+[.](com|ng|net|org|co|io|me|app)([^[:alnum:]]|$))'
    or text_value ~ '([+]?[0-9][[:space:]().-]*){9,15}'
    or text_value ~* '(^|[^[:alnum:]_])@[[:alnum:]_.-]{2,}'
    or text_value ~* '(^|[^[:alpha:]])(whats?app|telegram|instagram|facebook|messenger|tiktok|snapchat|twitter|linkedin|discord|signal|wechat|imo)([^[:alpha:]]|$)'
    or text_value ~* '(^|[^[:alpha:]])(dm[[:space:]]+me|direct[[:space:]]+message|inbox[[:space:]]+me|message[[:space:]]+me[[:space:]]+on|contact[[:space:]]+me[[:space:]]+on)([^[:alpha:]]|$)'
  then
    raise exception 'Contact details are not allowed in a job description. Remove phone numbers, email addresses, social-media details, websites and external links. Use the official Rydah contact fields instead.';
  end if;

  return new;
end;
$function$;

drop trigger if exists jobs_no_off_platform_contact on public.jobs;
create trigger jobs_no_off_platform_contact
before insert or update of description on public.jobs
for each row
execute function public.enforce_job_description_no_contact();

revoke all on function public.enforce_job_description_no_contact() from public, anon, authenticated;
grant execute on function public.enforce_job_description_no_contact() to service_role;

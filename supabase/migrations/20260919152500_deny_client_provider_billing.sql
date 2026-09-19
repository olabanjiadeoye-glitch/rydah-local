-- Defense-in-depth policies for billing tables.
-- Direct client table privileges are already revoked; these policies make the
-- deny-by-default intent explicit and keep RLS protections in place if grants
-- are changed later.

drop policy if exists "provider billing deny client access" on public.provider_billing;
create policy "provider billing deny client access"
on public.provider_billing
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "provider billing config deny client access" on public.provider_billing_config;
create policy "provider billing config deny client access"
on public.provider_billing_config
for all
to anon, authenticated
using (false)
with check (false);

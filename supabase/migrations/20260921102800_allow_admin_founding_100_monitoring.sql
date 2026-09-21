
grant select on public.provider_launch_promo_markets to authenticated;
grant select on public.provider_launch_promo_claims to authenticated;

drop policy if exists "admin read launch promo markets" on public.provider_launch_promo_markets;
create policy "admin read launch promo markets"
on public.provider_launch_promo_markets
for select
to authenticated
using ((select private.is_rydah_admin()));

drop policy if exists "admin read launch promo claims" on public.provider_launch_promo_claims;
create policy "admin read launch promo claims"
on public.provider_launch_promo_claims
for select
to authenticated
using ((select private.is_rydah_admin()));

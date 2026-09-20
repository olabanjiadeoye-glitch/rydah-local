-- Remove the anonymous SECURITY DEFINER review-summary RPC.
-- Public provider cards continue to use the existing sanitized provider rating
-- and completed-job counters. Written review publication will use a separate
-- moderated/public-stats design rather than privileged anonymous RPC access.

drop function if exists public.public_provider_review_summary(uuid);

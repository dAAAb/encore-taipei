-- Rooftop chat goes back to people-only review: no message becomes public until an admin approves it.
-- The waiting limit already counts only the last 24 hours, so nothing has to be put away automatically.
select cron.unschedule(jobid) from cron.job where jobname = 'encore-chat-auto-review';
drop function if exists public.encore_chat_auto_review();
drop function if exists public.encore_chat_plain(text, text);

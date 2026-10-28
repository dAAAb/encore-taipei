-- Channel descriptions edited by admins can carry a credits / references section with links, so they get more
-- room. The public submit form still caps what visitors type at 1,000 characters.
alter table public.encore_channels drop constraint if exists encore_channels_message_check;
alter table public.encore_channels add constraint encore_channels_message_check check (char_length(message) <= 4000);

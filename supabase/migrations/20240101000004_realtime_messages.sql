-- Enable Postgres Changes (Realtime) for the messages table.
-- Required for MessagesClient to receive live INSERT events via supabase.channel().
alter publication supabase_realtime add table public.messages;

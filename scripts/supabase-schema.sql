-- Kali chat persistence schema.
-- Paste into your Supabase project's SQL editor + run once.
-- Project: https://app.supabase.com/project/<id>/sql
--
-- What it creates:
--   kali_conversations  — one row per chat thread, scoped to auth.users
--   kali_messages       — ordered messages in a conversation
--   RLS policies        — users can only see/modify their own
--
-- Idempotent: drops + recreates safely. Safe to re-run.

-- ─── conversations ──────────────────────────────────────────────────────

create table if not exists public.kali_conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  tenant_id   text        not null default 'rivertown',
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists kali_conversations_user_idx
  on public.kali_conversations(user_id, updated_at desc);

-- ─── messages ───────────────────────────────────────────────────────────

create table if not exists public.kali_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.kali_conversations(id) on delete cascade,
  role            text        not null check (role in ('user','assistant','tool')),
  content         text        not null,
  tool_calls      jsonb,
  citations       jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists kali_messages_conv_idx
  on public.kali_messages(conversation_id, created_at);

-- ─── row-level security ─────────────────────────────────────────────────

alter table public.kali_conversations enable row level security;
alter table public.kali_messages      enable row level security;

-- Conversations: only the owner can see / modify.
drop policy if exists "kali_conversations select own"  on public.kali_conversations;
drop policy if exists "kali_conversations insert own"  on public.kali_conversations;
drop policy if exists "kali_conversations update own"  on public.kali_conversations;
drop policy if exists "kali_conversations delete own"  on public.kali_conversations;

create policy "kali_conversations select own"
  on public.kali_conversations for select
  using (user_id = auth.uid());

create policy "kali_conversations insert own"
  on public.kali_conversations for insert
  with check (user_id = auth.uid());

create policy "kali_conversations update own"
  on public.kali_conversations for update
  using (user_id = auth.uid());

create policy "kali_conversations delete own"
  on public.kali_conversations for delete
  using (user_id = auth.uid());

-- Messages: gated through conversation ownership.
drop policy if exists "kali_messages select own"  on public.kali_messages;
drop policy if exists "kali_messages insert own"  on public.kali_messages;
drop policy if exists "kali_messages update own"  on public.kali_messages;
drop policy if exists "kali_messages delete own"  on public.kali_messages;

create policy "kali_messages select own"
  on public.kali_messages for select
  using (conversation_id in (
    select id from public.kali_conversations where user_id = auth.uid()
  ));

create policy "kali_messages insert own"
  on public.kali_messages for insert
  with check (conversation_id in (
    select id from public.kali_conversations where user_id = auth.uid()
  ));

create policy "kali_messages update own"
  on public.kali_messages for update
  using (conversation_id in (
    select id from public.kali_conversations where user_id = auth.uid()
  ));

create policy "kali_messages delete own"
  on public.kali_messages for delete
  using (conversation_id in (
    select id from public.kali_conversations where user_id = auth.uid()
  ));

-- ─── trigger: bump conversation.updated_at on message insert ────────────

create or replace function public.kali_touch_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.kali_conversations
    set updated_at = now()
    where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists kali_messages_touch on public.kali_messages;
create trigger kali_messages_touch
  after insert on public.kali_messages
  for each row execute function public.kali_touch_conversation();

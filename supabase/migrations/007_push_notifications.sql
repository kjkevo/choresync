-- ── Migration 007: Push notifications, nudges, quiet hours ──────────────────

-- Push subscription storage
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now(),
  -- one subscription per browser endpoint per user
  unique (user_id, endpoint)
);

-- Per-user notification preferences (one row per user per household)
create table if not exists public.user_notification_prefs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  household_id    uuid not null references public.households(id) on delete cascade,
  -- what to send
  notify_due      boolean not null default true,   -- chore due today
  notify_overdue  boolean not null default true,   -- chore overdue
  notify_assigned boolean not null default true,   -- chore newly assigned to me
  notify_nudge    boolean not null default true,   -- nudge from roommate
  -- quiet hours (UTC "HH:MM", null = no quiet hours)
  quiet_start     text,
  quiet_end       text,
  updated_at      timestamptz not null default now(),
  unique (user_id, household_id)
);

-- Nudge log (rate-limit: 1 nudge per chore per hour)
create table if not exists public.nudge_log (
  id          uuid primary key default gen_random_uuid(),
  chore_id    uuid not null references public.chores(id) on delete cascade,
  sender_id   uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  sent_at     timestamptz not null default now()
);

-- RLS
alter table public.push_subscriptions      enable row level security;
alter table public.user_notification_prefs enable row level security;
alter table public.nudge_log               enable row level security;

-- push_subscriptions: users manage their own
create policy "users manage own push subs"
  on public.push_subscriptions for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- user_notification_prefs: users manage their own
create policy "users manage own notif prefs"
  on public.user_notification_prefs for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- nudge_log: household members can insert + read
create policy "household members insert nudges"
  on public.nudge_log for insert
  with check (sender_id = auth.uid());

create policy "household members read nudges"
  on public.nudge_log for select
  using (
    sender_id = auth.uid() or receiver_id = auth.uid()
  );

-- Index for cron job: find subs for a user
create index if not exists push_subs_user_idx
  on public.push_subscriptions (user_id);

-- Index for prefs lookup
create index if not exists notif_prefs_user_hh_idx
  on public.user_notification_prefs (user_id, household_id);

-- Index for rate-limit query
create index if not exists nudge_log_chore_sent_idx
  on public.nudge_log (chore_id, sent_at desc);

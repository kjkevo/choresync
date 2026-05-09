-- ============================================================
-- ChoreSync — Chores table
-- Run after 001_initial_schema.sql
-- ============================================================

-- ── Enum-style domains (enforced via CHECK) ───────────────────────────────────
-- We use text + check constraints instead of pg ENUM so we can add values
-- without a table lock in future migrations.

create table public.chores (
  id               uuid        primary key default uuid_generate_v4(),
  household_id     uuid        not null references public.households(id) on delete cascade,

  -- Core
  name             text        not null,
  description      text,

  -- Assignment
  assigned_to      uuid        references public.users(id) on delete set null,

  -- Schedule
  due_date         date,
  frequency        text        not null default 'one-time'
                               check (frequency in ('one-time','daily','weekly','biweekly','monthly')),

  -- Classification
  priority         text        not null default 'medium'
                               check (priority in ('low','medium','high')),
  category         text        not null default 'general'
                               check (category in ('kitchen','bathroom','bedroom','outdoor','laundry','general')),
  estimated_mins   int         check (estimated_mins is null or (estimated_mins >= 1 and estimated_mins <= 480)),

  -- Status
  status           text        not null default 'incomplete'
                               check (status in ('incomplete','completed')),
  completed_at     timestamptz,
  completed_by     uuid        references public.users(id) on delete set null,
  photo_proof_url  text,

  -- For recurring chores: when was it last completed before auto-reset?
  last_completed_at timestamptz,

  -- Audit
  created_by       uuid        references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Constraints
  constraint chores_name_length      check (char_length(name) between 1 and 120),
  constraint chores_completed_fields check (
    (status = 'completed' and completed_at is not null and completed_by is not null)
    or status = 'incomplete'
  )
);

comment on table public.chores is
  'Household chores with scheduling, priority, category, and completion tracking.';
comment on column public.chores.frequency is
  'one-time | daily | weekly | biweekly | monthly. Recurring chores auto-reset their due_date when completed.';
comment on column public.chores.last_completed_at is
  'Set to completed_at when a recurring chore resets, so history is not lost.';


-- ── Indexes ───────────────────────────────────────────────────────────────────

create index idx_chores_household         on public.chores (household_id);
create index idx_chores_assigned_to       on public.chores (assigned_to);
create index idx_chores_due_date          on public.chores (due_date);
create index idx_chores_status            on public.chores (status);
-- Composite: most queries filter by household + status
create index idx_chores_household_status  on public.chores (household_id, status);
-- Composite: frequency-based queries for due-date advance
create index idx_chores_household_freq    on public.chores (household_id, frequency) where frequency <> 'one-time';


-- ── updated_at trigger ────────────────────────────────────────────────────────

create trigger touch_chores_updated_at
  before update on public.chores
  for each row execute procedure public.touch_updated_at();


-- ── Helper: advance a due date by frequency ───────────────────────────────────

create or replace function public.next_chore_due_date(
  p_due_date  date,
  p_frequency text
)
returns date
language sql
immutable
as $$
  select case p_frequency
    when 'daily'    then p_due_date + interval '1 day'
    when 'weekly'   then p_due_date + interval '7 days'
    when 'biweekly' then p_due_date + interval '14 days'
    when 'monthly'  then p_due_date + interval '1 month'
    else p_due_date  -- 'one-time' — caller shouldn't call this, but safe fallback
  end;
$$;


-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.chores enable row level security;

-- Any household member can read chores
create policy "chores: members can read"
  on public.chores for select
  using (
    household_id in (
      select household_id
      from   public.household_members
      where  user_id = auth.uid()
    )
  );

-- Only admins can create chores
create policy "chores: admins can insert"
  on public.chores for insert
  with check (
    public.is_household_admin(household_id)
  );

-- All household members can update chores.
-- Fine-grained field restrictions (members can only touch status/completion
-- fields; only admins can change name, priority, etc.) are enforced in
-- application-layer server actions, not SQL, to keep policies readable.
create policy "chores: members can update"
  on public.chores for update
  using (
    household_id in (
      select household_id
      from   public.household_members
      where  user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id
      from   public.household_members
      where  user_id = auth.uid()
    )
  );

-- Only admins can delete chores
create policy "chores: admins can delete"
  on public.chores for delete
  using (
    public.is_household_admin(household_id)
  );


-- ── Storage bucket for chore photo proofs ─────────────────────────────────────
-- Run in the Supabase Dashboard → Storage, or via management API:
--
--   insert into storage.buckets (id, name, public)
--   values ('chore-photos', 'chore-photos', true);
--
--   -- Any authenticated household member can upload a photo proof
--   create policy "chore-photos: members upload"
--     on storage.objects for insert
--     with check (bucket_id = 'chore-photos' and auth.role() = 'authenticated');
--
--   -- Anyone can read (photos are referenced in the UI)
--   create policy "chore-photos: public read"
--     on storage.objects for select
--     using (bucket_id = 'chore-photos');
--
--   -- Uploader can delete their own
--   create policy "chore-photos: owner delete"
--     on storage.objects for delete
--     using (bucket_id = 'chore-photos' and auth.uid()::text = owner);

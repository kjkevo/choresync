-- ============================================================
-- ChoreSync — Initial Schema
-- Run against your Supabase project via:
--   supabase db push  (local dev)
--   supabase db push --linked  (linked remote project)
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fast ILIKE searches on names


-- ── Tables ────────────────────────────────────────────────────

-- Public user profile (mirrors auth.users, kept in sync via trigger)
create table public.users (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.users is 'Public profile for every authenticated user.';


-- Households
create table public.households (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null check (char_length(name) between 1 and 80),
  invite_code text        not null unique,
  created_by  uuid        references public.users(id) on delete set null,
  settings    jsonb       not null default '{}',  -- extensible settings bag
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.households is 'A shared household unit. Members join via invite_code.';
comment on column public.households.settings is
  'Arbitrary settings: { resetDay, pointValues, customCategories, darkMode, … }';


-- Household members (join table with extra metadata)
create table public.household_members (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references public.users(id)      on delete cascade,
  household_id uuid        not null references public.households(id) on delete cascade,
  role         text        not null default 'member'
                           check (role in ('admin', 'member')),
  color_theme  text        not null default '#6366f1',
  joined_at    timestamptz not null default now(),

  constraint uq_member_household unique (user_id, household_id)
);

comment on table public.household_members is
  'Membership, role (admin|member), and display colour for each household participant.';


-- ── Indexes ───────────────────────────────────────────────────

create index idx_household_members_user      on public.household_members (user_id);
create index idx_household_members_household on public.household_members (household_id);
create index idx_households_invite_code      on public.households (invite_code);


-- ── Helper functions ──────────────────────────────────────────

-- Generates a short, uppercase alphanumeric invite code (6 chars)
create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(
    substring(
      replace(encode(gen_random_bytes(6), 'base64'), '/', 'X'),
      1, 6
    )
  );
$$;


-- Returns true when the calling user is an admin of the given household
create or replace function public.is_household_admin(p_household_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id      = auth.uid()
      and role         = 'admin'
  );
$$;


-- Returns the household_id the calling user belongs to (first one if multiple)
create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
as $$
  select household_id
  from   public.household_members
  where  user_id = auth.uid()
  limit  1;
$$;


-- ── Triggers ──────────────────────────────────────────────────

-- 1. Sync new auth.users rows → public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name,  public.users.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also re-sync on OAuth re-logins (user metadata may change)
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Auto-generate invite_code before household insert
create or replace function public.set_invite_code()
returns trigger
language plpgsql
as $$
declare
  new_code text;
  attempts  int := 0;
begin
  if new.invite_code is not null and new.invite_code <> '' then
    return new;  -- caller supplied one explicitly
  end if;

  loop
    new_code := public.generate_invite_code();
    exit when not exists (
      select 1 from public.households where invite_code = new_code
    );
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Could not generate a unique invite code after 20 attempts';
    end if;
  end loop;

  new.invite_code := new_code;
  return new;
end;
$$;

create trigger before_household_insert
  before insert on public.households
  for each row execute procedure public.set_invite_code();


-- 3. Keep updated_at current
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_users_updated_at
  before update on public.users
  for each row execute procedure public.touch_updated_at();

create trigger touch_households_updated_at
  before update on public.households
  for each row execute procedure public.touch_updated_at();


-- ── Row Level Security ────────────────────────────────────────

alter table public.users             enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;


-- ── users policies ────────────────────────────────────────────

-- A user can read their own row; members of the same household can see each other
create policy "users: read own or household peers"
  on public.users for select
  using (
    id = auth.uid()
    or id in (
      select hm2.user_id
      from   public.household_members hm1
      join   public.household_members hm2 using (household_id)
      where  hm1.user_id = auth.uid()
    )
  );

create policy "users: update own"
  on public.users for update
  using  (id = auth.uid())
  with check (id = auth.uid());


-- ── households policies ───────────────────────────────────────

create policy "households: members can read"
  on public.households for select
  using (
    id in (
      select household_id
      from   public.household_members
      where  user_id = auth.uid()
    )
  );

create policy "households: admins can update"
  on public.households for update
  using  (public.is_household_admin(id))
  with check (public.is_household_admin(id));

-- Any authenticated user may create a household (they become admin in app code)
create policy "households: auth users can insert"
  on public.households for insert
  with check (auth.role() = 'authenticated');

-- Only admin can delete their household
create policy "households: admins can delete"
  on public.households for delete
  using (public.is_household_admin(id));


-- ── household_members policies ────────────────────────────────

-- Members can see other members in the same household
create policy "household_members: read same household"
  on public.household_members for select
  using (
    household_id in (
      select household_id
      from   public.household_members
      where  user_id = auth.uid()
    )
  );

-- Any authenticated user may join a household (insert their own row)
create policy "household_members: self-join"
  on public.household_members for insert
  with check (user_id = auth.uid());

-- Admins can update role / color of any member in their household;
-- members can update their own color only
create policy "household_members: admin update or self update color"
  on public.household_members for update
  using (
    public.is_household_admin(household_id)
    or user_id = auth.uid()
  )
  with check (
    public.is_household_admin(household_id)
    or (user_id = auth.uid() and role = (select role from public.household_members where id = household_members.id))
  );

-- Admins can remove members; members can remove themselves (leave)
create policy "household_members: admin remove or self leave"
  on public.household_members for delete
  using (
    public.is_household_admin(household_id)
    or user_id = auth.uid()
  );


-- ── Storage bucket for avatars ────────────────────────────────
-- Run once in the Supabase dashboard or via the management API:
--
--   insert into storage.buckets (id, name, public)
--   values ('avatars', 'avatars', true);
--
--   create policy "avatar upload" on storage.objects for insert
--     with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
--
--   create policy "avatar update" on storage.objects for update
--     using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
--
--   create policy "avatar public read" on storage.objects for select
--     using (bucket_id = 'avatars');
--
-- (Storage SQL is separate from schema migrations in Supabase.)

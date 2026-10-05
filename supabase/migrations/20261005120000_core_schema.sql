-- Home Library: core schema. Multi-tenant: every tenant table carries library_id, and composite foreign keys
-- (id, library_id) stop rows in one library from referencing rows in another.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type public.library_role as enum ('owner', 'member');
create type public.library_permission as enum (
  'books.add', 'books.edit', 'books.move', 'loans.manage', 'books.archive', 'books.delete',
  'shelves.manage', 'audits.run', 'members.manage', 'ai.manage'
);
create type public.book_status as enum ('on_shelf', 'borrowed', 'missing', 'archived');
create type public.audit_mode as enum ('random', 'shelf');
create type public.audit_result as enum ('pending', 'found', 'missing', 'misplaced', 'unexpected');
create type public.ai_provider as enum ('openai', 'gemini', 'openai_compatible');
create type public.color_name as enum (
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'grey', 'multi'
);
create type public.book_event_type as enum (
  'created', 'moved', 'lent', 'returned', 'archived', 'restored', 'audited', 'marked_missing'
);

-- ─── Helpers ────────────────────────────────────────────────────────────────

-- array_to_string is only STABLE, so generated columns need an IMMUTABLE wrapper.
create function public.immutable_array_to_string(arr text[], sep text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select pg_catalog.array_to_string(arr, sep)
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ─── Profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Libraries & membership ─────────────────────────────────────────────────

create table public.libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid references auth.users on delete set null default auth.uid(),
  -- Which configured AI provider (library_ai_providers) is used for metadata enrichment / cover recognition.
  enrich_provider public.ai_provider,
  vision_provider public.ai_provider,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger libraries_touch before update on public.libraries
  for each row execute function public.touch_updated_at();

create table public.library_members (
  library_id uuid not null references public.libraries on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role public.library_role not null default 'member',
  -- Granular grants for members; owners implicitly hold every permission and this array is ignored.
  permissions public.library_permission[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (library_id, user_id)
);
create index library_members_user_idx on public.library_members (user_id);

create table public.library_invites (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries on delete cascade,
  code text not null unique,
  permissions public.library_permission[] not null default '{}',
  expires_at timestamptz not null,
  max_uses int not null default 1 check (max_uses between 1 and 100),
  uses int not null default 0,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index library_invites_library_idx on public.library_invites (library_id);

-- ─── Racks & shelves ────────────────────────────────────────────────────────

create table public.racks (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  notes text,
  position int,
  created_at timestamptz not null default now(),
  unique (id, library_id)
);
create index racks_library_idx on public.racks (library_id, position);

create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries on delete cascade,
  rack_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 60),
  notes text,
  position int,
  created_at timestamptz not null default now(),
  unique (id, library_id),
  foreign key (rack_id, library_id) references public.racks (id, library_id) on delete cascade
);
create index shelves_rack_idx on public.shelves (rack_id, position);

-- New racks/shelves go to the end of their list unless a position is given.
create function public.default_position() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.position is null then
    if tg_table_name = 'racks' then
      select coalesce(max(position), 0) + 1 into new.position from public.racks where library_id = new.library_id;
    else
      select coalesce(max(position), 0) + 1 into new.position from public.shelves where rack_id = new.rack_id;
    end if;
  end if;
  return new;
end
$$;
create trigger racks_position before insert on public.racks for each row execute function public.default_position();
create trigger shelves_position before insert on public.shelves for each row execute function public.default_position();

-- ─── Books ──────────────────────────────────────────────────────────────────

-- One row per physical copy. shelf_id is the book's home shelf: kept while borrowed or missing, cleared when archived.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries on delete cascade,
  isbn13 text check (isbn13 ~ '^97[89][0-9]{10}$'),
  isbn10 text check (isbn10 ~ '^[0-9]{9}[0-9X]$'),
  title text not null check (length(trim(title)) between 1 and 500),
  subtitle text,
  authors text[] not null default '{}',
  publisher text,
  published_year int check (published_year between 0 and 2200),
  pages int check (pages > 0),
  language text,
  description text,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  cover_path text,
  cover_url text,
  dominant_color text check (dominant_color ~ '^#[0-9A-Fa-f]{6}$'),
  color_name public.color_name,
  condition text,
  notes text,
  status public.book_status not null default 'on_shelf',
  shelf_id uuid,
  archived_at timestamptz,
  archive_reason text,
  donated_to text,
  last_seen_at timestamptz,
  added_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  authors_text text generated always as (public.immutable_array_to_string(authors, ' ')) stored,
  search tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(subtitle, '')), 'A')
    || setweight(to_tsvector('simple'::regconfig, public.immutable_array_to_string(authors, ' ')), 'B')
    || setweight(to_tsvector('simple'::regconfig,
         public.immutable_array_to_string(tags, ' ') || ' ' || public.immutable_array_to_string(categories, ' ')
         || ' ' || coalesce(publisher, '')), 'C')
    || setweight(to_tsvector('simple'::regconfig, coalesce(description, '')), 'D')
  ) stored,
  unique (id, library_id),
  foreign key (shelf_id, library_id) references public.shelves (id, library_id) on delete restrict,
  check ((status = 'archived') = (shelf_id is null))
);
create trigger books_touch before update on public.books for each row execute function public.touch_updated_at();
create index books_library_status_idx on public.books (library_id, status);
create index books_shelf_idx on public.books (shelf_id);
create index books_isbn_idx on public.books (library_id, isbn13);
create index books_search_idx on public.books using gin (search);
create index books_tags_idx on public.books using gin (tags);
create index books_title_trgm_idx on public.books using gin (title extensions.gin_trgm_ops);
create index books_authors_trgm_idx on public.books using gin (authors_text extensions.gin_trgm_ops);

-- ─── Loans ──────────────────────────────────────────────────────────────────

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries on delete cascade,
  book_id uuid not null,
  borrower_user_id uuid references public.profiles on delete set null,
  borrower_name text not null check (length(trim(borrower_name)) between 1 and 120),
  borrower_contact text,
  notes text,
  lent_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz,
  return_shelf_id uuid references public.shelves on delete set null,
  lent_by uuid references auth.users on delete set null,
  returned_by uuid references auth.users on delete set null,
  foreign key (book_id, library_id) references public.books (id, library_id) on delete cascade
);
create unique index loans_one_open_per_book on public.loans (book_id) where returned_at is null;
create index loans_library_open_idx on public.loans (library_id) where returned_at is null;

-- ─── Book history ───────────────────────────────────────────────────────────

create table public.book_events (
  id bigint generated always as identity primary key,
  library_id uuid not null references public.libraries on delete cascade,
  book_id uuid not null,
  type public.book_event_type not null,
  from_shelf_id uuid references public.shelves on delete set null,
  to_shelf_id uuid references public.shelves on delete set null,
  payload jsonb not null default '{}',
  actor uuid references auth.users on delete set null default auth.uid(),
  at timestamptz not null default now(),
  foreign key (book_id, library_id) references public.books (id, library_id) on delete cascade
);
create index book_events_book_idx on public.book_events (book_id, at desc);
create index book_events_library_idx on public.book_events (library_id, at desc);

-- ─── Audits ─────────────────────────────────────────────────────────────────

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries on delete cascade,
  mode public.audit_mode not null,
  shelf_id uuid references public.shelves on delete set null,
  sample_size int,
  started_by uuid references auth.users on delete set null default auth.uid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, library_id)
);
create index audits_library_idx on public.audits (library_id, started_at desc);

create table public.audit_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null,
  audit_id uuid not null,
  book_id uuid,
  expected_shelf_id uuid references public.shelves on delete set null,
  found_shelf_id uuid references public.shelves on delete set null,
  scanned_isbn text,
  result public.audit_result not null default 'pending',
  checked_at timestamptz,
  checked_by uuid references auth.users on delete set null,
  foreign key (audit_id, library_id) references public.audits (id, library_id) on delete cascade,
  foreign key (book_id, library_id) references public.books (id, library_id) on delete cascade
);
create index audit_items_audit_idx on public.audit_items (audit_id);
create unique index audit_items_book_once on public.audit_items (audit_id, book_id) where book_id is not null;

-- ─── AI providers (keys live in Vault; this table is never exposed to clients) ─

create table public.library_ai_providers (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries on delete cascade,
  provider public.ai_provider not null,
  model text not null check (length(trim(model)) between 1 and 200),
  base_url text check (base_url is null or base_url ~ '^https://'),
  secret_id uuid,
  supports_vision boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (library_id, provider),
  check (provider <> 'openai_compatible' or base_url is not null)
);

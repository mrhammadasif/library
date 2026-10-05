-- Row-level security. Reads: any member of the library. Writes: the matching granular permission
-- (owners hold all of them). State changes on books (status, shelf, loans, archive, audits) go only through
-- the RPCs in *_rpcs.sql, enforced here by column-level grants.

-- ─── Permission helpers ─────────────────────────────────────────────────────

create function public.is_member(lib uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.library_members m
    where m.library_id = lib and m.user_id = (select auth.uid())
  )
$$;

create function public.is_owner(lib uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.library_members m
    where m.library_id = lib and m.user_id = (select auth.uid()) and m.role = 'owner'
  )
$$;

create function public.has_permission(lib uuid, perm public.library_permission) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.library_members m
    where m.library_id = lib and m.user_id = (select auth.uid())
      and (m.role = 'owner' or perm = any (m.permissions))
  )
$$;

-- Raises 42501 with the missing permission in HINT so the app can say exactly what is missing.
create function public.require_permission(lib uuid, perm public.library_permission) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission(lib, perm) then
    raise exception 'You don''t have permission to do this (%)', perm
      using errcode = '42501', hint = perm::text;
  end if;
end
$$;

create function public.require_member(lib uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(lib) then
    raise exception 'Not a member of this library' using errcode = '42501';
  end if;
end
$$;

-- ─── Grants ─────────────────────────────────────────────────────────────────

revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles, public.libraries, public.library_members, public.library_invites,
  public.racks, public.shelves, public.books, public.loans, public.book_events, public.audits,
  public.audit_items to authenticated;

grant update (display_name) on public.profiles to authenticated;
grant update (name), delete on public.libraries to authenticated;
grant delete on public.library_invites to authenticated;
grant insert (library_id, name, notes, position), update (name, notes, position), delete on public.racks to authenticated;
grant insert (library_id, rack_id, name, notes, position), update (rack_id, name, notes, position), delete
  on public.shelves to authenticated;
grant update (isbn13, isbn10, title, subtitle, authors, publisher, published_year, pages, language, description,
  categories, tags, cover_path, cover_url, dominant_color, color_name, condition, notes), delete
  on public.books to authenticated;
-- library_ai_providers: no grants at all; read via list_ai_providers(), written via set_ai_provider().

-- ─── Policies ───────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.libraries enable row level security;
alter table public.library_members enable row level security;
alter table public.library_invites enable row level security;
alter table public.racks enable row level security;
alter table public.shelves enable row level security;
alter table public.books enable row level security;
alter table public.loans enable row level security;
alter table public.book_events enable row level security;
alter table public.audits enable row level security;
alter table public.audit_items enable row level security;
alter table public.library_ai_providers enable row level security;

-- Profiles: yourself, plus anyone you share a library with (member lists, borrower names).
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.library_members mine
    join public.library_members theirs on theirs.library_id = mine.library_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy libraries_select on public.libraries for select to authenticated using (public.is_member(id));
create policy libraries_update on public.libraries for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy libraries_delete on public.libraries for delete to authenticated using (public.is_owner(id));

create policy members_select on public.library_members for select to authenticated using (public.is_member(library_id));

create policy invites_select on public.library_invites for select to authenticated
  using (public.has_permission(library_id, 'members.manage'));
create policy invites_delete on public.library_invites for delete to authenticated
  using (public.has_permission(library_id, 'members.manage'));

create policy racks_select on public.racks for select to authenticated using (public.is_member(library_id));
create policy racks_insert on public.racks for insert to authenticated
  with check (public.has_permission(library_id, 'shelves.manage'));
create policy racks_update on public.racks for update to authenticated
  using (public.has_permission(library_id, 'shelves.manage'))
  with check (public.has_permission(library_id, 'shelves.manage'));
create policy racks_delete on public.racks for delete to authenticated
  using (public.has_permission(library_id, 'shelves.manage'));

create policy shelves_select on public.shelves for select to authenticated using (public.is_member(library_id));
create policy shelves_insert on public.shelves for insert to authenticated
  with check (public.has_permission(library_id, 'shelves.manage'));
create policy shelves_update on public.shelves for update to authenticated
  using (public.has_permission(library_id, 'shelves.manage'))
  with check (public.has_permission(library_id, 'shelves.manage'));
create policy shelves_delete on public.shelves for delete to authenticated
  using (public.has_permission(library_id, 'shelves.manage'));

create policy books_select on public.books for select to authenticated using (public.is_member(library_id));
create policy books_update on public.books for update to authenticated
  using (public.has_permission(library_id, 'books.edit'))
  with check (public.has_permission(library_id, 'books.edit'));
create policy books_delete on public.books for delete to authenticated
  using (public.has_permission(library_id, 'books.delete'));

create policy loans_select on public.loans for select to authenticated using (public.is_member(library_id));
create policy book_events_select on public.book_events for select to authenticated using (public.is_member(library_id));
create policy audits_select on public.audits for select to authenticated using (public.is_member(library_id));
create policy audit_items_select on public.audit_items for select to authenticated using (public.is_member(library_id));

-- RPCs: every state change on the library goes through here. Each function checks the caller's granular
-- permission first (require_permission → 42501 with the permission in HINT), runs in one transaction, and
-- records book history in book_events.

-- ─── Libraries & members ────────────────────────────────────────────────────

create function public.create_library(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.libraries (name, created_by) values (trim(p_name), v_uid) returning id into v_id;
  insert into public.library_members (library_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end
$$;

-- Permissions the caller holds in a library (all of them for owners).
create function public.caller_permissions(lib uuid) returns public.library_permission[]
language sql stable security definer set search_path = '' as $$
  select case when m.role = 'owner' then enum_range(null::public.library_permission) else m.permissions end
  from public.library_members m
  where m.library_id = lib and m.user_id = (select auth.uid())
$$;

-- 8-char invite code without look-alike characters (0/O, 1/I/L).
create function public.new_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end
$$;

create function public.create_invite(
  p_library uuid,
  p_permissions public.library_permission[],
  p_days int default 7,
  p_max_uses int default 1
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  perform public.require_permission(p_library, 'members.manage');
  if not (coalesce(p_permissions, '{}') <@ public.caller_permissions(p_library)) then
    raise exception 'You can only grant permissions you have yourself' using errcode = '42501';
  end if;
  if p_days not between 1 and 90 then
    raise exception 'Invite must expire within 1 to 90 days';
  end if;
  loop
    v_code := public.new_invite_code();
    exit when not exists (select 1 from public.library_invites where code = v_code);
  end loop;
  insert into public.library_invites (library_id, code, permissions, expires_at, max_uses)
  values (p_library, v_code, coalesce(p_permissions, '{}'), now() + make_interval(days => p_days), p_max_uses);
  return v_code;
end
$$;

create function public.accept_invite(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.library_invites;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into v_invite from public.library_invites
  where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;
  if not found or v_invite.expires_at < now() or v_invite.uses >= v_invite.max_uses then
    raise exception 'This invite code is invalid or has expired' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.library_members where library_id = v_invite.library_id and user_id = v_uid) then
    return v_invite.library_id;
  end if;
  insert into public.library_members (library_id, user_id, role, permissions)
  values (v_invite.library_id, v_uid, 'member', v_invite.permissions);
  update public.library_invites set uses = uses + 1 where id = v_invite.id;
  return v_invite.library_id;
end
$$;

-- Non-owners may only add or remove permissions they hold themselves, and never touch owners.
create function public.set_member_permissions(
  p_library uuid,
  p_user uuid,
  p_permissions public.library_permission[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.library_members;
  v_changed public.library_permission[];
begin
  perform public.require_permission(p_library, 'members.manage');
  select * into v_target from public.library_members where library_id = p_library and user_id = p_user for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'owner' then
    raise exception 'Owners always have every permission';
  end if;
  p_permissions := array(select distinct unnest(coalesce(p_permissions, '{}')) order by 1);
  if not public.is_owner(p_library) then
    v_changed := array(
      (select unnest(p_permissions) except select unnest(v_target.permissions))
      union
      (select unnest(v_target.permissions) except select unnest(p_permissions))
    );
    if not (v_changed <@ public.caller_permissions(p_library)) then
      raise exception 'You can only change permissions you have yourself' using errcode = '42501';
    end if;
  end if;
  update public.library_members set permissions = p_permissions where library_id = p_library and user_id = p_user;
end
$$;

-- Removes a member. Anyone may leave; removing someone else needs members.manage (owners: only by owners).
create function public.remove_member(p_library uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.library_members;
begin
  select * into v_target from public.library_members where library_id = p_library and user_id = p_user for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if p_user <> auth.uid() then
    perform public.require_permission(p_library, 'members.manage');
    if v_target.role = 'owner' and not public.is_owner(p_library) then
      raise exception 'Only owners can remove an owner' using errcode = '42501';
    end if;
  end if;
  if v_target.role = 'owner'
     and (select count(*) from public.library_members where library_id = p_library and role = 'owner') = 1 then
    raise exception 'A library needs at least one owner. Make someone else an owner first, or delete the library.';
  end if;
  delete from public.library_members where library_id = p_library and user_id = p_user;
end
$$;

-- Promote a member to owner, or demote an owner to a member that keeps every permission.
create function public.set_owner(p_library uuid, p_user uuid, p_owner boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(p_library) then
    raise exception 'Only owners can change ownership' using errcode = '42501';
  end if;
  if not exists (select 1 from public.library_members where library_id = p_library and user_id = p_user) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if not p_owner
     and (select count(*) from public.library_members where library_id = p_library and role = 'owner' and user_id <> p_user) = 0 then
    raise exception 'A library needs at least one owner';
  end if;
  update public.library_members
  set role = case when p_owner then 'owner'::public.library_role else 'member'::public.library_role end,
      permissions = case when p_owner then '{}'::public.library_permission[]
                         else enum_range(null::public.library_permission) end
  where library_id = p_library and user_id = p_user;
end
$$;

-- ─── Racks & shelves ────────────────────────────────────────────────────────

create function public.reorder_racks(p_library uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission(p_library, 'shelves.manage');
  update public.racks r set position = o.idx
  from unnest(p_ids) with ordinality as o(id, idx)
  where r.id = o.id and r.library_id = p_library;
end
$$;

create function public.reorder_shelves(p_rack uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_library uuid;
begin
  select library_id into v_library from public.racks where id = p_rack;
  if v_library is null then
    raise exception 'Rack not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_library, 'shelves.manage');
  update public.shelves s set position = o.idx
  from unnest(p_ids) with ordinality as o(id, idx)
  where s.id = o.id and s.rack_id = p_rack;
end
$$;

-- ─── Books ──────────────────────────────────────────────────────────────────

-- Adds a copy to a shelf. p_book holds metadata fields only (status/shelf are set here). An optional "id"
-- lets the app upload the cover to {library}/{id}.jpg before saving, so books.add alone is enough.
create function public.add_book(p_library uuid, p_shelf uuid, p_book jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.books;
  v_id uuid;
begin
  perform public.require_permission(p_library, 'books.add');
  if not exists (select 1 from public.shelves where id = p_shelf and library_id = p_library) then
    raise exception 'Choose a shelf in this library' using errcode = 'P0002';
  end if;
  r := jsonb_populate_record(null::public.books, p_book);
  insert into public.books (
    id, library_id, isbn13, isbn10, title, subtitle, authors, publisher, published_year, pages, language,
    description, categories, tags, cover_path, cover_url, dominant_color, color_name, condition, notes,
    status, shelf_id, last_seen_at, added_by
  ) values (
    coalesce(r.id, gen_random_uuid()), p_library, r.isbn13, r.isbn10, trim(r.title), r.subtitle,
    coalesce(r.authors, '{}'), r.publisher, r.published_year, r.pages, r.language, r.description,
    coalesce(r.categories, '{}'), coalesce(r.tags, '{}'), r.cover_path, r.cover_url, r.dominant_color,
    r.color_name, r.condition, r.notes, 'on_shelf', p_shelf, now(), auth.uid()
  ) returning id into v_id;
  insert into public.book_events (library_id, book_id, type, to_shelf_id)
  values (p_library, v_id, 'created', p_shelf);
  return v_id;
end
$$;

create function public.move_books(p_book_ids uuid[], p_shelf uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_library uuid;
  v_count int;
begin
  select library_id into v_library from public.shelves where id = p_shelf;
  if v_library is null then
    raise exception 'Shelf not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_library, 'books.move');
  with moved as (
    select b.id, b.shelf_id as from_shelf from public.books b
    where b.id = any (p_book_ids) and b.library_id = v_library and b.status <> 'archived'
      and b.shelf_id is distinct from p_shelf
    for update
  ), upd as (
    update public.books b set shelf_id = p_shelf from moved where b.id = moved.id returning b.id
  )
  insert into public.book_events (library_id, book_id, type, from_shelf_id, to_shelf_id)
  select v_library, moved.id, 'moved', moved.from_shelf, p_shelf from moved;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create function public.lend_book(
  p_book uuid,
  p_borrower_user uuid default null,
  p_borrower_name text default null,
  p_borrower_contact text default null,
  p_due_at timestamptz default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_book public.books;
  v_name text := nullif(trim(p_borrower_name), '');
  v_loan uuid;
begin
  select * into v_book from public.books where id = p_book for update;
  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_book.library_id, 'loans.manage');
  if v_book.status <> 'on_shelf' then
    raise exception 'Only books on a shelf can be lent (this one is %)', replace(v_book.status::text, '_', ' ');
  end if;
  if p_borrower_user is not null then
    if not exists (select 1 from public.library_members where library_id = v_book.library_id and user_id = p_borrower_user) then
      raise exception 'Borrower is not a member of this library';
    end if;
    v_name := coalesce(v_name, (select display_name from public.profiles where id = p_borrower_user));
  end if;
  if v_name is null then
    raise exception 'Who is borrowing the book?';
  end if;
  insert into public.loans (library_id, book_id, borrower_user_id, borrower_name, borrower_contact, due_at, notes, lent_by)
  values (v_book.library_id, p_book, p_borrower_user, v_name, nullif(trim(p_borrower_contact), ''), p_due_at,
          nullif(trim(p_notes), ''), auth.uid())
  returning id into v_loan;
  update public.books set status = 'borrowed' where id = p_book;
  insert into public.book_events (library_id, book_id, type, from_shelf_id, payload)
  values (v_book.library_id, p_book, 'lent', v_book.shelf_id,
          jsonb_build_object('loan_id', v_loan, 'borrower', v_name, 'due_at', p_due_at));
  return v_loan;
end
$$;

-- Returns a borrowed book to its home shelf, or to p_shelf if given.
create function public.return_book(p_book uuid, p_shelf uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_book public.books;
  v_shelf uuid;
begin
  select * into v_book from public.books where id = p_book for update;
  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_book.library_id, 'loans.manage');
  if v_book.status <> 'borrowed' then
    raise exception 'This book is not lent out';
  end if;
  v_shelf := coalesce(p_shelf, v_book.shelf_id);
  if p_shelf is not null and v_shelf <> v_book.shelf_id then
    perform public.require_permission(v_book.library_id, 'books.move');
  end if;
  update public.loans set returned_at = now(), returned_by = auth.uid(), return_shelf_id = v_shelf
  where book_id = p_book and returned_at is null;
  update public.books set status = 'on_shelf', shelf_id = v_shelf, last_seen_at = now() where id = p_book;
  insert into public.book_events (library_id, book_id, type, from_shelf_id, to_shelf_id)
  values (v_book.library_id, p_book, 'returned', v_book.shelf_id, v_shelf);
end
$$;

-- Moves books to the archive (donated by default), off their shelves, closing any open loan.
create function public.archive_books(
  p_book_ids uuid[],
  p_reason text default 'donated',
  p_recipient text default null,
  p_note text default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_libraries uuid[];
  v_library uuid;
  v_book record;
  v_count int := 0;
begin
  select array_agg(distinct library_id) into v_libraries from public.books where id = any (p_book_ids);
  if coalesce(cardinality(v_libraries), 0) <> 1 then
    raise exception 'Choose books from a single library' using errcode = 'P0002';
  end if;
  v_library := v_libraries[1];
  perform public.require_permission(v_library, 'books.archive');
  if p_reason not in ('donated', 'lost', 'discarded', 'other') then
    raise exception 'Unknown archive reason %', p_reason;
  end if;
  for v_book in
    select id, shelf_id from public.books where id = any (p_book_ids) and status <> 'archived' for update
  loop
    update public.loans set returned_at = now(), returned_by = auth.uid(),
      notes = concat_ws(' · ', notes, 'closed when archived')
    where book_id = v_book.id and returned_at is null;
    update public.books set status = 'archived', shelf_id = null, archived_at = now(), archive_reason = p_reason,
      donated_to = case when p_reason = 'donated' then nullif(trim(p_recipient), '') end
    where id = v_book.id;
    insert into public.book_events (library_id, book_id, type, from_shelf_id, payload)
    values (v_library, v_book.id, 'archived', v_book.shelf_id,
            jsonb_strip_nulls(jsonb_build_object('reason', p_reason, 'recipient', nullif(trim(p_recipient), ''),
                                                 'note', nullif(trim(p_note), ''))));
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

create function public.restore_book(p_book uuid, p_shelf uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_book public.books;
begin
  select * into v_book from public.books where id = p_book for update;
  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_book.library_id, 'books.archive');
  if v_book.status <> 'archived' then
    raise exception 'This book is not archived';
  end if;
  if not exists (select 1 from public.shelves where id = p_shelf and library_id = v_book.library_id) then
    raise exception 'Choose a shelf in this library' using errcode = 'P0002';
  end if;
  update public.books set status = 'on_shelf', shelf_id = p_shelf, archived_at = null, archive_reason = null,
    donated_to = null, last_seen_at = now()
  where id = p_book;
  insert into public.book_events (library_id, book_id, type, to_shelf_id)
  values (v_book.library_id, p_book, 'restored', p_shelf);
end
$$;

-- Someone spotted a missing book: back on its home shelf (or p_shelf, which also needs books.move).
create function public.mark_book_found(p_book uuid, p_shelf uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_book public.books;
begin
  select * into v_book from public.books where id = p_book for update;
  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_book.library_id, 'audits.run');
  if v_book.status <> 'missing' then
    raise exception 'This book is not missing';
  end if;
  if p_shelf is not null and p_shelf <> v_book.shelf_id then
    perform public.require_permission(v_book.library_id, 'books.move');
    if not exists (select 1 from public.shelves where id = p_shelf and library_id = v_book.library_id) then
      raise exception 'Choose a shelf in this library' using errcode = 'P0002';
    end if;
    insert into public.book_events (library_id, book_id, type, from_shelf_id, to_shelf_id)
    values (v_book.library_id, p_book, 'moved', v_book.shelf_id, p_shelf);
  end if;
  update public.books set status = 'on_shelf', shelf_id = coalesce(p_shelf, shelf_id), last_seen_at = now()
  where id = p_book;
  insert into public.book_events (library_id, book_id, type, payload)
  values (v_book.library_id, p_book, 'audited', jsonb_build_object('result', 'found'));
end
$$;

-- ─── Audits ─────────────────────────────────────────────────────────────────

-- random: p_size books, weighted toward those unseen the longest. shelf: every book expected on p_shelf.
create function public.start_audit(
  p_library uuid,
  p_mode public.audit_mode,
  p_size int default 10,
  p_shelf uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_audit uuid;
  v_count int;
begin
  perform public.require_permission(p_library, 'audits.run');
  if p_mode = 'shelf' and not exists (select 1 from public.shelves where id = p_shelf and library_id = p_library) then
    raise exception 'Choose a shelf to audit' using errcode = 'P0002';
  end if;
  if p_mode = 'random' and p_size not between 1 and 200 then
    raise exception 'Pick between 1 and 200 books';
  end if;
  insert into public.audits (library_id, mode, shelf_id, sample_size)
  values (p_library, p_mode, case when p_mode = 'shelf' then p_shelf end, case when p_mode = 'random' then p_size end)
  returning id into v_audit;

  if p_mode = 'random' then
    insert into public.audit_items (library_id, audit_id, book_id, expected_shelf_id)
    select p_library, v_audit, b.id, b.shelf_id
    from public.books b
    where b.library_id = p_library and b.status in ('on_shelf', 'missing')
    order by random() * (extract(epoch from now() - coalesce(b.last_seen_at, b.created_at)) + 86400) desc
    limit p_size;
  else
    insert into public.audit_items (library_id, audit_id, book_id, expected_shelf_id)
    select p_library, v_audit, b.id, b.shelf_id
    from public.books b
    where b.shelf_id = p_shelf and b.status in ('on_shelf', 'missing');
  end if;
  get diagnostics v_count = row_count;
  if p_mode = 'random' and v_count = 0 then
    raise exception 'There are no books on shelves to audit yet';
  end if;
  return v_audit;
end
$$;

-- Records one check. found/misplaced mark the book as seen (and un-missing); misplaced + p_move relocates it.
create function public.record_audit_item(
  p_item uuid,
  p_result public.audit_result,
  p_found_shelf uuid default null,
  p_move boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.audit_items;
  v_book public.books;
begin
  select i.* into v_item from public.audit_items i where i.id = p_item for update;
  if not found then
    raise exception 'Audit item not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_item.library_id, 'audits.run');
  if (select completed_at from public.audits where id = v_item.audit_id) is not null then
    raise exception 'This audit is already completed';
  end if;
  if p_result not in ('found', 'missing', 'misplaced', 'pending') then
    raise exception 'Unsupported result %', p_result;
  end if;
  if p_result = 'misplaced' and not exists (
    select 1 from public.shelves where id = p_found_shelf and library_id = v_item.library_id
  ) then
    raise exception 'Which shelf was the book on?' using errcode = 'P0002';
  end if;

  update public.audit_items set
    result = p_result,
    found_shelf_id = case when p_result = 'misplaced' then p_found_shelf
                          when p_result = 'found' then expected_shelf_id end,
    checked_at = case when p_result = 'pending' then null else now() end,
    checked_by = case when p_result = 'pending' then null else auth.uid() end
  where id = p_item;

  if p_result in ('found', 'misplaced') and v_item.book_id is not null then
    select * into v_book from public.books where id = v_item.book_id for update;
    update public.books set last_seen_at = now(),
      status = case when status = 'missing' then 'on_shelf'::public.book_status else status end
    where id = v_book.id;
    if p_result = 'misplaced' and p_move and v_book.shelf_id is distinct from p_found_shelf then
      perform public.require_permission(v_item.library_id, 'books.move');
      update public.books set shelf_id = p_found_shelf where id = v_book.id;
      insert into public.book_events (library_id, book_id, type, from_shelf_id, to_shelf_id, payload)
      values (v_item.library_id, v_book.id, 'moved', v_book.shelf_id, p_found_shelf,
              jsonb_build_object('audit_id', v_item.audit_id));
    end if;
  end if;
  if p_result <> 'pending' and v_item.book_id is not null then
    insert into public.book_events (library_id, book_id, type, payload)
    values (v_item.library_id, v_item.book_id, 'audited',
            jsonb_build_object('audit_id', v_item.audit_id, 'result', p_result));
  end if;
end
$$;

-- Shelf-inventory scanning: matches a scanned ISBN (or picked book) against the audit. Books expected here are
-- marked found; books from elsewhere (or unknown ISBNs) are recorded as 'unexpected' on this shelf.
create function public.record_audit_scan(
  p_audit uuid,
  p_isbn text default null,
  p_book uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_audit public.audits;
  v_item public.audit_items;
  v_book public.books;
  v_new uuid;
begin
  select * into v_audit from public.audits where id = p_audit;
  if not found then
    raise exception 'Audit not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_audit.library_id, 'audits.run');
  if v_audit.completed_at is not null then
    raise exception 'This audit is already completed';
  end if;

  -- Prefer a pending copy expected in this audit, then any other copy in the library.
  select i.* into v_item from public.audit_items i
  join public.books b on b.id = i.book_id
  where i.audit_id = p_audit and (b.id = p_book or (p_book is null and b.isbn13 = p_isbn))
  order by (i.result = 'pending') desc
  limit 1;
  if found then
    if v_item.result = 'pending' then
      perform public.record_audit_item(v_item.id, 'found');
    end if;
    return jsonb_build_object('item_id', v_item.id, 'book_id', v_item.book_id, 'result', 'found',
                              'already', v_item.result <> 'pending');
  end if;

  select * into v_book from public.books b
  where b.library_id = v_audit.library_id and b.status <> 'archived'
    and (b.id = p_book or (p_book is null and b.isbn13 = p_isbn))
  limit 1;
  insert into public.audit_items (library_id, audit_id, book_id, expected_shelf_id, found_shelf_id, scanned_isbn,
                                  result, checked_at, checked_by)
  values (v_audit.library_id, p_audit, v_book.id, v_book.shelf_id, v_audit.shelf_id, p_isbn,
          'unexpected', now(), auth.uid())
  returning id into v_new;
  if v_book.id is not null then
    update public.books set last_seen_at = now(),
      status = case when status = 'missing' then 'on_shelf'::public.book_status else status end
    where id = v_book.id;
    insert into public.book_events (library_id, book_id, type, payload)
    values (v_audit.library_id, v_book.id, 'audited',
            jsonb_build_object('audit_id', p_audit, 'result', 'unexpected', 'found_shelf_id', v_audit.shelf_id));
  end if;
  return jsonb_build_object('item_id', v_new, 'book_id', v_book.id, 'result', 'unexpected', 'already', false);
end
$$;

-- Unchecked items become missing, and their books are flagged missing until seen again.
create function public.complete_audit(p_audit uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_audit public.audits;
  v_book_id uuid;
begin
  select * into v_audit from public.audits where id = p_audit for update;
  if not found then
    raise exception 'Audit not found' using errcode = 'P0002';
  end if;
  perform public.require_permission(v_audit.library_id, 'audits.run');
  if v_audit.completed_at is not null then
    raise exception 'This audit is already completed';
  end if;
  update public.audit_items set result = 'missing', checked_at = now(), checked_by = auth.uid()
  where audit_id = p_audit and result = 'pending';
  for v_book_id in
    select i.book_id from public.audit_items i
    join public.books b on b.id = i.book_id
    where i.audit_id = p_audit and i.result = 'missing' and b.status = 'on_shelf'
  loop
    update public.books set status = 'missing' where id = v_book_id;
    insert into public.book_events (library_id, book_id, type, payload)
    values (v_audit.library_id, v_book_id, 'marked_missing', jsonb_build_object('audit_id', p_audit));
  end loop;
  update public.audits set completed_at = now() where id = p_audit;
  return (
    select jsonb_build_object(
      'found', count(*) filter (where result = 'found'),
      'missing', count(*) filter (where result = 'missing'),
      'misplaced', count(*) filter (where result = 'misplaced'),
      'unexpected', count(*) filter (where result = 'unexpected'))
    from public.audit_items where audit_id = p_audit
  );
end
$$;

-- ─── AI providers (keys in Vault) ───────────────────────────────────────────

create function public.list_ai_providers(p_library uuid)
returns table (provider public.ai_provider, model text, base_url text, supports_vision boolean, has_key boolean,
               updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_member(p_library);
  return query
    select p.provider, p.model, p.base_url, p.supports_vision, p.secret_id is not null, p.updated_at
    from public.library_ai_providers p where p.library_id = p_library order by p.provider;
end
$$;

-- Creates or updates a provider. p_api_key null/blank keeps the stored key (e.g. when only changing the model).
create function public.set_ai_provider(
  p_library uuid,
  p_provider public.ai_provider,
  p_model text,
  p_base_url text default null,
  p_api_key text default null,
  p_supports_vision boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.library_ai_providers;
  v_key text := nullif(trim(p_api_key), '');
  v_secret uuid;
begin
  perform public.require_permission(p_library, 'ai.manage');
  select * into v_row from public.library_ai_providers where library_id = p_library and provider = p_provider for update;
  if v_row.id is null and v_key is null then
    raise exception 'An API key is required';
  end if;
  v_secret := v_row.secret_id;
  if v_key is not null then
    if v_secret is null then
      v_secret := vault.create_secret(v_key, 'library-ai:' || p_library || ':' || p_provider,
                                      'AI provider key for a Home Library library');
    else
      perform vault.update_secret(v_secret, v_key);
    end if;
  end if;
  insert into public.library_ai_providers (library_id, provider, model, base_url, secret_id, supports_vision, updated_at)
  values (p_library, p_provider, trim(p_model),
          case when p_provider = 'openai_compatible' then rtrim(trim(p_base_url), '/') end,
          v_secret, p_provider <> 'openai_compatible' or coalesce(p_supports_vision, false), now())
  on conflict (library_id, provider) do update set
    model = excluded.model, base_url = excluded.base_url, secret_id = excluded.secret_id,
    supports_vision = excluded.supports_vision, updated_at = now();
end
$$;

create function public.delete_ai_provider(p_library uuid, p_provider public.ai_provider) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_secret uuid;
begin
  perform public.require_permission(p_library, 'ai.manage');
  delete from public.library_ai_providers where library_id = p_library and provider = p_provider
  returning secret_id into v_secret;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
  update public.libraries set
    enrich_provider = case when enrich_provider = p_provider then null else enrich_provider end,
    vision_provider = case when vision_provider = p_provider then null else vision_provider end
  where id = p_library;
end
$$;

-- Chooses which configured provider enriches metadata and which recognises cover photos (null = off).
create function public.set_ai_usage(
  p_library uuid,
  p_enrich public.ai_provider,
  p_vision public.ai_provider
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission(p_library, 'ai.manage');
  if p_enrich is not null and not exists (
    select 1 from public.library_ai_providers where library_id = p_library and provider = p_enrich
  ) then
    raise exception 'Set up % first', p_enrich;
  end if;
  if p_vision is not null and not exists (
    select 1 from public.library_ai_providers where library_id = p_library and provider = p_vision and supports_vision
  ) then
    raise exception '% is not set up for cover recognition', p_vision;
  end if;
  update public.libraries set enrich_provider = p_enrich, vision_provider = p_vision where id = p_library;
end
$$;

-- For edge functions only (service_role): the decrypted provider config for a purpose.
create function public.ai_config_for(p_library uuid, p_purpose text)
returns table (provider public.ai_provider, model text, base_url text, api_key text)
language sql stable security definer set search_path = '' as $$
  select p.provider, p.model, p.base_url, s.decrypted_secret
  from public.libraries l
  join public.library_ai_providers p
    on p.library_id = l.id
   and p.provider = case when p_purpose = 'vision' then l.vision_provider else l.enrich_provider end
  join vault.decrypted_secrets s on s.id = p.secret_id
  where l.id = p_library
$$;

-- ─── Search, tags & stats (security invoker: RLS limits rows to the caller's libraries) ─

create function public.search_books(
  p_library uuid,
  p_query text default null,
  p_tags text[] default null,
  p_color public.color_name default null,
  p_status public.book_status default null,
  p_shelf uuid default null,
  p_limit int default 40,
  p_offset int default 0
) returns setof public.books
language sql stable set search_path = '' as $$
  with q as (
    select nullif(trim(p_query), '') as text,
           case when nullif(trim(p_query), '') is null then null
                else websearch_to_tsquery('simple'::regconfig, trim(p_query)) end as ts,
           nullif(regexp_replace(coalesce(p_query, ''), '[^0-9Xx]', '', 'g'), '') as digits
  )
  select b.* from public.books b, q
  where b.library_id = p_library
    and (case when p_status is null then b.status <> 'archived' else b.status = p_status end)
    and (p_shelf is null or b.shelf_id = p_shelf)
    and (p_color is null or b.color_name = p_color)
    and (p_tags is null or cardinality(p_tags) = 0 or b.tags @> p_tags)
    and (
      q.text is null
      or b.search @@ q.ts
      or b.title ilike '%' || q.text || '%'
      or b.authors_text ilike '%' || q.text || '%'
      or extensions.similarity(b.title, q.text) > 0.3
      or extensions.similarity(b.authors_text, q.text) > 0.3
      or (length(q.digits) >= 10 and (b.isbn13 = upper(q.digits) or b.isbn10 = upper(q.digits)))
    )
  order by
    case when q.text is null then 0
         else greatest(ts_rank(b.search, q.ts), extensions.similarity(b.title, q.text),
                       extensions.similarity(b.authors_text, q.text)) end desc,
    b.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
$$;

create function public.list_tags(p_library uuid) returns table (tag text, books bigint)
language sql stable set search_path = '' as $$
  select t.tag, count(*) from public.books b, unnest(b.tags) as t(tag)
  where b.library_id = p_library and b.status <> 'archived'
  group by t.tag order by count(*) desc, t.tag
$$;

create function public.library_stats(p_library uuid) returns jsonb
language sql stable set search_path = '' as $$
  with active as (
    select * from public.books where library_id = p_library and status <> 'archived'
  )
  select jsonb_build_object(
    'total', (select count(*) from active),
    'archived', (select count(*) from public.books where library_id = p_library and status = 'archived'),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (
        select status, count(*) n from active group by status) s),
    'pages', (select coalesce(sum(pages), 0) from active),
    'authors', (select count(distinct a) from active, unnest(authors) a),
    'racks', (select coalesce(jsonb_agg(r order by r.position), '[]') from (
        select rk.id, rk.name, rk.position,
          (select count(*) from active b join public.shelves s on s.id = b.shelf_id where s.rack_id = rk.id) as books,
          (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
              'books', (select count(*) from active b where b.shelf_id = s.id)) order by s.position), '[]')
           from public.shelves s where s.rack_id = rk.id) as shelves
        from public.racks rk where rk.library_id = p_library) r),
    'top_authors', (select coalesce(jsonb_agg(jsonb_build_object('name', a, 'books', n)), '[]') from (
        select a, count(*) n from active, unnest(authors) a group by a order by n desc, a limit 8) x),
    'top_categories', (select coalesce(jsonb_agg(jsonb_build_object('name', c, 'books', n)), '[]') from (
        select c, count(*) n from active, unnest(categories) c group by c order by n desc, c limit 8) x),
    'top_tags', (select coalesce(jsonb_agg(jsonb_build_object('name', t, 'books', n)), '[]') from (
        select t, count(*) n from active, unnest(tags) t group by t order by n desc, t limit 12) x),
    'colors', (select coalesce(jsonb_agg(jsonb_build_object('color', color_name, 'books', n)), '[]') from (
        select color_name, count(*) n from active where color_name is not null group by color_name order by n desc) x),
    'languages', (select coalesce(jsonb_agg(jsonb_build_object('name', language, 'books', n)), '[]') from (
        select language, count(*) n from active where language is not null group by language order by n desc limit 6) x),
    'decades', (select coalesce(jsonb_agg(jsonb_build_object('decade', d, 'books', n) order by d), '[]') from (
        select (published_year / 10) * 10 d, count(*) n from active where published_year is not null group by 1) x),
    'added_by_month', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'books', n) order by m), '[]') from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*) n
        from public.books where library_id = p_library and created_at > now() - interval '12 months' group by 1) x),
    'loans', jsonb_build_object(
        'open', (select count(*) from public.loans where library_id = p_library and returned_at is null),
        'overdue', (select count(*) from public.loans
                    where library_id = p_library and returned_at is null and due_at < now()),
        'total', (select count(*) from public.loans where library_id = p_library)),
    'audit', jsonb_build_object(
        'last', (select jsonb_build_object('id', a.id, 'completed_at', a.completed_at, 'mode', a.mode,
                    'found', count(*) filter (where i.result in ('found', 'misplaced')),
                    'missing', count(*) filter (where i.result = 'missing'),
                    'total', count(*) filter (where i.result <> 'unexpected'))
                 from public.audits a join public.audit_items i on i.audit_id = a.id
                 where a.id = (select id from public.audits where library_id = p_library and completed_at is not null
                               order by completed_at desc limit 1)
                 group by a.id),
        'unseen_year', (select count(*) from active
                        where coalesce(last_seen_at, created_at) < now() - interval '1 year'))
  )
$$;

-- ─── Function privileges ────────────────────────────────────────────────────

revoke execute on function public.ai_config_for(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_config_for(uuid, text) to service_role;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

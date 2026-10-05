-- Tenant isolation, granular permissions and the book state machine. Run with: npm run test:db
-- TEST DATA ONLY: fake users, libraries and books, rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true);
$$;

-- Data-modifying CTEs can't be nested in pgTAP calls, so count affected rows through EXECUTE instead.
create function pg_temp.rows_affected(p_sql text) returns int language plpgsql as $$
declare
  n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

select plan(63);

-- ─── Fixtures (as postgres) ─────────────────────────────────────────────────
-- o = owner, l = lender (loans.manage), a = auditor (audits.run), m = manager (members.manage + books.add), x = outsider

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', 'authenticated', 'authenticated', '{"display_name":"Olive"}'),
  ('00000000-0000-0000-0000-00000000000b', 'lender@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'auditor@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'manager@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'outsider@test.local', 'authenticated', 'authenticated', '{}');

select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Olive',
  'profile display name comes from sign-up metadata');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'lender',
  'profile display name falls back to the email name');

insert into public.libraries (id, name, created_by) values
  ('11111111-0000-0000-0000-000000000001', 'Home', '00000000-0000-0000-0000-00000000000a'),
  ('11111111-0000-0000-0000-000000000002', 'Office', '00000000-0000-0000-0000-00000000000e');
insert into public.library_members (library_id, user_id, role, permissions) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner', '{}'),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member', '{loans.manage}'),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member', '{audits.run}'),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'member', '{members.manage,books.add}'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000e', 'owner', '{}');
insert into public.racks (id, library_id, name) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Living room'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Office rack');
insert into public.shelves (id, library_id, rack_id, name) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Top'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Middle'),
  ('33333333-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Desk');

select is((select position from public.shelves where id = '33333333-0000-0000-0000-000000000002'), 2,
  'new shelves are appended to the end of their rack');
select throws_ok(
  $$insert into public.shelves (library_id, rack_id, name)
    values ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'Cross')$$,
  '23503', null, 'a shelf cannot hang off another library''s rack');

-- ─── Owner adds books ───────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select lives_ok($$select public.add_book('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
  '{"id":"44444444-0000-0000-0000-000000000001","title":"Dune","authors":["Frank Herbert"],"isbn13":"9780441172719","tags":["scifi","classic"]}')$$,
  'owner can add a book');
select lives_ok($$select public.add_book('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
  '{"id":"44444444-0000-0000-0000-000000000002","title":"The Hobbit","authors":["J. R. R. Tolkien"],"tags":["fantasy","classic"],"status":"archived"}')$$,
  'add_book ignores status in the payload');
select lives_ok($$select public.add_book('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002',
  '{"id":"44444444-0000-0000-0000-000000000003","title":"Clean Code","authors":["Robert C. Martin"]}')$$,
  'owner can add a third book');
select is((select status::text from public.books where id = '44444444-0000-0000-0000-000000000002'), 'on_shelf',
  'new books are on the shelf');
select is((select count(*)::int from public.book_events where type = 'created'), 3, 'adding books records history');
select throws_ok($$select public.add_book('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000009',
  '{"title":"Wrong shelf"}')$$, 'P0002', null, 'books cannot be put on another library''s shelf');

select is((select count(*)::int from public.search_books('11111111-0000-0000-0000-000000000001', 'dune')), 1,
  'search finds a book by title');
select is((select count(*)::int from public.search_books('11111111-0000-0000-0000-000000000001', 'tolk')), 1,
  'search matches partial author names');
select is((select count(*)::int from public.search_books('11111111-0000-0000-0000-000000000001', null, array['classic'])), 2,
  'search filters by tag');
select is((select count(*)::int from public.search_books('11111111-0000-0000-0000-000000000001', '978-0441172719')), 1,
  'search finds a book by ISBN with dashes');
select is((public.library_stats('11111111-0000-0000-0000-000000000001') ->> 'total')::int, 3, 'stats count active books');

-- ─── Tenant isolation ───────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.books), 0, 'outsider sees no books from another library');
select is((select count(*)::int from public.libraries), 1, 'outsider sees only their own library');
select is((select count(*)::int from public.profiles), 1, 'outsider sees only their own profile');
select throws_ok($$select public.lend_book('44444444-0000-0000-0000-000000000001', null, 'Eve')$$, '42501', null,
  'outsider cannot lend a book');
select throws_ok($$select public.list_ai_providers('11111111-0000-0000-0000-000000000001')$$, '42501', null,
  'outsider cannot list AI providers');

-- ─── Lender: loans.manage only ──────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.books), 3, 'members can read every book in their library');
select is((select count(*)::int from public.profiles), 4, 'members see profiles of fellow members');
select lives_ok($$select public.lend_book('44444444-0000-0000-0000-000000000001', null, 'Neighbour Sam', '0300', now() - interval '1 day')$$,
  'lender can lend');
select is((select status::text from public.books where id = '44444444-0000-0000-0000-000000000001'), 'borrowed',
  'lent book is borrowed');
select throws_ok($$select public.lend_book('44444444-0000-0000-0000-000000000001', null, 'Someone else')$$, 'P0001', null,
  'a borrowed book cannot be lent again');
select is((public.library_stats('11111111-0000-0000-0000-000000000001') -> 'loans' ->> 'overdue')::int, 1,
  'stats count overdue loans');
select lives_ok($$select public.return_book('44444444-0000-0000-0000-000000000001')$$, 'lender can return');
select is((select shelf_id::text from public.books where id = '44444444-0000-0000-0000-000000000001'),
  '33333333-0000-0000-0000-000000000001', 'returned book goes back to its home shelf');
select is((select count(*)::int from public.loans where returned_at is null), 0, 'returning closes the loan');
select throws_ok($$select public.return_book('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002')$$,
  'P0001', null, 'a book on the shelf cannot be returned');
select throws_ok($$select public.move_books(array['44444444-0000-0000-0000-000000000001']::uuid[], '33333333-0000-0000-0000-000000000002')$$,
  '42501', null, 'lender cannot move books');
select throws_ok($$select public.start_audit('11111111-0000-0000-0000-000000000001', 'random', 2)$$, '42501', null,
  'lender cannot audit');
select throws_ok($$select public.add_book('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '{"title":"X"}')$$,
  '42501', null, 'lender cannot add books');
select throws_ok($$select public.archive_books(array['44444444-0000-0000-0000-000000000001']::uuid[])$$, '42501', null,
  'lender cannot donate');
select is(pg_temp.rows_affected($$update public.books set title = 'Hacked' where id = '44444444-0000-0000-0000-000000000001'$$),
  0, 'lender cannot edit book metadata');
select throws_ok($$update public.books set status = 'archived' where id = '44444444-0000-0000-0000-000000000001'$$,
  '42501', null, 'nobody can change book status directly');
select throws_ok($$insert into public.racks (library_id, name) values ('11111111-0000-0000-0000-000000000001', 'R')$$,
  '42501', null, 'lender cannot create racks');

-- ─── Auditor: audits.run only ───────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$select public.lend_book('44444444-0000-0000-0000-000000000002', null, 'Sam')$$, '42501', null,
  'auditor cannot lend');
select lives_ok($$select public.start_audit('11111111-0000-0000-0000-000000000001', 'shelf', null, '33333333-0000-0000-0000-000000000001')$$,
  'auditor can start a shelf audit');
select is((select count(*)::int from public.audit_items), 2, 'shelf audit expects every book on the shelf');
select is((select public.record_audit_scan((select id from public.audits limit 1), '9780441172719') ->> 'result'), 'found',
  'scanning an expected book marks it found');
select is((select public.record_audit_scan((select id from public.audits limit 1), null,
  '44444444-0000-0000-0000-000000000003') ->> 'result'), 'unexpected', 'a book from another shelf is unexpected');
select is((public.complete_audit((select id from public.audits limit 1)) ->> 'missing')::int, 1,
  'completing an audit marks unchecked books missing');
select is((select status::text from public.books where id = '44444444-0000-0000-0000-000000000002'), 'missing',
  'unchecked book is flagged missing');
select throws_ok($$select public.move_books(array['44444444-0000-0000-0000-000000000003']::uuid[], '33333333-0000-0000-0000-000000000001')$$,
  '42501', null, 'auditor cannot move books');
select lives_ok($$select public.mark_book_found('44444444-0000-0000-0000-000000000002')$$, 'auditor can mark a missing book found');
select is((select status::text from public.books where id = '44444444-0000-0000-0000-000000000002'), 'on_shelf',
  'a found book is back on its shelf');

-- ─── Manager: members.manage + books.add ────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select lives_ok($$select public.create_invite('11111111-0000-0000-0000-000000000001', '{books.add}')$$,
  'manager can invite with permissions they hold');
select throws_ok($$select public.create_invite('11111111-0000-0000-0000-000000000001', '{ai.manage}')$$, '42501', null,
  'manager cannot invite with permissions they lack');
select throws_ok($$select public.set_member_permissions('11111111-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000b', '{loans.manage,audits.run}')$$, '42501', null,
  'manager cannot grant a permission they lack');
select lives_ok($$select public.set_member_permissions('11111111-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000b', '{loans.manage,books.add}')$$, 'manager can grant a permission they hold');
select throws_ok($$select public.set_member_permissions('11111111-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000a', '{}')$$, 'P0001', null, 'owners cannot be given a permission set');
select throws_ok($$select public.remove_member('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'a non-owner cannot remove an owner');

-- ─── Invites ────────────────────────────────────────────────────────────────

reset role;
insert into public.library_invites (library_id, code, permissions, expires_at) values
  ('11111111-0000-0000-0000-000000000001', 'OLDCODE1', '{books.add}', now() - interval '1 minute'),
  ('11111111-0000-0000-0000-000000000001', 'GOODCODE', '{audits.run}', now() + interval '1 day');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select throws_ok($$select public.accept_invite('OLDCODE1')$$,
  'P0002', null, 'expired invites are rejected');
select is(public.accept_invite('good-code')::text, '11111111-0000-0000-0000-000000000001',
  'invite codes are accepted case- and dash-insensitively');
select is((select permissions::text from public.library_members
  where user_id = '00000000-0000-0000-0000-00000000000e' and library_id = '11111111-0000-0000-0000-000000000001'),
  '{audits.run}', 'joining grants the invite''s permissions');
reset role;
select is((select uses from public.library_invites where code = 'GOODCODE'), 1, 'accepting an invite uses it up');
set local role authenticated;

-- ─── Owner: archive, AI keys, last owner ────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.archive_books(array['44444444-0000-0000-0000-000000000003']::uuid[], 'donated', 'School library')$$,
  'owner can donate');
select is((select shelf_id from public.books where id = '44444444-0000-0000-0000-000000000003'), null,
  'donated book leaves its shelf');
select lives_ok($$select public.set_ai_provider('11111111-0000-0000-0000-000000000001', 'openai', 'gpt-test', null, 'sk-test-123')$$,
  'owner can store an AI key');
select throws_ok($$select secret_id from public.library_ai_providers$$, '42501', null, 'clients cannot read the AI provider table');
select throws_ok($$select * from public.ai_config_for('11111111-0000-0000-0000-000000000001', 'enrich')$$, '42501', null,
  'clients cannot read decrypted AI keys');
select throws_ok($$select public.remove_member('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a')$$,
  'P0001', null, 'the last owner cannot leave');

select * from finish();
rollback;

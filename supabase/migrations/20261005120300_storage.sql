-- Cover images: public-read bucket (book covers aren't sensitive; public URLs cache well) at {library_id}/{book_id}.jpg.
-- Writes need books.add or books.edit in the library named by the first path segment.
-- Guarded so the migration also applies to a bare Postgres test container without the storage schema.

create function public.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end
$$;

create function public.can_write_cover(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    public.has_permission(public.try_uuid(split_part(p_name, '/', 1)), 'books.add')
    or public.has_permission(public.try_uuid(split_part(p_name, '/', 1)), 'books.edit'),
    false)
$$;

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping covers bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('covers', 'covers', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  -- Upserts (re-taking a cover) need SELECT as well; the bucket is public anyway.
  execute $p$create policy covers_select on storage.objects for select to authenticated
    using (bucket_id = 'covers')$p$;
  execute $p$create policy covers_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'covers' and public.can_write_cover(name))$p$;
  execute $p$create policy covers_update on storage.objects for update to authenticated
    using (bucket_id = 'covers' and public.can_write_cover(name))
    with check (bucket_id = 'covers' and public.can_write_cover(name))$p$;
  execute $p$create policy covers_delete on storage.objects for delete to authenticated
    using (bucket_id = 'covers' and public.can_write_cover(name))$p$;
end
$$;

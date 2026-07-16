-- ArtVault Discover Open Display curation
-- Administrators can select and order up to six works for the public Discover salon.

alter table public.artworks
  add column if not exists discover_display_rank smallint;

alter table public.artworks
  drop constraint if exists artworks_discover_display_rank_check;

alter table public.artworks
  add constraint artworks_discover_display_rank_check
  check (discover_display_rank is null or discover_display_rank between 1 and 6);

create unique index if not exists artworks_discover_display_rank_unique
  on public.artworks (discover_display_rank)
  where discover_display_rank is not null;

comment on column public.artworks.discover_display_rank is
  'Optional global 1-6 position in the administrator-curated Discover Open Display.';

create or replace function public.set_discover_display(artwork_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_count integer := cardinality(coalesce(artwork_ids, '{}'::uuid[]));
  matching_count integer;
begin
  if not private.is_staff() then
    raise exception 'Only staff members can curate the Discover display.'
      using errcode = '42501';
  end if;

  if requested_count > 6 then
    raise exception 'The Discover display supports no more than six artworks.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(artwork_ids, '{}'::uuid[])) as requested(id)
    where requested.id is null
  ) then
    raise exception 'Artwork identifiers cannot be null.'
      using errcode = '22023';
  end if;

  if requested_count <> (
    select count(distinct requested.id)
    from unnest(coalesce(artwork_ids, '{}'::uuid[])) as requested(id)
  ) then
    raise exception 'Each artwork can appear only once in the Discover display.'
      using errcode = '22023';
  end if;

  select count(*)
  into matching_count
  from public.artworks
  where id = any(coalesce(artwork_ids, '{}'::uuid[]));

  if matching_count <> requested_count then
    raise exception 'One or more selected artworks no longer exist.'
      using errcode = 'P0002';
  end if;

  update public.artworks
  set discover_display_rank = null
  where discover_display_rank is not null;

  update public.artworks as artwork
  set discover_display_rank = requested.position::smallint
  from unnest(coalesce(artwork_ids, '{}'::uuid[])) with ordinality as requested(id, position)
  where artwork.id = requested.id;
end;
$$;

revoke all on function public.set_discover_display(uuid[]) from public, anon;
grant execute on function public.set_discover_display(uuid[]) to authenticated;

comment on function public.set_discover_display(uuid[]) is
  'Atomically replaces the public Discover display order after verifying the caller is staff; artwork RLS remains enforced.';

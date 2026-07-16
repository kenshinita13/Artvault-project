-- ArtVault profile showcase
-- Allows each profile owner to curate up to four owned artworks in a stable order.

alter table public.artworks
  add column if not exists profile_featured_rank smallint;

alter table public.artworks
  drop constraint if exists artworks_profile_featured_rank_check;

alter table public.artworks
  add constraint artworks_profile_featured_rank_check
  check (profile_featured_rank is null or profile_featured_rank between 1 and 4);

create unique index if not exists artworks_user_featured_rank_unique
  on public.artworks (user_id, profile_featured_rank)
  where profile_featured_rank is not null;

comment on column public.artworks.profile_featured_rank is
  'Optional 1-4 position for an artwork featured on its owner profile.';

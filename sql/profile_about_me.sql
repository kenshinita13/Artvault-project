-- ArtVault public profile biography
-- Profile owners can edit this field through the existing owner-scoped profile RLS policy.

alter table public.profiles
  add column if not exists about_me text,
  add column if not exists profile_summary text;

alter table public.profiles
  drop constraint if exists profiles_about_me_length_check;

alter table public.profiles
  add constraint profiles_about_me_length_check
  check (about_me is null or char_length(about_me) <= 1000);

alter table public.profiles
  drop constraint if exists profiles_profile_summary_length_check;

alter table public.profiles
  add constraint profiles_profile_summary_length_check
  check (profile_summary is null or char_length(profile_summary) <= 320);

comment on column public.profiles.about_me is
  'Optional owner-authored public profile biography, limited to 1,000 characters.';

comment on column public.profiles.profile_summary is
  'Optional owner-authored profile introduction, limited to 320 characters.';

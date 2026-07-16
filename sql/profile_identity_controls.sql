-- ArtVault administrator-controlled public profile identity
-- Verification and professional titles are public, but only active administrators may change them.

alter table public.profiles
  add column if not exists profile_title text,
  add column if not exists is_verified boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_profile_title_length_check;

alter table public.profiles
  add constraint profiles_profile_title_length_check
  check (
    profile_title is null
    or char_length(btrim(profile_title)) between 2 and 60
  );

create or replace function private.protect_profile_authorization_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or private.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only administrators can change account roles.' using errcode = '42501';
  end if;

  if new.profile_title is distinct from old.profile_title
     or new.is_verified is distinct from old.is_verified then
    raise exception 'Only administrators can change public profile identity fields.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     or new.suspension_end is distinct from old.suspension_end then
    if not (
      old.status = 'suspended'
      and old.suspension_end <= now()
      and new.status = 'active'
      and new.suspension_end is null
    ) then
      raise exception 'Only administrators can change account restrictions.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on column public.profiles.profile_title is
  'Optional administrator-assigned public professional title.';

comment on column public.profiles.is_verified is
  'Whether an administrator has granted this profile the public ArtVault verification badge.';

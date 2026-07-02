create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  raw_username text;
  candidate_username text;
  suffix integer := 0;
  requested_role text;
begin
  profile_name := nullif(
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      'ArtVault Member'
    ),
    ''
  );

  raw_username := lower(
    regexp_replace(
      coalesce(
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'preferred_username',
        split_part(new.email, '@', 1),
        'member'
      ),
      '[^a-zA-Z0-9_]+',
      '_',
      'g'
    )
  );
  raw_username := trim(both '_' from raw_username);

  if raw_username = '' then
    raw_username := 'member';
  end if;

  candidate_username := left(raw_username, 28);
  while exists (
    select 1
    from public.profiles
    where username = candidate_username
  ) loop
    suffix := suffix + 1;
    candidate_username := left(raw_username, greatest(1, 27 - length(suffix::text))) || '_' || suffix::text;
  end loop;

  requested_role := new.raw_user_meta_data->>'role';

  insert into public.profiles (id, name, username, role)
  values (
    new.id,
    profile_name,
    candidate_username,
    case
      when requested_role in ('admin', 'moderator', 'curator', 'artist', 'user') then requested_role
      else 'user'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

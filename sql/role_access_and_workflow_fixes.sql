-- ArtVault role access and workflow hardening
-- Keeps UI role checks aligned with database-enforced authorization.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (
        status = 'active'
        or (status = 'suspended' and suspension_end <= now())
      )
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and (
        status = 'active'
        or (status = 'suspended' and suspension_end <= now())
      )
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'moderator')
      and (
        status = 'active'
        or (status = 'suspended' and suspension_end <= now())
      )
  );
$$;

create or replace function private.is_curator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'curator'
      and (
        status = 'active'
        or (status = 'suspended' and suspension_end <= now())
      )
  );
$$;

create or replace function private.can_upload()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('artist', 'curator')
      and (
        status = 'active'
        or (status = 'suspended' and suspension_end <= now())
      )
  );
$$;

revoke all on function private.is_active_account() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_curator() from public;
revoke all on function private.can_upload() from public;
grant execute on function private.is_active_account() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_curator() to authenticated;
grant execute on function private.can_upload() to authenticated;

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

-- Public signup may request only the two roles displayed by the registration UI.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

  raw_username := lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'preferred_username',
      split_part(new.email, '@', 1),
      'member'
    ),
    '[^a-zA-Z0-9_]+',
    '_',
    'g'
  ));
  raw_username := trim(both '_' from raw_username);
  if raw_username = '' then raw_username := 'member'; end if;

  candidate_username := left(raw_username, 28);
  while exists (
    select 1 from public.profiles where username = candidate_username
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
    case when requested_role in ('artist', 'user') then requested_role else 'user' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Prevent owners from changing their own role or restriction status through the API.
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

drop trigger if exists protect_profile_authorization_fields on public.profiles;
create trigger protect_profile_authorization_fields
before update on public.profiles
for each row execute function private.protect_profile_authorization_fields();

-- Profiles
drop policy if exists "Public profiles are viewable" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "Users can insert a safe own profile" on public.profiles;
drop policy if exists "Owners or admins can update profiles" on public.profiles;

create policy "Public profiles are viewable"
on public.profiles for select
to anon, authenticated
using (true);

create policy "Users can insert a safe own profile"
on public.profiles for insert
to authenticated
with check (
  (select auth.uid()) = id
  and role in ('artist', 'user')
  and status = 'active'
  and suspension_end is null
);

create policy "Owners or admins can update profiles"
on public.profiles for update
to authenticated
using (
  ((select auth.uid()) = id and private.is_active_account())
  or private.is_admin()
)
with check ((select auth.uid()) = id or private.is_admin());

-- Artworks
drop policy if exists "Owner or staff can delete artworks" on public.artworks;
drop policy if exists "Users can delete their own artworks." on public.artworks;
drop policy if exists "Admins can insert artworks" on public.artworks;
drop policy if exists "Artists and curators can upload artworks" on public.artworks;
drop policy if exists "Users can insert their own artworks." on public.artworks;
drop policy if exists "Artworks are publicly viewable" on public.artworks;
drop policy if exists "Artworks are viewable by everyone." on public.artworks;
drop policy if exists "Owner or staff can update artworks" on public.artworks;
drop policy if exists "Artists and curators can register own artworks" on public.artworks;
drop policy if exists "Admins can register artworks for users" on public.artworks;
drop policy if exists "Owners and staff can update artworks" on public.artworks;
drop policy if exists "Owners, staff, or curators can update artworks" on public.artworks;
drop policy if exists "Owners and staff can delete artworks" on public.artworks;
drop policy if exists "Uploaders or admins can register artworks" on public.artworks;

create policy "Artworks are publicly viewable"
on public.artworks for select
to anon, authenticated
using (true);

create policy "Uploaders or admins can register artworks"
on public.artworks for insert
to authenticated
with check (
  (private.can_upload() and (select auth.uid()) = user_id)
  or private.is_admin()
);

create policy "Owners, staff, or curators can update artworks"
on public.artworks for update
to authenticated
using (
  ((select auth.uid()) = user_id and private.is_active_account())
  or private.is_staff()
  or private.is_curator()
)
with check (
  ((select auth.uid()) = user_id and private.is_active_account())
  or private.is_staff()
  or private.is_curator()
);

-- Ownership transfer remains an administrator-only operation even for staff and curators.
create or replace function private.protect_artwork_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'Only administrators can transfer artwork ownership.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_artwork_owner on public.artworks;
create trigger protect_artwork_owner
before update on public.artworks
for each row execute function private.protect_artwork_owner();

create policy "Owners and staff can delete artworks"
on public.artworks for delete
to authenticated
using (((select auth.uid()) = user_id and private.is_active_account()) or private.is_staff());

-- Categories and artwork/category relationships
drop policy if exists "Categories are publicly viewable" on public.categories;
create policy "Categories are publicly viewable"
on public.categories for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert artwork categories" on public.artwork_categories;
drop policy if exists "Artwork categories are publicly viewable" on public.artwork_categories;
drop policy if exists "Owners and admins can tag artworks" on public.artwork_categories;
drop policy if exists "Owners and admins can untag artworks" on public.artwork_categories;
drop policy if exists "Owners, admins, or curators can tag artworks" on public.artwork_categories;
drop policy if exists "Owners, admins, or curators can untag artworks" on public.artwork_categories;
drop policy if exists "Owners, staff, or curators can tag artworks" on public.artwork_categories;
drop policy if exists "Owners, staff, or curators can untag artworks" on public.artwork_categories;
create policy "Artwork categories are publicly viewable"
on public.artwork_categories for select
to anon, authenticated
using (true);

create policy "Owners, staff, or curators can tag artworks"
on public.artwork_categories for insert
to authenticated
with check (
  private.is_staff()
  or private.is_curator()
  or exists (
    select 1 from public.artworks
    where artworks.id = artwork_categories.artwork_id
      and artworks.user_id = (select auth.uid())
      and private.can_upload()
  )
);

create policy "Owners, staff, or curators can untag artworks"
on public.artwork_categories for delete
to authenticated
using (
  private.is_staff()
  or private.is_curator()
  or exists (
    select 1 from public.artworks
    where artworks.id = artwork_categories.artwork_id
      and artworks.user_id = (select auth.uid())
      and private.can_upload()
  )
);

-- Portfolio ownership and admin management
drop policy if exists "Admins can manage all boards" on public.boards;
drop policy if exists "Admins can insert boards" on public.boards;
drop policy if exists "Users can insert own boards" on public.boards;
drop policy if exists "Users can update own boards" on public.boards;
drop policy if exists "Users can delete own boards" on public.boards;
drop policy if exists "Active users can insert own boards" on public.boards;
drop policy if exists "Active users can update own boards" on public.boards;
drop policy if exists "Active users can delete own boards" on public.boards;
drop policy if exists "Owners or admins can insert boards" on public.boards;
drop policy if exists "Owners or admins can update boards" on public.boards;
drop policy if exists "Owners or admins can delete boards" on public.boards;
create policy "Owners or admins can insert boards"
on public.boards for insert to authenticated
with check (
  ((select auth.uid()) = user_id and private.is_active_account())
  or private.is_admin()
);
create policy "Owners or admins can update boards"
on public.boards for update to authenticated
using (
  ((select auth.uid()) = user_id and private.is_active_account())
  or private.is_admin()
)
with check (
  ((select auth.uid()) = user_id and private.is_active_account())
  or private.is_admin()
);
create policy "Owners or admins can delete boards"
on public.boards for delete to authenticated
using (
  ((select auth.uid()) = user_id and private.is_active_account())
  or private.is_admin()
);

drop policy if exists "Admins can manage all board items" on public.board_items;
drop policy if exists "Admins can insert board items" on public.board_items;
drop policy if exists "Users can add items to their own boards" on public.board_items;
drop policy if exists "Users can remove items from their own boards" on public.board_items;
drop policy if exists "Active users can add items to own boards" on public.board_items;
drop policy if exists "Active users can remove items from own boards" on public.board_items;
drop policy if exists "Owners or admins can add board items" on public.board_items;
drop policy if exists "Owners or admins can remove board items" on public.board_items;
create policy "Owners or admins can add board items"
on public.board_items for insert to authenticated
with check (
  (
    private.is_active_account()
    and exists (
      select 1 from public.boards
      where boards.id = board_items.board_id
        and boards.user_id = (select auth.uid())
    )
  )
  or private.is_admin()
);
create policy "Owners or admins can remove board items"
on public.board_items for delete to authenticated
using (
  (
    private.is_active_account()
    and exists (
      select 1 from public.boards
      where boards.id = board_items.board_id
        and boards.user_id = (select auth.uid())
    )
  )
  or private.is_admin()
);

drop policy if exists "Anyone can view public boards" on public.boards;
drop policy if exists "Anyone can view permitted boards" on public.boards;
create policy "Anyone can view permitted boards"
on public.boards for select to public
using (is_private = false or (select auth.uid()) = user_id or private.is_admin());

drop policy if exists "Anyone can view items in public boards" on public.board_items;
drop policy if exists "Anyone can view permitted board items" on public.board_items;
create policy "Anyone can view permitted board items"
on public.board_items for select to public
using (
  private.is_admin()
  or
  exists (
    select 1 from public.boards
    where boards.id = board_items.board_id
      and (boards.is_private = false or boards.user_id = (select auth.uid()))
  )
);

-- Reports
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports drop constraint if exists reports_artwork_id_fkey;
alter table public.reports
  add constraint reports_artwork_id_fkey
  foreign key (artwork_id) references public.artworks(id) on delete set null;

drop policy if exists "Logged in users can create reports" on public.reports;
drop policy if exists "Users can insert their own reports" on public.reports;
drop policy if exists "Admins can view all reports" on public.reports;
drop policy if exists "Staff can view all reports" on public.reports;
drop policy if exists "Admins can update reports" on public.reports;
drop policy if exists "Staff can update reports" on public.reports;
drop policy if exists "Active users can create own reports" on public.reports;
drop policy if exists "Staff can view reports" on public.reports;

create policy "Active users can create own reports"
on public.reports for insert to authenticated
with check ((select auth.uid()) = reporter_id and private.is_active_account());
create policy "Staff can view reports"
on public.reports for select to authenticated
using (private.is_staff());
create policy "Staff can update reports"
on public.reports for update to authenticated
using (private.is_staff())
with check (private.is_staff());

-- Notifications are trigger-created and visible only to their recipient.
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can view own notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id and private.is_active_account());
create policy "Users can update own notifications"
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id and private.is_active_account())
with check ((select auth.uid()) = user_id);
create policy "Users can delete own notifications"
on public.notifications for delete to authenticated
using ((select auth.uid()) = user_id and private.is_active_account());

-- Likes and comments must come from the signed-in, active account.
drop policy if exists "Authenticated users can like" on public.likes;
drop policy if exists "Users can unlike their own" on public.likes;
drop policy if exists "Active users can like" on public.likes;
drop policy if exists "Active users can unlike own likes" on public.likes;
create policy "Active users can like"
on public.likes for insert to authenticated
with check ((select auth.uid()) = user_id and private.is_active_account());
create policy "Active users can unlike own likes"
on public.likes for delete to authenticated
using ((select auth.uid()) = user_id and private.is_active_account());
drop policy if exists "Authenticated users can comment" on public.comments;
drop policy if exists "Users can delete their own comments" on public.comments;
drop policy if exists "Active users can comment" on public.comments;
drop policy if exists "Active users can delete own comments" on public.comments;
create policy "Active users can comment"
on public.comments for insert to authenticated
with check ((select auth.uid()) = user_id and private.is_active_account());
create policy "Active users can delete own comments"
on public.comments for delete to authenticated
using ((select auth.uid()) = user_id and private.is_active_account());

-- Audit logs remain append-only for users and readable only by administrators.
drop policy if exists "Staff can insert audit logs" on public.audit_logs;
drop policy if exists "Users can insert their own logs" on public.audit_logs;
drop policy if exists "Admins can view all logs" on public.audit_logs;
drop policy if exists "Only admins can view audit logs" on public.audit_logs;
drop policy if exists "Users can append own audit logs" on public.audit_logs;
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Users can append own audit logs"
on public.audit_logs for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Admins can view audit logs"
on public.audit_logs for select to authenticated
using (private.is_admin());

-- Trigger helpers are internal-only and use a fixed search path.
alter function public.handle_new_like() set search_path = '';
alter function public.handle_new_comment() set search_path = '';
alter function public.enforce_artvault_auth_email() set search_path = '';
alter function public.is_artvault_allowed_email(text) set search_path = '';
revoke all on function public.handle_new_like() from public, anon, authenticated;
revoke all on function public.handle_new_comment() from public, anon, authenticated;
revoke all on function public.enforce_artvault_auth_email() from public, anon, authenticated;
revoke all on function public.is_artvault_allowed_email(text) from public, anon, authenticated;

drop function if exists public.is_admin();
drop function if exists public.is_staff();
drop function if exists public.can_upload();

-- Storage: enforce the agreed 10 MB image limit and ownership paths.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
where id = 'artworks';

drop policy if exists "Authenticated users can upload an artwork." on storage.objects;
drop policy if exists "Users can delete their own artworks." on storage.objects;
drop policy if exists "Artwork images are publicly accessible." on storage.objects;
drop policy if exists "Authorized users can upload artwork files" on storage.objects;
drop policy if exists "Owners and admins can replace artwork files" on storage.objects;
drop policy if exists "Owners and staff can delete artwork files" on storage.objects;

create policy "Authorized users can upload artwork files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'artworks'
  and (
    private.is_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and (
        name = (select auth.uid())::text || '/avatar'
        or private.can_upload()
      )
    )
  )
);

create policy "Owners and admins can replace artwork files"
on storage.objects for update to authenticated
using (
  bucket_id = 'artworks'
  and (
    private.is_admin()
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
)
with check (
  bucket_id = 'artworks'
  and (
    private.is_admin()
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

create policy "Owners and staff can delete artwork files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'artworks'
  and (
    private.is_staff()
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);

-- Foreign-key and feed indexes for the expected 10,000-record catalog.
create index if not exists artworks_user_id_idx on public.artworks(user_id);
create index if not exists artworks_created_at_idx on public.artworks(created_at desc);
create index if not exists artwork_categories_category_id_idx on public.artwork_categories(category_id);
create index if not exists boards_user_id_idx on public.boards(user_id);
create index if not exists board_items_artwork_id_idx on public.board_items(artwork_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists comments_artwork_id_idx on public.comments(artwork_id);
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists likes_user_id_idx on public.likes(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_actor_id_idx on public.notifications(actor_id);
create index if not exists notifications_artwork_id_idx on public.notifications(artwork_id);
create index if not exists reports_artwork_id_idx on public.reports(artwork_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists reports_reviewed_by_idx on public.reports(reviewed_by);
create index if not exists reports_status_created_at_idx on public.reports(status, created_at desc);

notify pgrst, 'reload schema';

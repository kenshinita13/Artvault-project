create or replace function public.is_artvault_allowed_email(input_email text)
returns boolean
language plpgsql
stable
as $$
declare
  normalized_email text := lower(trim(coalesce(input_email, '')));
  email_domain text;
  tld text;
begin
  if normalized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return false;
  end if;

  email_domain := split_part(normalized_email, '@', 2);
  tld := reverse(split_part(reverse(email_domain), '.', 1));

  if email_domain in ('artvault.com') then
    return true;
  end if;

  if email_domain in (
    '10minutemail.com', '20minutemail.com', 'mailinator.com', 'guerrillamail.com',
    'guerrillamail.net', 'tempmail.com', 'temp-mail.org', 'throwawaymail.com',
    'yopmail.com', 'sharklasers.com', 'getairmail.com', 'trashmail.com',
    'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'emailondeck.com',
    'moakt.com', 'mohmal.com'
  ) then
    return false;
  end if;

  if email_domain !~ '^[a-z0-9.-]+$' or email_domain like '%.%' = false or email_domain like '%..%' then
    return false;
  end if;

  if tld !~ '^[a-z]{2,24}$' then
    return false;
  end if;

  if email_domain in (
    'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
    'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'zohomail.com',
    'gmx.com', 'gmx.net', 'mail.com', 'fastmail.com', 'tutanota.com', 'tuta.com',
    'hey.com', 'pm.me', 'live.com.ph', 'yahoo.com.ph'
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.enforce_artvault_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_artvault_allowed_email(new.email) then
    raise exception 'Please use a valid non-temporary email address.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_artvault_auth_email_before_insert on auth.users;
create trigger enforce_artvault_auth_email_before_insert
before insert on auth.users
for each row execute function public.enforce_artvault_auth_email();

drop trigger if exists enforce_artvault_auth_email_before_update on auth.users;
create trigger enforce_artvault_auth_email_before_update
before update of email on auth.users
for each row execute function public.enforce_artvault_auth_email();

-- Apply to the dedicated Plan B project using Supabase's SQL editor.
-- Access to data is mediated by verified-user Next.js routes. The privileged
-- key stays server-side; browser roles have no direct table or RPC grants.
create table public.planb_households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  state jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.planb_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.planb_households(id) on delete cascade
);
create index planb_memberships_household_idx on public.planb_memberships(household_id);
create table public.planb_invites (
  token_hash text primary key,
  household_id uuid not null references public.planb_households(id) on delete cascade,
  member_id text not null,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  unique(household_id,member_id)
);
alter table public.planb_households enable row level security;
alter table public.planb_memberships enable row level security;
alter table public.planb_invites enable row level security;
revoke all on public.planb_households,public.planb_memberships,public.planb_invites from anon,authenticated;
grant all on public.planb_households,public.planb_memberships,public.planb_invites to service_role;

create function public.planb_create_household(p_user_id uuid,p_state jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid;
begin
  insert into public.planb_households(owner_id,state) values(p_user_id,p_state) returning id into new_id;
  insert into public.planb_memberships(user_id,household_id) values(p_user_id,new_id);
  return new_id;
end;
$$;

create function public.planb_accept_invite(p_token_hash text,p_user_id uuid,p_email text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare invitation public.planb_invites%rowtype; household public.planb_households%rowtype; updated_members jsonb; target jsonb;
begin
  select * into invitation from public.planb_invites where token_hash=p_token_hash for update;
  if not found or invitation.used_at is not null or invitation.expires_at<=now() or lower(invitation.email)<>lower(p_email) then raise exception 'Invalid invitation'; end if;
  if exists(select 1 from public.planb_memberships where user_id=p_user_id) then raise exception 'Already a household member'; end if;
  select * into household from public.planb_households where id=invitation.household_id for update;
  select value into target from jsonb_array_elements(household.state->'members') where value->>'id'=invitation.member_id;
  if target is null or target->>'userId' is not null or lower(target->>'email')<>lower(p_email) then raise exception 'Invalid member'; end if;
  select jsonb_agg(case when value->>'id'=invitation.member_id then value||jsonb_build_object('userId',p_user_id::text) else value end order by ordinal)
    into updated_members from jsonb_array_elements(household.state->'members') with ordinality as items(value,ordinal);
  update public.planb_households set state=jsonb_set(state,'{members}',updated_members),version=version+1,updated_at=now() where id=household.id;
  insert into public.planb_memberships(user_id,household_id) values(p_user_id,household.id);
  update public.planb_invites set used_at=now() where token_hash=p_token_hash;
  return household.id;
end;
$$;
revoke all on function public.planb_create_household(uuid,jsonb),public.planb_accept_invite(text,uuid,text) from public,anon,authenticated;
grant execute on function public.planb_create_household(uuid,jsonb),public.planb_accept_invite(text,uuid,text) to service_role;

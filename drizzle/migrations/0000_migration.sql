create type public.app_role as enum ('admin','worker');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "members read profiles" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "members read roles" on public.user_roles for select to authenticated using (true);
create policy "owner manages roles ins" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "owner manages roles upd" on public.user_roles for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "owner manages roles del" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin') and user_id <> auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'worker');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Batches
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  crop text not null default 'Lettuce',
  variety text,
  seeded_on date not null default current_date,
  seeds_sown int,
  germinated int,
  transplanted_on date,
  plant_count int,
  expected_harvest date,
  harvested_on date,
  status text not null default 'nursery' check (status in ('nursery','growing','harvested')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.daily_checks (
  id uuid primary key default gen_random_uuid(),
  check_date date not null default current_date,
  check_time time not null default localtime,
  user_id uuid not null default auth.uid(),
  batch_id uuid references public.batches(id) on delete set null,
  tank_level text,
  tank_debris boolean not null default false,
  water_source text not null default 'rain' check (water_source in ('rain','tap')),
  ec numeric, ph numeric, water_temp numeric, air_temp numeric, humidity numeric,
  automation_ok boolean not null default true,
  ppe_worn boolean not null default true,
  gh_defects boolean not null default false, gh_defects_notes text,
  insects boolean not null default false, insects_notes text,
  leaks boolean not null default false, leaks_notes text,
  flow_ok boolean not null default true,
  germination_notes text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.growth_measurements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  check_id uuid references public.daily_checks(id) on delete cascade,
  plant_no int not null check (plant_no between 1 and 10),
  measured_on date not null default current_date,
  height_cm numeric,
  leaf_count int,
  created_at timestamptz not null default now(),
  unique (batch_id, plant_no, measured_on)
);

create table public.quality_inspections (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete cascade,
  check_id uuid references public.daily_checks(id) on delete cascade,
  inspected_on date not null default current_date,
  inspected_count int not null default 25,
  healthy int not null default 25,
  macro_deficiency int not null default 0,
  micro_deficiency int not null default 0,
  insect_damage int not null default 0,
  disease int not null default 0,
  tipburn int not null default 0,
  other int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.harvests (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  harvested_on date not null default current_date,
  plants_harvested int not null default 0,
  total_weight_kg numeric not null default 0,
  avg_leaf_count numeric,
  grade_a int not null default 0,
  grade_b int not null default 0,
  grade_c int not null default 0,
  rejected int not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Nutrients',
  unit text not null default 'kg',
  quantity numeric not null default 0,
  reorder_level numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  change numeric not null,
  reason text,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.apply_inventory_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.inventory_items set quantity = quantity + new.change where id = new.item_id;
  return new;
end; $$;
create trigger inventory_movement_applied after insert on public.inventory_movements for each row execute function public.apply_inventory_movement();

create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('filter','inventory')),
  done_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  notes text
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  tx_date date not null default current_date,
  kind text not null check (kind in ('income','expense')),
  category text not null,
  amount numeric not null check (amount >= 0),
  description text,
  batch_id uuid references public.batches(id) on delete set null,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['batches','daily_checks','growth_measurements','quality_inspections','harvests','inventory_items','inventory_movements','maintenance_logs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "members insert" on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy "members update" on public.%I for update to authenticated using (true)', t);
    execute format('create policy "owner delete" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''admin''))', t);
  end loop;
end $$;

grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "owner all tx" on public.transactions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- EP FINANCE V1.6 - NOTIFICAÇÕES

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{
    "bills3Days": true,
    "bills1Day": true,
    "billsOverdue": true,
    "budget80": true,
    "budget100": true,
    "weeklySummary": false,
    "investmentReminder": false
  }'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "users read own push subscriptions" on public.push_subscriptions;
drop policy if exists "users insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "users update own push subscriptions" on public.push_subscriptions;
drop policy if exists "users delete own push subscriptions" on public.push_subscriptions;

create policy "users read own push subscriptions"
on public.push_subscriptions for select
using (auth.uid() = user_id);

create policy "users insert own push subscriptions"
on public.push_subscriptions for insert
with check (auth.uid() = user_id);

create policy "users update own push subscriptions"
on public.push_subscriptions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users delete own push subscriptions"
on public.push_subscriptions for delete
using (auth.uid() = user_id);

drop policy if exists "users read own notification preferences" on public.notification_preferences;
drop policy if exists "users insert own notification preferences" on public.notification_preferences;
drop policy if exists "users update own notification preferences" on public.notification_preferences;

create policy "users read own notification preferences"
on public.notification_preferences for select
using (auth.uid() = user_id);

create policy "users insert own notification preferences"
on public.notification_preferences for insert
with check (auth.uid() = user_id);

create policy "users update own notification preferences"
on public.notification_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

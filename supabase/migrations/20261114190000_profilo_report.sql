-- Profilo pubblico esteso (rank, ultimo online), segnalazioni delle aree, dettaglio area pubblico.

-- 1) Ultimo online nel profilo.
alter table public.profiles add column if not exists last_seen timestamptz;

create or replace function public.touch_seen(p_user uuid) returns void
language sql set search_path = '' as $$
  update public.profiles set last_seen = now() where id = p_user
$$;

-- 2) Segnalazioni. Motivi: spam, offensive, scam, impersonation, other.
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  area_id bigint not null references public.areas (id) on delete cascade,
  reporter uuid not null references public.profiles (id),
  reason text not null check (reason in ('spam', 'offensive', 'scam', 'impersonation', 'other')),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (area_id, reporter) -- una segnalazione per utente per area
);
create index if not exists reports_area on public.reports (area_id);
alter table public.reports enable row level security; -- nessuna policy: solo service_role
revoke all on public.reports from public, anon, authenticated;
grant all on public.reports to service_role;

-- Invia/aggiorna una segnalazione. L'autore non può segnalare la propria area.
create or replace function public.submit_report(p_reporter uuid, p_area bigint, p_reason text, p_note text) returns boolean
language plpgsql set search_path = '' as $$
declare v_owner uuid;
begin
  select owner into v_owner from public.areas where id = p_area and status = 'active';
  if v_owner is null then raise exception 'area-inesistente'; end if;
  if v_owner = p_reporter then raise exception 'area-propria'; end if;
  insert into public.reports (area_id, reporter, reason, note)
  values (p_area, p_reporter, p_reason, nullif(trim(p_note), ''))
  on conflict (area_id, reporter) do update set reason = excluded.reason, note = excluded.note, created_at = now();
  return true;
end $$;

-- Riepilogo segnalazioni per l'admin: aree attive con almeno una segnalazione, ordinate per numero.
create or replace function public.reports_summary(p_limit int default 100)
returns table (area_id bigint, reports bigint, reasons text, owner uuid, username text, email text,
               x int, y int, w int, h int, image_path text, message text, link text)
language sql stable set search_path = '' as $$
  select a.id, count(r.id), string_agg(distinct r.reason, ', ' order by r.reason),
         a.owner, p.username, p.email, a.x, a.y, a.w, a.h, a.image_path, a.message, a.link
  from public.reports r
  join public.areas a on a.id = r.area_id and a.status = 'active'
  join public.profiles p on p.id = a.owner
  group by a.id, a.owner, p.username, p.email
  order by count(r.id) desc, max(r.created_at) desc
  limit p_limit
$$;

-- 3) Dettaglio pubblico di un'area: profilo, rank di sempre, ultimo online, messaggio, coordinate.
create or replace function public.area_detail(p_id bigint)
returns table (id bigint, x int, y int, w int, h int, image_path text, link text, message text,
               username text, owner_pixels bigint, owner_areas bigint, rank bigint, last_seen timestamptz, member_since timestamptz)
language sql stable set search_path = '' as $$
  with ranked as (
    select user_id, rank() over (order by sum(paid_pixels) desc) as r
    from public.orders where status = 'paid' and paid_pixels > 0 group by user_id
  )
  select a.id, a.x, a.y, a.w, a.h, a.image_path, a.link, a.message,
         coalesce(p.username, 'anonimo'),
         (select coalesce(sum(w * h), 0)::bigint from public.areas where owner = a.owner and status = 'active'),
         (select count(*)::bigint from public.areas where owner = a.owner and status = 'active'),
         rk.r, p.last_seen, p.created_at
  from public.areas a
  join public.profiles p on p.id = a.owner
  left join ranked rk on rk.user_id = a.owner
  where a.id = p_id and a.status = 'active'
$$;

revoke all on function public.touch_seen(uuid), public.submit_report(uuid, bigint, text, text),
  public.reports_summary(int), public.area_detail(bigint) from public, anon, authenticated;
grant execute on function public.touch_seen(uuid), public.submit_report(uuid, bigint, text, text),
  public.reports_summary(int), public.area_detail(bigint) to service_role;

-- 4) Libera automaticamente le aree bloccate da checkout abbandonati, anche senza traffico.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('rilascio-scaduti', '* * * * *', 'select public.release_expired()');
  end if;
exception when others then
  raise notice 'pg_cron non disponibile: pianifica release_expired da Supabase Scheduled o Vercel Cron';
end $$;

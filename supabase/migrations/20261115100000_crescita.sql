-- Crescita: conteggio click in uscita per area (ROI per sponsor) + rank/click nel dettaglio pubblico.

alter table public.areas add column if not exists clicks int not null default 0;

-- Incrementa i click e restituisce il link dell'area attiva (o null). Usato dalla rotta /r/[id].
create or replace function public.bump_click(p_id bigint) returns text
language sql set search_path = '' as $$
  update public.areas set clicks = clicks + 1 where id = p_id and status = 'active' returning link
$$;

revoke all on function public.bump_click(bigint) from public, anon, authenticated;
grant execute on function public.bump_click(bigint) to service_role;

-- area_detail: aggiunge i click (prova sociale + ROI). Drop perché cambia il tipo di ritorno.
drop function if exists public.area_detail(bigint);
create or replace function public.area_detail(p_id bigint)
returns table (id bigint, x int, y int, w int, h int, image_path text, link text, message text,
               username text, owner_pixels bigint, owner_areas bigint, rank bigint, last_seen timestamptz, member_since timestamptz, clicks int)
language sql stable set search_path = '' as $$
  with ranked as (
    select user_id, rank() over (order by sum(paid_pixels) desc) as r
    from public.orders where status = 'paid' and paid_pixels > 0 group by user_id
  )
  select a.id, a.x, a.y, a.w, a.h, a.image_path, a.link, a.message,
         coalesce(p.username, 'anonimo'),
         (select coalesce(sum(w * h), 0)::bigint from public.areas where owner = a.owner and status = 'active'),
         (select count(*)::bigint from public.areas where owner = a.owner and status = 'active'),
         rk.r, p.last_seen, p.created_at, a.clicks
  from public.areas a
  join public.profiles p on p.id = a.owner
  left join ranked rk on rk.user_id = a.owner
  where a.id = p_id and a.status = 'active'
$$;

revoke all on function public.area_detail(bigint) from public, anon, authenticated;
grant execute on function public.area_detail(bigint) to service_role;

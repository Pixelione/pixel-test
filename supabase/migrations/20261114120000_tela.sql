-- PIXELIONE pixel-test: tela 1000x1000, aree con immagine, ordini Stripe, crediti (pixel omaggio), classifica.
-- Accesso solo dal server con la chiave segreta (service_role): RLS attiva, nessuna policy pubblica.
-- Le regole di prezzo e bonus stanno qui, in un posto solo, dentro transazioni.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text unique check (username ~ '^[A-Za-z0-9_.-]{3,20}$'),
  ref_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  referred_by uuid references public.profiles (id),
  early_bird boolean not null default false, -- iscritto alla lista d'attesa prima del lancio
  created_at timestamptz not null default now()
);

create table public.areas (
  id bigint generated always as identity primary key,
  owner uuid not null references public.profiles (id),
  x int not null check (x >= 0),
  y int not null check (y >= 0),
  w int not null check (w >= 1),
  h int not null check (h >= 1),
  image_path text not null,
  link text check (link is null or (link ~ '^https?://' and length(link) <= 500)),
  message text check (message is null or char_length(message) <= 100),
  status text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  expires_at timestamptz, -- solo per 'pending': blocco durante il checkout
  removed_reason text,
  created_at timestamptz not null default now(),
  check (x + w <= 1000 and y + h <= 1000),
  -- Coordinate incluse (x .. x+w-1): due aree vicine non si toccano. Nessuna doppia vendita possibile.
  constraint areas_no_overlap exclude using gist (box(point(x, y), point(x + w - 1, y + h - 1)) with &&)
    where (status <> 'removed')
);
create index areas_owner on public.areas (owner);

create table public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  area_id bigint not null references public.areas (id),
  pixels int not null check (pixels > 0),
  credits_used int not null check (credits_used >= 0),
  paid_pixels int not null check (paid_pixels >= 0),
  bonus_pixels int not null default 0,
  amount_cents int not null check (amount_cents >= 0), -- totale addebitato (pixel + commissione)
  fee_cents int not null check (fee_cents >= 0),
  stripe_session_id text unique,
  stripe_payment_intent text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (pixels = credits_used + paid_pixels)
);
create index orders_user on public.orders (user_id);
create index orders_paid_at on public.orders (paid_at) where status = 'paid';

-- Movimenti dei crediti (1 credito = 1 pixel). Il saldo è la somma.
create table public.credits (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  delta int not null,
  reason text not null check (reason in ('spent', 'released', 'bonus', 'early_bird', 'referral', 'clawback', 'admin_refund', 'manual')),
  order_id bigint references public.orders (id),
  area_id bigint references public.areas (id),
  created_at timestamptz not null default now()
);
create index credits_user on public.credits (user_id);
-- Idempotenza: ogni accredito legato a un ordine o a un'area avviene una volta sola.
create unique index credits_once_per_order on public.credits (order_id, reason) where order_id is not null;
create unique index credits_once_per_area on public.credits (area_id, reason) where area_id is not null;

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.orders enable row level security;
alter table public.credits enable row level security;
revoke all on public.profiles, public.areas, public.orders, public.credits from public, anon, authenticated;
grant all on public.profiles, public.areas, public.orders, public.credits to service_role;
grant usage, select on all sequences in schema public to service_role;

create function public.credit_balance(p_user uuid) returns int
language sql stable set search_path = '' as $$
  select coalesce(sum(delta), 0)::int from public.credits where user_id = p_user
$$;

-- Libera le aree bloccate da checkout scaduti e restituisce i crediti usati.
create function public.release_expired() returns int
language plpgsql set search_path = '' as $$
declare o record; n int := 0;
begin
  for o in
    select ord.id from public.orders ord join public.areas a on a.id = ord.area_id
    where ord.status = 'pending' and a.status = 'pending' and a.expires_at < now()
    for update of ord skip locked
  loop
    perform public.expire_order(o.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Prenota un'area e crea l'ordine. Usa prima i crediti, il resto si paga.
-- Commissione aggiunta al totale: totale = ceil((pixel*prezzo + fisso) / (1 - percentuale)).
create function public.reserve_area(
  p_user uuid, p_x int, p_y int, p_w int, p_h int,
  p_image_path text, p_link text, p_message text,
  p_price_cents int, p_fee_percent numeric, p_fee_fixed_cents int, p_lock_minutes int
) returns json
language plpgsql set search_path = '' as $$
declare
  v_balance int; v_pixels int := p_w * p_h; v_credits int; v_paid int;
  v_total int := 0; v_fee int := 0; v_area bigint; v_order bigint;
begin
  perform public.release_expired();
  perform 1 from public.profiles where id = p_user for update; -- un acquisto alla volta per utente: saldo coerente
  if not found then raise exception 'profilo-mancante'; end if;

  v_balance := greatest(public.credit_balance(p_user), 0);
  v_credits := least(v_balance, v_pixels);
  v_paid := v_pixels - v_credits;
  if v_paid > 0 then
    v_total := ceil((v_paid * p_price_cents + p_fee_fixed_cents) / (1 - p_fee_percent / 100.0))::int;
    v_fee := v_total - v_paid * p_price_cents;
  end if;

  insert into public.areas (owner, x, y, w, h, image_path, link, message, status, expires_at)
  values (p_user, p_x, p_y, p_w, p_h, p_image_path, nullif(p_link, ''), nullif(p_message, ''), 'pending',
          now() + make_interval(mins => p_lock_minutes))
  returning id into v_area;

  insert into public.orders (user_id, area_id, pixels, credits_used, paid_pixels, amount_cents, fee_cents)
  values (p_user, v_area, v_pixels, v_credits, v_paid, v_total, v_fee)
  returning id into v_order;

  if v_credits > 0 then
    insert into public.credits (user_id, delta, reason, order_id) values (p_user, -v_credits, 'spent', v_order);
  end if;

  if v_paid = 0 then
    perform public.complete_order(v_order, null, null); -- tutto coperto dai crediti: niente Stripe
  end if;

  return json_build_object('area_id', v_area, 'order_id', v_order, 'pixels', v_pixels, 'credits_used', v_credits,
    'paid_pixels', v_paid, 'amount_cents', v_total, 'fee_cents', v_fee);
end $$;

-- Pagamento confermato (webhook o pagina di ritorno). Idempotente: true solo la prima volta.
-- Bonus: 1 pixel ogni 5 pagati, +1 al primo acquisto (minimo 5 pagati) per gli iscritti pre-lancio,
-- 5 pixel a chi ha invitato, al primo acquisto pagato dell'invitato.
create function public.complete_order(p_order bigint, p_session text, p_payment_intent text) returns boolean
language plpgsql set search_path = '' as $$
declare o public.orders; p public.profiles; v_first boolean; v_bonus int; v_early int := 0;
begin
  update public.orders set status = 'paid', paid_at = now(),
    stripe_session_id = coalesce(p_session, stripe_session_id),
    stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent)
  where id = p_order and status = 'pending'
  returning * into o;
  if not found then return false; end if;

  update public.areas set status = 'active', expires_at = null where id = o.area_id;
  select * into p from public.profiles where id = o.user_id;

  v_first := o.paid_pixels > 0 and not exists (
    select 1 from public.orders where user_id = o.user_id and status in ('paid', 'refunded') and paid_pixels > 0 and id <> o.id);

  v_bonus := o.paid_pixels / 5;
  if v_bonus > 0 then
    insert into public.credits (user_id, delta, reason, order_id) values (o.user_id, v_bonus, 'bonus', o.id);
  end if;
  if v_first and p.early_bird and o.paid_pixels >= 5 then
    v_early := 1;
    insert into public.credits (user_id, delta, reason, order_id) values (o.user_id, 1, 'early_bird', o.id);
  end if;
  if v_first and p.referred_by is not null then
    insert into public.credits (user_id, delta, reason, order_id) values (p.referred_by, 5, 'referral', o.id);
  end if;

  update public.orders set bonus_pixels = v_bonus + v_early where id = o.id;
  return true;
end $$;

-- Checkout scaduto o fallito: area libera, crediti restituiti.
create function public.expire_order(p_order bigint) returns boolean
language plpgsql set search_path = '' as $$
declare o public.orders;
begin
  update public.orders set status = 'expired' where id = p_order and status = 'pending' returning * into o;
  if not found then return false; end if;
  update public.areas set status = 'removed', removed_reason = 'checkout-scaduto' where id = o.area_id and status = 'pending';
  if o.credits_used > 0 then
    insert into public.credits (user_id, delta, reason, order_id) values (o.user_id, o.credits_used, 'released', o.id);
  end if;
  return true;
end $$;

-- Rimborso o chargeback: area di nuovo libera, crediti usati restituiti, bonus ripresi.
create function public.refund_order(p_order bigint) returns boolean
language plpgsql set search_path = '' as $$
declare o public.orders;
begin
  update public.orders set status = 'refunded' where id = p_order and status = 'paid' returning * into o;
  if not found then return false; end if;
  update public.areas set status = 'removed', removed_reason = 'rimborso' where id = o.area_id and status <> 'removed';
  if o.credits_used > 0 then
    insert into public.credits (user_id, delta, reason, order_id) values (o.user_id, o.credits_used, 'released', o.id);
  end if;
  if o.bonus_pixels > 0 then
    insert into public.credits (user_id, delta, reason, order_id) values (o.user_id, -o.bonus_pixels, 'clawback', o.id);
  end if;
  return true;
end $$;

-- Admin: cancella aree attive e restituisce al proprietario tutti i loro pixel come crediti.
create function public.admin_remove_areas(p_ids bigint[], p_reason text) returns int
language plpgsql set search_path = '' as $$
declare a record; n int := 0;
begin
  for a in
    update public.areas set status = 'removed', removed_reason = coalesce(nullif(p_reason, ''), 'admin')
    where id = any (p_ids) and status = 'active'
    returning id, owner, w * h as px
  loop
    insert into public.credits (user_id, delta, reason, area_id) values (a.owner, a.px, 'admin_refund', a.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Classifica per pixel PAGATI (gli omaggi non contano). Fuso Europe/Rome, settimana da lunedì.
create function public.leaderboard(p_period text, p_limit int default 100)
returns table (rank bigint, username text, paid_pixels bigint, owned_pixels bigint)
language sql stable set search_path = '' as $$
  with since as (
    select case p_period
      when 'day' then date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'
      when 'week' then date_trunc('week', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'
      else '-infinity'::timestamptz end as t
  ), paid as (
    select o.user_id, sum(o.paid_pixels)::bigint as px from public.orders o, since
    where o.status = 'paid' and o.paid_at >= since.t and o.paid_pixels > 0 group by o.user_id
  )
  select rank() over (order by paid.px desc), coalesce(pr.username, 'anonimo'), paid.px,
    (select coalesce(sum(a.w * a.h), 0)::bigint from public.areas a where a.owner = paid.user_id and a.status = 'active')
  from paid join public.profiles pr on pr.id = paid.user_id
  order by paid.px desc limit p_limit
$$;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Immagini delle aree: già ridotte nel browser a w x h pixel. Bucket pubblico in sola lettura.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('areas', 'areas', true, 4194304, array['image/png'])
on conflict (id) do nothing;

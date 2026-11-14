-- Hardening di sicurezza (audit 14/11/2026).
-- 1) Tetto di ordini in sospeso per utente: blocca il "griefing" dei lock area e lo spam di checkout.
-- 2) Rate limit durevole lato database, usato dalle API costose.

-- 1) reserve_area con tetto di 3 ordini pending non scaduti per utente.
create or replace function public.reserve_area(
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

  -- Difesa in profondità: niente più di 3 prenotazioni aperte (non pagate) insieme.
  if (select count(*) from public.orders where user_id = p_user and status = 'pending') >= 3 then
    raise exception 'troppi-ordini-in-sospeso';
  end if;

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

-- 2) Rate limit a finestra fissa. rate_hit() ritorna true se la richiesta è consentita.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);
alter table public.rate_limits enable row level security; -- nessuna policy: solo service_role
revoke all on public.rate_limits from public, anon, authenticated;
grant all on public.rate_limits to service_role;

create or replace function public.rate_hit(p_key text, p_limit int, p_window_secs int) returns boolean
language plpgsql set search_path = '' as $$
declare v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_secs)
                        then now() else public.rate_limits.window_start end,
    count = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_secs)
                 then 1 else public.rate_limits.count + 1 end
  returning count into v_count;
  return v_count <= p_limit;
end $$;

revoke all on function public.rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_hit(text, int, int) to service_role;

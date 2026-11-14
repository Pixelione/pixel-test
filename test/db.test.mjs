// Prove delle regole di vendita sul Postgres vero in memoria (PGlite) con la migrazione.
// Avvio: npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const U = { a: '00000000-0000-0000-0000-00000000000a', b: '00000000-0000-0000-0000-00000000000b', c: '00000000-0000-0000-0000-00000000000c' };
const PRICE = 100, FEE_PCT = 1.5, FEE_FIX = 25, LOCK = 31;

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const reserve = (user, x, y, w, h) =>
  one(`select public.reserve_area($1,$2,$3,$4,$5,'img.png','https://esempio.it','ciao',$6,$7,$8,$9) as r`,
    [user, x, y, w, h, PRICE, FEE_PCT, FEE_FIX, LOCK]).then((r) => r.r);
const balance = async (user) => (await one('select public.credit_balance($1) as b', [user])).b;
const complete = async (order) => (await one('select public.complete_order($1, $2, null) as ok', [order, `cs_${order}`])).ok;

before(async () => {
  // Quello che Supabase ha già: ruoli, auth.users, storage.buckets.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  `);
  for (const f of readdirSync('supabase/migrations').sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  for (const id of Object.values(U)) await db.query('insert into auth.users values ($1)', [id]);
  await db.query(`insert into public.profiles (id, email, early_bird) values ($1, 'a@x.it', true), ($2, 'b@x.it', false)`, [U.a, U.b]);
  await db.query(`insert into public.profiles (id, email, referred_by) values ($1, 'c@x.it', $2)`, [U.c, U.b]);
});

test('prezzo: 10 pixel = 10 € + commissione aggiunta (1,5% + 0,25 €)', async () => {
  const r = await reserve(U.b, 0, 0, 5, 2);
  assert.equal(r.paid_pixels, 10);
  assert.equal(r.amount_cents, Math.ceil((1000 + 25) / 0.985)); // 1041
  assert.equal(r.fee_cents, r.amount_cents - 1000);
  // Netto per noi dopo la commissione Stripe >= prezzo pieno.
  assert.ok(r.amount_cents - (r.amount_cents * 0.015 + 25) >= 1000 - 0.5);
});

test('doppia vendita: area sovrapposta rifiutata, area accanto accettata', async () => {
  await assert.rejects(reserve(U.a, 4, 1, 3, 3), /areas_no_overlap/);
  const ok = await reserve(U.a, 5, 0, 1, 1); // subito a destra di x 0..4
  assert.equal(ok.pixels, 1);
});

test('fuori dalla tela rifiutato', async () => {
  await assert.rejects(reserve(U.a, 998, 0, 5, 1), /check/);
});

test('webhook duplicato: bonus accreditato una volta sola', async () => {
  const r = await reserve(U.b, 0, 10, 10, 1); // 10 pagati -> 2 bonus
  assert.equal(await complete(r.order_id), true);
  assert.equal(await complete(r.order_id), false);
  assert.equal(await balance(U.b), 2);
  const a = await one('select status from public.areas where id = $1', [r.area_id]);
  assert.equal(a.status, 'active');
});

test('iscritto pre-lancio: +1 al primo acquisto da almeno 5, oltre a 1 ogni 5', async () => {
  const r = await reserve(U.a, 0, 20, 5, 1);
  await complete(r.order_id);
  assert.equal(await balance(U.a), 2); // 1 (ogni 5) + 1 (pre-lancio)
  const r2 = await reserve(U.a, 0, 21, 4, 1); // usa i 2 crediti, paga 2
  assert.equal(r2.credits_used, 2);
  assert.equal(r2.paid_pixels, 2);
  await complete(r2.order_id);
  assert.equal(await balance(U.a), 0); // niente secondo bonus pre-lancio, 2 pagati < 5
});

test('invito: 5 pixel a chi invita al primo acquisto pagato dell\'invitato', async () => {
  const before = await balance(U.b);
  const r = await reserve(U.c, 0, 30, 1, 1);
  await complete(r.order_id);
  assert.equal(await balance(U.b), before + 5);
  const r2 = await reserve(U.c, 0, 31, 1, 1);
  await complete(r2.order_id);
  assert.equal(await balance(U.b), before + 5); // solo il primo
});

test('area coperta tutta dai crediti: attiva subito, niente Stripe', async () => {
  await db.query(`insert into public.credits (user_id, delta, reason) values ($1, 4, 'manual')`, [U.a]);
  const r = await reserve(U.a, 0, 40, 2, 2);
  assert.equal(r.paid_pixels, 0);
  assert.equal(r.amount_cents, 0);
  const o = await one('select status from public.orders where id = $1', [r.order_id]);
  assert.equal(o.status, 'paid');
  assert.equal(await balance(U.a), 0);
});

test('pagamento fallito o scaduto: area libera e crediti restituiti', async () => {
  await db.query(`insert into public.credits (user_id, delta, reason) values ($1, 3, 'manual')`, [U.a]);
  const r = await reserve(U.a, 0, 50, 10, 1); // 3 crediti + 7 pagati
  assert.equal(await balance(U.a), 0);
  await db.query(`update public.areas set expires_at = now() - interval '1 minute' where id = $1`, [r.area_id]);
  await reserve(U.b, 0, 50, 10, 1); // stessa area: release_expired la libera prima
  assert.equal(await balance(U.a), 3);
  const o = await one('select status from public.orders where id = $1', [r.order_id]);
  assert.equal(o.status, 'expired');
  assert.equal(await complete(r.order_id), false); // un pagamento in ritardo non riattiva nulla
});

test('rimborso: area libera, crediti usati restituiti, bonus ripresi', async () => {
  const r = await reserve(U.b, 0, 60, 5, 1);
  await complete(r.order_id);
  const before = await balance(U.b);
  const ok = await one('select public.refund_order($1) as ok', [r.order_id]);
  assert.equal(ok.ok, true);
  assert.equal(await balance(U.b), before - 1);
  const again = await one('select public.refund_order($1) as ok', [r.order_id]);
  assert.equal(again.ok, false);
  await reserve(U.a, 0, 60, 5, 1); // di nuovo libera
});

test('admin: cancella più aree e riaccredita tutti i pixel una volta sola', async () => {
  const r1 = await reserve(U.b, 100, 100, 3, 3);
  const r2 = await reserve(U.b, 200, 100, 2, 2);
  await complete(r1.order_id); await complete(r2.order_id);
  const before = await balance(U.b);
  const n = await one('select public.admin_remove_areas($1, $2) as n', [[r1.area_id, r2.area_id], 'test']);
  assert.equal(n.n, 2);
  assert.equal(await balance(U.b), before + 13);
  const again = await one('select public.admin_remove_areas($1, $2) as n', [[r1.area_id], 'test']);
  assert.equal(again.n, 0);
});

test('classifica: solo pixel pagati, ordine decrescente', async () => {
  const { rows } = await db.query(`select * from public.leaderboard('all')`);
  assert.ok(rows.length >= 2);
  for (let i = 1; i < rows.length; i++) assert.ok(Number(rows[i - 1].paid_pixels) >= Number(rows[i].paid_pixels));
  const day = await db.query(`select * from public.leaderboard('day')`);
  assert.equal(day.rows.length, rows.length); // tutto fatto oggi
});

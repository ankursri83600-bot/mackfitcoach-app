/**
 * Executes the migrations against a real Postgres to prove they actually apply.
 *
 *   node scripts/verify-migrations.mjs
 *
 * Uses PGlite (Postgres compiled to WASM), so this needs no Docker, no server
 * and no Supabase project. Supabase-provided objects that our SQL depends on —
 * the auth and storage schemas, auth.uid(), and the anon/authenticated/
 * service_role roles — are stubbed first so the migrations run unmodified.
 *
 * What this DOES prove: the SQL parses, every object resolves, PL/pgSQL bodies
 * compile, constraints and indexes are creatable, and the grants target real
 * function signatures.
 *
 * What it does NOT prove: behaviour under Supabase's real auth.uid(), or that
 * the RLS policies express the intended access rules. Those need a live project.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "..", "supabase", "migrations");

/** Stand-ins for everything Supabase provides that our migrations reference. */
const SUPABASE_STUBS = `
create schema if not exists auth;
create schema if not exists storage;

do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Supabase's session helper. Returns null here, which is what an anonymous
-- request looks like.
create or replace function auth.uid() returns uuid
language sql stable as $$ select null::uuid $$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;
`;

async function main() {
  const db = new PGlite();
  await db.waitReady;

  const version = await db.query("select version()");
  console.log(`  ${version.rows[0].version.split(",")[0]}\n`);

  console.log("→ installing Supabase stubs");
  await db.exec(SUPABASE_STUBS);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let failures = 0;

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    try {
      await db.exec(sql);
      console.log(`✓ ${file}`);
    } catch (err) {
      failures++;
      console.error(`\n✗ ${file}`);
      console.error(`  ${err.message}`);
      if (err.hint) console.error(`  hint: ${err.hint}`);
      // Keep going so one failure does not hide the rest.
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} migration(s) failed to apply.`);
    process.exit(1);
  }

  // ── Post-apply assertions ─────────────────────────────────────────────────
  console.log("\n→ verifying the resulting schema");

  const expectedTables = [
    "profiles",
    "diet_requests",
    "diet_plans",
    "orders",
    "payment_events",
    "entitlements",
    "coaches",
    "coach_contacts",
    "coach_availability",
    "coach_time_off",
    "bookings",
    "transformations",
  ];

  const tables = await db.query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const present = new Set(tables.rows.map((r) => r.table_name));
  for (const t of expectedTables) {
    if (!present.has(t)) {
      console.error(`✗ missing table: ${t}`);
      failures++;
    }
  }
  console.log(`  tables: ${expectedTables.filter((t) => present.has(t)).length}/${expectedTables.length}`);

  const expectedFunctions = [
    "is_admin",
    "is_staff",
    "handle_new_user",
    "freeze_profile_role",
    "claim_diet_request",
    "has_full_plan_access",
    "create_order_record",
    "mark_order_paid",
    "mark_order_failed",
    "mark_order_refunded",
    "record_payment_event",
    "book_slot",
    "set_booking_status",
    "bookings_set_start_at",
  ];

  const fns = await db.query(
    `select routine_name from information_schema.routines where routine_schema = 'public'`,
  );
  const fnSet = new Set(fns.rows.map((r) => r.routine_name));
  for (const f of expectedFunctions) {
    if (!fnSet.has(f)) {
      console.error(`✗ missing function: ${f}`);
      failures++;
    }
  }
  console.log(`  functions: ${expectedFunctions.filter((f) => fnSet.has(f)).length}/${expectedFunctions.length}`);

  // RLS must be on for every table holding user data.
  const rls = await db.query(
    `select relname, relrowsecurity from pg_class
      where relname = any($1) and relkind = 'r'`,
    [expectedTables],
  );
  const noRls = rls.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
  if (noRls.length) {
    console.error(`✗ RLS not enabled on: ${noRls.join(", ")}`);
    failures++;
  } else {
    console.log(`  RLS enabled on all ${rls.rows.length} tables`);
  }

  // The double-booking guard must exist as a partial unique index.
  const guard = await db.query(
    `select indexdef from pg_indexes
      where tablename = 'bookings' and indexname = 'bookings_coach_slot_unique'`,
  );
  if (!guard.rows.length) {
    console.error("✗ bookings_coach_slot_unique index is missing");
    failures++;
  } else {
    const def = guard.rows[0].indexdef;
    const isUnique = def.includes("UNIQUE");
    const isPartial = def.toLowerCase().includes("where");
    console.log(`  double-booking guard: unique=${isUnique} partial=${isPartial}`);
    if (!isUnique || !isPartial) failures++;
  }

  // ── Behavioural probes ────────────────────────────────────────────────────
  console.log("\n→ probing behaviour");

  // record_payment_event must return true once, then false for a replay. This is
  // the webhook's whole idempotency guarantee.
  await db.exec(`
    insert into orders (email, tier_slug, tier_name_snapshot, amount_paise, razorpay_order_id)
    values ('t@example.com', 'starter', 'Starter', 49900, 'order_TESTONLY0001');
  `);

  const first = await db.query(
    `select public.record_payment_event('evt_1','payment.captured','{}'::jsonb) as inserted`,
  );
  const second = await db.query(
    `select public.record_payment_event('evt_1','payment.captured','{}'::jsonb) as inserted`,
  );
  const idempotent = first.rows[0].inserted === true && second.rows[0].inserted === false;
  console.log(`  record_payment_event idempotency: ${idempotent ? "OK" : "BROKEN"} (${first.rows[0].inserted} then ${second.rows[0].inserted})`);
  if (!idempotent) failures++;

  // mark_order_paid must refuse a wrong amount rather than settle it, and must
  // return NULL rather than raising — raising would roll back the UPDATE that
  // parks the order for reconciliation.
  const refusal = await db.query(
    `select public.mark_order_paid('order_TESTONLY0001','pay_TESTONLY0001', 100, 'INR') as order_id`,
  );
  const refused = refusal.rows[0].order_id === null;
  console.log(`  mark_order_paid refuses amount mismatch: ${refused ? "OK" : "BROKEN"}`);
  if (!refused) failures++;

  const parked = await db.query(
    `select status, reconciliation_error from orders where razorpay_order_id = 'order_TESTONLY0001'`,
  );
  const isMismatch = parked.rows[0].status === "mismatch";
  console.log(`  mismatched order parked for review: ${isMismatch ? "OK" : "BROKEN"} (status=${parked.rows[0].status})`);
  if (!isMismatch) failures++;

  // The correct amount must settle, and grant entitlements.
  await db.exec(`
    insert into orders (email, tier_slug, tier_name_snapshot, amount_paise, razorpay_order_id)
    values ('t2@example.com', 'pro', 'Pro Coaching', 249900, 'order_TESTONLY0002');
  `);
  await db.query(
    `select public.mark_order_paid('order_TESTONLY0002','pay_TESTONLY0002', 249900, 'INR')`,
  );
  const settled = await db.query(
    `select status from orders where razorpay_order_id = 'order_TESTONLY0002'`,
  );
  const ents = await db.query(
    `select scope, consults_total from entitlements
      where order_id = (select id from orders where razorpay_order_id = 'order_TESTONLY0002')
      order by scope`,
  );
  console.log(`  correct amount settles: ${settled.rows[0].status === "paid" ? "OK" : "BROKEN"}`);
  console.log(`  entitlements granted: ${ents.rows.map((r) => `${r.scope}(${r.consults_total})`).join(", ") || "NONE"}`);
  if (settled.rows[0].status !== "paid" || ents.rows.length === 0) failures++;

  // Settling twice must be a no-op, not an error and not a double grant.
  await db.query(
    `select public.mark_order_paid('order_TESTONLY0002','pay_TESTONLY0002', 249900, 'INR')`,
  );
  const entsAgain = await db.query(
    `select count(*)::int as n from entitlements
      where order_id = (select id from orders where razorpay_order_id = 'order_TESTONLY0002')`,
  );
  const noDouble = entsAgain.rows[0].n === ents.rows.length;
  console.log(`  re-settling is idempotent: ${noDouble ? "OK" : "BROKEN"} (${entsAgain.rows[0].n} entitlements)`);
  if (!noDouble) failures++;

  // A refund must revoke access.
  await db.query(`select public.mark_order_refunded('pay_TESTONLY0002')`);
  const revoked = await db.query(
    `select count(*)::int as n from entitlements
      where order_id = (select id from orders where razorpay_order_id = 'order_TESTONLY0002')
        and revoked_at is not null`,
  );
  const allRevoked = revoked.rows[0].n === ents.rows.length;
  console.log(`  refund revokes entitlements: ${allRevoked ? "OK" : "BROKEN"}`);
  if (!allRevoked) failures++;

  // The double-booking guard, exercised for real.
  await db.exec(`
    insert into coaches (id, slug, name, kind)
    values ('11111111-1111-1111-1111-111111111111', 'probe', 'Probe Coach', 'trainer');
    insert into coach_availability (coach_id, weekday, start_time, end_time)
    values ('11111111-1111-1111-1111-111111111111', 0, '07:00', '11:00');
  `);
  await db.exec(`
    insert into bookings (coach_id, slot_date, slot_start, slot_end, name, email, phone)
    values ('11111111-1111-1111-1111-111111111111', '2030-01-07', '08:00', '08:30', 'A', 'a@x.com', '+911');
  `);
  let blocked = false;
  try {
    await db.exec(`
      insert into bookings (coach_id, slot_date, slot_start, slot_end, name, email, phone)
      values ('11111111-1111-1111-1111-111111111111', '2030-01-07', '08:00', '08:30', 'B', 'b@x.com', '+912');
    `);
  } catch (err) {
    blocked = err.message.includes("bookings_coach_slot_unique") || /duplicate key/i.test(err.message);
  }
  console.log(`  second booking for same slot blocked: ${blocked ? "OK" : "BROKEN"}`);
  if (!blocked) failures++;

  // Cancelling must free the slot again (the index excludes cancelled rows).
  await db.exec(`update bookings set status = 'cancelled' where email = 'a@x.com'`);
  let freed = true;
  try {
    await db.exec(`
      insert into bookings (coach_id, slot_date, slot_start, slot_end, name, email, phone)
      values ('11111111-1111-1111-1111-111111111111', '2030-01-07', '08:00', '08:30', 'C', 'c@x.com', '+913');
    `);
  } catch {
    freed = false;
  }
  console.log(`  cancelling frees the slot: ${freed ? "OK" : "BROKEN"}`);
  if (!freed) failures++;

  // slot_start_at must be populated by the trigger.
  const startAt = await db.query(
    `select slot_start_at from bookings where email = 'c@x.com'`,
  );
  const hasStartAt = Boolean(startAt.rows[0].slot_start_at);
  console.log(`  slot_start_at set by trigger: ${hasStartAt ? "OK" : "BROKEN"}`);
  if (!hasStartAt) failures++;

  // The generated column on transformations.
  await db.exec(`
    insert into transformations (slug, client_name, goal, weeks, start_weight_kg, end_weight_kg, before_path, after_path)
    values ('probe', 'Probe', 'fat_loss', 12, 90, 78, 'b.jpg', 'a.jpg');
  `);
  const delta = await db.query(`select weight_change_kg from transformations where slug = 'probe'`);
  const correctDelta = Number(delta.rows[0].weight_change_kg) === -12;
  console.log(`  weight_change_kg computed: ${correctDelta ? "OK" : "BROKEN"} (${delta.rows[0].weight_change_kg})`);
  if (!correctDelta) failures++;

  // A non-veg-days value on a vegetarian row must be rejected.
  let checkHeld = false;
  try {
    await db.exec(`
      insert into diet_requests (claim_token, age, gender, height_cm, weight_kg, activity, goal,
        diet_type, nonveg_days, meals_per_day, bmi, bmi_category, bmr_kcal, tdee_kcal,
        target_kcal, protein_g, carbs_g, fat_g)
      values ('tok1', 30, 'male', 175, 80, 'moderate', 'fat_loss',
        'vegetarian', array[1,2]::smallint[], 4, 26.1, 'obese', 1700, 2600, 2100, 150, 200, 60);
    `);
  } catch (err) {
    checkHeld = /nonveg_only_when_nonveg/.test(err.message);
  }
  console.log(`  vegetarian cannot have non-veg days: ${checkHeld ? "OK" : "BROKEN"}`);
  if (!checkHeld) failures++;

  // Deliberately not calling db.close(): PGlite's teardown trips a libuv
  // assertion on Windows, which would mask the exit code we care about.

  if (failures > 0) {
    console.error(`\n✗ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\n✓ all migrations apply and all behavioural probes pass");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

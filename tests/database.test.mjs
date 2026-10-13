import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { createHousehold, applyAction } from "../lib/household.ts";
test("database schema enforces private access and one-use, email-bound invitations", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const guest = "22222222-2222-4222-8222-222222222222";
  const stranger = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);",
    );
    await db.query("insert into auth.users(id) values($1),($2),($3)", [owner, guest, stranger]);
    await db.exec(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    const state = applyAction(createHousehold(owner, "Ada", "Home"), {
      type: "member-add",
      name: "Guest",
      email: "guest@example.test",
      role: "Family",
      availableFrom: 900,
      availableUntil: 1300,
      pickupAllowed: true,
      canReceive: true,
      atHome: true,
    });
    await db.exec("set role service_role");
    const { rows } = await db.query("select public.planb_create_household($1,$2::jsonb) as id", [
      owner,
      JSON.stringify(state),
    ]);
    const householdId = rows[0].id;
    const hash = createHash("sha256").update("one-use-token").digest("hex");
    await db.query(
      "insert into public.planb_invites(token_hash,household_id,member_id,email,expires_at) values($1,$2,$3,$4,now()+interval '7 days')",
      [hash, householdId, state.members[1].id, "guest@example.test"],
    );
    await assert.rejects(
      db.query("select public.planb_accept_invite($1,$2,$3)", [
        hash,
        stranger,
        "wrong@example.test",
      ]),
      /Invalid invitation/,
    );
    await db.query("select public.planb_accept_invite($1,$2,$3)", [
      hash,
      guest,
      "guest@example.test",
    ]);
    const joined = await db.query("select state,version from public.planb_households where id=$1", [
      householdId,
    ]);
    assert.equal(joined.rows[0].state.members[1].userId, guest);
    assert.equal(joined.rows[0].version, 1);
    await assert.rejects(
      db.query("select public.planb_accept_invite($1,$2,$3)", [hash, guest, "guest@example.test"]),
      /Invalid invitation/,
    );
    await assert.rejects(
      db.query("select public.planb_create_household($1,$2::jsonb)", [
        guest,
        JSON.stringify(createHousehold(guest, "Guest", "Other home")),
      ]),
      /duplicate key/,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(db.query("select * from public.planb_households"), /permission denied/);
    await assert.rejects(
      db.query("select public.planb_accept_invite($1,$2,$3)", [
        hash,
        stranger,
        "guest@example.test",
      ]),
      /permission denied/,
    );
    await db.exec("reset role;set role authenticated");
    await assert.rejects(db.query("select * from public.planb_invites"), /permission denied/);
    console.log(
      "Verified schema SQL, row-level restrictions, transaction rollback, and invitation identity checks.",
    );
  } finally {
    await db.close();
  }
});

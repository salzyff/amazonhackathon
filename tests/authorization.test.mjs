import test from "node:test";
import assert from "node:assert/strict";
import { authorizeAction } from "../lib/authorization.ts";
import { createHousehold, applyAction, parseIntent, candidate } from "../lib/household.ts";
import { seedHousehold } from "./fixtures.ts";
test("real households start empty with the entered owner name", () => {
  const s = createHousehold("account-1", "Ada", "My home");
  assert.equal(s.members.length, 1);
  assert.equal(s.members[0].name, "Ada");
  assert.equal(s.name, "My home");
  assert.equal(s.events.length, 0);
  assert.equal(s.memories.length, 0);
  assert.equal(s.plans.length, 0);
});
test("unlinked members cannot be offered as cover", () => {
  const s = seedHousehold();
  s.members.forEach((m) => {
    if (m.id !== "sam") delete m.userId;
  });
  assert.equal(
    candidate(
      s,
      s.events.find((e) => e.id === "school"),
    ),
    undefined,
  );
});
test("even the owner cannot impersonate a request recipient", () => {
  const s = applyAction(seedHousehold(), {
    type: "chat",
    text: "My meeting is running late until 6 pm",
  });
  const p = s.plans[0];
  const a = p.assignments.find((a) => a.eventId === "school");
  const action = { type: "reply", planId: p.id, assignmentId: a.id, accept: true };
  assert.throws(() => authorizeAction(s, action, true, "sam"), /Only the person/);
  assert.throws(() => authorizeAction(s, action, false, "maya"), /Only the person/);
  assert.doesNotThrow(() => authorizeAction(s, action, false, "tola"));
});
test("members can edit their own availability but cannot grant themselves permissions", () => {
  const s = seedHousehold();
  const m = s.members.find((m) => m.id === "maya");
  const a = {
    type: "member",
    memberId: m.id,
    availableFrom: 1000,
    availableUntil: 1300,
    pickupAllowed: m.pickupAllowed,
    canReceive: m.canReceive,
    atHome: true,
  };
  assert.doesNotThrow(() => authorizeAction(s, a, false, "maya"));
  assert.throws(
    () => authorizeAction(s, { ...a, pickupAllowed: true }, false, "maya"),
    /permissions/,
  );
  assert.throws(() => authorizeAction(s, { ...a, memberId: "tola" }, false, "maya"));
  assert.throws(() => authorizeAction(s, { type: "approve", planId: "test" }, false, "maya"));
});
test("a missing return time is not invented", () => {
  assert.equal(parseIntent("My meeting is running late").kind, "unknown");
  assert.equal(parseIntent("I’m running late. I’ll be available again at 7:15 pm").until, 1155);
});

import { z } from "zod";
import { configured, verifiedUser } from "@/lib/supabase/server";
import { applyAction } from "@/lib/household";
import { aiConfigured, interpret } from "@/lib/intent";
import { forViewer, getHousehold, saveHousehold } from "@/lib/storage";
import { authorizeAction } from "@/lib/authorization";
export const dynamic = "force-dynamic";
const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(1000);
const minute = z.number().int().min(0).max(1439);
const memberFields = {
  availableFrom: minute,
  availableUntil: minute,
  pickupAllowed: z.boolean(),
  canReceive: z.boolean(),
  atHome: z.boolean(),
};
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chat"), text }),
  z.object({ type: z.literal("approve"), planId: id }),
  z.object({ type: z.literal("cancel"), planId: id }),
  z.object({ type: z.literal("reply"), planId: id, assignmentId: id, accept: z.boolean() }),
  z.object({ type: z.literal("member"), memberId: id, ...memberFields }),
  z.object({
    type: z.literal("member-add"),
    name: text,
    email: z.string().email().max(254),
    role: z.string().trim().min(1).max(50),
    ...memberFields,
  }),
  z.object({
    type: z.literal("event"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: text,
    kind: z.enum(["pickup", "delivery", "meeting", "errand"]),
    start: minute,
    end: minute,
    ownerId: id,
    location: z.string().trim().max(200),
    flexible: z.boolean(),
  }),
  z.object({ type: z.literal("memory"), text: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("delete-memory"), id }),
]);
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  if (!configured())
    return json(
      {
        error:
          "Accounts and saved data aren’t ready yet. If this is your project, follow the setup guide in the README.",
        setupRequired: true,
      },
      503,
    );
  const user = await verifiedUser();
  if (!user) return json({ error: "Sign in to open your household." }, 401);
  try {
    const row = await getHousehold(user.id);
    return json({
      state: row ? forViewer(row, user.id) : null,
      isOwner: row?.owner_id === user.id,
      aiConfigured: aiConfigured(),
      engine: aiConfigured() ? "ready" : "rules",
      user: { id: user.id, email: user.email },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Couldn’t load your household." }, 503);
  }
}
export async function POST(request: Request) {
  if (!configured())
    return json(
      { error: "Saved data isn’t ready yet. The project owner needs to finish setup." },
      503,
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "We couldn’t verify that request. Refresh the page and try again." }, 403);
  const user = await verifiedUser();
  if (!user) return json({ error: "Sign in to use household data." }, 401);
  let parsed;
  try {
    const raw = await request.text();
    if (raw.length > 5000) throw new Error();
    parsed = actionSchema.safeParse(JSON.parse(raw));
  } catch {
    return json({ error: "Something was missing from that request. Please try again." }, 400);
  }
  if (!parsed.success) return json({ error: "Check your request details." }, 400);
  const a = parsed.data;
  if (
    ((a.type === "member" || a.type === "member-add") && a.availableFrom >= a.availableUntil) ||
    (a.type === "event" && a.start >= a.end)
  )
    return json({ error: "Choose an end time that’s later than the start time." }, 400);
  try {
    const row = await getHousehold(user.id);
    if (!row) return json({ error: "Create or join a household first." }, 400);
    const state = forViewer(row, user.id);
    const isOwner = row.owner_id === user.id;
    try {
      authorizeAction(state, a, isOwner, user.id);
    } catch (e) {
      return json({ error: (e as Error).message }, 403);
    }
    if (
      (a.type === "event" && state.events.length >= 300) ||
      (a.type === "memory" && state.memories.length >= 100)
    )
      return json({ error: "The household has reached its record limit." }, 400);
    const result = a.type === "chat" ? await interpret(a.text, state) : null;
    const next = applyAction(state, a, result?.intent);
    if (!(await saveHousehold(row, next)))
      return json(
        { error: "Someone just changed the household. Refresh to get the latest, then try again." },
        409,
      );
    return json({
      state: next,
      isOwner,
      aiConfigured: aiConfigured(),
      engine: result?.engine ?? (aiConfigured() ? "ready" : "rules"),
      notice: result?.notice,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Couldn’t save that change." }, 400);
  }
}

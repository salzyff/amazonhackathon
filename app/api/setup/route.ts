import { z } from "zod";
import { adminClient, configured, verifiedUser } from "@/lib/supabase/server";
import { createHousehold } from "@/lib/household";
import { getHousehold } from "@/lib/storage";
const schema = z.object({
  name: z.string().trim().min(1).max(70),
  householdName: z.string().trim().min(1).max(100),
  availableFrom: z.number().int().min(0).max(1438),
  availableUntil: z.number().int().min(1).max(1439),
});
export async function POST(request: Request) {
  const json = (v: unknown, status = 200) =>
    Response.json(v, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!configured())
    return json(
      {
        error:
          "Accounts and saved data aren’t set up yet. The project owner needs to finish setup.",
      },
      503,
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "We couldn’t verify that request. Refresh the page and try again." }, 403);
  const user = await verifiedUser();
  if (!user) return json({ error: "Sign in first." }, 401);
  let data;
  try {
    data = schema.parse(await request.json());
  } catch {
    return json(
      { error: "Add your name, a household name, and the hours you’re usually free." },
      400,
    );
  }
  if (data.availableFrom >= data.availableUntil)
    return json({ error: "Choose an end time that’s later than the start time." }, 400);
  try {
    if (await getHousehold(user.id))
      return json({ error: "You already belong to a household." }, 409);
    const state = createHousehold(user.id, data.name, data.householdName);
    Object.assign(state.members[0], {
      email: user.email,
      availableFrom: data.availableFrom,
      availableUntil: data.availableUntil,
    });
    const { error } = await adminClient().rpc("planb_create_household", {
      p_user_id: user.id,
      p_state: state,
    });
    if (error)
      return json(
        { error: "Couldn’t create your household. Check the database setup or try again." },
        400,
      );
    return json({ ok: true });
  } catch {
    return json(
      {
        error:
          "Your household’s saved data isn’t ready yet. Check the setup guide before trying again.",
      },
      503,
    );
  }
}

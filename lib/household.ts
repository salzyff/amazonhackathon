export type Member = {
  id: string;
  userId?: string;
  email?: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  availableFrom: number;
  availableUntil: number;
  pickupAllowed: boolean;
  canReceive: boolean;
  atHome: boolean;
};
export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  kind: "pickup" | "delivery" | "meeting" | "errand";
  start: number;
  end: number;
  ownerId: string;
  location: string;
  flexible: boolean;
  status: "scheduled" | "needs-cover" | "covered";
};
export type Memory = { id: string; text: string; createdAt: string };
export type Assignment = {
  id: string;
  eventId: string;
  memberId: string | null;
  previousOwnerId: string;
  reason: string;
  excluded: string[];
  status: "proposed" | "waiting" | "accepted" | "declined" | "blocked";
};
export type Plan = {
  id: string;
  title: string;
  source: string;
  status: "proposed" | "waiting" | "complete" | "blocked" | "cancelled";
  assignments: Assignment[];
  createdAt: string;
  createdById?: string;
  until: number;
};
export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
  planId?: string;
  trace?: string[];
};
export type Activity = {
  id: string;
  text: string;
  at: string;
  kind: "plan" | "request" | "reply" | "memory" | "calendar";
};
export type Household = {
  date: string;
  name: string;
  selfId: string;
  members: Member[];
  events: CalendarEvent[];
  memories: Memory[];
  plans: Plan[];
  messages: ChatMessage[];
  activity: Activity[];
};
export type Intent = {
  kind: "disruption" | "status" | "memory" | "unknown";
  until?: number;
  targets?: string[];
  memory?: string;
};
export type Action =
  | { type: "chat"; text: string }
  | { type: "approve"; planId: string }
  | { type: "cancel"; planId: string }
  | { type: "reply"; planId: string; assignmentId: string; accept: boolean }
  | {
      type: "member";
      memberId: string;
      availableFrom: number;
      availableUntil: number;
      pickupAllowed: boolean;
      canReceive: boolean;
      atHome: boolean;
    }
  | {
      type: "member-add";
      name: string;
      email: string;
      role: string;
      availableFrom: number;
      availableUntil: number;
      pickupAllowed: boolean;
      canReceive: boolean;
      atHome: boolean;
    }
  | {
      type: "event";
      date: string;
      title: string;
      kind: CalendarEvent["kind"];
      start: number;
      end: number;
      ownerId: string;
      location: string;
      flexible: boolean;
    }
  | { type: "memory"; text: string }
  | { type: "delete-memory"; id: string };
export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}
export function clock(minutes: number) {
  const h = Math.floor(minutes / 60);
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}
export function inputTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function fromTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function createHousehold(
  userId: string,
  name: string,
  householdName: string,
  date = today(),
): Household {
  return {
    date,
    name: householdName,
    selfId: userId,
    members: [
      {
        id: userId,
        userId,
        name,
        role: "Owner",
        initials: name.trim().slice(0, 1).toUpperCase(),
        color: "mint",
        availableFrom: 0,
        availableUntil: 1439,
        pickupAllowed: false,
        canReceive: false,
        atHome: false,
      },
    ],
    events: [],
    memories: [],
    plans: [],
    activity: [],
    messages: [
      {
        id: uid(),
        role: "assistant",
        text: `Hi ${name}. Start by adding your people and today’s plans. When something changes, tell me when you’ll be free and I’ll check who can help.`,
        createdAt: now(),
      },
    ],
  };
}

function log(s: Household, text: string, kind: Activity["kind"]) {
  s.activity.unshift({ id: uid(), text, at: now(), kind });
  s.activity = s.activity.slice(0, 100);
}
function say(s: Household, text: string, planId?: string, trace?: string[]) {
  s.messages.push({
    id: uid(),
    role: "assistant",
    text,
    createdAt: now(),
    ...(planId ? { planId } : {}),
    ...(trace ? { trace } : {}),
  });
}
function overlap(a: number, b: number, c: number, d: number) {
  return a < d && b > c;
}
export function candidate(
  s: Household,
  e: CalendarEvent,
  excluded: string[] = [],
  reserved: Assignment[] = [],
): Member | undefined {
  return s.members
    .filter((m) => {
      if (!m.userId || m.id === s.selfId || excluded.includes(m.id)) return false;
      if (e.kind === "pickup" && !m.pickupAllowed) return false;
      if (e.kind === "delivery" && (!m.canReceive || !m.atHome)) return false;
      const buffer = e.kind === "pickup" ? 15 : 0;
      if (m.availableFrom > e.start - buffer || m.availableUntil < e.end + buffer) return false;
      if (
        s.events.some(
          (other) =>
            other.id !== e.id &&
            other.date === e.date &&
            other.ownerId === m.id &&
            overlap(e.start - buffer, e.end + buffer, other.start, other.end),
        )
      )
        return false;
      const held = [
        ...reserved,
        ...s.plans.filter((p) => p.status !== "cancelled").flatMap((p) => p.assignments),
      ].filter(
        (a) =>
          a.memberId === m.id &&
          a.eventId !== e.id &&
          ["proposed", "waiting", "accepted"].includes(a.status),
      );
      return !held.some((a) => {
        const other = s.events.find((x) => x.id === a.eventId);
        const ob = other?.kind === "pickup" ? 15 : 0;
        return other && overlap(e.start - buffer, e.end + buffer, other.start - ob, other.end + ob);
      });
    })
    .sort((a, b) => a.availableFrom - b.availableFrom)[0];
}
export function parseIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (/^(remember|please remember|save this|remember that)\b/.test(t))
    return {
      kind: "memory",
      memory: text.replace(/^(please )?remember( that)?\s*|^save this[:\s]*/i, "").trim(),
    };
  if (
    /is everything|what.*(status|sorted|confirmed)|what.s (the plan|happening)|any updates|who.*(pickup|collect|grocer|delivery)|are we|check.*plan|status|all sorted/.test(
      t,
    )
  )
    return { kind: "status" };
  if (
    !/(late|stuck|can.t|cannot|running over|unavailable|delayed|help.*(pickup|delivery)|replan|reorganize|reorganise)/.test(
      t,
    )
  )
    return { kind: "unknown" };
  let until = 1080;
  const time = t.match(
    /(?:until|till|by|home (?:at|after)|back (?:at|after)|available (?:again )?(?:at|after))\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
  );
  if (time) {
    let hour = Number(time[1]);
    const min = Number(time[2] || 0);
    if (time[3] === "pm" && hour < 12) hour += 12;
    else if (time[3] === "am" && hour === 12) hour = 0;
    else if (!time[3] && hour < 8) hour += 12;
    if (hour > 23 || min > 59) return { kind: "unknown" };
    until = hour * 60 + min;
  }
  if (!time) return { kind: "unknown" };
  const isWork = /meeting|work|office|stuck|running late|running over/.test(t);
  const targets: string[] = [];
  if (/school|pickup|pick up|collect/.test(t)) targets.push("pickup");
  if (/grocer|delivery|deliveries|package|parcel/.test(t)) targets.push("delivery");
  if (/errand|dinner/.test(t)) targets.push("errand");
  return { kind: "disruption", until, targets: isWork || !targets.length ? [] : targets };
}
function statusText(s: Household) {
  const plans = s.plans.filter((p) => p.status !== "cancelled");
  if (!plans.length)
    return "No changes have been made yet. Tell me which part of today you need a hand with.";
  const current = plans.flatMap((p) => p.assignments).filter((a) => a.status !== "declined");
  const lines = current.map((a) => {
    const e = s.events.find((x) => x.id === a.eventId);
    const m = s.members.find((x) => x.id === a.memberId);
    return `${e?.title}: ${a.status === "accepted" ? `confirmed with ${m?.name}` : a.status === "waiting" ? `waiting for ${m?.name} to reply` : a.status === "blocked" ? "still needs someone available" : `a suggestion for ${m?.name}, waiting for your approval`}.`;
  });
  return `${current.every((a) => a.status === "accepted") ? "Everyone’s confirmed. The new plan is sorted." : "Here’s the latest:"}\n\n${lines.join("\n")}`;
}
export function propose(s: Household, source: string, intent: Intent) {
  const until = intent.until ?? 1080;
  const targets = intent.targets ?? [];
  const affected = s.events.filter(
    (e) =>
      e.date === s.date &&
      e.ownerId === s.selfId &&
      e.kind !== "meeting" &&
      e.start < until &&
      (!targets.length || targets.includes(e.kind) || targets.includes(e.id)),
  );
  const active = s.plans.filter((p) => !["complete", "cancelled"].includes(p.status));
  if (active.length) {
    say(
      s,
      "You already have a plan waiting. Take a look at it, or cancel it before we make another.",
      active[0].id,
    );
    return;
  }
  if (!affected.length) {
    say(
      s,
      `You don’t have any tasks that need cover before ${clock(until)}. If something’s missing, add it in Calendar. You can also tell me if you’ll be back later.`,
      undefined,
      ["Your calendar", "Tasks that might need help"],
    );
    return;
  }
  const assignments: Assignment[] = [];
  for (const e of affected.sort((a, b) => a.start - b.start)) {
    const m = candidate(s, e, [], assignments);
    assignments.push({
      id: uid(),
      eventId: e.id,
      memberId: m?.id ?? null,
      previousOwnerId: e.ownerId,
      reason: m
        ? e.kind === "pickup"
          ? `${m.name} is approved for pickup and has time to get there and back.`
          : e.kind === "delivery"
            ? `${m.name} is marked as home when the delivery arrives.`
            : `${m.name} is free at that time.`
        : "I couldn’t find someone who’s joined, has permission, and is free for this task. Check their details in Household.",
      excluded: [],
      status: m ? "proposed" : "blocked",
    });
  }
  const plan: Plan = {
    id: uid(),
    title: "The new plan",
    source,
    status: assignments.every((a) => a.status === "blocked") ? "blocked" : "proposed",
    assignments,
    createdAt: now(),
    createdById: s.selfId,
    until,
  };
  s.plans.unshift(plan);
  log(s, `Found ${affected.length} tasks that need a hand.`, "plan");
  say(
    s,
    `You’ll be busy until ${clock(until)}, so I’ve checked who could help with the tasks you’ll miss. Have a look before we ask anyone.`,
    plan.id,
    [
      "Today’s plans",
      "Free hours and time to travel",
      "Who’s allowed to do school pickups",
      "Suggestions for you to review",
    ],
  );
}
export function applyAction(state: Household, action: Action, intent?: Intent): Household {
  const s = structuredClone(state);

  if (action.type === "chat") {
    s.messages.push({ id: uid(), role: "user", text: action.text, createdAt: now() });
    const i = intent ?? parseIntent(action.text);
    if (i.kind === "status")
      say(s, statusText(s), undefined, ["The current plan", "Who’s replied"]);
    else if (i.kind === "memory" && i.memory) {
      s.memories.unshift({ id: uid(), text: i.memory, createdAt: now() });
      log(s, "Saved a household note.", "memory");
      say(
        s,
        "Saved. If this changes who can help, update their free hours or permissions in Household too.",
      );
    } else if (i.kind === "disruption") propose(s, action.text, i);
    else
      say(
        s,
        "Tell me what changed and when you’ll be free again. Something like “I’m stuck at work until 6 pm” gives me enough to check the calendar. You can also ask “Is everything sorted?” or say “Remember…” followed by a note.",
      );
  }
  if (action.type === "approve") {
    const p = s.plans.find((p) => p.id === action.planId);
    if (!p || !["proposed", "blocked"].includes(p.status))
      throw new Error("This plan has already been reviewed. Refresh to see the latest.");
    let count = 0;
    for (const a of p.assignments.filter((a) => a.status === "proposed")) {
      const e = s.events.find((e) => e.id === a.eventId)!;
      const valid = candidate(
        s,
        e,
        s.members.filter((m) => m.id !== a.memberId).map((m) => m.id),
      );
      if (!valid) {
        a.status = "blocked";
        a.memberId = null;
        a.reason = "Their availability has changed. Check Household and make a new plan.";
        continue;
      }
      a.status = "waiting";
      e.status = "needs-cover";
      count++;
      log(s, `Request created for ${valid.name}: ${e.title}.`, "request");
    }
    refreshPlan(p);
    say(
      s,
      count
        ? `Okay, ${count} request${count === 1 ? " is" : "s are"} in the household inbox. I’ll update the calendar as each person accepts.`
        : "Nobody’s free for this plan right now. Check the household’s details, cancel this plan, and we can try again.",
      p.id,
    );
  }
  if (action.type === "cancel") {
    const p = s.plans.find((p) => p.id === action.planId);
    if (!p || p.status === "complete" || p.status === "cancelled")
      throw new Error("This plan is already finished or cancelled.");
    p.status = "cancelled";
    for (const a of p.assignments) {
      const e = s.events.find((e) => e.id === a.eventId);
      if (e)
        e.status = p.assignments.some((x) => x.eventId === e.id && x.status === "accepted")
          ? "covered"
          : "scheduled";
    }
    log(s, "Cancelled the requests that hadn’t been accepted.", "plan");
    say(
      s,
      "Cancelled the requests still waiting for a reply. Anyone who already accepted keeps their task.",
    );
  }
  if (action.type === "reply") {
    const p = s.plans.find((p) => p.id === action.planId);
    const a = p?.assignments.find((a) => a.id === action.assignmentId);
    if (!p || p.status === "cancelled" || !a || a.status !== "waiting")
      throw new Error(
        "Someone’s already answered this request, or the plan was cancelled. Refresh to see the latest.",
      );
    const e = s.events.find((e) => e.id === a.eventId)!;
    const m = s.members.find((m) => m.id === a.memberId)!;
    if (action.accept) {
      const valid = candidate(
        s,
        e,
        s.members.filter((x) => x.id !== m.id).map((x) => x.id),
      );
      if (!valid)
        throw new Error(
          "That person’s availability or permission changed. Choose “Can’t make it” so we can look for someone else.",
        );
      a.status = "accepted";
      e.ownerId = m.id;
      e.status = "covered";
      log(s, `${m.name} accepted ${e.title}. Calendar updated.`, "reply");
      say(s, `${m.name} said yes to ${e.title} at ${clock(e.start)}. I’ve updated the calendar.`);
    } else {
      a.status = "declined";
      log(s, `${m.name} can’t help with ${e.title}. Checking who else is free.`, "reply");
      const excluded = [...a.excluded, m.id];
      const next = candidate(s, e, excluded);
      p.assignments.push({
        id: uid(),
        eventId: e.id,
        memberId: next?.id ?? null,
        previousOwnerId: a.previousOwnerId,
        excluded,
        reason: next
          ? `${next.name} can help at that time. ${m.name} couldn’t make it.`
          : "No one else is free or able to help. This task still needs someone.",
        status: next ? "proposed" : "blocked",
      });
      say(
        s,
        next
          ? `${m.name} can’t make it. ${next.name} could help with ${e.title} instead. Want to ask them?`
          : `${m.name} can’t make it, and I couldn’t find anyone else to help with ${e.title}. Check the details in Household, then cancel this plan if you want to try again.`,
        p.id,
        ["Who couldn’t make it", "Who else could help", "Another option for you to review"],
      );
    }
    refreshPlan(p);
  }
  if (action.type === "member-add") {
    if (s.members.length >= 20) throw new Error("A household can have up to 20 people.");
    if (s.members.some((m) => m.email?.toLowerCase() === action.email.toLowerCase()))
      throw new Error("You’ve already added someone with that email address.");
    s.members.push({
      id: uid(),
      name: action.name,
      email: action.email.toLowerCase(),
      role: action.role,
      initials: action.name.slice(0, 1).toUpperCase(),
      color: ["mint", "lilac", "blue", "peach"][s.members.length % 4],
      availableFrom: action.availableFrom,
      availableUntil: action.availableUntil,
      pickupAllowed: action.pickupAllowed,
      canReceive: action.canReceive,
      atHome: action.atHome,
    });
    log(s, `Added ${action.name}. Send them an invitation link so they can join.`, "memory");
  }
  if (action.type === "member") {
    const m = s.members.find((m) => m.id === action.memberId);
    if (!m) throw new Error("I couldn’t find that person in this household.");
    Object.assign(m, {
      availableFrom: action.availableFrom,
      availableUntil: action.availableUntil,
      pickupAllowed: action.pickupAllowed,
      canReceive: action.canReceive,
      atHome: action.atHome,
    });
    log(s, `Saved ${m.name}’s free hours and permissions.`, "memory");
  }
  if (action.type === "event") {
    if (!s.members.some((m) => m.id === action.ownerId))
      throw new Error("Choose someone from your household.");
    s.events.push({
      id: uid(),
      date: action.date,
      title: action.title,
      kind: action.kind,
      start: action.start,
      end: action.end,
      ownerId: action.ownerId,
      location: action.location,
      flexible: action.flexible,
      status: "scheduled",
    });
    log(s, `Added ${action.title} to the calendar.`, "calendar");
  }
  if (action.type === "memory") {
    s.memories.unshift({ id: uid(), text: action.text, createdAt: now() });
    log(s, "Saved a household note.", "memory");
  }
  if (action.type === "delete-memory") s.memories = s.memories.filter((m) => m.id !== action.id);
  s.messages = s.messages.slice(-120);
  s.memories = s.memories.slice(0, 100);
  return s;
}
function refreshPlan(p: Plan) {
  const live = p.assignments.filter((a) => a.status !== "declined");
  p.status = live.every((a) => a.status === "accepted")
    ? "complete"
    : live.some((a) => a.status === "proposed")
      ? "proposed"
      : live.some((a) => a.status === "waiting")
        ? "waiting"
        : "blocked";
}

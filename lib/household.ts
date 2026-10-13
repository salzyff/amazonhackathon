export type Member = { id: string; userId?: string; email?: string; name: string; role: string; initials: string; color: string; availableFrom: number; availableUntil: number; pickupAllowed: boolean; canReceive: boolean; atHome: boolean };
export type CalendarEvent = { id: string; date: string; title: string; kind: "pickup" | "delivery" | "meeting" | "errand"; start: number; end: number; ownerId: string; location: string; flexible: boolean; status: "scheduled" | "needs-cover" | "covered" };
export type Memory = { id: string; text: string; createdAt: string };
export type Assignment = { id: string; eventId: string; memberId: string | null; previousOwnerId: string; reason: string; excluded: string[]; status: "proposed" | "waiting" | "accepted" | "declined" | "blocked" };
export type Plan = { id: string; title: string; source: string; status: "proposed" | "waiting" | "complete" | "blocked" | "cancelled"; assignments: Assignment[]; createdAt: string; createdById?: string; until: number };
export type ChatMessage = { id: string; role: "assistant" | "user"; text: string; createdAt: string; planId?: string; trace?: string[] };
export type Activity = { id: string; text: string; at: string; kind: "plan" | "request" | "reply" | "memory" | "calendar" };
export type Household = { date: string; name: string; selfId: string; members: Member[]; events: CalendarEvent[]; memories: Memory[]; plans: Plan[]; messages: ChatMessage[]; activity: Activity[] };
export type Intent = { kind: "disruption" | "status" | "memory" | "unknown"; until?: number; targets?: string[]; memory?: string };
export type Action =
  | { type: "chat"; text: string }
  | { type: "approve"; planId: string }
  | { type: "cancel"; planId: string }
  | { type: "reply"; planId: string; assignmentId: string; accept: boolean }
  | { type: "member"; memberId: string; availableFrom: number; availableUntil: number; pickupAllowed: boolean; canReceive: boolean; atHome: boolean }
  | { type: "member-add"; name: string; email: string; role: string; availableFrom: number; availableUntil: number; pickupAllowed: boolean; canReceive: boolean; atHome: boolean }
  | { type: "event"; date: string; title: string; kind: CalendarEvent["kind"]; start: number; end: number; ownerId: string; location: string; flexible: boolean }
  | { type: "memory"; text: string }
  | { type: "delete-memory"; id: string }
  ;
export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
export function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()); }
export function clock(minutes: number) { const h = Math.floor(minutes / 60); return `${h % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`; }
export function inputTime(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
export function fromTime(value: string) { const [h, m] = value.split(":").map(Number); return h * 60 + m; }
export function createHousehold(userId:string, name:string, householdName:string, date=today()):Household {
  return {date,name:householdName,selfId:userId,members:[{id:userId,userId,name,role:"Owner",initials:name.trim().slice(0,1).toUpperCase(),color:"mint",availableFrom:0,availableUntil:1439,pickupAllowed:false,canReceive:false,atHome:false}],events:[],memories:[],plans:[],activity:[],messages:[{id:uid(),role:"assistant",text:`Hi ${name}. Add your household members and tasks first. Then tell me when your plans change, and I’ll check who can help.`,createdAt:now()}]};
}

function log(s: Household, text: string, kind: Activity["kind"]) { s.activity.unshift({ id: uid(), text, at: now(), kind }); s.activity = s.activity.slice(0, 100); }
function say(s: Household, text: string, planId?: string, trace?: string[]) { s.messages.push({ id: uid(), role: "assistant", text, createdAt: now(), ...(planId ? {planId} : {}), ...(trace ? {trace} : {}) }); }
function overlap(a: number, b: number, c: number, d: number) { return a < d && b > c; }
export function candidate(s: Household, e: CalendarEvent, excluded: string[] = [], reserved: Assignment[] = []): Member | undefined {
  return s.members.filter(m => {
    if (!m.userId || m.id === s.selfId || excluded.includes(m.id)) return false;
    if (e.kind === "pickup" && !m.pickupAllowed) return false;
    if (e.kind === "delivery" && (!m.canReceive || !m.atHome)) return false;
    const buffer = e.kind === "pickup" ? 15 : 0;
    if (m.availableFrom > e.start - buffer || m.availableUntil < e.end + buffer) return false;
    if (s.events.some(other => other.id !== e.id && other.date === e.date && other.ownerId === m.id && overlap(e.start - buffer, e.end + buffer, other.start, other.end))) return false;
    const held = [...reserved, ...s.plans.filter(p => p.status !== "cancelled").flatMap(p => p.assignments)].filter(a => a.memberId === m.id && a.eventId !== e.id && ["proposed", "waiting", "accepted"].includes(a.status));
    return !held.some(a => { const other = s.events.find(x => x.id === a.eventId); const ob = other?.kind === "pickup" ? 15 : 0; return other && overlap(e.start - buffer, e.end + buffer, other.start - ob, other.end + ob); });
  }).sort((a,b) => a.availableFrom - b.availableFrom)[0];
}
export function parseIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (/^(remember|please remember|save this|remember that)\b/.test(t)) return { kind: "memory", memory: text.replace(/^(please )?remember( that)?\s*|^save this[:\s]*/i, "").trim() };
  if (/is everything|what.*(status|sorted|confirmed)|what.s (the plan|happening)|any updates|who.*(pickup|collect|grocer|delivery)|are we|check.*plan|status|all sorted/.test(t)) return { kind: "status" };
  if (!/(late|stuck|can.t|cannot|running over|unavailable|delayed|help.*(pickup|delivery)|replan|reorganize|reorganise)/.test(t)) return { kind: "unknown" };
  let until = 1080;
  const time = t.match(/(?:until|till|by|home (?:at|after)|back (?:at|after)|available (?:again )?(?:at|after))\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (time) { let hour = Number(time[1]); const min = Number(time[2] || 0); if (time[3] === "pm" && hour < 12) hour += 12; else if (time[3] === "am" && hour === 12) hour = 0; else if (!time[3] && hour < 8) hour += 12; if (hour > 23 || min > 59) return { kind: "unknown" }; until = hour * 60 + min; }
  if(!time)return {kind:"unknown"};
  const isWork = /meeting|work|office|stuck|running late|running over/.test(t);
  const targets: string[] = [];
  if (/school|pickup|pick up|collect/.test(t)) targets.push("pickup");
  if (/grocer|delivery|deliveries|package|parcel/.test(t)) targets.push("delivery");
  if (/errand|dinner/.test(t)) targets.push("errand");
  return { kind: "disruption", until, targets: isWork || !targets.length ? [] : targets };
}
function statusText(s: Household) {
  const plans = s.plans.filter(p => p.status !== "cancelled");
  if (!plans.length) return "Your original calendar is still in place. There’s no replacement plan yet. Tell me which part of today needs help.";
  const current = plans.flatMap(p => p.assignments).filter(a => a.status !== "declined");
  const lines = current.map(a => { const e=s.events.find(x=>x.id===a.eventId); const m=s.members.find(x=>x.id===a.memberId); return `${e?.title}: ${a.status === "accepted" ? `confirmed with ${m?.name}` : a.status === "waiting" ? `waiting for ${m?.name} to reply` : a.status === "blocked" ? "still needs someone available" : `a suggestion for ${m?.name}, waiting for your approval`}.`; });
  return `${current.every(a=>a.status==="accepted") ? "Everything in the replacement plan is confirmed." : "Here’s where things stand:"}\n\n${lines.join("\n")}`;
}
export function propose(s: Household, source: string, intent: Intent) {
  const until = intent.until ?? 1080; const targets = intent.targets ?? [];
  const affected = s.events.filter(e => e.date === s.date && e.ownerId === s.selfId && e.kind !== "meeting" && e.start < until && (!targets.length || targets.includes(e.kind) || targets.includes(e.id)));
  const active = s.plans.filter(p=>!["complete","cancelled"].includes(p.status));
  if (active.length) { say(s, "There’s already a plan in progress. Review it or cancel it before starting another, so we don’t create duplicate requests.", active[0].id); return; }
  if (!affected.length) { say(s, `I checked your calendar up to ${clock(until)}. No tasks assigned to you need cover in that window. Add a task in Calendar, or tell me a later return time.`, undefined, ["Read household calendar", "Checked affected tasks"]); return; }
  const assignments: Assignment[] = [];
  for (const e of affected.sort((a,b)=>a.start-b.start)) {
    const m = candidate(s,e,[],assignments);
    assignments.push({ id: uid(), eventId:e.id, memberId:m?.id ?? null, previousOwnerId:e.ownerId, reason:m ? e.kind==="pickup" ? `${m.name} is approved for pickup and free including travel time.` : e.kind==="delivery" ? `${m.name} will be home during the delivery window.` : `${m.name} is free during this errand.` : "No signed-in, eligible person is free for the whole task. Update household availability or arrange cover yourself.", excluded:[], status:m?"proposed":"blocked" });
  }
  const plan: Plan = { id:uid(), title:"A little room to breathe", source, status:assignments.every(a=>a.status==="blocked")?"blocked":"proposed", assignments, createdAt:now(), createdById:s.selfId, until };
  s.plans.unshift(plan); log(s,`Checked ${affected.length} tasks and prepared a replacement plan.`,"plan");
  say(s,`I’ll plan around you being unavailable until ${clock(until)}. I checked everyone’s calendar, pickup permissions, and time at home. Here’s what could work. Review the suggestions before any requests are created.`,plan.id,["Read today’s calendar", "Checked availability + travel time", "Checked pickup permissions", "Prepared requests for approval"]);
}
export function applyAction(state: Household, action: Action, intent?: Intent): Household {
  const s = structuredClone(state);

  if(action.type==="chat") {
    s.messages.push({id:uid(),role:"user",text:action.text,createdAt:now()}); const i=intent??parseIntent(action.text);
    if(i.kind==="status") say(s,statusText(s),undefined,["Read saved plan", "Checked request replies"]);
    else if(i.kind==="memory" && i.memory) { s.memories.unshift({id:uid(),text:i.memory,createdAt:now()}); log(s,"Saved a household note.","memory"); say(s,"Saved in household memory. Availability, delivery access, and pickup permissions are controlled in Household; update those settings if this note changes who can help."); }
    else if(i.kind==="disruption") propose(s,action.text,i);
    else say(s,"Tell me what changed and when you’ll be available again. For example: “My meeting is running late. I won’t be home until 6 pm.” You can also ask “Is everything sorted?” or say “Remember…” to save a household note.");
  }
  if(action.type==="approve") {
    const p=s.plans.find(p=>p.id===action.planId); if(!p||!["proposed","blocked"].includes(p.status)) throw new Error("This plan is no longer awaiting approval."); let count=0;
    for(const a of p.assignments.filter(a=>a.status==="proposed")) {
      const e=s.events.find(e=>e.id===a.eventId)!; const valid=candidate(s,e,s.members.filter(m=>m.id!==a.memberId).map(m=>m.id));
      if(!valid) { a.status="blocked"; a.memberId=null; a.reason="Availability changed. Review household settings and try a fresh plan."; continue; }
      a.status="waiting"; e.status="needs-cover"; count++; log(s,`Request created for ${valid.name}: ${e.title}.`,"request");
    }
    refreshPlan(p);
    say(s,count?`Approved. ${count} request${count===1?" is":"s are"} waiting in the household inbox. Each person must sign in and answer their own request. The calendar changes only after acceptance.`:"Nobody is currently available for this plan. Update the household settings, cancel this plan, and ask me to plan again.",p.id);
  }
  if(action.type==="cancel") {
    const p=s.plans.find(p=>p.id===action.planId); if(!p||p.status==="complete"||p.status==="cancelled") throw new Error("This plan cannot be cancelled."); p.status="cancelled";
    for(const a of p.assignments) { const e=s.events.find(e=>e.id===a.eventId); if(e) e.status=p.assignments.some(x=>x.eventId===e.id&&x.status==="accepted")?"covered":"scheduled"; }
    log(s,"Cancelled unconfirmed requests. Accepted calendar changes remain in place.","plan"); say(s,"Cancelled the unconfirmed requests. Any tasks that were already accepted stay with that person.");
  }
  if(action.type==="reply") {
    const p=s.plans.find(p=>p.id===action.planId); const a=p?.assignments.find(a=>a.id===action.assignmentId);
    if(!p||p.status==="cancelled"||!a||a.status!=="waiting") throw new Error("This request is no longer waiting for a reply.");
    const e=s.events.find(e=>e.id===a.eventId)!; const m=s.members.find(m=>m.id===a.memberId)!;
    if(action.accept) {
      const valid=candidate(s,e,s.members.filter(x=>x.id!==m.id).map(x=>x.id)); if(!valid) throw new Error("That person’s availability or permission changed. Decline this request to find another option.");
      a.status="accepted"; e.ownerId=m.id; e.status="covered"; log(s,`${m.name} accepted ${e.title}. Calendar updated.`,"reply"); say(s,`${m.name} accepted. ${e.title} is confirmed for ${clock(e.start)}, and the shared calendar has been updated.`);
    } else {
      a.status="declined"; log(s,`${m.name} declined ${e.title}. Looking for another option.`,"reply");
      const excluded=[...a.excluded,m.id]; const next=candidate(s,e,excluded);
      p.assignments.push({id:uid(),eventId:e.id,memberId:next?.id??null,previousOwnerId:a.previousOwnerId,excluded,reason:next?`${next.name} is eligible and free. ${m.name} declined the earlier request.`:"Everyone eligible is unavailable or has declined. This task still needs cover.",status:next?"proposed":"blocked"});
      say(s,next?`${m.name} can’t do it. ${next.name} is available for ${e.title}. I’ve prepared a replacement for you to approve.`:`${m.name} can’t do it, and I couldn’t find another eligible person. ${e.title} still needs cover. Update availability in Household, then cancel and create a fresh plan.`,p.id,["Recorded decline", "Checked remaining eligible members", "Prepared replacement suggestion"]);
    }
    refreshPlan(p);
  }
  if(action.type==="member-add") { if(s.members.length>=20)throw new Error("A household can have up to 20 people."); if(s.members.some(m=>m.email?.toLowerCase()===action.email.toLowerCase()))throw new Error("That person is already listed."); s.members.push({id:uid(),name:action.name,email:action.email.toLowerCase(),role:action.role,initials:action.name.slice(0,1).toUpperCase(),color:["mint","lilac","blue","peach"][s.members.length%4],availableFrom:action.availableFrom,availableUntil:action.availableUntil,pickupAllowed:action.pickupAllowed,canReceive:action.canReceive,atHome:action.atHome}); log(s,`Added ${action.name}. They can help once they join the household.`,"memory"); }
  if(action.type==="member") { const m=s.members.find(m=>m.id===action.memberId); if(!m) throw new Error("Household member not found."); Object.assign(m,{availableFrom:action.availableFrom,availableUntil:action.availableUntil,pickupAllowed:action.pickupAllowed,canReceive:action.canReceive,atHome:action.atHome}); log(s,`Updated ${m.name}’s availability and permissions.`,"memory"); }
  if(action.type==="event") { if(!s.members.some(m=>m.id===action.ownerId)) throw new Error("Choose a household member."); s.events.push({id:uid(),date:action.date,title:action.title,kind:action.kind,start:action.start,end:action.end,ownerId:action.ownerId,location:action.location,flexible:action.flexible,status:"scheduled"}); log(s,`Added ${action.title} to the calendar.`,"calendar"); }
  if(action.type==="memory") { s.memories.unshift({id:uid(),text:action.text,createdAt:now()}); log(s,"Saved a household note.","memory"); }
  if(action.type==="delete-memory") s.memories=s.memories.filter(m=>m.id!==action.id);
  s.messages=s.messages.slice(-120); s.memories=s.memories.slice(0,100); return s;
}
function refreshPlan(p:Plan) { const live=p.assignments.filter(a=>a.status!=="declined"); p.status=live.every(a=>a.status==="accepted")?"complete":live.some(a=>a.status==="proposed")?"proposed":live.some(a=>a.status==="waiting")?"waiting":"blocked"; }

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  GraduationCap,
  Home,
  Inbox,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  MapPin,
  Mic,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Volume2,
  X,
  BriefcaseBusiness,
  TriangleAlert,
} from "lucide-react";
import { SetupForm } from "@/components/account";
import { browserClient } from "@/lib/supabase/client";
import {
  clock,
  fromTime,
  inputTime,
  type Action,
  type Assignment,
  type CalendarEvent,
  type Household,
  type Member,
  type Plan,
} from "@/lib/household";

type APIData = {
  state: Household | null;
  isOwner?: boolean;
  user?: { id: string; email: string };
  aiConfigured: boolean;
  engine: string;
  notice?: string;
  error?: string;
};
type View = "today" | "calendar" | "requests" | "household" | "memory";
type Modal = "settings" | "event" | "memory" | "person" | "invite" | Member | CalendarEvent | null;
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: {
        results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
const navigation = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "requests", label: "Requests", icon: Inbox },
  { id: "household", label: "Household", icon: Users },
  { id: "memory", label: "Memory", icon: BookOpen },
] as const;
const prompts = [
  { label: "I’m running late", text: "I’m running late. I’ll be available again at " },
  { label: "Is everything sorted?", text: "Is everything sorted?" },
];
const icons = {
  pickup: GraduationCap,
  delivery: ShoppingBag,
  meeting: BriefcaseBusiness,
  errand: ShoppingBag,
};
const statusLabel: Record<string, string> = {
  proposed: "Review this",
  waiting: "Awaiting reply",
  accepted: "Confirmed",
  declined: "Declined",
  blocked: "Still needs help",
  complete: "All confirmed",
  cancelled: "Cancelled",
};

function Avatar({ member, small = false }: { member: Member; small?: boolean }) {
  return (
    <span className={`avatar ${member.color} ${small ? "small" : ""}`} title={member.name}>
      {member.initials}
    </span>
  );
}
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`}>
      <Leaf size={small ? 17 : 22} strokeWidth={1.6} />
    </span>
  );
}
function Empty({ icon: Icon, title, text }: { icon: typeof Inbox; title: string; text: string }) {
  return (
    <div className="empty">
      <span>
        <Icon size={25} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function ModalBox({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export default function PlanB() {
  const [state, setState] = useState<Household | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [calendarDate, setCalendarDate] = useState("");
  const [view, setView] = useState<View>("today");
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(false);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState("");
  const [ai, setAI] = useState(false);
  const [engine, setEngine] = useState("rules");
  const [chatOpen, setChatOpen] = useState(false);
  const [listen, setListen] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const actionLock = useRef(false);
  async function refresh(silent = false) {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const r = await fetch("/api/household", { cache: "no-store" });
      const data = (await r.json()) as APIData;
      if (!r.ok) {
        setAuth(r.status === 401);
        throw new Error(data.error);
      }
      setState(data.state);
      setIsOwner(Boolean(data.isOwner));
      setAI(data.aiConfigured);
      setEngine(data.engine);
      setAuth(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load your household.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (!actionLock.current) void refresh(true);
    }, 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    if (chatOpen) chatInput.current?.focus();
  }, [chatOpen]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state?.messages.length, chatOpen]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("plan-b-read-aloud");
      setReadAloud(saved === "true");
    } catch {}
    return () => {
      recognition.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);
  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setToast("Read aloud isn’t supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }
  async function act(action: Action) {
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = (await r.json()) as APIData;
      if (!r.ok) {
        if (r.status === 409) void refresh();
        throw new Error(data.error);
      }
      setState(data.state);
      setIsOwner(Boolean(data.isOwner));
      setAI(data.aiConfigured);
      setEngine(data.engine);
      if (action.type === "event") setCalendarDate(action.date);
      if (data.notice) setToast(data.notice);
      if (action.type === "chat" && readAloud) {
        const last = data.state?.messages.at(-1);
        if (last?.role === "assistant") speak(last.text);
      }
      return true;
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn’t save that change.");
      return false;
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function send(text = input) {
    if (!text.trim() || busy) return;
    setChatOpen(true);
    const ok = await act({ type: "chat", text: text.trim() });
    if (ok) setInput("");
  }
  function dictate() {
    if (listen) {
      recognition.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setToast("Voice input isn’t available here. You can type your message instead.");
      chatInput.current?.focus();
      return;
    }
    const rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      setInput(e.results[0][0].transcript);
      chatInput.current?.focus();
    };
    rec.onerror = (e) => {
      setListen(false);
      setToast(
        e.error === "not-allowed"
          ? "Microphone access was denied. Allow it in your browser, or type your message."
          : "Voice input stopped. Try again or type your message.",
      );
    };
    rec.onend = () => setListen(false);
    recognition.current = rec;
    try {
      rec.start();
      setListen(true);
    } catch {
      setToast("Couldn’t start the microphone. Please try again.");
    }
  }
  const me = state?.members.find((m) => m.id === state.selfId);
  async function invite(memberId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const d = (await r.json()) as { url: string; error?: string };
      if (!r.ok) throw new Error(d.error);
      setInviteLink(d.url);
      setModal("invite");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn’t create invitation.");
    } finally {
      setBusy(false);
    }
  }
  const pending =
    state?.plans
      .filter((p) => p.status !== "cancelled")
      .flatMap((p) => p.assignments)
      .filter((a) => a.status === "waiting").length ?? 0;
  const activePlan = state?.plans.find((p) => p.status !== "cancelled");
  const confirmed = activePlan?.assignments.filter((a) => a.status === "accepted").length ?? 0;
  const date = state
    ? new Date(`${state.date}T12:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "Your day, together";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="logo" href="/" aria-label="Plan B home">
          <Mark />
          <span>
            plan<span className="logo-b">b</span>
            <span className="logo-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <Home size={16} />
          </span>
          <div>
            <strong>{state?.name ?? "Your household"}</strong>
            <span>Everyone’s plans, in one place</span>
          </div>
        </div>
        <span className="nav-label">YOUR SPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={19} strokeWidth={1.7} />
              <span>{n.label}</span>
              {n.id === "requests" && pending > 0 ? (
                <span className="nav-count">{pending}</span>
              ) : n.id === "today" && view === "today" ? (
                <span className="active-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <Leaf size={23} strokeWidth={1.4} />
          </div>
          <h3>
            Plans change.
            <br />
            That’s okay.
          </h3>
          <p>
            Check who’s free and ask
            <br className="desktop-break" /> for a hand.
          </p>
        </div>
        <button className="settings-link" onClick={() => setModal("settings")}>
          <Settings2 size={18} />
          <span>Settings</span>
        </button>
        <div className="profile">
          <span className="avatar mint small">{me?.initials ?? "·"}</span>
          <div>
            <strong>{me?.name ?? "Your space"}</strong>
            <span>{state?.name ?? "Set up your household"}</span>
          </div>
          <span className="profile-dot" />
        </div>
      </aside>

      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            Your space <ChevronRight size={13} />
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="connection-tag">
              <span />
              Household assistant
            </span>
            {state && (
              <div className="avatar-stack">
                {state.members.slice(0, 3).map((m) => (
                  <Avatar key={m.id} member={m} small />
                ))}
              </div>
            )}
            <button
              className="icon-button mobile-settings"
              onClick={() => setModal("settings")}
              aria-label="Settings"
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        <div className="body-grid">
          <main className="main-content">
            {loading && !state ? (
              <div className="loading-state">
                <Mark />
                <LoaderCircle size={22} className="spin" />
                <p>Getting your household ready…</p>
              </div>
            ) : error && !state ? (
              <div className="error-state">
                <TriangleAlert size={30} />
                <h1>We couldn’t open your household</h1>
                <p>{error}</p>
                {auth ? (
                  <a href="/login" className="button primary">
                    Sign in <ArrowRight size={16} />
                  </a>
                ) : (
                  <button className="button primary" onClick={() => void refresh()}>
                    Try again
                  </button>
                )}
              </div>
            ) : state ? (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">
                      {view === "today"
                        ? date
                        : view === "calendar"
                          ? "EVERYONE’S PLANS, TOGETHER"
                          : view === "requests"
                            ? "A LITTLE HELP GOES BOTH WAYS"
                            : view === "household"
                              ? "YOUR PEOPLE"
                              : "THE SMALL THINGS THAT MATTER"}
                    </p>
                    <h1>
                      {view === "today"
                        ? "Here’s your day."
                        : view === "calendar"
                          ? "Everyone’s plans."
                          : view === "requests"
                            ? "Who’s helping with what?"
                            : view === "household"
                              ? "Your household."
                              : "Things to remember."}
                    </h1>
                    <p className="page-subtitle">
                      {view === "today"
                        ? "See what’s coming up and who can help if plans change."
                        : view === "calendar"
                          ? "See who’s doing what, and where there’s room to help."
                          : view === "requests"
                            ? "Check who’s replied and what still needs sorting."
                            : view === "household"
                              ? "Add your people, their free hours, and what they can help with."
                              : "Keep the notes you’d otherwise have to ask about again."}
                    </p>
                  </div>
                  {view === "calendar" && isOwner ? (
                    <button className="button secondary" onClick={() => setModal("event")}>
                      <Plus size={16} />
                      Add a task
                    </button>
                  ) : view === "memory" && isOwner ? (
                    <button className="button secondary" onClick={() => setModal("memory")}>
                      <Plus size={16} />
                      Add a note
                    </button>
                  ) : null}
                </div>

                {view === "today" && (
                  <>
                    <section className="hero-card">
                      <div className="hero-copy">
                        <span className="overline">
                          <span className="mini-spark">✳</span> WHEN THE DAY DOESN’T GO TO PLAN
                        </span>
                        <h2>
                          Running late?
                          <br />
                          Let’s work it out.
                        </h2>
                        <p>
                          Tell me what changed and when you’ll be free.
                          <br className="desktop-break" /> I’ll check who can give you a hand.
                        </p>
                        <button
                          className="button dark"
                          disabled={busy}
                          onClick={() => {
                            setChatOpen(true);
                            chatInput.current?.focus();
                            setInput("");
                          }}
                        >
                          Help me sort this out <ArrowUpRight size={17} />
                        </button>
                      </div>
                      <div className="hero-art" aria-hidden="true">
                        <svg viewBox="0 0 250 250">
                          <circle cx="126" cy="127" r="103" fill="#d9e5d6" />
                          <path
                            d="M27 148C75 141 64 94 114 103s25 71 81 52"
                            fill="none"
                            stroke="#617657"
                            strokeWidth="2"
                            strokeDasharray="4 7"
                          />
                          <rect
                            x="42"
                            y="140"
                            width="70"
                            height="76"
                            rx="17"
                            fill="#f5f4df"
                            transform="rotate(-12 42 140)"
                          />
                          <path
                            d="M58 164l13 9 21-27"
                            fill="none"
                            stroke="#788764"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                          <rect
                            x="108"
                            y="58"
                            width="82"
                            height="101"
                            rx="19"
                            fill="#fcfcf4"
                            transform="rotate(9 108 58)"
                          />
                          <path
                            d="M126 100h43m-45 16h33m-35 16h22"
                            stroke="#b0b9a4"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                          <circle cx="187" cy="172" r="32" fill="#537053" />
                          <path
                            d="M174 174l10 9 16-20"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M203 58v18m-9-9h18" stroke="#91a580" strokeWidth="2" />
                          <circle cx="67" cy="81" r="5" fill="#c5a47c" />
                          <path d="M119 203c3-16 10-27 23-31-1 18-9 29-23 31z" fill="#98ad86" />
                        </svg>
                        <span className="art-caption">
                          A few changes.
                          <br />
                          Everyone in the loop.
                        </span>
                      </div>
                    </section>
                    <div className="quick-prompts">
                      {prompts.slice(0, 2).map((p) => (
                        <button
                          key={p.label}
                          disabled={busy}
                          onClick={() => {
                            if (p.label === "I’m running late") {
                              setInput(p.text);
                              setChatOpen(true);
                              chatInput.current?.focus();
                            } else void send(p.text);
                          }}
                        >
                          {p.label}
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                      <button onClick={() => setView("memory")}>
                        <BookOpen size={14} />
                        Household memory
                      </button>
                    </div>
                    <section className="day-section">
                      <div className="section-heading">
                        <div>
                          <h2>On the calendar</h2>
                          <span>
                            {state.events.filter((e) => e.date === state.date).length} things for{" "}
                            {date.split(",")[0].toLowerCase()}
                          </span>
                        </div>
                        <button className="text-button" onClick={() => setView("calendar")}>
                          View calendar <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="timeline">
                        {!state.events.some((e) => e.date === state.date) && (
                          <Empty
                            icon={CalendarDays}
                            title="Nothing on the calendar yet"
                            text="Add your first task or appointment in Calendar."
                          />
                        )}
                        {state.events
                          .filter((e) => e.date === state.date)
                          .sort((a, b) => a.start - b.start)
                          .map((e) => (
                            <EventRow
                              key={e.id}
                              event={e}
                              state={state}
                              onClick={() => setModal(e)}
                            />
                          ))}
                      </div>
                    </section>
                    <section className="plan-section">
                      <div className="section-heading">
                        <div>
                          <h2>The new plan</h2>
                          <span>
                            {activePlan
                              ? `${confirmed} confirmed · ${pending} waiting for a reply`
                              : "We’ll keep the moving parts here."}
                          </span>
                        </div>
                        <span className="subtle-pill">
                          <span className="green-dot" />
                          You decide
                        </span>
                      </div>
                      {activePlan ? (
                        <PlanCard
                          plan={activePlan}
                          state={state}
                          canManage={isOwner}
                          busy={busy}
                          act={act}
                          openRequests={() => setView("requests")}
                        />
                      ) : (
                        <div className="calm-empty">
                          <span className="calm-icon">
                            <CheckCheck size={26} strokeWidth={1.4} />
                          </span>
                          <div>
                            <h3>No changes to sort out.</h3>
                            <p>
                              If something changes, the new plan and everyone’s replies will appear
                              here.
                            </p>
                          </div>
                        </div>
                      )}
                    </section>
                    <div className="bottom-note">
                      <ShieldCheck size={15} />
                      <span>You review the plan before anyone gets a request.</span>
                      <span className="bottom-note-right">One less thing to chase.</span>
                    </div>
                  </>
                )}

                {view === "calendar" && (
                  <>
                    <div className="calendar-bar">
                      <div>
                        <CalendarDays size={19} />
                        <strong>
                          {new Date(`${calendarDate || state.date}T12:00:00`).toLocaleDateString(
                            "en-GB",
                            { weekday: "long", day: "numeric", month: "long" },
                          )}
                        </strong>
                        <input
                          type="date"
                          aria-label="Calendar date"
                          value={calendarDate || state.date}
                          onChange={(e) => setCalendarDate(e.target.value)}
                        />
                      </div>
                      <span className="subtle-pill">Lagos · WAT</span>
                    </div>
                    <div className="timeline calendar-full">
                      {state.events
                        .filter((e) => e.date === (calendarDate || state.date))
                        .sort((a, b) => a.start - b.start)
                        .map((e) => (
                          <EventRow
                            key={e.id}
                            event={e}
                            state={state}
                            onClick={() => setModal(e)}
                          />
                        ))}
                    </div>
                    <p className="helper">
                      When someone accepts a task, their name appears here. Add plans yourself;
                      other calendar apps aren’t connected yet.
                    </p>
                  </>
                )}

                {view === "requests" && (
                  <>
                    <div className="simulation-note">
                      <Sparkles size={17} />
                      <div>
                        <strong>Waiting for a reply?</strong>
                        <p>Each person answers their own requests after signing in.</p>
                      </div>
                    </div>
                    {state.plans.some((p) => p.status !== "cancelled") ? (
                      state.plans
                        .filter((p) => p.status !== "cancelled")
                        .map((p) => (
                          <section key={p.id} className="request-group">
                            <div className="section-heading">
                              <h2>{p.title}</h2>
                              <span className={`pill ${p.status}`}>{statusLabel[p.status]}</span>
                            </div>
                            {p.assignments.map((a) => (
                              <RequestCard
                                key={a.id}
                                assignment={a}
                                plan={p}
                                state={state}
                                busy={busy}
                                act={act}
                              />
                            ))}
                            {isOwner && p.assignments.some((a) => a.status === "proposed") && (
                              <button
                                className="button primary"
                                disabled={busy}
                                onClick={() => void act({ type: "approve", planId: p.id })}
                              >
                                Ask them to help <Check size={16} />
                              </button>
                            )}
                          </section>
                        ))
                    ) : (
                      <Empty
                        icon={Inbox}
                        title="Nobody’s been asked yet"
                        text="Tell me what changed, review the plan, and choose who to ask. Their requests will appear here."
                      />
                    )}
                  </>
                )}

                {view === "household" && (
                  <>
                    {isOwner && (
                      <button
                        className="button secondary add-person"
                        onClick={() => setModal("person")}
                      >
                        <Plus size={16} />
                        Add a person
                      </button>
                    )}
                    <div className="member-grid">
                      {state.members.map((m) => (
                        <article key={m.id} className="member-card">
                          <div className="member-top">
                            <Avatar member={m} />
                            <button
                              disabled={!isOwner && m.id !== state.selfId}
                              className="icon-button"
                              aria-label={`Edit ${m.name}’s settings`}
                              onClick={() => setModal(m)}
                            >
                              <Settings2 size={17} />
                            </button>
                          </div>
                          <h2>
                            {m.name}
                            {m.id === state.selfId && <span>You</span>}
                          </h2>
                          <p>
                            {m.role}
                            {!m.userId ? " · Invitation needed" : " · Joined"}
                          </p>
                          <div className="member-availability">
                            <span className="green-dot" />
                            <span>
                              Free {clock(m.availableFrom)}–{clock(m.availableUntil)}
                            </span>
                          </div>
                          <div className="member-tags">
                            <span className={m.pickupAllowed ? "allowed" : ""}>
                              <GraduationCap size={13} />
                              {m.pickupAllowed ? "Pickup approved" : "No school pickup"}
                            </span>
                            <span className={m.atHome && m.canReceive ? "allowed" : ""}>
                              <Home size={13} />
                              {m.atHome && m.canReceive
                                ? "Can receive at home"
                                : "Away / no deliveries"}
                            </span>
                          </div>
                          {(isOwner || m.id === state.selfId) && (
                            <button className="text-button" onClick={() => setModal(m)}>
                              Edit availability <ArrowRight size={14} />
                            </button>
                          )}
                          {isOwner && !m.userId && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => void invite(m.id)}
                            >
                              Create invitation <ArrowUpRight size={14} />
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                    <div className="info-card">
                      <ShieldCheck size={23} />
                      <div>
                        <h3>Who can help?</h3>
                        <p>
                          I check whether each person is free for the whole task. School pickups
                          also need permission and 15 minutes on either side for travel.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {view === "memory" && (
                  <>
                    <div className="memory-intro">
                      <BookOpen size={21} />
                      <p>
                        These notes stay here for next time. To change who can do school pickups or
                        receive deliveries, go to{" "}
                        <button onClick={() => setView("household")}>Household</button>.
                      </p>
                    </div>
                    <div className="memory-list">
                      {state.memories.length ? (
                        state.memories.map((m, i) => (
                          <article key={m.id} className="memory-card">
                            <span className="memory-number">{String(i + 1).padStart(2, "0")}</span>
                            <div>
                              <p>{m.text}</p>
                              <span>Saved for next time</span>
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`Delete note: ${m.text}`}
                              disabled={busy || !isOwner}
                              onClick={() => void act({ type: "delete-memory", id: m.id })}
                            >
                              <X size={17} />
                            </button>
                          </article>
                        ))
                      ) : (
                        <Empty
                          icon={BookOpen}
                          title="No notes yet"
                          text="Add something you’d like everyone to remember."
                        />
                      )}
                    </div>
                    <button
                      className="add-memory"
                      disabled={!isOwner}
                      onClick={() => setModal("memory")}
                    >
                      <Plus size={19} />
                      Add something to remember
                    </button>
                  </>
                )}
              </>
            ) : (
              <SetupForm onCreated={() => void refresh()} />
            )}
          </main>

          <aside
            className={`assistant-panel ${chatOpen ? "mobile-open" : ""}`}
            aria-label="Household assistant"
          >
            <div className="assistant-header">
              <div>
                <span className="assistant-symbol">
                  <Sparkles size={17} />
                </span>
                <div>
                  <h2>Need a hand?</h2>
                  <span>
                    <span className="green-dot" />
                    {engine === "ai"
                      ? "AI assisted"
                      : engine === "ready"
                        ? "AI is set up"
                        : "Calendar planner"}
                  </span>
                </div>
              </div>
              <button
                className="icon-button mobile-close"
                aria-label="Close assistant"
                onClick={() => setChatOpen(false)}
              >
                <X size={20} />
              </button>
              <button
                className="icon-button desktop-assistant-settings"
                aria-label="Assistant settings"
                onClick={() => setModal("settings")}
              >
                <Settings2 size={17} />
              </button>
            </div>
            <div className="assistant-intro">
              <span className="little-label">LET’S SORT IT OUT</span>
              <p>
                Tell me what’s changed.
                <br />
                We’ll take it from there.
              </p>
            </div>
            <div className="chat-feed" aria-live="polite">
              {state?.messages.map((m) => (
                <div key={m.id} className={`chat-message ${m.role}`}>
                  {m.role === "assistant" && (
                    <div className="chat-byline">
                      <Mark small />
                      <span>Plan B</span>
                      <button
                        className="read-button"
                        onClick={() => speak(m.text)}
                        aria-label="Read this response aloud"
                      >
                        <Volume2 size={13} />
                      </button>
                    </div>
                  )}
                  <p>{m.text}</p>
                  {m.trace && (
                    <details className="trace">
                      <summary>
                        <CheckCheck size={13} />
                        What I checked <ChevronRight size={12} />
                      </summary>
                      <ul>
                        {m.trace.map((t) => (
                          <li key={t}>
                            <Check size={12} />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {m.planId && (
                    <button
                      className="chat-plan-link"
                      onClick={() => {
                        setView("today");
                        setChatOpen(false);
                        setTimeout(
                          () =>
                            document
                              .querySelector(".plan-section")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          50,
                        );
                      }}
                    >
                      Review your plan <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              ))}
              {busy && (
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                  <small>Checking the calendar…</small>
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            <div className="chat-composer-wrap">
              <div className="chat-shortcuts">
                {prompts.slice(0, 2).map((p) => (
                  <button
                    key={p.label}
                    disabled={busy || !state}
                    onClick={() => {
                      if (p.label === "I’m running late") {
                        setInput(p.text);
                        setChatOpen(true);
                        chatInput.current?.focus();
                      } else void send(p.text);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <form
                className={`chat-composer ${listen ? "listening" : ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <textarea
                  ref={chatInput}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={1000}
                  placeholder={listen ? "Listening…" : "Tell me what’s happening…"}
                  aria-label="Message Plan B"
                  rows={2}
                  disabled={!state}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="composer-controls">
                  <button
                    type="button"
                    disabled={busy || !state}
                    className={`mic-button ${listen ? "recording" : ""}`}
                    aria-label={listen ? "Stop microphone" : "Dictate a message"}
                    onClick={dictate}
                  >
                    <Mic size={17} />
                    <span>{listen ? "Listening…" : "Use your voice"}</span>
                  </button>
                  <button
                    className="send-button"
                    disabled={busy || !state || !input.trim()}
                    aria-label="Send message"
                  >
                    {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={19} />}
                  </button>
                </div>
              </form>
              <p className="composer-disclaimer">
                {ai
                  ? "AI interprets your request. You approve every change."
                  : "Saved household data · replies from signed-in members"}
              </p>
            </div>
            <div className="assistant-footer">
              <Leaf size={13} />
              <span>We’ll keep track of the replies.</span>
            </div>
          </aside>
        </div>
      </div>

      <button
        className="mobile-chat-trigger"
        onClick={() => setChatOpen(true)}
        aria-label="Open assistant"
      >
        <Sparkles size={21} />
        Need a hand?
      </button>
      {toast && (
        <div role="status" className="toast">
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <ModalBox
          title={
            modal === "settings"
              ? "Settings"
              : modal === "event"
                ? "Add a household task"
                : modal === "memory"
                  ? "Something to remember"
                  : modal === "person"
                    ? "Add a person"
                    : modal === "invite"
                      ? "Send them the link"
                      : "pickupAllowed" in modal
                        ? `${modal.name}’s availability`
                        : modal.title
          }
          onClose={() => setModal(null)}
        >
          {modal === "settings" && (
            <div className="settings-content">
              <div className="settings-status">
                <Sparkles size={23} />
                <div>
                  <h3>{ai ? "AI is set up" : "AI isn’t connected yet"}</h3>
                  <p>
                    {ai
                      ? "I’ll use AI to understand your message, then check everyone’s free hours and permissions before suggesting a plan."
                      : "You can still tell me when you’ll be back, check replies, and save notes. Open-ended chat needs an AI connection."}
                  </p>
                </div>
              </div>
              <label className="toggle-row">
                <div>
                  <strong>Read responses aloud</strong>
                  <span>Use your browser’s voice after each message.</span>
                </div>
                <input
                  type="checkbox"
                  checked={readAloud}
                  onChange={(e) => {
                    setReadAloud(e.target.checked);
                    try {
                      localStorage.setItem("plan-b-read-aloud", String(e.target.checked));
                    } catch {}
                  }}
                />
              </label>
              <div className="settings-explainer">
                <h3>Who can do what?</h3>
                <p>
                  The person who started the household manages plans and permissions. Everyone else
                  can update their own free hours and reply to their requests. You’ll see changes
                  here as they happen.
                </p>
              </div>
              <button
                disabled={!state}
                className="button secondary"
                onClick={async () => {
                  await browserClient().auth.signOut();
                  window.location.assign("/login");
                }}
              >
                Sign out
              </button>
            </div>
          )}
          {modal === "person" && (
            <PersonForm
              busy={busy}
              onSave={async (a) => {
                if (await act(a)) {
                  setModal(null);
                  setToast("Added. Make an invitation link so they can join.");
                }
              }}
            />
          )}
          {modal === "invite" && (
            <div className="edit-form">
              <p className="helper">
                Send this link to the person you added. They’ll need to sign in with the same email
                address you entered. The link lasts seven days; making a new one replaces the old
                one.
              </p>
              <label>
                Invitation link
                <input value={inviteLink} readOnly onFocus={(e) => e.target.select()} />
              </label>
              <button
                className="button primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink);
                    setToast("Invitation link copied.");
                  } catch {
                    setToast("Select the link and copy it manually.");
                  }
                }}
              >
                Copy invitation
              </button>
            </div>
          )}
          {modal === "event" && state && (
            <EventForm
              state={state}
              busy={busy}
              onSave={async (a) => {
                if (await act(a)) {
                  setModal(null);
                  setToast("Added to the calendar.");
                }
              }}
            />
          )}
          {modal === "memory" && (
            <MemoryForm
              busy={busy}
              onSave={async (text) => {
                if (await act({ type: "memory", text })) {
                  setModal(null);
                  setToast("Saved for next time.");
                }
              }}
            />
          )}
          {typeof modal === "object" &&
            modal !== null &&
            ("pickupAllowed" in modal ? (
              <MemberForm
                key={modal.id}
                member={modal}
                canManage={isOwner}
                busy={busy}
                onSave={async (a) => {
                  if (await act(a)) {
                    setModal(null);
                    setToast("Saved their availability.");
                  }
                }}
              />
            ) : (
              <div className="event-details">
                <span className="subtle-pill">{modal.kind}</span>
                <p>
                  <Clock3 size={17} />
                  {clock(modal.start)}–{clock(modal.end)}
                </p>
                <p>
                  <MapPin size={17} />
                  {modal.location || "Location not set"}
                </p>
                <p>
                  <Users size={17} />
                  {state?.members.find((m) => m.id === modal.ownerId)?.name}
                </p>
                <div className="info-card">
                  <ShieldCheck size={20} />
                  <p>
                    {modal.status === "covered"
                      ? "Cover has been accepted. The shared calendar is updated."
                      : modal.status === "needs-cover"
                        ? "Waiting for someone to accept. The original assignment is still in place."
                        : modal.flexible
                          ? "This task has a flexible time. Ask the assistant for cover when your day changes."
                          : "This task has a fixed time. Plan B will check the full time window."}
                  </p>
                </div>
              </div>
            ))}
        </ModalBox>
      )}
    </div>
  );
}

function EventRow({
  event: e,
  state,
  onClick,
}: {
  event: CalendarEvent;
  state: Household;
  onClick: () => void;
}) {
  const Icon = icons[e.kind];
  const m = state.members.find((m) => m.id === e.ownerId)!;
  return (
    <button className={`event-row ${e.status}`} onClick={onClick}>
      <span className="event-time">
        {clock(e.start)}
        <small>{clock(e.end)}</small>
      </span>
      <span className={`event-icon ${e.kind}`}>
        <Icon size={19} strokeWidth={1.5} />
      </span>
      <span className="event-copy">
        <strong>{e.title}</strong>
        <small>{e.location}</small>
      </span>
      <span className="event-owner">
        <Avatar member={m} small />
        <span>{m.id === state.selfId ? "You" : m.name}</span>
      </span>
      {e.status === "covered" ? (
        <span className="event-check" title="Confirmed">
          <CheckCheck size={17} />
        </span>
      ) : e.status === "needs-cover" ? (
        <span className="cover-dot" title="Waiting for cover" />
      ) : (
        <ChevronRight size={15} className="event-chevron" />
      )}
    </button>
  );
}

function PlanCard({
  plan,
  state,
  canManage,
  busy,
  act,
  openRequests,
}: {
  plan: Plan;
  state: Household;
  canManage: boolean;
  busy: boolean;
  act: (a: Action) => Promise<boolean>;
  openRequests: () => void;
}) {
  const live = plan.assignments.filter((a) => a.status !== "declined");
  return (
    <div className="plan-card">
      <div className="plan-card-head">
        <span className="plan-symbol">
          <Sparkles size={18} />
        </span>
        <div>
          <h3>
            {plan.status === "complete" ? "Everyone’s confirmed." : "Here’s what could work."}
          </h3>
          <p>
            {plan.status === "complete"
              ? "The calendar is up to date."
              : `Planning around you being back at ${clock(plan.until)}.`}
          </p>
        </div>
        <span className={`pill ${plan.status}`}>{statusLabel[plan.status]}</span>
      </div>
      <div className="plan-assignments">
        {live.map((a) => {
          const e = state.events.find((e) => e.id === a.eventId)!;
          const m = state.members.find((m) => m.id === a.memberId);
          const Icon = icons[e.kind];
          return (
            <div className="plan-assignment" key={a.id}>
              <span className={`event-icon ${e.kind}`}>
                <Icon size={17} />
              </span>
              <div>
                <h4>
                  {e.title}
                  <span>{clock(e.start)}</span>
                </h4>
                <p>{a.reason}</p>
              </div>
              <span className="assignment-person">
                {m && <Avatar member={m} small />}
                <span>{m?.name ?? "No cover"}</span>
                <small className={a.status}>{statusLabel[a.status]}</small>
              </span>
            </div>
          );
        })}
      </div>
      <div className="plan-actions">
        {canManage && live.some((a) => a.status === "proposed") ? (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void act({ type: "approve", planId: plan.id })}
          >
            <Check size={16} />
            Ask them to help
          </button>
        ) : plan.status === "complete" ? (
          <span className="confirmed-note">
            <CheckCheck size={17} />
            Calendar updated
          </span>
        ) : (
          <button className="button primary" onClick={openRequests}>
            View requests <ArrowRight size={16} />
          </button>
        )}
        {canManage && !["complete", "cancelled"].includes(plan.status) && (
          <button
            className="text-button muted"
            disabled={busy}
            onClick={() => void act({ type: "cancel", planId: plan.id })}
          >
            Cancel plan
          </button>
        )}
      </div>
    </div>
  );
}

function RequestCard({
  assignment: a,
  plan,
  state,
  busy,
  act,
}: {
  assignment: Assignment;
  plan: Plan;
  state: Household;
  busy: boolean;
  act: (a: Action) => Promise<boolean>;
}) {
  const e = state.events.find((e) => e.id === a.eventId)!;
  const m = state.members.find((m) => m.id === a.memberId);
  return (
    <article className={`request-card ${a.status}`}>
      <div className="request-card-head">
        {m ? (
          <Avatar member={m} />
        ) : (
          <span className="request-unassigned">
            <TriangleAlert size={20} />
          </span>
        )}
        <div>
          <h3>{m ? `For ${m.name}` : "Still needs a hand"}</h3>
          <p>
            {e.title} · {clock(e.start)}
          </p>
        </div>
        <span className={`pill ${a.status}`}>{statusLabel[a.status]}</span>
      </div>
      <p className="request-reason">{a.reason}</p>
      {a.status === "waiting" && m?.id === state.selfId && (
        <div className="request-response">
          <span>
            Your reply <small>Updates the shared plan</small>
          </span>
          <div>
            <button
              disabled={busy}
              className="button secondary"
              onClick={() =>
                void act({ type: "reply", planId: plan.id, assignmentId: a.id, accept: false })
              }
            >
              Can’t make it
            </button>
            <button
              disabled={busy}
              className="button primary"
              onClick={() =>
                void act({ type: "reply", planId: plan.id, assignmentId: a.id, accept: true })
              }
            >
              <Check size={16} />I can help
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function MemberForm({
  member: m,
  canManage,
  busy,
  onSave,
}: {
  member: Member;
  canManage: boolean;
  busy: boolean;
  onSave: (a: Action) => Promise<void>;
}) {
  return (
    <form
      className="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          type: "member",
          memberId: m.id,
          availableFrom: fromTime(String(f.get("from"))),
          availableUntil: fromTime(String(f.get("until"))),
          pickupAllowed: canManage ? f.has("pickup") : m.pickupAllowed,
          canReceive: canManage ? f.has("receive") : m.canReceive,
          atHome: f.has("home"),
        });
      }}
    >
      <p className="helper">
        Set your usual free hours. Anything already in the calendar still counts as busy time.
      </p>
      <div className="form-grid">
        <label>
          Free from
          <input type="time" name="from" defaultValue={inputTime(m.availableFrom)} required />
        </label>
        <label>
          Free until
          <input type="time" name="until" defaultValue={inputTime(m.availableUntil)} required />
        </label>
      </div>
      <label className="toggle-row">
        <div>
          <strong>Approved for school pickup</strong>
          <span>Allowed to collect children from school.</span>
        </div>
        <input
          type="checkbox"
          name="pickup"
          disabled={!canManage}
          defaultChecked={m.pickupAllowed}
        />
      </label>
      <label className="toggle-row">
        <div>
          <strong>Can receive deliveries</strong>
          <span>Allowed to receive orders for the household.</span>
        </div>
        <input type="checkbox" name="receive" disabled={!canManage} defaultChecked={m.canReceive} />
      </label>
      <label className="toggle-row">
        <div>
          <strong>At home during availability</strong>
          <span>I’ll check this before suggesting them for a delivery.</span>
        </div>
        <input type="checkbox" name="home" defaultChecked={m.atHome} />
      </label>
      <button className="button primary" disabled={busy}>
        Save availability <Check size={16} />
      </button>
    </form>
  );
}
function EventForm({
  state,
  busy,
  onSave,
}: {
  state: Household;
  busy: boolean;
  onSave: (a: Action) => Promise<void>;
}) {
  return (
    <form
      className="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          type: "event",
          date: String(f.get("date")),
          title: String(f.get("title")),
          kind: String(f.get("kind")) as CalendarEvent["kind"],
          start: fromTime(String(f.get("start"))),
          end: fromTime(String(f.get("end"))),
          ownerId: String(f.get("owner")),
          location: String(f.get("location")),
          flexible: f.has("flexible"),
        });
      }}
    >
      <label>
        Task date
        <input name="date" type="date" defaultValue={state.date} required />
      </label>
      <label>
        What needs doing?
        <input name="title" placeholder="e.g. Pick up a parcel" maxLength={100} required />
      </label>
      <div className="form-grid">
        <label>
          Task type
          <select name="kind">
            <option value="errand">Errand</option>
            <option value="pickup">School pickup</option>
            <option value="delivery">Delivery</option>
            <option value="meeting">Meeting / busy time</option>
          </select>
        </label>
        <label>
          Assigned to
          <select name="owner">
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === state.selfId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Start time
          <input name="start" type="time" required />
        </label>
        <label>
          End time
          <input name="end" type="time" required />
        </label>
      </div>
      <label>
        Location
        <input name="location" placeholder="Where is it?" maxLength={200} />
      </label>
      <label className="checkbox-label">
        <input name="flexible" type="checkbox" />
        This can wait if something comes up
      </label>
      <button className="button primary" disabled={busy}>
        Add to calendar <Plus size={16} />
      </button>
    </form>
  );
}
function MemoryForm({ busy, onSave }: { busy: boolean; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  return (
    <form
      className="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(text.trim());
      }}
    >
      <label>
        Add something to remember
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What should your household know for next time?"
          rows={4}
          maxLength={500}
          required
        />
      </label>
      <p className="helper">
        Need to change who can help? Update their permissions and free hours in Household.
      </p>
      <button className="button primary" disabled={busy || !text.trim()}>
        Save note <BookOpen size={16} />
      </button>
    </form>
  );
}
function PersonForm({ busy, onSave }: { busy: boolean; onSave: (a: Action) => Promise<void> }) {
  return (
    <form
      className="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          type: "member-add",
          name: String(f.get("name")),
          email: String(f.get("email")),
          role: String(f.get("role")),
          availableFrom: fromTime(String(f.get("from"))),
          availableUntil: fromTime(String(f.get("until"))),
          pickupAllowed: f.has("pickup"),
          canReceive: f.has("receive"),
          atHome: f.has("home"),
        });
      }}
    >
      <label>
        Name
        <input name="name" maxLength={70} required />
      </label>
      <label>
        Their email
        <input name="email" type="email" maxLength={254} required />
      </label>
      <label>
        Relationship
        <select name="role">
          <option>Family</option>
          <option>Housemate</option>
          <option>Trusted neighbour</option>
          <option>Other</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          Free from
          <input type="time" name="from" required />
        </label>
        <label>
          Free until
          <input type="time" name="until" required />
        </label>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" name="pickup" />
        Approved for school pickup
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="receive" />
        Can receive household deliveries
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="home" />
        At home during availability
      </label>
      <p className="helper">
        They’ll need to join using this email address before you can ask them to help.
      </p>
      <button disabled={busy} className="button primary">
        Add person <Plus size={16} />
      </button>
    </form>
  );
}

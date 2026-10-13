"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Leaf, LoaderCircle } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import { fromTime } from "@/lib/household";
export function SetupForm({ onCreated }: { onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          householdName: data.get("householdName"),
          availableFrom: fromTime(String(data.get("from"))),
          availableUntil: fromTime(String(data.get("until"))),
        }),
      });
      const result = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(result.error);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t create your household.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="setup-card">
      <span className="brand-mark">
        <Leaf size={22} />
      </span>
      <p className="eyebrow">YOUR HOUSEHOLD</p>
      <h1>Let’s get your household set up.</h1>
      <p className="page-subtitle">
        Start with your name and the hours you’re usually free. You can add people and plans as you
        go.
      </p>
      <form className="edit-form" onSubmit={submit}>
        <label>
          Your name
          <input name="name" autoComplete="given-name" maxLength={70} required />
        </label>
        <label>
          Household name
          <input
            name="householdName"
            placeholder="What should we call your household?"
            maxLength={100}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Usually free from
            <input name="from" type="time" required />
          </label>
          <label>
            Usually free until
            <input name="until" type="time" required />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="button primary">
          {busy ? <LoaderCircle size={16} className="spin" /> : "Create household"}
          <ArrowRight size={16} />
        </button>
      </form>
    </section>
  );
}
export function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [next, setNext] = useState("/");
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const n = p.get("next");
    if (n?.startsWith("/") && !n.startsWith("//") && !n.includes("\\")) setNext(n);
    if (p.get("error"))
      setError("That link didn’t work. Try signing in if you’ve already confirmed your email.");
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const f = new FormData(e.currentTarget);
    try {
      const db = browserClient();
      const email = String(f.get("email"));
      const password = String(f.get("password"));
      if (mode === "signup") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) window.location.assign(next);
        else setNotice("Check your email to confirm your account, then come back and sign in.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <section className="account-card">
        <a className="logo" href="/">
          <span className="brand-mark">
            <Leaf size={22} />
          </span>
          <span>
            plan<b>b</b>.
          </span>
        </a>
        <p className="eyebrow">PLAN B</p>
        <h1>{mode === "signin" ? "Welcome back." : "Let’s get you set up."}</h1>
        <p className="page-subtitle">
          {mode === "signin"
            ? "Sign in to see your household’s plans and requests."
            : "Create an account to start or join a household."}
        </p>
        {!configured ? (
          <div className="info-card">
            <p>
              Accounts aren’t ready yet. If this is your project, follow the account setup steps in
              the README.
            </p>
          </div>
        ) : (
          <form className="edit-form" onSubmit={submit}>
            <label>
              Email address
              <input type="email" name="email" autoComplete="email" required maxLength={254} />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="form-success">
                {notice}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        <button
          className="text-button account-switch"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setNotice("");
          }}
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
export function Join() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signin, setSignin] = useState(false);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token") ?? ""), []);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        setSignin(r.status === 401);
        throw new Error(data.error);
      }
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t join this household.");
    } finally {
      setBusy(false);
    }
  }
  const next = `/join?token=${encodeURIComponent(token)}`;
  return (
    <main className="account-page">
      <section className="account-card">
        <span className="brand-mark">
          <Leaf size={22} />
        </span>
        <p className="eyebrow">YOU’VE BEEN INVITED</p>
        <h1>Join your household.</h1>
        <p className="page-subtitle">
          Sign in with the email address they invited. Then you can see the calendar, set your free
          hours, and answer when someone asks for help.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {signin ? (
          <a className="button primary" href={`/login?next=${encodeURIComponent(next)}`}>
            Sign in to join <ArrowRight size={16} />
          </a>
        ) : (
          <button
            className="button primary"
            disabled={busy || !/^[a-f0-9]{64}$/.test(token)}
            onClick={() => void join()}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : "Join household"}
            <ArrowRight size={16} />
          </button>
        )}
      </section>
    </main>
  );
}

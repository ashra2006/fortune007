import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { initFirebase } from "@/lib/firebase";
import { api } from "@/lib/api";
import { PILLARS } from "@/lib/pillars";

const FB_MSG = {
  "auth/operation-not-allowed": "This sign-in method is turned off in Firebase. Turn on Email/Password (and Google) under Firebase console > Authentication > Sign-in method.",
  "auth/unauthorized-domain": "This website isn't on Firebase's list of approved domains yet. Add it under Firebase console > Authentication > Settings > Authorized domains.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
};
const fbError = (e) => FB_MSG[e?.code] || (e?.code || "").replace("auth/", "").replace(/-/g, " ") || e?.message;

const AuthCard = () => {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const auth = await initFirebase();
      if (mode === "login") await signInWithEmailAndPassword(auth, f.email, f.password);
      else {
        const cred = await createUserWithEmailAndPassword(auth, f.email, f.password);
        if (f.name) {
          await updateProfile(cred.user, { displayName: f.name });
          await api.patch("/me", { name: f.name }).catch(() => {});
        }
      }
    } catch (err) {
      toast.error(fbError(err));
    }
    setBusy(false);
  };

  const google = async () => {
    try {
      await signInWithPopup(await initFirebase(), new GoogleAuthProvider());
    } catch (err) {
      toast.error(fbError(err));
    }
  };

  const field = "w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-amber-500/60 transition-colors";
  return (
    <div className="panel p-7 w-full max-w-md rise" style={{ animationDelay: ".2s" }} data-testid="auth-card">
      <div className="flex gap-1 p-1 bg-slate-950/60 rounded-lg mb-6">
        {["login", "signup"].map((m) => (
          <button key={m} data-testid={`auth-tab-${m}`} onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${mode === m ? "bg-slate-800 text-white" : "text-slate-500"}`}>
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && <input data-testid="auth-name-input" className={field} placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
        <input data-testid="auth-email-input" type="email" required className={field} placeholder="Work email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input data-testid="auth-password-input" type="password" required minLength={6} className={field} placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button data-testid="auth-submit-button" disabled={busy} className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
          {busy ? "Authenticating…" : mode === "login" ? "Enter command center" : "Create account"} <ArrowRight size={16} />
        </button>
      </form>
      <div className="flex items-center gap-3 my-5 text-[10px] font-mono text-slate-600"><span className="flex-1 h-px bg-slate-800" />OR<span className="flex-1 h-px bg-slate-800" /></div>
      <button data-testid="auth-google-button" onClick={google} className="w-full py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 text-sm transition-colors">Continue with Google</button>
    </div>
  );
};

const NotConfigured = () => (
  <div className="panel p-7 max-w-md" data-testid="auth-not-configured">
    <ShieldCheck className="text-amber-400 mb-3" />
    <h3 className="font-display text-lg font-semibold">Sign-in is not configured yet</h3>
    <p className="text-sm text-slate-400 mt-2">The admin needs to add the Firebase web API key in the Admin Console before users can sign in.</p>
    <Link to="/admin" className="inline-block mt-4 text-sm text-amber-400 hover:underline" data-testid="goto-admin-link">Open Admin Console →</Link>
  </div>
);

export default function Landing() {
  const { user, loading, configured } = useAuth();
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => (x + 1) % PILLARS.length), 2200); return () => clearInterval(i); }, []);
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  const P = PILLARS[t];
  return (
    <div className="min-h-screen grid-lines relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-md bg-amber-500 text-slate-950 grid place-items-center font-display font-extrabold text-sm">07</span><span className="font-display font-bold tracking-[0.2em] text-sm">FORTUNE 007</span></div>
          <Link to="/admin" data-testid="landing-admin-link" className="text-xs font-mono text-slate-500 hover:text-amber-400 transition-colors">ADMIN ACCESS</Link>
        </div>
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-16 items-center mt-20 lg:mt-28">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-emerald-400 rise">● FOUNDER OPERATING SYSTEM</p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mt-5 leading-[1.05] rise" style={{ animationDelay: ".08s" }}>
              Run the whole company<br />from one <span className="text-amber-400">command deck.</span>
            </h1>
            <p className="text-slate-400 mt-6 max-w-xl text-base rise" style={{ animationDelay: ".14s" }}>
              Six AI-powered pillars — ideas, capital, talent, tax, market intel and strategy — each with its own specialist assistant.
            </p>
            <div className="mt-10 flex items-center gap-4 rise" style={{ animationDelay: ".2s" }}>
              <div className="w-12 h-12 rounded-xl border grid place-items-center transition-colors" style={{ borderColor: P.hex + "55", color: P.hex }}><P.icon size={22} /></div>
              <div><div className="font-display font-semibold" style={{ color: P.hex }}>{P.name}</div><div className="text-sm text-slate-400">{P.tagline}</div></div>
            </div>
          </div>
          {loading ? <div className="font-mono text-amber-400">INITIALISING…</div> : configured ? <AuthCard /> : <NotConfigured />}
        </div>
      </div>
    </div>
  );
}

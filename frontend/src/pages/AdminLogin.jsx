import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { api, errMsg } from "@/lib/api";

export default function AdminLogin() {
  const [f, setF] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/admin/login", f);
      localStorage.setItem("f007_admin_token", data.token);
      nav("/admin/console");
    } catch (err) {
      toast.error(errMsg(err));
    }
    setBusy(false);
  };
  const field = "w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm font-mono outline-none focus:border-amber-500/60";
  return (
    <div className="min-h-screen grid-lines grid place-items-center px-6">
      <form onSubmit={submit} className="panel p-8 w-full max-w-sm rise" data-testid="admin-login-form">
        <Lock className="text-amber-400" />
        <h1 className="font-display text-2xl font-bold mt-4">Admin Console</h1>
        <p className="text-xs text-slate-500 mt-1 font-mono">RESTRICTED · FORTUNE 007</p>
        <div className="space-y-3 mt-6">
          <input data-testid="admin-username-input" className={field} placeholder="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
          <input data-testid="admin-password-input" type="password" className={field} placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button data-testid="admin-login-button" disabled={busy} className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-60">
            {busy ? "Verifying…" : "Unlock"}
          </button>
        </div>
        <Link to="/" className="block text-center text-xs text-slate-500 hover:text-white mt-5" data-testid="admin-back-link">← Back to app</Link>
      </form>
    </div>
  );
}

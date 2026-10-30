import { Link, useNavigate } from "react-router-dom";
import { LogOut, LayoutGrid } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PILLARS } from "@/lib/pillars";

export const AppHeader = ({ active }) => {
  const { profile, user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-50 bg-[#080B11]/90 backdrop-blur-xl border-b border-slate-800/80" data-testid="app-header">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center gap-6">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0" data-testid="header-logo-link">
          <span className="w-8 h-8 rounded-md bg-amber-500 text-slate-950 grid place-items-center font-display font-extrabold text-sm">07</span>
          <span className="font-display font-bold tracking-[0.2em] text-sm">FORTUNE 007</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
          <Link to="/dashboard" data-testid="nav-dashboard" className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors ${!active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>
            <LayoutGrid size={14} /> Command
          </Link>
          {PILLARS.map((p) => (
            <Link key={p.id} to={`/pillar/${p.id}`} data-testid={`nav-${p.id}`}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${active === p.id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>
              {p.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-200" data-testid="header-user-name">{profile?.name || user?.displayName || "Founder"}</div>
            <div className="text-[10px] font-mono text-slate-500">{user?.email}</div>
          </div>
          <button data-testid="logout-button" onClick={async () => { await logout(); nav("/"); }}
            className="p-2 rounded-md border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

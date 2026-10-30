import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/context/AuthContext";
import { PILLARS, inr } from "@/lib/pillars";
import { api } from "@/lib/api";

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [m, setM] = useState({});
  useEffect(() => {
    Promise.all([api.get("/notes"), api.get("/investors"), api.get("/candidates"), api.get("/gst/invoices")])
      .then(([n, i, c, g]) => setM({
        venture_radar: `${n.data.length} ideas`,
        capital_flow: inr(i.data.filter((x) => x.status === "Closed").reduce((s, x) => s + Number(x.amount || 0), 0)) + " closed",
        talent_forge: `${c.data.length} candidates`,
        tax_desk: `${g.data.length} invoices`,
        market_pulse: "Live feed",
        strategy_lab: "Advisor online",
      }))
      .catch(() => {});
  }, []);
  const name = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Founder";
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12">
        <p className="font-mono text-xs tracking-[0.3em] text-emerald-400 rise">● ALL SYSTEMS NOMINAL</p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mt-3 rise" data-testid="dashboard-greeting">Good to see you, {name.split(" ")[0]}.</h1>
        <p className="text-slate-400 mt-3 rise">Pick a pillar to get to work.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {PILLARS.map((p, i) => (
            <Link key={p.id} to={`/pillar/${p.id}`} data-testid={`pillar-card-${p.id}`}
              className={`panel group p-6 rise relative overflow-hidden transition-[border-color,transform] duration-300 hover:-translate-y-1 ${i === 0 ? "lg:col-span-2" : ""}`}
              style={{ animationDelay: `${0.05 * i + 0.1}s` }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = p.hex + "66")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}>
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ background: p.hex }} />
              <div className="flex items-start justify-between relative">
                <div className="w-11 h-11 rounded-xl border grid place-items-center" style={{ borderColor: p.hex + "44", color: p.hex }}><p.icon size={20} /></div>
                <ArrowUpRight className="text-slate-600 group-hover:text-white transition-colors" size={18} />
              </div>
              <div className="relative mt-8">
                <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: p.hex }}>{p.badge}</span>
                <h3 className="font-display text-2xl font-bold mt-1">{p.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{p.tagline}</p>
                <p className="font-mono text-xs text-slate-300 mt-5" data-testid={`pillar-metric-${p.id}`}>{m[p.id] || "—"}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

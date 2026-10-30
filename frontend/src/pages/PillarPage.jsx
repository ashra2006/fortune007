import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { pillarById } from "@/lib/pillars";
import VentureRadar from "@/pillars/VentureRadar";
import CapitalFlow from "@/pillars/CapitalFlow";
import TalentForge from "@/pillars/TalentForge";
import TaxDesk from "@/pillars/TaxDesk";
import MarketPulse from "@/pillars/MarketPulse";
import StrategyLab from "@/pillars/StrategyLab";

const TOOLS = { venture_radar: VentureRadar, capital_flow: CapitalFlow, talent_forge: TalentForge, tax_desk: TaxDesk, market_pulse: MarketPulse, strategy_lab: StrategyLab };

const STARTERS = {
  venture_radar: ["Score my idea on a 10-point feasibility scale", "What are the top risks for a D2C brand in India?"],
  capital_flow: ["How should I prepare for a seed round?", "Explain liquidation preference simply"],
  talent_forge: ["Write a JD for a founding engineer", "Give me 5 interview questions for a growth marketer"],
  tax_desk: ["When is IGST applied instead of CGST+SGST?", "What GST rate applies to SaaS services?"],
  market_pulse: ["What sectors are VCs funding in India right now?", "Summarise key risks for startups this quarter"],
  strategy_lab: ["Build a 90-day go-to-market plan", "Run a SWOT on a B2B SaaS for SMBs", "Should I raise now or bootstrap 6 more months?"],
};

export default function PillarPage() {
  const { id } = useParams();
  const p = pillarById(id);
  const [inject, setInject] = useState(null);
  if (!p) return <Navigate to="/dashboard" replace />;
  const Tool = TOOLS[id];
  const ask = (text, query) => setInject({ text, query, pillar: id, nonce: Date.now() });
  const chat = <ChatPanel key={id} pillar={id} title={`${p.name} AI`} starters={STARTERS[id]} inject={inject} className={id === "strategy_lab" ? "h-[calc(100vh-180px)]" : "h-[calc(100vh-120px)] lg:sticky lg:top-20"} />;
  return (
    <div className="min-h-screen">
      <AppHeader active={id} />
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-end gap-4 mb-8 rise">
          <div className="w-12 h-12 rounded-xl border grid place-items-center" style={{ borderColor: p.hex + "55", color: p.hex }}><p.icon size={22} /></div>
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: p.hex }}>{p.badge}</span>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight" data-testid="pillar-title">{p.name}</h1>
          </div>
          <p className="text-sm text-slate-400 hidden md:block ml-4 mb-1">{p.tagline}</p>
        </div>
        {id === "strategy_lab" ? (
          <Tool ask={ask} chat={chat} />
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
            <section className="min-w-0 rise" style={{ animationDelay: ".1s" }}><Tool ask={ask} /></section>
            {chat}
          </div>
        )}
      </main>
    </div>
  );
}

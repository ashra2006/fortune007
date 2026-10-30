import { Radar, Landmark, Users, Receipt, Newspaper, Brain } from "lucide-react";

export const PILLARS = [
  { id: "venture_radar", name: "VentureRadar", tagline: "Idea notepad & AI feasibility engine", badge: "Strategy & Ideation", icon: Radar, color: "amber", hex: "#F59E0B" },
  { id: "capital_flow", name: "CapitalFlow", tagline: "Funding pipeline & investor CRM", badge: "Capital Ops", icon: Landmark, color: "emerald", hex: "#10B981" },
  { id: "talent_forge", name: "TalentForge", tagline: "Candidate pipeline & AI outreach composer", badge: "Talent", icon: Users, color: "cyan", hex: "#06B6D4" },
  { id: "tax_desk", name: "TaxDesk", tagline: "GST calculator, invoice AI & PDF export", badge: "Tax & Compliance", icon: Receipt, color: "orange", hex: "#FB923C" },
  { id: "market_pulse", name: "MarketPulse", tagline: "Live business news & market signals", badge: "Market Intel", icon: Newspaper, color: "rose", hex: "#F43F5E" },
  { id: "strategy_lab", name: "StrategyLab", tagline: "Boardroom AI advisor & scenario planner", badge: "Executive AI", icon: Brain, color: "sky", hex: "#38BDF8" },
];

export const pillarById = (id) => PILLARS.find((p) => p.id === id);

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

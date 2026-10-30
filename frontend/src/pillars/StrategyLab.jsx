const FRAMEWORKS = [
  ["SWOT", "Run a SWOT analysis for my business: "],
  ["Porter's 5 Forces", "Analyse my market with Porter's Five Forces: "],
  ["Scenario plan", "Build best/base/worst scenarios for the next 12 months for: "],
  ["Pricing", "Recommend a pricing strategy with tiers for: "],
  ["OKRs", "Draft quarterly OKRs for: "],
  ["Pre-mortem", "Run a pre-mortem: imagine this failed in 1 year. Why? Business: "],
];

export default function StrategyLab({ ask, chat }) {
  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
      <div className="panel p-5 space-y-3 rise" data-testid="strategy-frameworks">
        <p className="text-[10px] font-mono tracking-widest text-sky-400">FRAMEWORKS</p>
        <p className="text-xs text-slate-500">Describe your business once in the box, then fire any framework.</p>
        <textarea id="biz" data-testid="strategy-business-input" rows={5} placeholder="e.g. B2B SaaS for Indian clinics, ₹40L ARR, 6 people" className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-sm outline-none focus:border-sky-500/50" />
        {FRAMEWORKS.map(([l, p]) => (
          <button key={l} data-testid={`strategy-framework-${l.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => ask(p + (document.getElementById("biz").value || "a typical early-stage Indian startup"), `${l} ${document.getElementById("biz").value || "Indian startup"}`)}
            className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-slate-800 hover:border-sky-500/50 hover:text-white text-slate-300 transition-colors">{l}</button>
        ))}
      </div>
      {chat}
    </div>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, ExternalLink, Sparkles, RefreshCw, Star, X, Building2, Layers } from "lucide-react";
import { api, errMsg } from "@/lib/api";

const TOPICS = ["Indian startups funding", "Venture capital", "GST updates", "Stock market India", "AI startups", "RBI policy"];
const FEED = "__feed__";

const Watchlist = ({ watch, onAdd, onRemove, active, onOpen }) => {
  const [f, setF] = useState({ label: "", type: "company" });
  const add = async (e) => { e.preventDefault(); if (f.label.trim() && (await onAdd(f))) setF({ ...f, label: "" }); };
  return (
    <div className="panel p-4 space-y-3" data-testid="watchlist-panel">
      <div className="flex items-center gap-2"><Star size={14} className="text-rose-400" /><span className="font-display text-sm font-semibold">My watchlist</span><span className="text-[11px] font-mono text-slate-500">{watch.length}/12</span></div>
      <form onSubmit={add} className="flex gap-2">
        <select data-testid="watch-type-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="bg-slate-950/60 border border-slate-800 rounded-lg px-2 text-xs outline-none">
          <option value="company">Company</option><option value="sector">Sector</option>
        </select>
        <input data-testid="watch-label-input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Zepto, Fintech, EV batteries" className="flex-1 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-rose-500/50" />
        <button data-testid="watch-add-button" className="px-3 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-medium transition-colors">Watch</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {watch.length === 0 && <span className="text-xs text-slate-500">Add companies or sectors to build your personal feed.</span>}
        {watch.map((w) => (
          <span key={w.id} data-testid={`watch-chip-${w.id}`} className={`group flex items-center gap-1.5 text-xs pl-2.5 pr-1.5 py-1 rounded-full border transition-colors ${active === w.label ? "border-rose-500 text-rose-300" : "border-slate-700 text-slate-300"}`}>
            {w.type === "company" ? <Building2 size={11} /> : <Layers size={11} />}
            <button data-testid={`watch-open-${w.id}`} onClick={() => onOpen(w.label)}>{w.label}</button>
            <button data-testid={`watch-remove-${w.id}`} onClick={() => onRemove(w.id)} className="text-slate-500 hover:text-rose-400"><X size={12} /></button>
          </span>
        ))}
      </div>
    </div>
  );
};

export default function MarketPulse({ ask }) {
  const [topic, setTopic] = useState(null);
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [watch, setWatch] = useState(null);
  const [src, setSrc] = useState(() => localStorage.getItem("f007_news_source") || "auto");

  useEffect(() => {
    api.get("/watchlist").then((r) => { setWatch(r.data); setTopic(r.data.length ? FEED : TOPICS[0]); }).catch(() => { setWatch([]); setTopic(TOPICS[0]); });
  }, []);

  const load = async (t) => {
    setBusy(true);
    try {
      if (t === FEED) {
        const { data: d } = await api.get("/news/feed", { params: { source: src } });
        setData({ source: "feed", topic: "My feed", items: d.items });
      } else setData((await api.get("/news", { params: { topic: t, source: src } })).data);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  useEffect(() => { if (topic) load(topic); }, [topic, src]); // eslint-disable-line react-hooks/exhaustive-deps

  const addWatch = async (f) => {
    try {
      const { data: w } = await api.post("/watchlist", f);
      setWatch((x) => [...x, w]);
      toast.success(`Watching ${w.label}`);
      if (topic === FEED) load(FEED); else setTopic(FEED);
      return true;
    } catch (e) { toast.error(errMsg(e)); return false; }
  };
  const removeWatch = async (id) => {
    await api.delete(`/watchlist/${id}`);
    const next = watch.filter((w) => w.id !== id);
    setWatch(next);
    if (topic === FEED) next.length ? load(FEED) : setTopic(TOPICS[0]);
  };
  const isWatched = watch?.some((w) => w.label.toLowerCase() === (topic || "").toLowerCase());

  return (
    <div className="space-y-4">
      {watch && <Watchlist watch={watch} onAdd={addWatch} onRemove={removeWatch} active={topic} onOpen={setTopic} />}
      <div className="panel p-4 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) setTopic(q.trim()); }} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3"><Search size={15} className="text-slate-500" />
            <input data-testid="news-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any company, sector or topic" className="flex-1 bg-transparent py-2 text-sm outline-none" /></div>
          <button data-testid="news-search-button" className="px-4 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium transition-colors">Scan</button>
          <button type="button" data-testid="news-refresh-button" onClick={() => topic && load(topic)} className="px-3 rounded-lg border border-slate-700 text-slate-400 hover:text-white"><RefreshCw size={15} className={busy ? "animate-spin" : ""} /></button>
          <select data-testid="news-source-select" value={src} onChange={(e) => { setSrc(e.target.value); localStorage.setItem("f007_news_source", e.target.value); }}
            className="bg-slate-950/60 border border-slate-800 rounded-lg px-2 text-xs outline-none" title="News source">
            <option value="auto">Auto source</option><option value="tinyfish">TinyFish</option><option value="google">Google News</option>
          </select>
        </form>
        <div className="flex flex-wrap gap-2">
          {watch?.length > 0 && <button data-testid="news-topic-my-feed" onClick={() => setTopic(FEED)} className={`text-xs px-3 py-1 rounded-full border flex items-center gap-1 transition-colors ${topic === FEED ? "border-rose-500 bg-rose-500/10 text-rose-300" : "border-slate-700 text-slate-300 hover:text-white"}`}><Star size={11} />My feed</button>}
          {TOPICS.map((t) => <button key={t} data-testid={`news-topic-${t.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => setTopic(t)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${topic === t ? "border-rose-500 text-rose-400" : "border-slate-700 text-slate-400 hover:text-white"}`}>{t}</button>)}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-mono text-slate-500" data-testid="news-source-label">{data ? (data.source === "feed" ? `${data.items.length} SIGNALS · MY FEED · ${watch?.length || 0} WATCHED` : `${data.items.length} SIGNALS · "${data.topic}" · via ${data.source === "tinyfish" ? "TinyFish" : "Google News"}`) : "SCANNING…"}</p>
        <div className="flex items-center gap-4">
          {topic && topic !== FEED && !isWatched && <button data-testid="news-watch-topic-button" onClick={() => addWatch({ label: topic, type: "sector" })} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-300"><Star size={13} />Watch this</button>}
          {data?.items?.length > 0 && <button data-testid="news-ai-brief-button" onClick={() => ask(`Give me a founder-focused briefing (key takeaways, opportunities, risks) from these headlines about "${data.topic}":\n${data.items.slice(0, 12).map((n) => `- ${n.watch ? `[${n.watch}] ` : ""}${n.title}`).join("\n")}`, `${data.topic === "My feed" ? (watch || []).map((w) => w.label).slice(0, 3).join(" ") : data.topic} latest news analysis`)}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300"><Sparkles size={13} />AI briefing</button>}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3" data-testid="news-list">
        {busy && !data && [...Array(6)].map((_, i) => <div key={i} className="panel h-24 animate-pulse" />)}
        {data?.items?.map((n, i) => (
          <a key={i} href={n.url} target="_blank" rel="noreferrer" data-testid={`news-item-${i}`} className="panel p-4 group hover:border-rose-500/40 transition-colors rise" style={{ animationDelay: `${i * 0.03}s` }}>
            <div className="flex justify-between gap-3"><h4 className="text-sm font-medium leading-snug group-hover:text-white text-slate-200">{n.title}</h4><ExternalLink size={13} className="text-slate-600 shrink-0 mt-1" /></div>
            <div className="text-[11px] font-mono text-slate-500 mt-3 flex items-center gap-2">{n.watch && <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300" data-testid={`news-item-watch-${i}`}>{n.watch}</span>}{n.source} · {n.published?.slice(0, 22)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

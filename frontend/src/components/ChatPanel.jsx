import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { api, API, userToken, errMsg } from "@/lib/api";

const MD = "[&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-3 [&_h2]:mt-3 [&_h3]:mt-3 [&_h1]:mb-1 [&_h2]:mb-1 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:text-white [&_code]:text-amber-300 [&_a]:text-amber-400 [&_a]:underline";

const Bubble = ({ m, i }) => (
  <div data-testid={`chat-message-${i}`} className={`rise text-sm leading-relaxed rounded-xl px-3.5 py-2.5 max-w-[92%] ${m.role === "user" ? "ml-auto whitespace-pre-wrap bg-amber-500/15 border border-amber-500/30 text-amber-50" : `bg-slate-900/80 border border-slate-800 text-slate-200 ${MD}`}`}>
    {m.role === "assistant" && m.engine && <div className={`text-[9px] font-mono tracking-widest mb-1 ${m.engine === "tinyfish" ? "text-cyan-400" : "text-amber-400"}`} data-testid={`chat-message-engine-${i}`}>{m.engine === "tinyfish" ? "TINYFISH WEB" : "GEMINI AI"}</div>}
    {!m.content ? <span className="font-mono text-xs text-slate-500 animate-pulse">{m.engine === "tinyfish" ? "searching the web…" : "thinking…"}</span> : m.role === "user" ? m.content : <ReactMarkdown components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{m.content}</ReactMarkdown>}
  </div>
);

export const ENGINES = [
  { id: "gemini", label: "Gemini AI", hint: "Thinks and advises" },
  { id: "tinyfish", label: "TinyFish web", hint: "Searches the live web · paste a link to have it read the page" },
];

export const ChatPanel = ({ pillar, title, starters = [], inject, className = "" }) => {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState(() => localStorage.getItem(`f007_engine_${pillar}`) || "gemini");
  const endRef = useRef(null);

  const engineRef = useRef(engine);
  const abortRef = useRef(null);
  const mountedAt = useRef(Date.now());

  const pickEngine = (v) => { setEngine(v); engineRef.current = v; localStorage.setItem(`f007_engine_${pillar}`, v); };

  useEffect(() => {
    api.get(`/chat/${pillar}`).then((r) => setMsgs((prev) => (prev.length ? prev : r.data))).catch(() => {});
    return () => abortRef.current?.abort();
  }, [pillar]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (msg, searchQuery) => {
    if (!msg.trim() || busy) return;
    const eng = engineRef.current;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setText("");
    setMsgs((m) => [...m, { role: "user", content: msg, engine: eng }, { role: "assistant", content: "", engine: eng, pending: true }]);
    try {
      const res = await fetch(`${API}/chat/${pillar}/stream`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await userToken()}` },
        body: JSON.stringify({ message: msg, engine: eng, search_query: searchQuery || null }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Chat failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (!last?.pending) return m;
          return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      }
      setMsgs((m) => (m[m.length - 1]?.pending ? [...m.slice(0, -1), { ...m[m.length - 1], pending: false }] : m));
    } catch (e) {
      if (e.name !== "AbortError") toast.error(errMsg(e));
      setMsgs((m) => (m[m.length - 1]?.pending ? m.slice(0, -1) : m));
    }
    setBusy(false);
  };

  useEffect(() => {
    if (inject?.text && inject.pillar === pillar && inject.nonce > mountedAt.current) send(inject.text, inject.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inject?.nonce]);

  const clear = async () => {
    abortRef.current?.abort();
    await api.delete(`/chat/${pillar}`);
    setMsgs([]);
  };

  return (
    <aside className={`panel flex flex-col min-h-0 ${className}`} data-testid="ai-chat-panel">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-slate-800">
        <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
        <span className="font-display text-sm font-semibold">{title}</span>
        <button onClick={clear} data-testid="ai-chat-clear-button" className="ml-auto p-1.5 text-slate-500 hover:text-rose-400 transition-colors" title="Clear chat">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3" data-testid="ai-chat-messages">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><Sparkles size={12} /> Try asking</p>
            {starters.map((s, i) => (
              <button key={s} data-testid={`chat-starter-${i}`} onClick={() => send(s)}
                className="block w-full text-left text-xs text-slate-300 border border-slate-800 rounded-lg px-3 py-2 hover:border-amber-500/40 hover:text-white transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => <Bubble key={i} m={m} i={i} />)}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="p-3 border-t border-slate-800 flex gap-2">
        <input data-testid="ai-chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the assistant…"
          className="flex-1 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500/60" />
        <button data-testid="ai-chat-send-button" disabled={busy} className="px-3 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors">
          <Send size={16} />
        </button>
      </form>
      <div className="px-3 pb-3 -mt-1 flex items-center gap-2" data-testid="chat-engine-bar">
        <span className="text-[10px] font-mono text-slate-500 tracking-widest">ENGINE</span>
        <select data-testid="chat-engine-select" value={engine} onChange={(e) => pickEngine(e.target.value)} disabled={busy}
          className="bg-slate-950/60 border border-slate-800 rounded-md px-2 py-1 text-xs outline-none focus:border-amber-500/60">
          {ENGINES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <span className="text-[10px] text-slate-500 truncate" title={ENGINES.find((x) => x.id === engine)?.hint} data-testid="chat-engine-hint">{ENGINES.find((x) => x.id === engine)?.hint}</span>
      </div>
    </aside>
  );
};

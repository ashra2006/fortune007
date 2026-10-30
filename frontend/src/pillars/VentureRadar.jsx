import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, Save } from "lucide-react";
import { api, errMsg } from "@/lib/api";

const STATUSES = ["Idea", "Validating", "Building", "Parked"];

export default function VentureRadar({ ask }) {
  const [notes, setNotes] = useState([]);
  const [cur, setCur] = useState(null);
  const load = () => api.get("/notes").then((r) => setNotes(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data } = await api.post("/notes", { title: "Untitled idea", content: "", tags: [], status: "Idea" });
    setNotes([data, ...notes]);
    setCur(data);
  };
  const save = async () => {
    try {
      const { data } = await api.put(`/notes/${cur.id}`, { title: cur.title, content: cur.content, tags: cur.tags, status: cur.status });
      setNotes(notes.map((n) => (n.id === data.id ? data : n)));
      toast.success("Idea saved");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (id) => {
    await api.delete(`/notes/${id}`);
    setNotes(notes.filter((n) => n.id !== id));
    if (cur?.id === id) setCur(null);
  };

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <div className="panel p-3 space-y-2 h-fit" data-testid="notes-list">
        <button data-testid="note-create-button" onClick={create} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors"><Plus size={15} />New idea</button>
        {notes.length === 0 && <p className="text-xs text-slate-500 p-3">No ideas yet. Capture your first one.</p>}
        {notes.map((n) => (
          <div key={n.id} data-testid={`note-item-${n.id}`} onClick={() => setCur(n)}
            className={`group cursor-pointer rounded-lg px-3 py-2.5 border transition-colors ${cur?.id === n.id ? "border-amber-500/50 bg-amber-500/5" : "border-transparent hover:border-slate-700"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm truncate">{n.title}</span>
              <button data-testid={`note-delete-${n.id}`} onClick={(e) => { e.stopPropagation(); remove(n.id); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400"><Trash2 size={13} /></button>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{n.status} · {n.updated_at?.slice(0, 10)}</span>
          </div>
        ))}
      </div>
      {cur ? (
        <div className="panel p-5 space-y-4" data-testid="note-editor">
          <input data-testid="note-title-input" value={cur.title} onChange={(e) => setCur({ ...cur, title: e.target.value })} className="w-full bg-transparent font-display text-2xl font-bold outline-none" />
          <div className="flex flex-wrap gap-2 items-center">
            {STATUSES.map((s) => (
              <button key={s} data-testid={`note-status-${s.toLowerCase()}`} onClick={() => setCur({ ...cur, status: s })}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${cur.status === s ? "border-amber-500 text-amber-400" : "border-slate-700 text-slate-400"}`}>{s}</button>
            ))}
            <input data-testid="note-tags-input" placeholder="tags, comma separated" value={cur.tags.join(", ")} onChange={(e) => setCur({ ...cur, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              className="ml-auto bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1 text-xs font-mono outline-none w-56" />
          </div>
          <textarea data-testid="note-content-input" value={cur.content} onChange={(e) => setCur({ ...cur, content: e.target.value })} rows={16}
            placeholder="Problem, customer, solution, how you make money…" className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-4 text-sm leading-relaxed outline-none focus:border-amber-500/50 resize-y" />
          <div className="flex gap-2">
            <button data-testid="note-save-button" onClick={save} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors"><Save size={15} />Save</button>
            <button data-testid="note-analyze-button" onClick={() => ask(`Analyse this startup idea for feasibility, market, competition, risks and next 3 steps.\nTitle: ${cur.title}\n${cur.content}`, `${cur.title} market size competitors India`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-sm transition-colors"><Sparkles size={15} />AI feasibility check</button>
          </div>
        </div>
      ) : (
        <div className="panel p-10 grid place-items-center text-sm text-slate-500" data-testid="note-empty-state">Select or create an idea to start writing.</div>
      )}
    </div>
  );
}

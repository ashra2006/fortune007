import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, Send, Mail } from "lucide-react";
import { api, errMsg } from "@/lib/api";

const STAGES = ["Sourced", "Screening", "Interview", "Offer", "Hired", "Rejected"];
const PURPOSES = ["interview invitation", "follow-up after interview", "offer letter note", "polite rejection", "initial outreach"];
const field = "w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500/60";

export default function TalentForge() {
  const [cands, setCands] = useState([]);
  const [sel, setSel] = useState(null);
  const [nc, setNc] = useState({ name: "", email: "", role: "" });
  const [draft, setDraft] = useState({ purpose: PURPOSES[0], company: "", extra: "", subject: "", body: "" });
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState([]);

  const load = () => api.get("/candidates").then((r) => setCands(r.data));
  useEffect(() => { load(); api.get("/emails").then((r) => setSent(r.data)); }, []);
  useEffect(() => { setDraft((d) => ({ ...d, extra: "", subject: "", body: "" })); }, [sel?.id]);

  const add = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post("/candidates", { ...nc, stage: "Sourced", notes: "" }); setNc({ name: "", email: "", role: "" }); load(); setSel(data); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const setStage = async (c, stage) => { await api.put(`/candidates/${c.id}`, { ...c, stage }); load(); };
  const remove = async (id) => { await api.delete(`/candidates/${id}`); if (sel?.id === id) setSel(null); load(); };

  const generate = async () => {
    setBusy("draft");
    try { const { data } = await api.post(`/candidates/${sel.id}/draft`, draft); setDraft({ ...draft, ...data }); toast.success("Draft ready"); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy("");
  };
  const send = async () => {
    setBusy("send");
    try {
      const { data } = await api.post(`/candidates/${sel.id}/send`, { subject: draft.subject, body: draft.body });
      toast.success(`Email sent to ${data.to}`);
      setSent([data, ...sent]);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy("");
  };

  return (
    <div className="grid xl:grid-cols-[320px_1fr] gap-4">
      <div className="space-y-3">
        <form onSubmit={add} className="panel p-4 space-y-2" data-testid="candidate-form">
          <input data-testid="candidate-name-input" required className={field} placeholder="Candidate name" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
          <input data-testid="candidate-email-input" required type="email" className={field} placeholder="Email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} />
          <input data-testid="candidate-role-input" className={field} placeholder="Role" value={nc.role} onChange={(e) => setNc({ ...nc, role: e.target.value })} />
          <button data-testid="candidate-add-button" className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"><Plus size={15} />Add candidate</button>
        </form>
        <div className="panel p-2 space-y-1" data-testid="candidate-list">
          {cands.length === 0 && <p className="text-xs text-slate-500 p-3">No candidates yet.</p>}
          {cands.map((c) => (
            <div key={c.id} onClick={() => setSel(c)} data-testid={`candidate-item-${c.id}`}
              className={`group cursor-pointer rounded-lg p-3 border transition-colors ${sel?.id === c.id ? "border-cyan-500/50 bg-cyan-500/5" : "border-transparent hover:border-slate-700"}`}>
              <div className="flex justify-between"><span className="text-sm font-semibold">{c.name}</span>
                <button data-testid={`candidate-delete-${c.id}`} onClick={(e) => { e.stopPropagation(); remove(c.id); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400"><Trash2 size={13} /></button></div>
              <div className="text-xs text-slate-500">{c.role} · <span className="font-mono">{c.email}</span></div>
              <select data-testid={`candidate-stage-${c.id}`} onClick={(e) => e.stopPropagation()} value={c.stage} onChange={(e) => setStage(c, e.target.value)} className="mt-1 bg-transparent text-[11px] text-cyan-400 outline-none">
                {STAGES.map((s) => <option key={s} className="bg-slate-900">{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {sel ? (
          <div className="panel p-5 space-y-3" data-testid="email-composer">
            <div className="flex items-center gap-2 text-sm"><Mail size={16} className="text-cyan-400" />To: <span className="font-mono text-slate-300" data-testid="composer-recipient">{sel.name} &lt;{sel.email}&gt;</span></div>
            <div className="grid sm:grid-cols-3 gap-2">
              <select data-testid="composer-purpose-select" className={field} value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select>
              <input data-testid="composer-company-input" className={field} placeholder="Your company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
              <input data-testid="composer-extra-input" className={field} placeholder="Extra context (date, salary…)" value={draft.extra} onChange={(e) => setDraft({ ...draft, extra: e.target.value })} />
            </div>
            <button data-testid="composer-generate-button" disabled={busy === "draft"} onClick={generate} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 text-sm transition-colors disabled:opacity-60"><Wand2 size={15} />{busy === "draft" ? "Drafting…" : "Draft with AI"}</button>
            <input data-testid="composer-subject-input" className={field} placeholder="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            <textarea data-testid="composer-body-input" rows={12} className={`${field} leading-relaxed`} placeholder="Email body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <button data-testid="composer-send-button" disabled={busy === "send" || !draft.subject || !draft.body} onClick={send} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"><Send size={15} />{busy === "send" ? "Sending…" : "Send email"}</button>
          </div>
        ) : <div className="panel p-10 text-center text-sm text-slate-500" data-testid="composer-empty-state">Select a candidate to compose an email.</div>}
        <div className="panel p-4" data-testid="sent-emails-list">
          <div className="text-xs font-mono text-slate-500 mb-2">SENT LOG</div>
          {sent.length === 0 ? <p className="text-xs text-slate-500">Nothing sent yet.</p> : sent.slice(0, 8).map((s) => (
            <div key={s.id} className="flex justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0"><span className="truncate">{s.subject}</span><span className="font-mono text-slate-500 ml-3 shrink-0">{s.to}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

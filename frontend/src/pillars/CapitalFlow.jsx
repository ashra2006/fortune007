import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { inr } from "@/lib/pillars";

const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Series C+", "Debt", "Grant"];
const STATUSES = ["Prospect", "Contacted", "Pitched", "Term Sheet", "Closed", "Passed"];
const EMPTY = { name: "", firm: "", email: "", stage: "Seed", amount: 0, status: "Prospect", notes: "" };
const field = "w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/60";

export default function CapitalFlow({ ask }) {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/investors").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit.name.trim()) return toast.error("Investor name is required");
    try {
      const body = { ...edit, amount: Number(edit.amount) || 0 };
      if (edit.id) await api.put(`/investors/${edit.id}`, body); else await api.post("/investors", body);
      setEdit(null); load(); toast.success("Investor saved");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (id) => { await api.delete(`/investors/${id}`); load(); };
  const move = async (inv, status) => { await api.put(`/investors/${inv.id}`, { ...inv, status }); load(); };

  const sum = (f) => items.filter(f).reduce((s, x) => s + Number(x.amount || 0), 0);
  const stats = [
    ["Pipeline", inr(sum((x) => !["Closed", "Passed"].includes(x.status))), "stat-pipeline"],
    ["Term sheets", inr(sum((x) => x.status === "Term Sheet")), "stat-termsheet"],
    ["Closed", inr(sum((x) => x.status === "Closed")), "stat-closed"],
    ["Investors", items.length, "stat-count"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(([l, v, t]) => (
          <div key={l} className="panel p-4" data-testid={`capital-${t}`}><div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{l}</div><div className="font-mono text-xl text-emerald-400 mt-1">{v}</div></div>
        ))}
      </div>
      <div className="flex gap-2">
        <button data-testid="investor-add-button" onClick={() => setEdit({ ...EMPTY })} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"><Plus size={15} />Add investor</button>
        <button data-testid="capital-ai-review-button" onClick={() => ask(`Review my fundraising pipeline and suggest next actions:\n${items.map((i) => `${i.name} (${i.firm}) - ${i.stage} - ${inr(i.amount)} - ${i.status}`).join("\n") || "No investors yet"}`, "startup fundraising investors India seed round trends")}
          className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:border-emerald-500/50 transition-colors">AI pipeline review</button>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="investor-board">
        {STATUSES.map((st) => (
          <div key={st} className="panel p-3 min-h-[140px]" data-testid={`investor-column-${st.toLowerCase().replace(" ", "-")}`}>
            <div className="flex justify-between text-xs font-mono text-slate-400 mb-2 px-1"><span>{st.toUpperCase()}</span><span>{items.filter((i) => i.status === st).length}</span></div>
            <div className="space-y-2">
              {items.filter((i) => i.status === st).map((i) => (
                <div key={i.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 group" data-testid={`investor-card-${i.id}`}>
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0"><div className="text-sm font-semibold truncate">{i.name}</div><div className="text-xs text-slate-500 truncate">{i.firm} · {i.stage}</div></div>
                    <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                      <button data-testid={`investor-edit-${i.id}`} onClick={() => setEdit(i)} className="text-slate-400 hover:text-white"><Pencil size={13} /></button>
                      <button data-testid={`investor-delete-${i.id}`} onClick={() => remove(i.id)} className="text-slate-400 hover:text-rose-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono text-xs text-emerald-400">{inr(i.amount)}</span>
                    <select data-testid={`investor-move-${i.id}`} value={i.status} onChange={(e) => move(i, e.target.value)} className="bg-transparent text-[11px] text-slate-400 outline-none">
                      {STATUSES.map((s) => <option key={s} className="bg-slate-900">{s}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="bg-[#0F1523] border-slate-800" data-testid="investor-dialog">
          <DialogHeader><DialogTitle className="font-display">{edit?.id ? "Edit investor" : "New investor"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <input data-testid="investor-name-input" className={field} placeholder="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <input data-testid="investor-firm-input" className={field} placeholder="Firm" value={edit.firm} onChange={(e) => setEdit({ ...edit, firm: e.target.value })} />
              <input data-testid="investor-email-input" className={field} placeholder="Email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              <input data-testid="investor-amount-input" type="number" className={field} placeholder="Amount (₹)" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
              <select data-testid="investor-stage-select" className={field} value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
              <select data-testid="investor-status-select" className={field} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              <textarea data-testid="investor-notes-input" className={`${field} col-span-2`} rows={3} placeholder="Notes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              <button data-testid="investor-save-button" onClick={save} className="col-span-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">Save investor</button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

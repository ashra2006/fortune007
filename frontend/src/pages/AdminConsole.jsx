import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Cpu, Globe, Users, Activity, KeyRound, Flame } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { api, errMsg } from "@/lib/api";

const field = "w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm font-mono outline-none focus:border-amber-500/60";
const btn = "px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-60";
const Row = ({ label, children, hint }) => (
  <label className="block space-y-1.5"><span className="text-xs text-slate-400">{label}</span>{children}{hint && <span className="block text-[11px] text-slate-500 font-mono">{hint}</span>}</label>
);

const useAiForm = (s) => {
  const [f, setF] = useState({ ai_model: s.ai.model, ai_api_key: "", tinyfish_base_url: s.tinyfish.base_url, tinyfish_api_key: "", firebase_api_key: "" });
  const [testing, setTesting] = useState(false);
  const test = async () => {
    setTesting(true);
    try { toast.success(`AI replied: ${(await api.post("/admin/test-ai")).data.reply}`); } catch (e) { toast.error(errMsg(e)); }
    setTesting(false);
  };
  return { f, setF, test, testing };
};

const FB_FIELDS = [["firebase_project_id", "projectId", "Project ID"], ["firebase_auth_domain", "authDomain", "Auth domain"], ["firebase_app_id", "appId", "App ID"],
  ["firebase_messaging_sender_id", "messagingSenderId", "Messaging sender ID"], ["firebase_storage_bucket", "storageBucket", "Storage bucket"]];

const FirebaseCard = ({ s, save }) => {
  const [f, setF] = useState(() => Object.fromEntries([["firebase_api_key", ""], ...FB_FIELDS.map(([k, sk]) => [k, s.firebase[sk] || ""])]));
  return (
    <div className="panel p-6 space-y-3" data-testid="admin-firebase-settings">
      <h3 className="font-display font-semibold flex items-center gap-2"><Flame size={16} className="text-orange-400" />Firebase sign-in</h3>
      <p className="text-[11px] text-slate-500">The API key and project must come from the same Firebase project.</p>
      <Row label="Firebase web API key" hint={s.firebase.configured ? `Current: ${s.firebase.api_key_masked}` : "Not set — using the key from app settings if present"}>
        <input data-testid="admin-firebase-key-input" className={field} placeholder="AIza… (leave blank to keep)" value={f.firebase_api_key} onChange={(e) => setF({ ...f, firebase_api_key: e.target.value })} />
      </Row>
      <div className="grid grid-cols-2 gap-3">
        {FB_FIELDS.map(([k, , label]) => (
          <Row key={k} label={label}><input data-testid={`admin-${k.replace(/_/g, "-")}-input`} className={field} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Row>
        ))}
      </div>
      <button data-testid="admin-firebase-save-button" className={btn} onClick={() => save(f).then(() => setF({ ...f, firebase_api_key: "" }))}>Save</button>
    </div>
  );
};

const AiTab = ({ s, save }) => {
  const { f, setF, test, testing } = useAiForm(s);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="panel p-6 space-y-4" data-testid="admin-ai-settings">
        <h3 className="font-display font-semibold flex items-center gap-2"><Cpu size={16} className="text-amber-400" />Gemini (all pillars)</h3>
        <Row label="Model" hint="e.g. gemini-3-flash-preview, gemini-3.1-pro-preview · save before testing">
          <input data-testid="admin-ai-model-input" className={field} value={f.ai_model} onChange={(e) => setF({ ...f, ai_model: e.target.value })} />
        </Row>
        <Row label="Gemini API key" hint={s.ai.configured ? `Current: ${s.ai.api_key_masked}` : "Not set"}>
          <input data-testid="admin-ai-key-input" type="password" className={field} placeholder="Paste new key to replace" value={f.ai_api_key} onChange={(e) => setF({ ...f, ai_api_key: e.target.value })} />
        </Row>
        <div className="flex gap-2">
          <button data-testid="admin-ai-save-button" className={btn} onClick={() => save({ ai_model: f.ai_model, ai_api_key: f.ai_api_key }).then(() => setF({ ...f, ai_api_key: "" }))}>Save</button>
          <button data-testid="admin-ai-test-button" disabled={testing} onClick={test} className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:border-emerald-500/60 transition-colors">{testing ? "Testing…" : "Test connection"}</button>
        </div>
      </div>
      <FirebaseCard key={s.firebase.projectId + s.firebase.api_key_masked} s={s} save={save} />
    </div>
  );
};

const TinyFishTab = ({ s, save }) => {
  const [f, setF] = useState({ tinyfish_base_url: s.tinyfish.base_url, tinyfish_search_url: s.tinyfish.search_url, tinyfish_api_key: "" });
  const [testing, setTesting] = useState(false);
  const test = async () => {
    setTesting(true);
    try {
      const { data } = await api.post("/admin/test-tinyfish");
      toast.success(`TinyFish is working — ${data.count} results${data.sample ? `, e.g. "${data.sample}"` : ""}`);
    } catch (e) { toast.error(errMsg(e)); }
    setTesting(false);
  };
  return (
    <div className="panel p-6 space-y-4 max-w-xl" data-testid="admin-tinyfish-settings">
      <h3 className="font-display font-semibold flex items-center gap-2"><Globe size={16} className="text-cyan-400" />TinyFish web research</h3>
      <p className="text-xs text-slate-500">Users can pick TinyFish in every pillar's chat. The switch below also makes MarketPulse news use TinyFish by default (otherwise Google News).</p>
      <div className="flex items-center gap-3"><Switch data-testid="admin-tinyfish-toggle" checked={s.tinyfish.enabled} onCheckedChange={(v) => save({ tinyfish_enabled: v })} /><span className="text-sm">{s.tinyfish.enabled ? "News uses TinyFish" : "News uses Google News"}</span></div>
      <Row label="Agent base URL"><input data-testid="admin-tinyfish-url-input" className={field} value={f.tinyfish_base_url} onChange={(e) => setF({ ...f, tinyfish_base_url: e.target.value })} /></Row>
      <Row label="Search API URL"><input data-testid="admin-tinyfish-search-url-input" className={field} value={f.tinyfish_search_url} onChange={(e) => setF({ ...f, tinyfish_search_url: e.target.value })} /></Row>
      <Row label="API key" hint={s.tinyfish.configured ? `Current: ${s.tinyfish.api_key_masked}` : "Not set"}>
        <input data-testid="admin-tinyfish-key-input" type="password" className={field} value={f.tinyfish_api_key} onChange={(e) => setF({ ...f, tinyfish_api_key: e.target.value })} />
      </Row>
      <div className="flex gap-2">
        <button data-testid="admin-tinyfish-save-button" className={btn} onClick={() => save(f).then(() => setF({ ...f, tinyfish_api_key: "" }))}>Save</button>
        <button data-testid="admin-tinyfish-test-button" disabled={testing} onClick={test} className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:border-cyan-500/60 transition-colors">{testing ? "Testing…" : "Test connection"}</button>
      </div>
    </div>
  );
};

const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const load = () => api.get("/admin/users").then((r) => setUsers(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);
  const toggle = (uid) => api.patch(`/admin/users/${uid}`).then(load).catch((e) => toast.error(errMsg(e)));
  return (
    <div className="panel overflow-x-auto" data-testid="admin-users-table">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 font-mono text-left"><tr>{["Name", "Email", "Provider", "Joined", "Status", ""].map((h) => <th key={h} className="px-4 py-3 border-b border-slate-800">{h}</th>)}</tr></thead>
        <tbody>
          {users.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users yet</td></tr>}
          {users.map((u) => (
            <tr key={u.uid} className="border-b border-slate-800/60" data-testid={`admin-user-row-${u.uid}`}>
              <td className="px-4 py-3">{u.name}</td><td className="px-4 py-3 font-mono text-xs">{u.email}</td><td className="px-4 py-3 text-xs">{u.provider}</td>
              <td className="px-4 py-3 text-xs font-mono">{u.created_at?.slice(0, 10)}</td>
              <td className="px-4 py-3"><span className={`text-xs ${u.disabled ? "text-rose-400" : "text-emerald-400"}`}>{u.disabled ? "Disabled" : "Active"}</span></td>
              <td className="px-4 py-3"><button data-testid={`admin-user-toggle-${u.uid}`} onClick={() => toggle(u.uid)} className="text-xs text-slate-400 hover:text-white">{u.disabled ? "Enable" : "Disable"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatsTab = () => {
  const [st, setSt] = useState(null);
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  useEffect(() => { api.get("/admin/stats").then((r) => setSt(r.data)).catch((e) => toast.error(errMsg(e))); }, []);
  const change = async () => {
    try { await api.post("/admin/password", pw); toast.success("Admin password updated"); setPw({ current_password: "", new_password: "" }); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {st && Object.entries(st).map(([k, v]) => (
          <div key={k} className="panel p-5" data-testid={`admin-stat-${k}`}><div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{k.replace("_", " ")}</div><div className="font-mono text-3xl text-amber-400 mt-2">{v}</div></div>
        ))}
      </div>
      <div className="panel p-6 space-y-3 max-w-md">
        <h3 className="font-display font-semibold flex items-center gap-2"><KeyRound size={16} className="text-amber-400" />Change admin password</h3>
        <input data-testid="admin-current-password-input" type="password" className={field} placeholder="Current password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
        <input data-testid="admin-new-password-input" type="password" className={field} placeholder="New password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
        <button data-testid="admin-change-password-button" className={btn} onClick={change}>Update password</button>
      </div>
    </div>
  );
};

export default function AdminConsole() {
  const [s, setS] = useState(null);
  const nav = useNavigate();
  const logout = () => { localStorage.removeItem("f007_admin_token"); nav("/admin"); };
  useEffect(() => { api.get("/admin/settings").then((r) => setS(r.data)).catch(logout); }, []); // eslint-disable-line
  const save = async (body) => {
    if (!Object.values(body).some((v) => v !== "" && v !== undefined)) return toast.info("Nothing to save");
    try { setS((await api.put("/admin/settings", body)).data); toast.success("Settings saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-[#080B11]/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-3">
          <span className="w-8 h-8 rounded-md bg-amber-500 text-slate-950 grid place-items-center font-display font-extrabold text-sm">07</span>
          <span className="font-display font-bold tracking-[0.2em] text-sm">ADMIN CONSOLE</span>
          <button data-testid="admin-logout-button" onClick={logout} className="ml-auto flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400"><LogOut size={14} />Lock</button>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        <h1 className="font-display text-4xl font-extrabold tracking-tight rise">Control room</h1>
        <p className="text-slate-400 mt-2 rise">Central AI, research and access configuration for every pillar.</p>
        {s && (
          <Tabs defaultValue="ai" className="mt-8">
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger value="ai" data-testid="admin-tab-ai"><Cpu size={14} className="mr-1.5" />AI & Auth</TabsTrigger>
              <TabsTrigger value="tinyfish" data-testid="admin-tab-tinyfish"><Globe size={14} className="mr-1.5" />TinyFish</TabsTrigger>
              <TabsTrigger value="users" data-testid="admin-tab-users"><Users size={14} className="mr-1.5" />Users</TabsTrigger>
              <TabsTrigger value="stats" data-testid="admin-tab-stats"><Activity size={14} className="mr-1.5" />Telemetry</TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="mt-6"><AiTab s={s} save={save} /></TabsContent>
            <TabsContent value="tinyfish" className="mt-6"><TinyFishTab s={s} save={save} /></TabsContent>
            <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
            <TabsContent value="stats" className="mt-6"><StatsTab /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

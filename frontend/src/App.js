import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import PillarPage from "@/pages/PillarPage";
import AdminLogin from "@/pages/AdminLogin";
import AdminConsole from "@/pages/AdminConsole";

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center font-mono text-amber-400" data-testid="app-loading">INITIALISING…</div>;
  return user ? children : <Navigate to="/" replace />;
};

const AdminOnly = ({ children }) => (localStorage.getItem("f007_admin_token") ? children : <Navigate to="/admin" replace />);

function App() {
  return (
    <div className="App grain">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/pillar/:id" element={<Protected><PillarPage /></Protected>} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/console" element={<AdminOnly><AdminConsole /></AdminOnly>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}

export default App;

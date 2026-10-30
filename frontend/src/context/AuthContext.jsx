import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { initFirebase } from "@/lib/firebase";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    initFirebase()
      .then((auth) => {
        if (!auth) {
          setConfigured(false);
          setLoading(false);
          return;
        }
        unsub = onAuthStateChanged(auth, async (u) => {
          setUser(u);
          if (u) {
            try {
              setProfile((await api.get("/me")).data);
            } catch {
              setProfile(null);
            }
          } else setProfile(null);
          setLoading(false);
        });
      })
      .catch(() => {
        setConfigured(false);
        setLoading(false);
      });
    return () => unsub();
  }, []);

  const logout = async () => {
    const auth = await initFirebase();
    if (auth) await signOut(auth);
  };

  return <AuthContext.Provider value={{ user, profile, loading, configured, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

import axios from "axios";
import { getFirebaseAuth } from "@/lib/firebase";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use(async (config) => {
  if (config.url.startsWith("/admin")) {
    const t = localStorage.getItem("f007_admin_token");
    if (t) config.headers.Authorization = `Bearer ${t}`;
  } else {
    const auth = getFirebaseAuth();
    if (auth?.currentUser) config.headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  return config;
});

export const userToken = async () => {
  const auth = getFirebaseAuth();
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
};

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(", ");
  return d || e?.message || "Something went wrong";
};

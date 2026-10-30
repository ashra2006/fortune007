import axios from "axios";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

let authInstance = null;

const envKey = () => {
  const raw = process.env.REACT_APP_FIREBASE_API_KEY || "";
  const m = raw.match(/apiKey:\s*\\?"([^"\\]*)\\?"/);
  if (m) return m[1];
  const k = raw.match(/AIza[0-9A-Za-z_-]{30,}/);
  if (k) return k[0];
  return raw.includes(" ") ? "" : raw;
};

export async function initFirebase() {
  if (authInstance) return authInstance;
  const { data } = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/public/firebase-config`);
  const apiKey = data.apiKey || envKey();
  if (!apiKey) return null;
  const app = getApps()[0] || initializeApp({ ...data, apiKey });
  authInstance = getAuth(app);
  return authInstance;
}

export const getFirebaseAuth = () => authInstance;

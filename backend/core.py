import os
import re
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

load_dotenv(Path(__file__).parent / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
FIREBASE_PROJECT_ID = os.environ["FIREBASE_PROJECT_ID"]
_google_req = google_requests.Request()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def parse_key(raw: str) -> str:
    """Extract a usable key from a possibly messy env value."""
    raw = (raw or "").strip()
    m = re.search(r'apiKey:\s*"([^"]*)"', raw)
    if m:
        return m.group(1)
    m = re.search(r"api\s*=\s*(\S+)", raw)
    if m:
        return m.group(1)
    return raw if " " not in raw else ""


def mask(v: str) -> str:
    if not v:
        return ""
    return v[:4] + "•" * 8 + v[-4:] if len(v) > 10 else "•" * len(v)


DEFAULT_SETTINGS = {
    "_id": "global",
    "ai": {"provider": "gemini", "model": "gemini-3-flash-preview", "api_key": parse_key(os.environ.get("GEMINI_API_KEY", ""))},
    "tinyfish": {"base_url": "https://agent.tinyfish.ai", "api_key": "", "enabled": False},
    "firebase": {
        "apiKey": "",
        "authDomain": os.environ["FIREBASE_AUTH_DOMAIN"],
        "projectId": FIREBASE_PROJECT_ID,
        "storageBucket": os.environ["FIREBASE_STORAGE_BUCKET"],
        "messagingSenderId": os.environ["FIREBASE_MESSAGING_SENDER_ID"],
        "appId": os.environ["FIREBASE_APP_ID"],
    },
}


async def get_settings() -> dict:
    s = await db.settings.find_one({"_id": "global"})
    if not s:
        await db.settings.insert_one(DEFAULT_SETTINGS)
        s = dict(DEFAULT_SETTINGS)
    return s


async def bootstrap_admin():
    if not await db.admins.find_one({"username": os.environ["ADMIN_USERNAME"]}):
        pw = bcrypt.hashpw(os.environ["ADMIN_PASSWORD"].encode(), bcrypt.gensalt()).decode()
        await db.admins.insert_one({"id": new_id(), "username": os.environ["ADMIN_USERNAME"], "password_hash": pw, "created_at": now_iso()})
    await get_settings()
    await db.users.create_index("uid", unique=True)
    await db.watchlist.create_index([("uid", 1), ("label_lc", 1)], unique=True)


def make_admin_token(username: str) -> str:
    payload = {"sub": username, "role": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _bearer(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    return auth[7:]


async def get_admin(request: Request) -> dict:
    try:
        data = jwt.decode(_bearer(request), JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid admin session")
    if data.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return {"username": data["sub"]}


async def get_user(request: Request) -> dict:
    token = _bearer(request)
    project_id = (await get_settings())["firebase"].get("projectId") or FIREBASE_PROJECT_ID
    try:
        claims = await asyncio.to_thread(google_id_token.verify_firebase_token, token, _google_req, project_id)
    except Exception:
        raise HTTPException(401, "Invalid or expired session")
    uid = claims["sub"]
    user = await db.users.find_one({"uid": uid}, {"_id": 0})
    if not user:
        user = {"uid": uid, "email": claims.get("email", ""), "name": claims.get("name") or (claims.get("email", "").split("@")[0]),
                "provider": claims.get("firebase", {}).get("sign_in_provider", ""), "created_at": now_iso(), "disabled": False}
        await db.users.insert_one(dict(user))
    if user.get("disabled"):
        raise HTTPException(403, "Account disabled by admin")
    await db.users.update_one({"uid": uid}, {"$set": {"last_seen": now_iso()}})
    return user

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from core import db, get_admin, get_settings, make_admin_token, mask, now_iso
from ai import complete, ai_error, test_key
import tinyfish

router = APIRouter(prefix="/api")


class AdminLogin(BaseModel):
    username: str
    password: str


class SettingsUpdate(BaseModel):
    ai_model: Optional[str] = None
    ai_api_key: Optional[str] = None
    tinyfish_base_url: Optional[str] = None
    tinyfish_search_url: Optional[str] = None
    tinyfish_api_key: Optional[str] = None
    tinyfish_enabled: Optional[bool] = None
    firebase_api_key: Optional[str] = None
    firebase_project_id: Optional[str] = None
    firebase_auth_domain: Optional[str] = None
    firebase_app_id: Optional[str] = None
    firebase_messaging_sender_id: Optional[str] = None
    firebase_storage_bucket: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/admin/login")
async def admin_login(body: AdminLogin):
    a = await db.admins.find_one({"username": body.username})
    if not a or not bcrypt.checkpw(body.password.encode(), a["password_hash"].encode()):
        raise HTTPException(401, "Invalid admin credentials")
    return {"token": make_admin_token(a["username"]), "username": a["username"]}


@router.get("/admin/me")
async def admin_me(admin=Depends(get_admin)):
    return admin


@router.post("/admin/password")
async def admin_password(body: PasswordChange, admin=Depends(get_admin)):
    a = await db.admins.find_one({"username": admin["username"]})
    if not bcrypt.checkpw(body.current_password.encode(), a["password_hash"].encode()):
        raise HTTPException(400, "Current password is wrong")
    if len(body.new_password) < 4:
        raise HTTPException(400, "New password must be at least 4 characters")
    pw = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.admins.update_one({"username": admin["username"]}, {"$set": {"password_hash": pw}})
    return {"ok": True}


def _public_settings(s: dict) -> dict:
    return {
        "ai": {"provider": "gemini", "model": s["ai"].get("model"), "api_key_masked": mask(s["ai"].get("api_key", "")), "configured": bool(s["ai"].get("api_key"))},
        "tinyfish": {"base_url": s["tinyfish"].get("base_url"), "search_url": s["tinyfish"].get("search_url") or tinyfish.DEFAULT_SEARCH_URL, "enabled": s["tinyfish"].get("enabled", False),
                     "api_key_masked": mask(s["tinyfish"].get("api_key", "")), "configured": bool(s["tinyfish"].get("api_key"))},
        "firebase": {**{k: v for k, v in s["firebase"].items() if k != "apiKey"}, "api_key_masked": mask(s["firebase"].get("apiKey", "")), "configured": bool(s["firebase"].get("apiKey"))},
    }


@router.get("/admin/settings")
async def read_settings(admin=Depends(get_admin)):
    return _public_settings(await get_settings())


@router.put("/admin/settings")
async def update_settings(body: SettingsUpdate, admin=Depends(get_admin)):
    await get_settings()
    upd = {}
    if body.ai_api_key or body.ai_model:
        cur = (await get_settings())["ai"]
        try:
            await test_key(body.ai_api_key.strip() if body.ai_api_key else cur.get("api_key", ""), (body.ai_model or cur.get("model")).strip())
        except Exception as e:
            raise HTTPException(400, f"Not saved — Gemini rejected this key/model. {ai_error(e)}")
    if body.ai_model:
        upd["ai.model"] = body.ai_model.strip()
    if body.ai_api_key:
        upd["ai.api_key"] = body.ai_api_key.strip()
    if body.tinyfish_base_url:
        upd["tinyfish.base_url"] = body.tinyfish_base_url.strip().rstrip("/")
    if body.tinyfish_search_url:
        upd["tinyfish.search_url"] = body.tinyfish_search_url.strip().rstrip("/")
    if body.tinyfish_api_key:
        upd["tinyfish.api_key"] = body.tinyfish_api_key.strip()
    if body.tinyfish_enabled is not None:
        upd["tinyfish.enabled"] = body.tinyfish_enabled
    if body.firebase_api_key:
        upd["firebase.apiKey"] = body.firebase_api_key.strip()
    for field, key in (("firebase_project_id", "projectId"), ("firebase_auth_domain", "authDomain"), ("firebase_app_id", "appId"),
                       ("firebase_messaging_sender_id", "messagingSenderId"), ("firebase_storage_bucket", "storageBucket")):
        if getattr(body, field):
            upd[f"firebase.{key}"] = getattr(body, field).strip()
    if upd:
        upd["updated_at"] = now_iso()
        await db.settings.update_one({"_id": "global"}, {"$set": upd})
    return _public_settings(await get_settings())


@router.post("/admin/test-ai")
async def test_ai(admin=Depends(get_admin)):
    try:
        reply = await complete("You are a health check.", "Reply with exactly: FORTUNE 007 ONLINE")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(424, ai_error(e))
    return {"ok": True, "reply": reply.strip()}


@router.post("/admin/test-tinyfish")
async def test_tinyfish(admin=Depends(get_admin)):
    cfg = (await get_settings())["tinyfish"]
    try:
        res = await tinyfish.search(cfg, "latest startup funding news India", purpose="connection test")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(424, f"TinyFish call failed: {str(e)[:200]}")
    return {"ok": True, "count": len(res), "sample": res[0].get("title") if res else None}


@router.get("/admin/users")
async def list_users(admin=Depends(get_admin)):
    return await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.patch("/admin/users/{uid}")
async def toggle_user(uid: str, admin=Depends(get_admin)):
    u = await db.users.find_one({"uid": uid})
    if not u:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"uid": uid}, {"$set": {"disabled": not u.get("disabled", False)}})
    return {"uid": uid, "disabled": not u.get("disabled", False)}


@router.get("/admin/stats")
async def stats(admin=Depends(get_admin)):
    return {
        "users": await db.users.count_documents({}),
        "notes": await db.notes.count_documents({}),
        "investors": await db.investors.count_documents({}),
        "candidates": await db.candidates.count_documents({}),
        "emails_sent": await db.emails.count_documents({}),
        "chat_messages": await db.chat_messages.count_documents({}),
        "invoices": await db.invoices.count_documents({}),
    }


@router.get("/public/firebase-config")
async def firebase_config():
    fb = (await get_settings())["firebase"]
    return {k: fb.get(k, "") for k in ("apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId")}

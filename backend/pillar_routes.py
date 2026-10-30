import os
import re
import asyncio
import logging
import tempfile
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from html import escape
from typing import Optional, List
from urllib.parse import quote_plus

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core import db, get_user, get_settings, new_id, now_iso
from ai import PILLAR_PROMPTS, stream_reply, complete, parse_json, ai_error
from email_service import send_email, EMAIL_FROM_NAME
import tinyfish

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/me")
async def me(user=Depends(get_user)):
    return user


class ProfileIn(BaseModel):
    name: str


@router.patch("/me")
async def update_me(body: ProfileIn, user=Depends(get_user)):
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(400, "Name is required")
    await db.users.update_one({"uid": user["uid"]}, {"$set": {"name": name}})
    return {**user, "name": name}


# ---------- Chat ----------
class ChatIn(BaseModel):
    message: str
    engine: str = "gemini"
    search_query: Optional[str] = None


@router.get("/chat/{pillar}")
async def chat_history(pillar: str, user=Depends(get_user)):
    return await db.chat_messages.find({"uid": user["uid"], "pillar": pillar}, {"_id": 0}).sort("created_at", 1).to_list(200)


@router.delete("/chat/{pillar}")
async def chat_clear(pillar: str, user=Depends(get_user)):
    await db.chat_messages.delete_many({"uid": user["uid"], "pillar": pillar})
    return {"ok": True}


@router.post("/chat/{pillar}/stream")
async def chat_stream(pillar: str, body: ChatIn, user=Depends(get_user)):
    if pillar not in PILLAR_PROMPTS:
        raise HTTPException(404, "Unknown pillar")
    if body.engine not in ("gemini", "tinyfish"):
        raise HTTPException(400, "engine must be 'gemini' or 'tinyfish'")
    settings = await get_settings()
    history = await db.chat_messages.find({"uid": user["uid"], "pillar": pillar}, {"_id": 0}).sort("created_at", -1).to_list(10)
    context = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in reversed(history))
    prompt = (f"Conversation so far:\n{context}\n\nUSER: {body.message}" if context else body.message)
    await db.chat_messages.insert_one({"id": new_id(), "uid": user["uid"], "pillar": pillar, "role": "user", "content": body.message, "engine": body.engine, "created_at": now_iso()})

    async def gen():
        full, failed = "", False
        try:
            if body.engine == "tinyfish":
                source = tinyfish.research_stream(settings["tinyfish"], pillar, body.message, body.search_query)
            else:
                source = stream_reply(PILLAR_PROMPTS[pillar] + " Use markdown sparingly.", prompt)
            async for chunk in source:
                full += chunk
                yield chunk
        except HTTPException as e:
            failed = True
            yield f"⚠ {e.detail}"
        except Exception as e:
            failed = True
            logger.error(f"Chat {body.engine} failed: {e}")
            yield f"⚠ {ai_error(e) if body.engine == 'gemini' else 'TinyFish could not complete this request right now. Please try again.'}"
        if not failed and full:
            await db.chat_messages.insert_one({"id": new_id(), "uid": user["uid"], "pillar": pillar, "role": "assistant", "content": full, "engine": body.engine, "created_at": now_iso()})

    return StreamingResponse(gen(), media_type="text/plain", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- Generic owned CRUD ----------
def crud(name: str, model_in):
    async def list_items(user=Depends(get_user)):
        return await db[name].find({"uid": user["uid"]}, {"_id": 0}).sort("updated_at", -1).to_list(500)

    async def create_item(body: model_in, user=Depends(get_user)):
        doc = {**body.model_dump(), "id": new_id(), "uid": user["uid"], "created_at": now_iso(), "updated_at": now_iso()}
        await db[name].insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    async def update_item(item_id: str, body: model_in, user=Depends(get_user)):
        r = await db[name].update_one({"id": item_id, "uid": user["uid"]}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
        if not r.matched_count:
            raise HTTPException(404, "Not found")
        return await db[name].find_one({"id": item_id}, {"_id": 0})

    async def delete_item(item_id: str, user=Depends(get_user)):
        r = await db[name].delete_one({"id": item_id, "uid": user["uid"]})
        if not r.deleted_count:
            raise HTTPException(404, "Not found")
        return {"ok": True}

    router.add_api_route(f"/{name}", list_items, methods=["GET"])
    router.add_api_route(f"/{name}", create_item, methods=["POST"])
    router.add_api_route(f"/{name}/{{item_id}}", update_item, methods=["PUT"])
    router.add_api_route(f"/{name}/{{item_id}}", delete_item, methods=["DELETE"])


class NoteIn(BaseModel):
    title: str
    content: str = ""
    tags: List[str] = []
    status: str = "Idea"


class InvestorIn(BaseModel):
    name: str
    firm: str = ""
    email: str = ""
    stage: str = "Seed"
    amount: float = 0
    status: str = "Prospect"
    notes: str = ""


class CandidateIn(BaseModel):
    name: str
    email: str
    role: str = ""
    stage: str = "Sourced"
    notes: str = ""


crud("notes", NoteIn)
crud("investors", InvestorIn)
crud("candidates", CandidateIn)


# ---------- TalentForge email ----------
class DraftIn(BaseModel):
    purpose: str = "interview invitation"
    company: str = ""
    extra: str = ""


class SendIn(BaseModel):
    subject: str
    body: str


@router.post("/candidates/{cid}/draft")
async def draft_email(cid: str, body: DraftIn, user=Depends(get_user)):
    c = await db.candidates.find_one({"id": cid, "uid": user["uid"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Candidate not found")
    prompt = (f"Write a professional hiring email. Purpose: {body.purpose}. Candidate: {c['name']}, role: {c.get('role')}. "
              f"Company: {body.company or 'our company'}. Sender: {user.get('name')}. Extra context: {body.extra}. "
              "Plain text body, no links, no placeholders in brackets. Return ONLY JSON: {\"subject\": \"...\", \"body\": \"...\"}")
    try:
        data = parse_json(await complete(PILLAR_PROMPTS["talent_forge"], prompt))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(424, ai_error(e))
    return {"subject": data.get("subject", ""), "body": data.get("body", "")}


@router.post("/candidates/{cid}/send")
async def send_candidate_email(cid: str, body: SendIn, user=Depends(get_user)):
    c = await db.candidates.find_one({"id": cid, "uid": user["uid"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Candidate not found")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.emails.count_documents({"uid": user["uid"], "created_at": {"$gte": since}}) >= 20:
        raise HTTPException(429, "Daily email limit (20) reached")
    if not body.subject.strip() or not body.body.strip():
        raise HTTPException(400, "Subject and body are required")
    paragraphs = "".join(f'<p style="margin:0 0 12px">{escape(p)}</p>' for p in body.body.strip().split("\n") if p.strip())
    html = (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#111">'
            f'{paragraphs}<p style="font-size:12px;color:#888;margin-top:24px">Sent by {escape(user.get("name") or user["email"])} '
            f'via {escape(EMAIL_FROM_NAME)}. We never ask for passwords or payment details by email.</p></td></tr></table>')
    eid = await send_email(to=c["email"], subject=body.subject.strip()[:200], html=html, reply_to=user.get("email") or None)
    rec = {"id": new_id(), "uid": user["uid"], "candidate_id": cid, "to": c["email"], "subject": body.subject, "email_id": eid, "created_at": now_iso()}
    await db.emails.insert_one(dict(rec))
    rec.pop("_id", None)
    return rec


@router.get("/emails")
async def list_emails(user=Depends(get_user)):
    return await db.emails.find({"uid": user["uid"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------- TaxDesk GST ----------
@router.post("/gst/extract")
async def gst_extract(file: UploadFile = File(...), user=Depends(get_user)):
    mime = file.content_type or ""
    if mime not in ("application/pdf", "image/png", "image/jpeg", "image/webp"):
        raise HTTPException(400, "Upload a PDF, PNG, JPG or WEBP invoice")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    suffix = os.path.splitext(file.filename or "")[1] or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = tmp.name
    prompt = ("Extract this Indian GST invoice. Return ONLY JSON with keys: vendor_name, vendor_gstin, buyer_name, buyer_gstin, invoice_number, "
              "invoice_date, place_of_supply, supply_type ('intra' or 'inter'), line_items (array of {description, hsn, quantity, unit_price, gst_rate}), "
              "taxable_value, cgst, sgst, igst, total. Use numbers for amounts and rates (gst_rate as percent). Use null if missing.")
    try:
        result = parse_json(await complete(PILLAR_PROMPTS["tax_desk"], prompt, file_path=path, mime=mime))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(424, ai_error(e))
    finally:
        os.unlink(path)
    return {"filename": file.filename, "data": result}


class GstLine(BaseModel):
    description: str = ""
    hsn: str = ""
    quantity: float = Field(0, ge=0)
    unit_price: float = Field(0, ge=0)
    gst_rate: float = Field(0, ge=0, le=40)


class GstInvoiceIn(BaseModel):
    kind: str
    period: str
    inter: bool = False
    inclusive: bool = False
    meta: dict = {}
    lines: List[GstLine]


def _calc_line(l: GstLine, inclusive: bool, inter: bool) -> dict:
    gross = l.quantity * l.unit_price
    taxable = gross / (1 + l.gst_rate / 100) if inclusive else gross
    tax = taxable * l.gst_rate / 100
    return {**l.model_dump(), "taxable": round(taxable, 2), "cgst": 0 if inter else round(tax / 2, 2),
            "sgst": 0 if inter else round(tax / 2, 2), "igst": round(tax, 2) if inter else 0, "total": round(taxable + tax, 2)}


TAX_KEYS = ("taxable", "cgst", "sgst", "igst", "total")


def _sum(rows) -> dict:
    return {k: round(sum(r[k] for r in rows), 2) for k in TAX_KEYS}


@router.post("/gst/invoices")
async def gst_save(body: GstInvoiceIn, user=Depends(get_user)):
    if body.kind not in ("sales", "purchase"):
        raise HTTPException(400, "kind must be 'sales' or 'purchase'")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", body.period):
        raise HTTPException(400, "period must be YYYY-MM")
    lines = [_calc_line(l, body.inclusive, body.inter) for l in body.lines if l.quantity and l.unit_price]
    if not lines:
        raise HTTPException(400, "Add at least one line with quantity and price")
    meta = {k: str(body.meta.get(k) or "") for k in ("vendor_name", "vendor_gstin", "buyer_name", "buyer_gstin", "invoice_number", "invoice_date")}
    rec = {"id": new_id(), "uid": user["uid"], "kind": body.kind, "period": body.period, "inter": body.inter, "inclusive": body.inclusive,
           "meta": meta, "lines": lines, "totals": _sum(lines), "created_at": now_iso()}
    await db.invoices.insert_one(dict(rec))
    rec.pop("_id", None)
    return rec


@router.get("/gst/invoices")
async def gst_invoices(period: Optional[str] = None, user=Depends(get_user)):
    q = {"uid": user["uid"], "kind": {"$in": ["sales", "purchase"]}}
    if period:
        q["period"] = period
    return await db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.delete("/gst/invoices/{iid}")
async def gst_delete(iid: str, user=Depends(get_user)):
    r = await db.invoices.delete_one({"id": iid, "uid": user["uid"]})
    if not r.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.get("/gst/summary")
async def gst_summary(period: str, user=Depends(get_user)):
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period):
        raise HTTPException(400, "period must be YYYY-MM")
    invs = await db.invoices.find({"uid": user["uid"], "period": period, "kind": {"$in": ["sales", "purchase"]}}, {"_id": 0}).to_list(1000)
    sales = [i for i in invs if i["kind"] == "sales"]
    purchases = [i for i in invs if i["kind"] == "purchase"]
    b2b = [{"invoice_number": i["meta"]["invoice_number"], "invoice_date": i["meta"]["invoice_date"], "buyer_name": i["meta"]["buyer_name"],
            "buyer_gstin": i["meta"]["buyer_gstin"], "supply": "Inter" if i["inter"] else "Intra", **i["totals"]} for i in sales if i["meta"]["buyer_gstin"]]
    b2c = [i["totals"] for i in sales if not i["meta"]["buyer_gstin"]]
    rate_map, hsn_map = {}, {}
    for i in sales:
        for l in i["lines"]:
            r = rate_map.setdefault(l["gst_rate"], {"gst_rate": l["gst_rate"], **{k: 0 for k in TAX_KEYS}})
            h = hsn_map.setdefault((l["hsn"] or "—", l["gst_rate"]), {"hsn": l["hsn"] or "—", "description": l["description"], "gst_rate": l["gst_rate"], "quantity": 0, **{k: 0 for k in TAX_KEYS}})
            h["quantity"] += l["quantity"]
            for k in TAX_KEYS:
                r[k] = round(r[k] + l[k], 2)
                h[k] = round(h[k] + l[k], 2)
    out_t, itc = _sum([i["totals"] for i in sales]), _sum([i["totals"] for i in purchases])
    liab = {k: out_t[k] for k in ("igst", "cgst", "sgst")}
    credit = {k: itc[k] for k in ("igst", "cgst", "sgst")}
    # IGST credit -> IGST, CGST, SGST; CGST credit -> CGST, IGST; SGST credit -> SGST, IGST (CGST/SGST never cross)
    for src, order in (("igst", ("igst", "cgst", "sgst")), ("cgst", ("cgst", "igst")), ("sgst", ("sgst", "igst"))):
        for head in order:
            use = min(credit[src], liab[head])
            credit[src] -= use
            liab[head] -= use
    net = {k: round(liab[k], 2) for k in ("cgst", "sgst", "igst")}
    carry = {k: round(credit[k], 2) for k in ("cgst", "sgst", "igst")}
    return {
        "period": period, "counts": {"sales": len(sales), "purchases": len(purchases)},
        "gstr1": {"b2b": b2b, "b2c": _sum(b2c) if b2c else {k: 0 for k in TAX_KEYS}, "b2c_count": len(b2c),
                  "rate_wise": sorted(rate_map.values(), key=lambda x: x["gst_rate"]), "hsn": list(hsn_map.values())},
        "gstr3b": {"outward": out_t, "itc": itc, "net_payable": {**net, "total": round(sum(net.values()), 2)}, "itc_carry_forward": carry},
    }


# ---------- MarketPulse news ----------
async def _rss_news(topic: str):
    url = f"https://news.google.com/rss/search?q={quote_plus(topic)}&hl=en-IN&gl=IN&ceid=IN:en"
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
        r = await c.get(url)
    root = ET.fromstring(r.content)
    items = []
    for it in root.iter("item"):
        src = it.find("source")
        items.append({"title": it.findtext("title", ""), "url": it.findtext("link", ""), "published": it.findtext("pubDate", ""),
                      "source": src.text if src is not None else ""})
        if len(items) >= 15:
            break
    return items


async def _tinyfish_news(cfg: dict, topic: str):
    res = await tinyfish.search(cfg, f"{topic} news", purpose="latest business news", recency_minutes=10080)
    return [{"title": r.get("title", ""), "url": r.get("url", ""), "source": r.get("publisher") or r.get("site_name", ""), "published": r.get("date", "")} for r in res]


async def _fetch_news(topic: str, source: str = "auto"):
    tf = (await get_settings())["tinyfish"]
    if source == "tinyfish":
        return "tinyfish", await _tinyfish_news(tf, topic)
    if source == "auto" and tf.get("enabled") and tf.get("api_key"):
        try:
            items = await _tinyfish_news(tf, topic)
            if items:
                return "tinyfish", items
        except Exception:
            pass
    return "rss", await _rss_news(topic)


@router.get("/news")
async def news(topic: str = "Indian startups funding", source: str = "auto", user=Depends(get_user)):
    try:
        source, items = await _fetch_news(topic, source)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Could not fetch news right now")
    return {"source": source, "topic": topic, "items": items}


# ---------- MarketPulse watchlist ----------
class WatchIn(BaseModel):
    label: str
    type: str = "company"


@router.get("/watchlist")
async def watchlist(user=Depends(get_user)):
    return await db.watchlist.find({"uid": user["uid"]}, {"_id": 0}).sort("created_at", 1).to_list(50)


@router.post("/watchlist")
async def watch_add(body: WatchIn, user=Depends(get_user)):
    label = body.label.strip()[:60]
    if not label or body.type not in ("company", "sector"):
        raise HTTPException(400, "Give a name and type 'company' or 'sector'")
    if await db.watchlist.count_documents({"uid": user["uid"]}) >= 12:
        raise HTTPException(400, "Watchlist is full (12 max)")
    if await db.watchlist.find_one({"uid": user["uid"], "label_lc": label.lower()}):
        raise HTTPException(400, "Already on your watchlist")
    rec = {"id": new_id(), "uid": user["uid"], "label": label, "label_lc": label.lower(), "type": body.type, "created_at": now_iso()}
    await db.watchlist.insert_one(dict(rec))
    rec.pop("_id", None)
    return rec


@router.delete("/watchlist/{wid}")
async def watch_delete(wid: str, user=Depends(get_user)):
    r = await db.watchlist.delete_one({"id": wid, "uid": user["uid"]})
    if not r.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


def _ts(s: str) -> float:
    try:
        return parsedate_to_datetime(s).timestamp()
    except Exception:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0


@router.get("/news/feed")
async def news_feed(source: str = "auto", user=Depends(get_user)):
    watch = await db.watchlist.find({"uid": user["uid"]}, {"_id": 0}).to_list(12)
    if not watch:
        return {"items": [], "watch_count": 0}
    results = await asyncio.gather(*[_fetch_news(w["label"], source) for w in watch], return_exceptions=True)
    items, seen = [], set()
    for w, res in zip(watch, results):
        if isinstance(res, Exception):
            continue
        for n in res[1][:6]:
            if n.get("title") in seen:
                continue
            seen.add(n.get("title"))
            items.append({**n, "watch": w["label"], "watch_type": w["type"], "via": res[0]})
    items.sort(key=lambda n: _ts(n.get("published", "")), reverse=True)
    return {"items": items[:40], "watch_count": len(watch)}

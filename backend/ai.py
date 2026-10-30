import json
import re
import logging
from fastapi import HTTPException
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone, FileContentWithMimeType
from core import get_settings, new_id

logger = logging.getLogger(__name__)

PILLAR_PROMPTS = {
    "venture_radar": "You are VentureRadar, a sharp startup analyst. Evaluate ideas for market size, competition, feasibility, risks and next steps. Be concise and structured.",
    "capital_flow": "You are CapitalFlow, a fundraising strategist. Advise on investor targeting, pitch, valuation, term sheets and runway.",
    "talent_forge": "You are TalentForge, a hiring partner. Help write job descriptions, outreach and interview plans.",
    "tax_desk": "You are TaxDesk, an Indian GST expert. Explain CGST/SGST/IGST, HSN/SAC, input tax credit and filing. Add a short disclaimer to verify with a CA for filings.",
    "market_pulse": "You are MarketPulse, a market intelligence analyst. Summarise business news, trends and signals for founders.",
    "strategy_lab": "You are StrategyLab, a boardroom-grade strategy advisor. Give crisp frameworks, scenarios and decisive recommendations.",
}


async def _chat(system: str) -> LlmChat:
    s = await get_settings()
    key = s["ai"].get("api_key")
    if not key:
        raise HTTPException(503, "AI is not configured. Ask the admin to add a Gemini API key.")
    return LlmChat(api_key=key, session_id=new_id(), system_message=system).with_model("gemini", s["ai"].get("model") or "gemini-3-flash-preview")


def ai_error(e: Exception) -> str:
    logger.error(f"AI call failed: {e}")
    s = str(e)
    if "401" in s or "API key" in s or "AuthenticationError" in s or "PERMISSION_DENIED" in s:
        return "The AI key isn't working. Ask the admin to update the Gemini API key in the Admin Console."
    if "429" in s or "RateLimit" in s or "quota" in s.lower():
        return "The AI is busy or out of quota right now. Please try again shortly."
    if "404" in s or "NotFound" in s:
        return "The AI model name isn't recognised. Ask the admin to check the model in the Admin Console."
    return "The AI couldn't respond right now. Please try again."


async def test_key(api_key: str, model: str) -> None:
    chat = LlmChat(api_key=api_key, session_id=new_id(), system_message="Health check").with_model("gemini", model)
    async for ev in chat.stream_message(UserMessage(text="Reply with OK")):
        if isinstance(ev, StreamDone):
            break


async def stream_reply(system: str, text: str):
    chat = await _chat(system)
    async for ev in chat.stream_message(UserMessage(text=text)):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break


async def complete(system: str, text: str, file_path: str = None, mime: str = None) -> str:
    chat = await _chat(system)
    files = [FileContentWithMimeType(file_path=file_path, mime_type=mime)] if file_path else None
    out = ""
    async for ev in chat.stream_message(UserMessage(text=text, file_contents=files) if files else UserMessage(text=text)):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    return out


def parse_json(text: str):
    m = re.search(r"\{.*\}|\[.*\]", text, re.S)
    if not m:
        raise HTTPException(424, "AI returned an unreadable response, please try again")
    return json.loads(m.group(0))

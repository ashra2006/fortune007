import json
import re
import httpx
from fastapi import HTTPException

DEFAULT_AGENT_URL = "https://agent.tinyfish.ai"
DEFAULT_SEARCH_URL = "https://api.search.tinyfish.ai"
URL_RE = re.compile(r"https?://[^\s)>\]]+")

PILLAR_PURPOSE = {
    "venture_radar": "startup idea and market research",
    "capital_flow": "startup fundraising and investor research",
    "talent_forge": "hiring and talent market research",
    "tax_desk": "Indian GST and tax compliance research",
    "market_pulse": "business and market news research",
    "strategy_lab": "business strategy research",
}


def _cfg_ok(cfg: dict):
    if not cfg.get("api_key"):
        raise HTTPException(503, "TinyFish isn't set up yet. Ask the admin to add the TinyFish API key in the Admin Console.")


async def search(cfg: dict, query: str, **params) -> list:
    _cfg_ok(cfg)
    url = cfg.get("search_url") or DEFAULT_SEARCH_URL
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url, params={"query": query[:300], **params}, headers={"X-API-Key": cfg["api_key"]})
    if r.status_code in (401, 403):
        raise HTTPException(424, "TinyFish rejected the API key. Ask the admin to check it in the Admin Console.")
    r.raise_for_status()
    return r.json().get("results", [])


async def agent_events(cfg: dict, url: str, goal: str):
    _cfg_ok(cfg)
    base = (cfg.get("base_url") or DEFAULT_AGENT_URL).rstrip("/")
    async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=20)) as c:
        async with c.stream("POST", f"{base}/v1/automation/run-sse", headers={"X-API-Key": cfg["api_key"]}, json={"url": url, "goal": goal}) as r:
            if r.status_code in (401, 403):
                raise HTTPException(424, "TinyFish rejected the API key. Ask the admin to check it in the Admin Console.")
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line.startswith("data:"):
                    try:
                        yield json.loads(line[5:].strip())
                    except ValueError:
                        continue


def _to_md(v, depth=0) -> str:
    pad = "  " * depth
    if isinstance(v, dict):
        return "\n".join(f"{pad}- **{k}**: {_to_md(x, depth + 1).strip() if not isinstance(x, (dict, list)) else chr(10) + _to_md(x, depth + 1)}" for k, x in v.items())
    if isinstance(v, list):
        return "\n".join(f"{pad}- {_to_md(x, depth + 1).strip()}" if not isinstance(x, (dict, list)) else _to_md(x, depth) for x in v)
    return f"{v}"


def _query_from(message: str) -> str:
    q = " ".join(message.split())
    if len(q) <= 160:
        return q
    cut = q[:160]
    return cut[: cut.rfind(" ")] if " " in cut else cut


async def research_stream(cfg: dict, pillar: str, message: str, search_query: str = None):
    m = URL_RE.search(message)
    if m and not search_query:
        url = m.group(0).rstrip(".,")
        yield f"**TinyFish web agent** is browsing {url}\n\n"
        async for ev in agent_events(cfg, url, message):
            t = ev.get("type")
            if t == "PROGRESS" and ev.get("purpose"):
                yield f"- {ev['purpose']}\n"
            elif t == "COMPLETE":
                if ev.get("status") == "COMPLETED" and ev.get("result") is not None:
                    yield "\n### Result\n" + _to_md(ev["result"]) + "\n"
                else:
                    err = ev.get("error") or {}
                    yield f"\n⚠ TinyFish couldn't finish this task: {err.get('message', 'unknown error') if isinstance(err, dict) else err}\n"
        return
    query = _query_from(search_query or message)
    results = await search(cfg, query, purpose=PILLAR_PURPOSE.get(pillar, "business research"))
    shown = re.sub(r"([\\`*_\[\]#<>|~])", r"\\\1", query)
    if not results:
        yield f"TinyFish found no web results for **{shown}**. Try a shorter or more specific question."
        return
    yield f"### Web research via TinyFish\n_Search: {shown}_\n\n"
    for i, r in enumerate(results[:8], 1):
        meta = " · ".join(x for x in (r.get("publisher") or r.get("site_name"), r.get("date")) if x)
        yield f"{i}. **[{r.get('title', 'Untitled')}]({r.get('url', '')})**{' — ' + meta if meta else ''}\n   {r.get('snippet', '')}\n\n"
    yield "_Tip: include a link in your message to have TinyFish's agent open and read that page for you._"

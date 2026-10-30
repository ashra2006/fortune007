# Fortune 007 — PRD

## Original problem
Founder operating suite "Fortune 007": Admin console (1111/1111 bootstrap), Firebase user auth, centralized AI config (user's own Gemini key, admin-editable), TinyFish web research (admin-configurable base URL + key), 6 AI pillars with chat, News, GST calculator (upload+extract+PDF), VentureRadar notepad, Funding tracker, TalentForge email composer (Emergent Resend). No payments.

## Architecture
- FastAPI: core.py (db, settings doc, admin JWT, Firebase ID-token verify via Google certs, no service account), ai.py (emergentintegrations Gemini, model from settings), admin_routes.py, pillar_routes.py, email_service.py (managed Resend + guardrail gate)
- React: Firebase SDK initialised at runtime from /api/public/firebase-config (apiKey editable in admin), pages Landing/Dashboard/PillarPage/AdminLogin/AdminConsole, pillars/*.jsx, ChatPanel (streaming)
- Mongo collections: settings, admins, users, notes, investors, candidates, emails, invoices, chat_messages

## Implemented (2026-06)
- Admin: login, AI model/key, Firebase apiKey, TinyFish url/key/toggle, test-AI, users enable/disable, stats, change password
- Pillars: VentureRadar notes + AI feasibility; CapitalFlow kanban + totals; TalentForge candidates, AI draft, real send + log; TaxDesk GST calc (intra/inter, incl/excl), Gemini invoice extraction, jsPDF export; MarketPulse news (TinyFish if enabled else Google News RSS) + AI briefing; StrategyLab frameworks + chat
- Streaming chat per pillar with persisted history; bottom engine dropdown per pillar: Gemini AI or TinyFish web (Search API; Agent run-sse when a link is in the message). Admin TinyFish test button + Search API URL. MarketPulse news source dropdown (Auto/TinyFish/Google News)
- Fixed: 'destroy is not a function' (scrollIntoView Promise as effect cleanup), stream crash on clear/switch, stale prompt replay; Firebase project mismatch (now dgljhgf-22f2f, admin-editable)
- GST monthly returns (2026-06): save calculator invoices as sales/purchase per month; GSTR-1 (B2B, B2C, rate-wise, HSN) + GSTR-3B (output, ITC, net payable, carry-forward) with PDF export
- MarketPulse watchlists (2026-06): save up to 12 companies/sectors; "My feed" merges their news and opens by default

## Blockers
- Firebase web apiKey not provided -> user sign-in disabled until admin pastes it (Admin Console > AI & Auth). Firebase Email/Password + Google providers must be enabled in Firebase console, and preview/prod domain added to Authorized domains.

## Backlog
- P1: Clear-key option in admin, per-pillar prompt editing, revoke admin tokens on password change
- P2: Investor email reminders, GST return summaries (GSTR-1/3B), news watchlists

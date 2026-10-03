# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

KarobarAI: a voice-first AI copilot for Nepal's kirana shops (credit-risk scoring, demand forecasting, Nepali voice ledger, daily spoken brief). Monorepo with three apps. Each has its own `CLAUDE.md` with commands, structure and rules. Read the one for the app you are changing before editing.

| Dir        | What                                                                    | Guide                                                    |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `backend/` | FastAPI + PostgreSQL + Alembic, ML models (`ml/credit`, `ml/demand`)    | `backend/CLAUDE.md`                                      |
| `web/`     | React 19 + Vite dashboard: analytics, credit, forecasts, inventory      | `web/CLAUDE.md`                                          |
| `mobile/`  | Expo (React Native) app: voice capture, daily brief, offline recordings | `mobile/CLAUDE.md` (+ `mobile/AGENTS.md` for Expo rules) |

## Commands

```bash
# backend (venv at backend/.venv)
cd backend
python -m venv .venv #(Optional) Create virtual environement
.venv/Scripts/activate #for windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload                 # add --host 0.0.0.0 when a phone must reach it over LAN

# web
cd web && npm run dev | npm run build | npm run lint

# mobile
cd mobile && npx expo start
npx tsc --noEmit && npx expo lint             # run both before calling mobile work done
```

There is no automated test suite in any app. Verify with typecheck/lint/build, and for backend changes at least import the touched modules with the venv Python.

## Cross-app architecture

- **One API contract, two clients.** All routes live under `/api/v1` and most are shop-scoped: `/shops/{shop_id}/...`. JSON responses use the `ApiResponse` envelope (`success`, `message`, `data`; errors are `ErrorResponse` with `detail`), which both clients unwrap. Audio routes (`confirm-with-audio`, `brief/audio`, `tts`) instead stream `audio/mpeg` and carry extra data in headers (`X-Confirmation-Text`, `X-Processed-Count`).
- **Types are hand-mirrored.** `web/src/types/` and `mobile/src/types/api.ts` copy the Pydantic models in `backend/app/schemas/`. A backend schema change means updating both mirrors. Read the router and schema before adding or changing any client call; do not guess field names.
- **Surface split.** Voice capture and transcription exist only on mobile. Detailed credit/forecast views (SHAP, charts) exist only on web; mobile shows simple summaries.
- **Voice pipeline** (mobile to backend): record `.m4a`, then `/voice/transcribe` (ElevenLabs STT), then `/voice/extract-transactions` (LLM, user reviews drafts), then `/voice/confirm-with-audio` (writes transactions, updates stock, returns TTS). Offline recordings on mobile replay this same flow later and send `recorded_at` so transactions are dated to when they were spoken.
- **Provider fallback chains live in the backend only:** LLM through `llm_service.generate()`, speech through `voice_service.synthesize_speech()`. Do not add provider calls elsewhere.
- **No mock data** anywhere. If the backend has no endpoint for something, leave the feature out. Each app's `CLAUDE.md` lists the known backend gaps.

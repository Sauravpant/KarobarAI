# CLAUDE.md

Guidance for working in `backend/`, the KarobarAI API. KarobarAI is a voice-first AI copilot for Nepal's kirana shops. Clients: the web dashboard (`../web`) and the Expo mobile app (`../mobile`).

## Stack

FastAPI, SQLAlchemy, PostgreSQL, Alembic, Pydantic settings. Auth uses JWT and bcrypt. ML: credit-risk and demand-forecast models with SHAP explanations. All routes are under `/api/v1`.

## Commands

```bash
pip install -r requirements.txt
alembic upgrade head                 # migrations live in app/alembic/versions
uvicorn app.main:app --reload        # dev server, docs at /docs
python -m app.seed_transactions      # seed demo transactions (--email, --shop-id, --days N, --reset)
```

## Environment

Settings live in `app/core/config.py`. Copy `.env.example` to `.env`.

```
DATABASE_URL=
SECRET_KEY=
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GEMINI_API_KEY=          # LLM primary
GROQ_API_KEY=            # LLM fallback 1
OPENROUTER_API_KEY=      # LLM fallback 2
ELEVEN_LABS_API_KEY=     # STT and TTS. ELEVEN_LABS, not ELEVENLABS
SARVAM_API_KEY=          # TTS
```

Edge-TTS and gTTS need no keys. Never rename existing env vars, because that breaks every `.env`.

## Structure

```
app/
  main.py        app setup; lifespan loads ML models and warms the DB pool
  api/           routers: auth, shops, categories, products, customers,
                 transactions, dashboard, credit_risk, demand_forecast, voice
  schemas/       Pydantic request/response models
  models/        SQLAlchemy models
  services/      business logic, one module per domain
  core/          config, security, dependencies, ml_manager
  db/            engine and session
  alembic/       migrations
ml/
  credit/        credit-risk training, inference, artifacts
  demand/        demand-forecast training, inference, artifacts
```

Routers stay thin. Logic goes in `services/`.

## Key flows

- **Voice transactions** (`api/voice.py`, `services/voice_service.py`):
  1. `/voice/transcribe` takes a multipart `UploadFile` (field `audio`).
  2. `preprocess_audio()` converts audio to mono 16 kHz, normalizes it, trims silence, and optionally denoises it.
  3. ElevenLabs Scribe v2 (`ne`) transcribes the audio. STT is confirmed working; do not change it.
  4. `/voice/extract-transactions` returns structured JSON.
  5. `/voice/confirm` or `/voice/confirm-with-audio` saves the transactions.
- **LLM** (`services/llm_service.py`): use `generate(prompt, json_schema=...)` for every LLM call. The chain is Gemini, then Groq, then OpenRouter. In JSON mode, output is validated against the Pydantic model, and a validation failure moves to the next provider.
- **TTS** (`synthesize_speech()` in `voice_service.py`): the chain is Edge-TTS, Sarvam, ElevenLabs, then gTTS. Every provider returns mp3, so responses always use `audio/mpeg`.
  - Sarvam authenticates with the `api-subscription-key` header, not Bearer.
  - Sarvam returns base64 audio, which must be decoded.
- **Daily brief** (`services/daily_brief_service.py`):
  1. Python computes all numbers into `DailyBriefContext`.
  2. The LLM writes a Nepali-only spoken transcript as plain text, with no markdown, JSON, or emojis.
  3. The transcript goes unchanged to TTS.
  - Only the transcript is stored, one per shop and date in `daily_briefs`. The LLM never reruns for the same shop and date.
  - `GET /shops/{shop_id}/dashboard/brief/audio` runs TTS again on every call.
- **ML** (`api/credit_risk.py`, `api/demand_forecast.py`): models load at startup through `core/ml_manager.py`. Per-customer and per-product predictions persist to `credit_predictions` and `demand_forecasts`.

## Conventions

- Provider clients are lazy singletons (`_get_ai_client()`, `_get_stt_client()`, ...). Add new providers the same way.
- Put all LLM calls through `llm_service.generate()` and all speech through `synthesize_speech()`. Do not duplicate fallback logic.
- Fall back only on real failures: timeout, rate limit, 5xx, empty response, or invalid JSON. Short but well-formed output is not a failure.
- Log which provider served each LLM and TTS request.
- New generated records follow the `CreditPrediction` / `DemandForecast` persist-history pattern.
- Schema changes need an Alembic migration.

## Known gaps

- The dashboard endpoint has no date-range params.
- No routes read persisted credit predictions or demand forecasts back.
- No credit-report export and no notification system.
- No scheduled jobs yet. A nightly credit-risk refresh would call `credit_risk_service.predict_for_customer(..., save_result=True)` per active customer instead of rebuilding prediction logic.

# KarobarAI 🎙️

**"From recording transactions to predicting business outcomes."**

A voice-first AI copilot that helps Nepali kirana (retail) store owners make smarter credit and inventory decisions — in Nepali, by voice.

Built by **Team DeepStack** for **MBMC IdeaX 2026**.

| | |
| --- | --- |
| **Project** | KarobarAI |
| **Team** | DeepStack |
| **Track** | Fintech |
| **Hackathon** | MBMC IdeaX 2026 |
| **Repository** | [https://github.com/MBMC-IdeaX/DeepStack](https://github.com/MBMC-IdeaX/DeepStack) |

---

## Problem

Kirana stores make up ~90% of Nepal's retail sector, yet most still run on paper *bahi khata* and memory. Two blind spots cost them money every month:

- **Credit** — Shopkeepers give *उधार* to survive, but can't tell who will repay and who will quietly default.
- **Inventory** — Reordering by gut feeling means stockouts on fast-movers and expiry on slow-movers.

Existing khata apps only digitize the ledger. They never answer *who won't pay* or *what won't sell*.

## Solution

KarobarAI is a single voice-first platform: speak a transaction in Nepali, get AI guidance on credit and stock, and hear a daily business summary.

| Traditional ledger apps | KarobarAI |
| --- | --- |
| "What happened?" | "What will happen next?" |

Remove the credit-risk model and the forecaster and it's just another ledger — AI is the product, not decoration.

## Key Features

- 🗣️ **Nepali voice entry** — say *"कोक पाँच वटा बेच्यो"*; it's transcribed, parsed, stock is updated, and confirmed back by voice.
- 📊 **Credit risk scoring** — repayment likelihood per customer, risk flags, and a recommended credit limit (SHAP-explained).
- 📦 **Demand forecasting** — shop-level forecasts with seasonality and Nepal's festival calendar, driving reorder alerts.
- 🔊 **Daily voice brief** — end-of-day spoken recap: sales, top/bottom sellers, stock, cash vs. credit, total *उधार*.

## Pipeline

`Voice → STT → Ledger DB → ML models → Predictions → Audio brief`

1. Shopkeeper speaks in Nepali
2. ElevenLabs STT + Gemini parse it into a transaction
3. Saved to PostgreSQL
4. Credit-risk and demand models run
5. Risk scores, limits, and reorder alerts are generated
6. Daily summary is spoken via TTS

## Architecture

```text
        ┌────────────────────────────────┐      ┌────────────────────────────────┐
        │           MOBILE APP           │      │         WEB DASHBOARD          │
        │     (React Native / Expo)      │      │         (React + Vite)         │
        │                                │      │                                │
        │   • Nepali voice transactions  │      │   • Credit risk scores         │
        │   • Daily voice brief          │      │   • Demand forecasts           │
        │   • Quick stock view           │      │   • Inventory & reports        │
        └────────────────────────────────┘      └────────────────────────────────┘
                         │                                      │
                         └───────────────────┬──────────────────┘
                                             │ REST /api/v1
                                             ▼
┌─ FASTAPI BACKEND ──────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────┐   ┌──────────────────────────┐    ┌──────────────────────┐  │
│  │     Voice Service     │◀──│         REST API         │───▶│      ML Service      │  │
│  │    STT → LLM → TTS    │   │auth · ledger · dashboard │    │ credit risk · demand │  │
│  └───────────────────────┘   └──────────────────────────┘    └──────────────────────┘  │
└──────────────┬─────────────────────────────┬─────────────────────────────┬─────────────┘
               │                             │                             │
               ▼                             ▼                             ▼
 ┌───────────────────────────┐  ┌─────────────────────────┐   ┌─────────────────────────┐
 │       EXTERNAL APIs       │  │        PostgreSQL       │   │  Model files (.joblib)  │
 │       ElevenLabs STT      │  │    ledger · customers   │   │       credit_risk       │
 │ Gemini → Groq → OpenRouter│  │ inventory · transactions│   │          demand         │
 │   Sarvam TTS / Edge-TTS   │  │                         │   │                         │
 └───────────────────────────┘  └────────────┬────────────┘   └────────────▲────────────┘
                                             │ new transactions            │
        ┌────────────────────────────────────┘          deploy new models  │
        ▼                                                                  │
 ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─┴───────────┐
 │  1. Extract │──▶│  2. Clean & │──▶│ 3. Append to│──▶│  4. Retrain │──▶│ 5. Evaluate │
 │   from DB   │   │  transform  │   │training CSVs│   │ both models │   │   & deploy  │
 └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘

                  ETL + RETRAINING PIPELINE (planned, runs periodically)
```

## Model Data & Retraining

- **Synthetic data** — both the credit-risk and demand-forecasting models are currently trained on synthetic data.
- **Planned ETL pipeline** — real transactions will be extracted from the ledger DB, appended to the training CSVs, and used to retrain both models periodically, so predictions improve as more shops and customers join.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Web dashboard | React, TypeScript, Vite, Tailwind CSS |
| Mobile | React Native (Expo) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Neon) |
| STT / TTS | ElevenLabs STT; Sarvam AI TTS (Edge-TTS fallback) |
| LLM | Gemini → Groq → OpenRouter (fallback chain) |
| ML | XGBoost / CatBoost / LightGBM, SHAP |
| Infra | Docker, Docker Compose, nginx |

## Project Structure

```
DeepStack/
├── README.md
├── .gitignore
├── docker-compose.yml
├── frontend/     # React + Vite web dashboard
├── mobile/       # React Native (Expo) app
└── backend/
    ├── app/      # FastAPI: api, core, db, models, schemas, services
    └── ml/
        ├── credit_risk/   # train.py, src/, inference/, models/*.joblib
        └── demand/        # train.py, src/, inference/, models/*.joblib
```

Only `ml/*/models/*.joblib` are needed at runtime; data, notebooks, and artifacts are excluded from the Docker image.

## Setup

### Docker (recommended)

```bash
git clone https://github.com/MBMC-IdeaX/DeepStack.git
cd DeepStack
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host/dbname
GEMINI_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
ELEVENLABS_API_KEY=...
SARVAM_API_KEY=...
```

```bash
docker compose up --build
docker compose exec backend alembic upgrade head
```

- Web: http://localhost:3000
- API: http://localhost:8000 (docs at `/docs`)

### Local development

**Prerequisites:** Node.js 18+, Python 3.13+, PostgreSQL (local or Neon).

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Web (needs frontend/.env: VITE_API_BASE_URL=http://localhost:8000/api/v1)
cd frontend && npm install && npm run dev

# Mobile
cd mobile && npm install && npx expo start
```

Pretrained `.joblib` pipelines are included. To retrain, run `train.py` in `backend/ml/<model>/` with your data in `data/raw/`.

## Third-Party Components

| Component | Used for |
| --- | --- |
| Gemini API (Groq / OpenRouter fallback) | Function-calling assistant: intent parsing, daily summary |
| ElevenLabs STT | Nepali speech-to-text |
| Sarvam AI / Edge-TTS | Spoken confirmations and daily brief (Edge-TTS uses an unofficial endpoint) |
| CatBoost / XGBoost / LightGBM, SHAP | Credit-risk and demand models, explainability |
| FastAPI, PostgreSQL, React, Tailwind, Docker, nginx | App infrastructure (open source) |

## Known Limitations

- **Synthetic training data** — models are not yet trained on real shop data; accuracy on real-world usage is unvalidated until the ETL/retraining pipeline is in place.
- **Cold start** — new shops/customers get low-confidence scores until enough history exists.
- **Nepali STT accuracy** — dialects, Nepali-English code-switching, and noisy stores aren't rigorously benchmarked.
- **Pooled model** — one model with per-shop features, not a bespoke model per store.
- **API dependence & connectivity** — relies on external APIs and a stable internet connection.
- **Informational scores only** — no banking or micro-lending integration yet.
- **Security** — encryption, access control, and data retention are not formally audited.

## Business Model

B2B tiered subscription for kirana owners and the wholesalers who supply them.

| Tier | Price | Highlights |
| --- | --- | --- |
| **Starter Lite** | Rs. 0 | Nepali voice transactions, transaction logs, manual backups |
| **KarobarAI Pro** | Rs. 499/month | Credit scoring, festival-aware forecasting, daily audio brief, SMS repayment alerts |
| **Enterprise Hub** | Custom | Distributor integrations, demand heatmaps, margin analytics, credit-risk check access |

Distributor-paid tiers subsidize free retailer tiers, driving grassroots adoption.

## Market Opportunity

- **90%+** of Nepal's retail sector is traditional kirana *(UNCDF)*
- **450k+** kirana outlets nationwide *(National Statistics Office)*
- **14.1%** of GDP from wholesale/retail trade in FY 2025/26 *(NRB, NSO)*

## Team

**Team DeepStack** — Saurav Pant, Swastika Dhakal

## Sources

- Nepal Rastra Bank — SME Financial Integration Survey & Policy Guidelines
- UNCDF — Digitizing MSMEs: Traditional Kirana Outlets in Nepal
- National Statistics Office — National Economic Census & Enterprise Datasets
- Samriddhi Foundation — Informal Retail Market Regulations & Trade Friction

## License

Built for MBMC IdeaX 2026.
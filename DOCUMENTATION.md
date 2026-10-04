# KarobarAI: Project Documentation

> Voice-first AI copilot for Nepal's kirana shops. Built by Team DeepStack for MBMC IdeaX 2026 (Fintech track).

This document covers the whole project in one place: the problem, the product, the market, and every technical layer (backend, AI/ML, voice, web, mobile, third-party services, deployment). It describes the code as it exists in this repository. Where the code and older docs disagree, this document follows the code and notes the difference.

---

## Contents

1. [Summary](#1-summary)
2. [The problem](#2-the-problem)
3. [The solution](#3-the-solution)
4. [Market and business model](#4-market-and-business-model)
5. [Users and core journeys](#5-users-and-core-journeys)
6. [System architecture](#6-system-architecture)
7. [Technology stack](#7-technology-stack)
8. [Backend](#8-backend)
9. [API reference](#9-api-reference)
10. [AI and machine learning](#10-ai-and-machine-learning)
11. [Voice pipeline (STT, LLM, TTS)](#11-voice-pipeline-stt-llm-tts)
12. [Daily voice brief](#12-daily-voice-brief)
13. [Web dashboard](#13-web-dashboard)
14. [Mobile app](#14-mobile-app)
15. [Third-party services](#15-third-party-services)
16. [Libraries](#16-libraries)
17. [Setup and deployment](#17-setup-and-deployment)
18. [Testing and quality](#18-testing-and-quality)
19. [Security and privacy](#19-security-and-privacy)
20. [Known limitations and roadmap](#20-known-limitations-and-roadmap)
21. [Glossary](#21-glossary)
22. [Sources](#22-sources)

---

## 1. Summary

KarobarAI lets a kirana (neighbourhood grocery) shopkeeper run the shop by speaking Nepali. The shopkeeper says something like *"कोक पाँच वटा बेच्यो"* ("sold five Cokes"). The app transcribes it, turns it into a structured transaction, updates stock, and reads a confirmation back in Nepali.

On top of that ledger, two machine-learning models answer the questions a paper ledger cannot:

- **Credit risk:** which customers are likely to repay late, and what credit limit is safe for each one.
- **Demand forecasting:** how many units of each product will sell tomorrow and over the next 7 days, including the effect of Dashain and Tihar.

Every evening, the shopkeeper can listen to a spoken **daily brief** in Nepali: sales, credit given, who owes the most, best and worst sellers, low stock, and what to restock before tomorrow.

The product has three parts:

| Part | Purpose | Tech |
| --- | --- | --- |
| Mobile app (`mobile/`) | Voice capture, offline recordings, daily brief, quick stats | Expo / React Native |
| Web dashboard (`web/`) | Detailed analytics: inventory, customers, credit risk with SHAP, demand forecasts, reports | React + Vite |
| Backend (`backend/`) | REST API, PostgreSQL ledger, ML inference, LLM and speech provider chains | FastAPI + SQLAlchemy |

> Traditional ledger apps answer "what happened?". KarobarAI answers "what will happen next?". Without the credit model and the forecaster it would be another ledger app. The AI is the product.

---

## 2. The problem

### 2.1 Context

Traditional kirana outlets make up more than 90% of Nepal's retail sector. There are more than 450,000 of them. Most still run on a paper *bahi khata* (ledger book) and the owner's memory.

### 2.2 Two blind spots

**Credit (उधारो / udharo).** Shopkeepers extend informal credit to keep customers. It is a survival tool, not a choice. But they have no way to tell who will repay on time and who will default quietly. Credit decisions rest on gut feeling and personal relationships. Bad credit locks up working capital, and a few late payers can stop the shop from restocking.

**Inventory.** Reordering is done by feel. Fast-moving goods run out (lost sales). Slow-moving and perishable goods expire (wasted money). Demand also swings sharply around festivals. Dashain and Tihar can lift sales of some categories by 30 to 50% for two weeks, and owners who do not plan for it either run out or overstock.

### 2.3 Why existing tools fall short

- Existing khata apps digitize the ledger, but they only record the past. They never say *who won't pay* or *what won't sell*.
- Most apps need typing in English or romanized Nepali. Many shop owners are more comfortable speaking Nepali than typing.
- Shopkeepers serve customers with their hands full. Data entry has to take seconds, not minutes.
- Connectivity in many areas is unreliable, so an app that loses a sale when the network drops is not trusted.

---

## 3. The solution

### 3.1 Features

| Feature | What the shopkeeper gets | Where |
| --- | --- | --- |
| Nepali voice entry | Speak a sale or purchase. It is transcribed, parsed into line items, matched to the product catalog, reviewed, saved, and confirmed by voice. Stock updates automatically. | Mobile |
| Offline recordings | If the server cannot be reached, the recording is kept on the phone and processed later, dated to when it was spoken. | Mobile |
| Credit risk scoring | Per-customer probability of late repayment, a risk level (low/medium/high), a suggested credit limit with a reason, and a SHAP breakdown of why. One click applies the suggested limit. | Web (detail) |
| Credit limit enforcement | A credit sale that would push a customer over their limit is rejected by the backend. | Backend |
| Demand forecasting | Next-day and 7-day forecasts per product, festival-aware, with a stock summary ("restock 12 units") and SHAP drivers. | Web |
| Daily voice brief | An end-of-day spoken summary in Nepali, plus restock advice driven by the forecaster. | Mobile and web |
| Dashboard and reports | Revenue, profit, payment mix, top products, category performance, inventory status, 7-day sales chart. | Web (full), mobile (summary) |
| Alerts | Low-stock and unpaid/overdue credit alerts derived from live data. | Web |

### 3.2 End-to-end flow

```
Speak in Nepali
  -> record .m4a on the phone
  -> /voice/transcribe            (audio cleanup + ElevenLabs Scribe v2, Nepali)
  -> /voice/extract-transactions  (LLM turns text into JSON line items; fuzzy match to catalog)
  -> shopkeeper reviews drafts    (fix product, quantity, set credit customer and due date)
  -> /voice/confirm-with-audio    (write transactions, update stock, LLM polishes Nepali reply, TTS)
  -> phone plays the confirmation
  -> ledger feeds the credit model, demand model, dashboard and daily brief
```

---

## 4. Market and business model

### 4.1 Market

| Indicator | Value | Source |
| --- | --- | --- |
| Share of retail that is traditional kirana | 90%+ | UNCDF |
| Kirana outlets nationwide | 450,000+ | National Statistics Office |
| Wholesale/retail trade share of GDP (FY 2025/26) | 14.1% | NRB, NSO |

### 4.2 Target users

- **Primary:** owners of small and mid-size kirana shops in urban, semi-urban and rural Nepal. The data model records `location_type` (`urban`, `semi_urban`, `rural`) for every shop, and the demand model uses it.
- **Secondary:** distributors and wholesalers who supply these shops and benefit from better demand signals and creditworthiness data.

### 4.3 Business model

B2B tiered subscription.

| Tier | Price | Includes |
| --- | --- | --- |
| Starter Lite | Rs. 0 | Nepali voice transactions, transaction logs, manual backups |
| KarobarAI Pro | Rs. 499 / month | Credit scoring, festival-aware forecasting, daily audio brief, SMS repayment alerts (planned) |
| Enterprise Hub | Custom | Distributor integrations, demand heatmaps, margin analytics, credit-risk check access |

Distributor-paid tiers subsidize the free retailer tier. This drives grassroots adoption: the more shops use the free tier, the more valuable the aggregated data is for distributors.

### 4.4 Differentiation

- Voice-first in Nepali, not a form-based app with a microphone added.
- Predictive (credit risk, demand), not only a record of the past.
- Explainable. Every score comes with SHAP drivers in plain language, so the owner can see why a customer is flagged.
- Festival-aware forecasting built for the Nepali calendar.
- Works through network drops with offline recordings.

---

## 5. Users and core journeys

### 5.1 Onboarding

1. Register (`full_name`, `email`, `password`, optional `phone`).
2. Log in. The backend returns a JWT.
3. Create a shop (`shop_name`, `address`, `location_type`). One user can own several shops.
4. Create categories and add products (SKU, unit, cost price, selling price, opening stock, reorder level, staple and perishable flags).
5. Add customers who buy on credit, with a credit limit.

### 5.2 Recording a sale by voice (mobile)

1. Open the voice screen and hold to record (max 90 seconds).
2. The transcript appears. The shopkeeper can edit it.
3. The app shows draft transactions. Each line shows the matched product, current stock and quantity. Unmatched lines are excluded by default.
4. For a credit sale, pick the customer and a due date (7, 15 or 30 days).
5. Confirm. The phone plays the spoken confirmation, for example "चिनी पाँच प्याकेट बिक्री भयो, भण्डारमा पचपन्न बाँकी।"

### 5.3 Deciding on credit (web)

1. Open Credit Risk and select a customer.
2. See the risk probability, risk level, share of credit limit in use, suggested limit with its reason, and grouped SHAP drivers (repayment record, current debt, credit use, shopping activity).
3. Apply the suggested limit with one click. The backend recomputes it server-side before saving.

### 5.4 Planning stock (web)

1. Open Demand Forecast and select a product.
2. See tomorrow's forecast, the 7-day forecast, the stock gap, a restock recommendation, and the drivers (recent sales, calendar, festivals).

### 5.5 End of day (mobile or web)

1. Open the daily brief. The Nepali transcript and the AI insight line show first.
2. Press play to hear it.

---

## 6. System architecture

```
        +------------------------------+      +------------------------------+
        |          MOBILE APP          |      |        WEB DASHBOARD         |
        |      (Expo / React Native)   |      |        (React + Vite)        |
        |  voice capture, offline queue|      | analytics, credit, forecasts |
        |  daily brief, quick stats    |      | inventory, customers, reports|
        +--------------+---------------+      +---------------+--------------+
                       |   REST /api/v1, JWT Bearer           |
                       +------------------+-------------------+
                                          v
+-------------------------------- FASTAPI BACKEND --------------------------------+
|  routers (thin)  ->  services (logic)  ->  SQLAlchemy models                     |
|                                                                                   |
|  voice_service          llm_service           credit_risk_service                 |
|  STT, matching, TTS     Gemini > Groq >       demand_forecast_service             |
|  chain                  OpenRouter chain      daily_brief_service                 |
|                                               dashboard_service                   |
|  core/ml_manager: loads both .joblib pipelines once at startup                    |
+------------+---------------------------+-------------------------+---------------+
             |                           |                         |
             v                           v                         v
   +--------------------+     +--------------------+     +----------------------+
   |   External APIs    |     |    PostgreSQL      |     | ml/*/models/*.joblib |
   | ElevenLabs STT/TTS |     |  (Neon in cloud)   |     | credit_risk_pipeline |
   | Gemini, Groq,      |     |  ledger, customers,|     | forecasting_pipeline |
   | OpenRouter         |     |  credit, forecasts,|     +----------------------+
   | Edge-TTS, Sarvam,  |     |  daily briefs      |
   | gTTS               |     +--------------------+
   +--------------------+
```

### 6.1 Design principles

- **One API contract, two clients.** All routes live under `/api/v1`. Most are scoped to a shop: `/shops/{shop_id}/...`. Both clients unwrap the same response envelope.
- **Surface split.** Voice capture exists only on mobile. Detailed credit and forecast views (SHAP charts) exist only on web. Mobile shows simple summaries.
- **Provider fallback lives only in the backend.** Every LLM call goes through `llm_service.generate()`. Every speech synthesis goes through `voice_service.synthesize_speech()`. Clients never call AI providers directly, so API keys stay on the server.
- **No mock data.** Every number in either client comes from a backend endpoint. If there is no endpoint for something, the feature is left out.
- **Hand-mirrored types.** `web/src/types/` and `mobile/src/types/api.ts` copy the Pydantic models in `backend/app/schemas/`. A schema change means updating both.

### 6.2 Response envelope

Successful JSON responses:

```json
{ "success": true, "message": "Dashboard data fetched", "data": { } }
```

Errors (all `HTTPException`s, validation errors and unhandled exceptions go through global handlers in `app/main.py`):

```json
{ "success": false, "message": "Credit sales require a customer", "detail": "Credit sales require a customer" }
```

Validation errors (422) flatten Pydantic errors into `detail` as `"body -> field: message; ..."`.

Audio endpoints (`confirm-with-audio`, `brief/audio`, `tts`) return `audio/mpeg` bytes instead of JSON. `confirm-with-audio` carries extra data in headers:

| Header | Content |
| --- | --- |
| `X-Confirmation-Text` | URL-encoded Nepali confirmation text |
| `X-Processed-Count` | Number of line items saved |

CORS exposes these two headers so browsers can read them.

---

## 7. Technology stack

| Layer | Technology |
| --- | --- |
| Backend framework | FastAPI 0.139, Uvicorn 0.51, Starlette 1.3 |
| ORM and migrations | SQLAlchemy 2.0 (typed `Mapped[]` models), Alembic 1.18 |
| Database | PostgreSQL (Neon serverless in the cloud), driver `psycopg` 3 / `psycopg2-binary` |
| Settings | `pydantic-settings` (reads `backend/.env`) |
| Auth | JWT (`python-jose`, HS256), bcrypt via `passlib` |
| ML | scikit-learn 1.8, XGBoost 3.3, LightGBM 4.6, CatBoost 1.2, SHAP 0.52, pandas 3, NumPy 2.4, joblib |
| Audio processing | pydub + ffmpeg, noisereduce, NumPy |
| LLM SDKs | `google-genai` (Gemini), `groq`, `httpx` (OpenRouter) |
| Speech SDKs | `elevenlabs` (STT and TTS), `edge-tts`, `gTTS`, `httpx` (Sarvam) |
| Web | React 19, TypeScript 6, Vite 8 (React Compiler), Tailwind CSS 4, shadcn primitives on `radix-ui`, TanStack Query 5, React Router 7, React Hook Form + Zod 4, Recharts 3, axios, react-hot-toast, lucide-react |
| Mobile | Expo SDK 57, React Native 0.86, Expo Router (typed routes), TanStack Query 5, `expo-audio`, `expo-file-system`, `expo-secure-store`, `expo-haptics`, Reanimated 4, React Compiler |
| Infra | Docker (Python 3.14-slim for the API, Node 22 build + nginx for web), Docker Compose |

---

## 8. Backend

### 8.1 Layout

```
backend/
  app/
    main.py         app factory, CORS, exception handlers, router registration, lifespan
    api/            routers: auth, shops, categories, products, customers,
                    transactions, dashboard, credit_risk, demand_forecast, voice
    schemas/        Pydantic request and response models
    models/         SQLAlchemy models + enums
    services/       business logic, one module per domain
    core/           config, security (JWT, bcrypt), dependencies, ml_manager, clock
    db/             engine, session, pool warm-up
    alembic/        migrations
    seed.py               demo catalog (categories + products)
    seed_transactions.py  demo sales history with weekday and festival patterns
  ml/
    credit/         credit-risk training, inference, artifacts, model file
    demand/         demand-forecast training, inference, artifacts, model file
  tests/test_core.py
```

Rule: routers stay thin and only parse input and wrap output. Logic lives in `services/`.

### 8.2 Configuration

All settings come from `backend/.env` via `app/core/config.py`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SECRET_KEY` | yes | JWT signing key |
| `ALGORITHM` | no (`HS256`) | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no (`30`) | Token lifetime |
| `GEMINI_API_KEY` | for LLM | Primary LLM |
| `GROQ_API_KEY` | for LLM | First LLM fallback |
| `OPENROUTER_API_KEY` | for LLM | Second LLM fallback |
| `ELEVEN_LABS_API_KEY` | for STT | Speech-to-text, and one TTS fallback. Note the spelling: `ELEVEN_LABS`, not `ELEVENLABS`. |
| `SARVAM_API_KEY` | optional | One TTS fallback |

Edge-TTS and gTTS need no keys. A missing key does not crash the app. The affected provider fails at call time and the chain moves to the next one.

### 8.3 Startup

`lifespan()` in `app/main.py` runs once when the server starts:

1. Loads the credit-risk pipeline (`ml/credit/models/credit_risk_pipeline.joblib`).
2. Loads the demand pipeline (`ml/demand/models/forecasting_pipeline.joblib`).
3. Warms the DB pool by opening 4 connections in parallel, so the first requests do not pay the ~5 s connect cost of a serverless database.

Each step logs and continues on failure. If a model is missing, its endpoints return `503`. `GET /health` reports whether each model is loaded.

`ml_manager` temporarily puts the model's folder at the front of `sys.path` and clears cached `src.*` modules before each `joblib.load`. Both ML packages use a top-level package called `src`, so this stops the two from colliding during unpickling.

`db/database.py` forces IPv4-first DNS resolution (patches `socket.getaddrinfo`) to avoid slow IPv6 attempts on some networks. Pool settings: `pool_size=20`, `max_overflow=10`, `pool_pre_ping=True`, `pool_recycle=1800`.

### 8.4 Data model

```
users 1--* shops 1--* products *--1 categories (global)
                 1--* customers 1--* credit_predictions
                 1--* transactions 1--* transaction_items *--1 products
                                   1--0..1 credit_sales *--1 customers
                 1--* demand_forecasts *--0..1 products
                 1--* daily_briefs (unique per shop + date)
```

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `full_name`, `email` (unique), `password_hash`, `phone` | bcrypt hash |
| `shops` | `user_id`, `shop_name`, `address`, `location_type` | `location_type` in `urban`, `semi_urban`, `rural` |
| `categories` | `name` (unique), `description` | Global, not per shop |
| `products` | `shop_id`, `category_id`, `product_name`, `sku` (unique), `barcode`, `unit`, `stock_quantity`, `cost_price`, `selling_price`, `reorder_level`, `is_staple`, `is_perishable`, `is_active` | Soft delete via `is_active` |
| `customers` | `shop_id`, `full_name`, `phone`, `address`, `credit_limit`, `current_outstanding_balance`, `max_outstanding_ever`, `is_active` | Balances kept in sync by transaction logic |
| `transactions` | `shop_id`, `customer_id`, `transaction_type` (`sale`/`purchase`), `payment_type` (`cash`/`credit`/`qr`), `subtotal`, `discount`, `total_amount`, `notes`, `created_at` (timestamptz) | Indexed by shop + type, created_at, payment |
| `transaction_items` | `transaction_id`, `product_id`, `quantity`, `unit_price`, `subtotal` | Price is copied at sale time |
| `credit_sales` | `transaction_id` (unique), `customer_id`, `credit_amount`, `due_date`, `paid_at`, `status` (`paid`/`unpaid`/`overdue`), `remarks` | One per credit sale |
| `credit_predictions` | `customer_id`, `risk_probability`, `risk_level`, `recommended_credit_limit`, `model_version`, `generated_at` | History of every saved prediction |
| `demand_forecasts` | `shop_id`, `product_id`, `forecast_date`, `predicted_quantity`, `confidence_score`, `model_version`, `generated_at` | History of every product forecast |
| `daily_briefs` | `shop_id`, `brief_date`, `transcript`, `context` (JSONB) | Unique on (`shop_id`, `brief_date`) |

Migrations (`app/alembic/versions/`): initial schema, add `daily_briefs`, drop the old `daily_briefs.audio` column (audio is no longer stored).

### 8.5 Authentication and authorization

- `POST /auth/login` checks the bcrypt hash and returns `{ user, token: { access_token, token_type: "bearer" } }`.
- Tokens are HS256 JWTs with `sub` = user id and `exp` = now + `ACCESS_TOKEN_EXPIRE_MINUTES`.
- `get_current_user` (`core/dependencies.py`) decodes the token from the `Authorization: Bearer` header and loads the user. Any failure returns `401`.
- Shop ownership is checked in services through `shop_service.get_shop_by_id(db, user, shop_id)`. A user cannot read or write another user's shop. The test suite covers this.
- There is no refresh token. Clients send the user back to login on `401`.

### 8.6 Ledger rules (`transaction_service.create_transaction`)

This is the one function that writes transactions. Manual entry on web and voice confirmation on mobile both go through it.

1. The shop must belong to the user, and the transaction needs at least one item.
2. A credit sale needs a `customer_id` and a `due_date`.
3. Every product must belong to the shop.
4. A sale cannot take stock below zero. The error names the product and the available quantity.
5. Prices come from the server, never the client: `selling_price` for sales, `cost_price` for purchases.
6. Stock moves: a sale subtracts, a purchase adds.
7. For a credit sale, the customer row is locked with `SELECT ... FOR UPDATE`. If `outstanding + this sale > credit_limit`, the sale is rejected with the available amount. The lock stops two simultaneous credit sales from both passing the check.
8. A credit sale creates a `credit_sales` row and raises `current_outstanding_balance` (and `max_outstanding_ever` if exceeded).
9. An optional `created_at` (used by offline voice entries) is capped at "now", so a client can never date a sale in the future.
10. Everything commits in one transaction. If any check fails, nothing is written.

Marking a credit sale `paid` (`PATCH /transactions/credit-sales/{id}`) sets `paid_at` and lowers the customer's outstanding balance (never below 0). The `overdue` status is set manually. No scheduled job sets it yet. Credit-limit logic separately treats any unpaid sale past its due date as overdue.

### 8.7 Time zone

The shop's calendar day is Nepal time (UTC+05:45, no daylight saving). `core/clock.nepal_today()` is the only source of "today". Never use `date.today()` or UTC dates.

SQL aggregations that group by day shift timestamps with `created_at + interval '5 hours 45 minutes'` (`NEPAL_TIMESTAMP` in `dashboard_service`). Without this, sales made between 00:00 and 05:45 Nepal time would land on the previous day.

### 8.8 Dashboard (`dashboard_service.get_dashboard`)

One call returns everything the dashboard needs:

- **Summary:** total products, customers, sale count, revenue, profit (revenue minus `quantity × cost_price`), outstanding credit, low-stock count, and today's transactions, revenue and profit.
- **Revenue by payment type:** cash, credit, QR.
- **Top 5 products** by units sold, with revenue and profit.
- **Sales over time:** revenue and profit for each of the last 7 Nepal days, zero-filled.
- **Revenue by category,** including categories with products but no sales.
- **Inventory status:** in stock, low stock (`stock ≤ reorder_level` and > 0), out of stock.

The endpoint has no date-range parameters.

---

## 9. API reference

Base URL: `http://<host>:8000/api/v1`. Interactive docs: `/docs` (Swagger) and `/redoc`. All routes need `Authorization: Bearer <token>` unless marked public.

### 9.1 Auth

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register` (public) | `full_name`, `email`, `password`, `phone?` | `UserResponse` (201) |
| POST | `/auth/login` (public) | `email`, `password` | `{ user, token }` |
| GET | `/auth/me` | | `UserResponse` |
| POST | `/auth/logout` | | envelope only (stateless; client drops the token) |

### 9.2 Shops, categories, products, customers

| Method | Path | Notes |
| --- | --- | --- |
| POST, GET | `/shops/` | Create, list own shops |
| GET, PATCH, DELETE | `/shops/{shop_id}` | |
| POST, GET | `/categories/` | Global list |
| GET, PATCH, DELETE | `/categories/{category_id}` | |
| POST, GET | `/shops/{shop_id}/products/` | |
| GET | `/shops/{shop_id}/products/low-stock` | `stock_quantity ≤ reorder_level` |
| GET, PATCH, DELETE | `/shops/{shop_id}/products/{product_id}` | DELETE deactivates |
| POST | `/shops/{shop_id}/products/{product_id}/stock-in` | Manual stock adjustment |
| POST | `/shops/{shop_id}/products/{product_id}/stock-out` | Manual stock adjustment |
| POST, GET | `/shops/{shop_id}/customers/` | |
| GET, PATCH, DELETE | `/shops/{shop_id}/customers/{customer_id}` | DELETE deactivates |

### 9.3 Transactions and credit

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/shops/{shop_id}/transactions/` | Body: `transaction_type`, `payment_type`, `customer_id?`, `due_date?`, `discount`, `notes?`, `items[{product_id, quantity}]` |
| GET | `/shops/{shop_id}/transactions/` | Query: `page` (≥1), `limit` (1–100, default 20), `payment_type?`, `search?` (transaction id or customer name), `include_stats` (default true). Returns `{ items, total, page, limit, has_more, stats }` |
| GET | `/shops/{shop_id}/transactions/stats` | `today_sales`, `total_sales`, `credit_sales`, `pending_credit`, `total_count` |
| GET | `/shops/{shop_id}/transactions/{transaction_id}` | With items and credit sale |
| GET | `/shops/{shop_id}/transactions/credit-sales/` | Query: `status?` |
| PATCH | `/shops/{shop_id}/transactions/credit-sales/{credit_sale_id}` | `status?`, `remarks?`. Setting `paid` settles the balance. |

### 9.4 Dashboard and daily brief

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/shops/{shop_id}/dashboard` | `DashboardDetail` (see 8.8) |
| GET | `/shops/{shop_id}/dashboard/brief?brief_date=YYYY-MM-DD` | Defaults to today in Nepal. Returns context numbers, `transcript`, `ai_insight`, `audio_url`, `restock_suggestions`. |
| GET | `/shops/{shop_id}/dashboard/brief/audio?brief_date=...` | `audio/mpeg`. 404 if the brief was not fetched first. Synthesized on every call. |

### 9.5 Voice

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/shops/{shop_id}/voice/transcribe` | `multipart/form-data`, field `audio`. Returns `{ text }`. |
| POST | `/shops/{shop_id}/voice/extract-transactions` | `{ text }`. Returns `{ extracted, matched_items, matched_transactions }`. |
| POST | `/shops/{shop_id}/voice/confirm` | `VoiceConfirmRequest`. Returns `{ confirmation_text, processed[] }`. |
| POST | `/shops/{shop_id}/voice/confirm-with-audio` | Same body. Returns `audio/mpeg` plus headers. |
| POST | `/shops/{shop_id}/voice/tts` (public) | `{ text }`. Returns `audio/mpeg`. |

`VoiceConfirmRequest`:

```json
{
  "transactions": [
    {
      "action": "sale",
      "items": [{ "action": "sale", "product_id": "uuid", "quantity": 5, "product_name": "Sugar 1kg" }],
      "payment_type": "credit",
      "customer_id": "uuid",
      "due_date": "2026-10-19",
      "notes": null
    }
  ],
  "recorded_at": "2026-10-04T09:12:00+05:45"
}
```

A legacy flat form (`items`, `payment_type`, `customer_id`, `due_date`) is still accepted. It groups all sales into one transaction and each purchase into its own. `recorded_at` must include a timezone.

### 9.6 Credit risk (ML)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/shops/{shop_id}/customers/{customer_id}/credit-risk/predict?save=true` | Computes the 18 features from the DB, predicts, suggests a limit, and saves to `credit_predictions` if `save`. |
| POST | `/shops/{shop_id}/customers/{customer_id}/credit-risk/explain?top_k=5` | Same plus SHAP drivers. `top_k` 1–18. Not saved. |
| POST | `/shops/{shop_id}/customers/{customer_id}/credit-risk/apply-limit` | Recomputes the suggestion server-side and writes it to `customers.credit_limit`. Returns new, previous and reason. |
| POST | `/ml/credit-risk/predict` | Raw 18-feature input (for testing and integrations) |
| POST | `/ml/credit-risk/predict-probability` | Probability only |
| POST | `/ml/credit-risk/explain?top_k=5` | Raw input with SHAP |
| GET | `/ml/credit-risk/global-importance` | Mean absolute SHAP per feature |
| GET | `/ml/credit-risk/model-info` | Training metadata and metrics |

### 9.7 Demand forecasting (ML)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/shops/{shop_id}/demand/products/{product_id}/predict-next-day` | Body `{ last_date, sales_history?, transactions_history? }`. History is built from the DB if omitted. Saved to `demand_forecasts`. |
| POST | `/shops/{shop_id}/demand/products/{product_id}/predict-next-7-days` | Same. Saves 7 rows. |
| GET | `/shops/{shop_id}/demand/products/{product_id}/stock-summary?last_date=` | Current stock vs forecast: gaps, recommended restock, `status` (`restock`/`healthy`), summary sentence. |
| POST | `/ml/demand/predict-next-day`, `/predict-next-7-days` | Raw input: `shop_id`, `category`, `location_type`, `is_staple`, `is_perishable`, `last_date`, ≥21 days of `sales_history` and `transactions_history` |
| POST | `/ml/demand/explain-next-day`, `/explain-next-7-days` | Raw input with SHAP |
| GET | `/ml/demand/global-importance`, `/ml/demand/model-info` | |

### 9.8 Utility

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` (public) | `{ "message": "API is running" }` |
| GET | `/health` (public) | Status and whether each ML model is loaded |

---

## 10. AI and machine learning

KarobarAI uses AI in four places:

| Use | Type | Where |
| --- | --- | --- |
| Credit risk | Supervised classifier + SHAP | `ml/credit`, `credit_risk_service` |
| Demand forecast | Supervised regressor, recursive multi-step + SHAP | `ml/demand`, `demand_forecast_service` |
| Transaction extraction, confirmation wording, daily brief | LLM (Gemini > Groq > OpenRouter) | `llm_service`, `voice_service`, `daily_brief_service` |
| Speech | STT and TTS models from third parties | `voice_service` |

### 10.1 Training data

Both models are trained on **synthetic data**, generated by scripts in the repo. There is no public dataset of Nepali kirana credit or daily demand, so the generators encode domain knowledge directly.

**Credit data** (`ml/credit/scripts/generate_credit_data.py`): 55,000 rows from a 4-year simulation of 9,000 customers.

- Customers fall into shopping-frequency segments: daily (25%), weekly (45%), occasional (30%).
- Purchase amounts range from Rs. 20 to Rs. 4,000.
- The informal "expected" repayment window is 14 days. Credit is always repaid eventually (capped at 120 days).
- A customer is recorded only after 3 to 5 completed credit cycles, so features have history behind them.
- **Target `is_risk`:** the next credit is repaid more than 30 days late. Positive rate is about 13.9%.

**Demand data** (`ml/demand/scripts/generate_demand.py`): 146,176 daily rows from 2020-07-01 to 2026-10-01, per shop and category. Columns include location type, staple and perishable flags, weekday, month-end, signed days to Dashain and Tihar, festival windows, transaction count, units sold and revenue. Festival effects follow a ramp that builds 15 days before, peaks 2 days before, and decays over 4 days after. The real Dashain and Tihar dates for 2020–2026 are hard-coded.

`app/seed.py` and `app/seed_transactions.py` load a demo catalog and realistic sales history into a real shop, with category-specific weekday multipliers, festival lifts and month-end effects. This lets the live models and dashboard work on a fresh database.

### 10.2 Credit-risk model

**Features (18),** computed live from the ledger by `_compute_features_from_db()`:

| Group | Features |
| --- | --- |
| Repayment record | `pct_repaid_on_time`, `avg_days_to_repay`, `repayment_consistency` (std-dev of days to repay), `historical_repayment_ratio`, `num_completed_credit_cycles`, `num_severely_late_repayments` (> 30 days past due) |
| Current debt | `current_outstanding_balance`, `outstanding_to_avg_transaction_ratio`, `max_outstanding_ever` |
| Credit use (30 days) | `credit_purchase_value_last_30d`, `credit_transaction_count_last_30d`, `credit_to_purchase_ratio`, `avg_credit_transaction_amount` |
| Shopping activity | `relationship_days`, `transaction_count_last_30d`, `cash_purchase_value_last_30d`, `avg_purchase_amount`, `days_since_last_purchase` |

**Training pipeline** (`ml/credit/train.py`, `src/trainer.py`):

1. Load and validate the CSV. Check columns, types and class balance.
2. Stratified split: 70% train, 15% validation, 15% test. The test set is untouched until final reporting.
3. Fit the preprocessor on train only: deduplicate, validate ranges (non-negative counts, ratios in 0–1, integer counts), clip outliers.
4. Train every candidate model with two imbalance strategies (`baseline`, `class_weight`): Logistic Regression, Random Forest, Extra Trees, HistGradientBoosting, CatBoost, XGBoost, LightGBM, plus Balanced Random Forest when `imbalanced-learn` is installed.
5. For each candidate, search the F1-optimal decision threshold on validation (grid 0.05–0.95, step 0.01).
6. Rank candidates by ROC-AUC, then PR-AUC, then F1, then Brier score (lower is better), then MCC.
7. As a controlled experiment, try SMOTE and random oversampling on the winning family. Keep them only if they beat the winner.
8. Calibration: compare isotonic and sigmoid (Platt) on one half of the validation set, and search the threshold on the other half. Keep calibration only if it improves the Brier score.
9. Fit a SHAP explainer (background sample of 500) and compute global importance (sample of 1,000).
10. Save one `CreditRiskPredictor` object (preprocessor, model, threshold, SHAP explainer, metadata) to `models/credit_risk_pipeline.joblib`, and write artifacts (metrics, comparison table, confusion matrix, calibration curve, feature importance) to `artifacts/`.

**Selected model:** HistGradientBoosting with `class_weight`, no calibration, threshold 0.70, version 1.0.0.

| Metric (held-out test set) | Value |
| --- | --- |
| ROC-AUC | 0.826 |
| PR-AUC | 0.493 (base rate 0.139) |
| F1 | 0.495 |
| Precision | 0.480 |
| Recall | 0.510 |
| MCC | 0.411 |
| Brier score | 0.165 |

Rows: 38,500 train, 8,250 validation, 8,250 test. All 14 candidate runs scored ROC-AUC between 0.803 and 0.823 on validation, so the choice is stable.

**Top global drivers (mean |SHAP|):** `pct_repaid_on_time` (0.558), `outstanding_to_avg_transaction_ratio` (0.396), `avg_days_to_repay` (0.333), `credit_to_purchase_ratio` (0.145), `historical_repayment_ratio` (0.131). Past repayment behaviour and current debt relative to normal spending dominate, as a shopkeeper would expect.

**From probability to decision** (`credit_risk_service`):

- `is_risk` = probability ≥ model threshold (0.70).
- Risk level: `high` if `is_risk` or probability ≥ 0.65; `medium` if ≥ 0.35; otherwise `low`.
- **Suggested credit limit** = last-30-day total spend × factor (low 1.0, medium 0.6, high 0.3), rounded to Rs. 100, capped at Rs. 50,000.
  - It is based on behaviour, never on the current limit, so applying it twice gives the same number.
  - No spend in 30 days means no change is suggested.
  - A customer with overdue credit can never get an increase.
  - Every suggestion carries a plain-English `limit_reason`.
- Predictions are saved to `credit_predictions` (persist-history pattern).

**Explanations:** `explain` returns the base value, the top features pushing risk up and down, the full SHAP map, and a human-readable sentence. The web app groups the 18 features into 4 factor groups with plain labels (`web/src/lib/shapGroups.ts`) so owners see "Repayment record" instead of raw column names.

### 10.3 Demand-forecasting model

**Granularity:** one series per (shop, category). At inference, the product's own daily sales are fed in as the history, together with its shop's location type, category, and staple and perishable flags.

**Features** (`src/feature_engineering.py`), all leakage-free (built from shifted values only):

| Group | Features |
| --- | --- |
| Lags | units sold at t-1, 2, 3, 7, 14; transaction counts at the same lags |
| Rolling | mean and std of units over 3, 7, 14 days; 7-day mean of transactions |
| Trend | momentum (lag1 − lag7), growth rate (3-day vs 7-day mean), moving-average ratio, 7-day linear slope |
| Calendar | weekday, day of month, week of year, month, quarter, year, `is_weekend` (Saturday, the Nepali weekend), `is_month_end` (days 1–3 and 28–31, around payday) |
| Festivals | signed days to Dashain and Tihar, ramp values, festival windows, days to nearest festival, pre-festival peak (7 days before) |
| Entity | shop average, category average, shop × category average, shop vs category ratio (fitted on train only) |

**Training** (`ml/demand/train.py`):

1. Clean the data and encode categoricals.
2. Chronological split: the last 45 days are the final test set.
3. Fit entity statistics on train+validation only.
4. Grid-search XGBoost, LightGBM, CatBoost, Random Forest, Gradient Boosting and HistGradientBoosting with 3-fold `TimeSeriesSplit` CV.
5. Pick the best model by test RMSE. Save the `DemandForecaster` (model, preprocessor, feature engineer, SHAP explainer, metadata) to `models/forecasting_pipeline.joblib`.

**Selected model:** HistGradientBoosting.

| Metric (45-day test) | Value |
| --- | --- |
| RMSE | 4.14 units |
| MAE | 3.11 units |
| MAPE | 39.0% |
| R² | 0.742 |
| CV RMSE | 3.87 |

All six model families land within 0.04 RMSE of each other. MAPE is high because many daily values are small, where a 1-unit miss is a big percentage.

**Top global drivers:** `shop_category_avg_demand`, 7-day rolling mean, year, 14-day rolling mean, weekend, month-end, weekday, then festival features.

**Recursive forecasting** (`src/forecasting_engine.py`): to forecast 7 days, the model predicts day 1, writes that prediction back into the history as if it were real, rebuilds all features, and predicts day 2, and so on. Predictions are rounded and floored at 0. The transaction count for each forecast day is estimated from the recent transactions-per-unit ratio.

**Minimum history:** 21 days (largest lag 14 + 7). When the client sends no history, the service builds 21 zero-filled daily totals from the ledger, ending at `last_date` or the product's last sale date.

**Confidence:** the `confidence` field is the model's test R² clipped to 0–1 (currently 0.74). It is a global quality signal, not a per-prediction interval.

**Stock summary** (`get_stock_demand_summary`): runs the 7-day forecast and compares it with current stock.

- `recommended_restock = max(0, 7-day demand − stock)`
- `status = "restock"` when stock cannot cover 7 days or tomorrow, otherwise `"healthy"`
- One English summary sentence

### 10.4 LLM usage (`llm_service.generate`)

One function serves every LLM call:

```python
await llm_service.generate(prompt, json_schema=SomeModel, temperature=0.1, timeout=30)
```

| Order | Provider | Model | JSON mode |
| --- | --- | --- | --- |
| 1 | Google Gemini (`google-genai`) | `gemini-3.5-flash` | Native `response_schema` from the Pydantic model |
| 2 | Groq (`groq` SDK) | `openai/gpt-oss-120b` | `json_object` + schema in the prompt |
| 3 | OpenRouter (`httpx`) | `nvidia/nemotron-3-super-120b-a12b:free`, then `google/gemma-4-31b-it:free`, then `qwen/qwen3.8-27b:free` (routed server-side) | `json_object` + schema in the prompt |

A provider is skipped on an exception, a timeout (per provider), an empty response, or (in JSON mode) output that fails Pydantic validation. Short but valid output is not a failure. The serving provider is logged. If all three fail, the API returns `502` with every provider's error.

Where the LLM is used:

| Task | Temperature | Timeout | Output |
| --- | --- | --- | --- |
| Transaction extraction | 0.1 | 30 s | JSON validated against `ExtractResult` |
| Confirmation wording | 0.2 | 6 s per provider (user is waiting) | Nepali plain text; falls back to a fixed template on failure |
| Daily brief | 0.6 | 30 s | Nepali plain text, under 900 characters |

**Guardrails in the prompts:**

- The LLM never computes numbers. Python computes all totals, stock levels and forecasts. The LLM only phrases them.
- The extraction prompt forbids inferring credit status, due dates or customer names from speech. Payment is always returned as `cash`, and the shopkeeper sets credit explicitly on the review screen. A model guessing that a sale is credit could change someone's debt, so this decision stays with a human.
- Output for TTS must be plain Devanagari: no English, no Latin digits, no markdown, no emojis.

---

## 11. Voice pipeline (STT, LLM, TTS)

### 11.1 Recording (mobile)

`features/voice/use-voice-recorder.ts` records with `expo-audio`: AAC in `.m4a`, mono, 16 kHz, 64 kbps. The backend resamples to 16 kHz mono anyway, so this is about 4 times smaller than the high-quality preset with no loss in transcription quality. Recording is capped at 90 seconds. The app asks for microphone permission with the message "KarobarAI uses the microphone to record sales and purchases you speak."

### 11.2 Audio preprocessing (backend)

`preprocess_audio()` runs before STT:

1. Decode any format with pydub/ffmpeg.
2. Convert to mono, 16 kHz.
3. Normalize loudness.
4. Trim leading and trailing silence. Silence is anything 16 dB below the clip's average level for at least 300 ms. 150 ms of padding is kept on each side.
5. Denoise with `noisereduce` (non-stationary, 75% reduction) to handle shop noise.
6. Export WAV.

If any step fails, the original file is sent instead. Temp files are always deleted.

### 11.3 Speech-to-text

**ElevenLabs Scribe v2** (`model_id="scribe_v2"`, `language_code="ne"`, temperature 0, no diarization, no audio-event tags). The synchronous SDK call runs in a worker thread so it does not block other requests. The detected language and its probability are logged. STT has no fallback provider. ElevenLabs Scribe was the option that handled Nepali reliably in testing.

### 11.4 Extraction and matching

1. The transcript and the shop's catalog (up to 80 products with unit and stock) go to the LLM.
2. The prompt maps Nepali verbs to actions:
   - Sale: बेचियो, बिक्री, बेचे, दिएँ, लग्यो, बिक्री भयो
   - Purchase: किन्यो, किने, खरिद, थपियो, ल्याए
3. It converts number words to digits (एक=1 ... दस=10). One sentence can hold several transactions.
4. `match_product()` maps each spoken product name to the catalog:
   - Exact match wins.
   - Substring match scores 0.95.
   - Otherwise `difflib.SequenceMatcher` similarity.
   - Below 0.45 means no match.
5. `match_customer()` uses the same logic for customer names.
6. The response has the raw extraction plus `matched_items` and `matched_transactions`. Each line includes `product_id`, matched name, current stock and `match_confidence` (`high` or `none`).

### 11.5 Review (mobile)

`features/voice/draft.ts` turns the response into editable drafts:

- Unmatched items are excluded by default.
- Quantities are rounded to positive integers (the backend requires this).
- Credit sales must have a customer and a due date before submit.
- `buildConfirmPayload()` sends only included, matched items.

### 11.6 Confirmation

1. `confirm_voice_transactions()` writes each transaction through `create_transaction()`, so stock checks and credit limits apply exactly as for manual entry. Default notes are "Vyapar Voice sale" or "Vyapar Voice purchase".
2. A fixed Nepali template is built first, for example "Sugar 5 बिक्री भयो। भण्डारमा 55 बाँकी।".
3. `polish_confirmation()` asks the LLM to rewrite it as natural spoken Nepali:
   - Translate product names (Sugar → चिनी) and transliterate brands (Wai Wai → वाइवाइ).
   - Treat pack size as part of the product: "Sugar 1kg" × 5 is five 1 kg packets, not 15 kg.
   - Never change a number.
   - If the LLM fails or takes more than 6 s per provider, the template is kept.
4. `synthesize_speech()` turns the text into MP3.

### 11.7 Text-to-speech chain (`synthesize_speech`)

| Order | Provider | Voice / model | Notes |
| --- | --- | --- | --- |
| 1 | Microsoft Edge-TTS (`edge-tts`) | `ne-NP-SagarNeural`, rate −2%, pitch +5 Hz | Free, native Nepali voice. Uses an unofficial endpoint. |
| 2 | Sarvam AI (REST) | `bulbul:v3`, speaker `shubh`, language `hi-IN` | Auth header is `api-subscription-key`, not Bearer. Returns base64 audio. Max 2,500 characters. Reads Devanagari text with a Hindi voice. |
| 3 | ElevenLabs | `eleven_v4`, voice `kLhAstPcnnPxqzk6gS5i`, language `ne`, MP3 44.1 kHz 128 kbps | Paid, shares the STT key |
| 4 | Google gTTS | `lang="ne"` | Free, last resort |

Each provider gets 30 seconds. Empty audio counts as a failure. Every provider returns MP3, so responses are always `audio/mpeg`. The serving provider is logged. If all four fail, the API returns `502`.

### 11.8 Offline recordings

See [14.4](#144-offline-recordings).

---

## 12. Daily voice brief

`services/daily_brief_service.py`.

### 12.1 Context (computed in Python)

For the shop and date (Nepal time), `build_context()` computes `DailyBriefContext`:

- Total sales and total credit given today.
- The customer with the highest outstanding balance.
- Best-selling and least-selling product today.
- Low-stock product names.
- `restock_suggestions` for today's top 3 sellers: units sold today, current stock, tomorrow's forecast from the demand model, and `needs_restock` (forecast ≥ stock). A forecast failure for one product is logged and skipped.

### 12.2 Transcript (LLM)

The prompt (written in Nepali) asks for three parts:

1. A paragraph covering the numbers. Null or empty items are skipped.
2. Restock advice in plain words, without reading out raw forecast numbers.
3. One closing paragraph of 1 to 2 sentences with a practical insight that links the data points.

The output is Nepali only, conversational, plain text, under 900 characters. The last paragraph becomes `ai_insight`.

### 12.3 Caching

- The transcript and its context are saved in `daily_briefs`, one row per shop and date.
- On each request the context is recomputed. If it equals the saved context, the saved transcript is returned and the LLM is not called.
- If the day's data changed (new sale, stock change, credit change), the transcript is regenerated and the row updated.
- A unique constraint plus `IntegrityError` handling covers two requests racing to create the same brief.
- The DB connection is released (`db.commit()`) before the slow LLM and TTS calls, so idle pooled connections are not dropped by the serverless database.

### 12.4 Audio

`GET .../brief/audio` re-synthesizes the saved transcript on every call (about 10 s). Audio is not stored. Both clients show the text first and fetch audio only when needed (web: only when the user presses play).

---

## 13. Web dashboard

### 13.1 Structure

```
web/src/
  pages/        one component per route (lazy-loaded)
  routes/       router config
  layouts/      MainLayout (sidebar shell), AuthLayout, AuthShell
  components/   ui/ (shadcn primitives), charts/, dashboard/, inventory/
  services/     axios clients, one per backend domain
  hooks/        TanStack Query hooks (queries and mutations)
  lib/          api.ts, queryClient.ts, queryKeys.ts, shapGroups.ts, utils.ts
  providers/    AuthProvider
  types/        mirrors of backend schemas
  utils/        format.ts (NPR, dates), storage.ts (localStorage)
  constants/    routes and storage keys
```

Imports use the `@/` alias for `src`.

### 13.2 Pages

| Route | Page | What it shows |
| --- | --- | --- |
| `/login`, `/register` | Login, Register | Auth forms (React Hook Form + Zod) |
| `/shop-setup` | ShopSetup | Create the first shop |
| `/dashboard` | Dashboard | Today's revenue, profit and transactions; credit outstanding; low stock; 7-day sales and profit chart; revenue by payment; best sellers; inventory status; credit status; top credit customers; daily brief card with play button |
| `/inventory` | Inventory | Product table, stock value at cost, low and out-of-stock counts, create/edit/deactivate, stock in/out |
| `/categories` | Categories | Category CRUD |
| `/customers` | Customers | Customer records, credit limits, outstanding balances, totals |
| `/transactions` | Transactions | Infinite-scroll ledger with payment filter and search, new sale/purchase form (cash, QR, credit), transaction detail, credit sales tab with "mark paid" |
| `/credit-risk` | CreditRisk | Customer picker, risk probability and level, share of limit in use, suggested limit with reason and apply button, SHAP breakdown (grouped donut and driver bars), global importance, model info |
| `/demand-forecasting` | DemandForecast | Product picker, next-day forecast, stock summary, SHAP drivers, global importance, model info |
| `/reports` | Reports | Revenue, profit, order count, average order value, payment mix and category performance, all from dashboard data |
| `/notifications` | Notifications | Low-stock and unpaid/overdue credit alerts computed from live endpoints (there is no backend notification system) |
| `/settings` | Settings | Account details (read-only), edit shop profile, delete shop |

### 13.3 Data layer

- **axios instance** (`lib/api.ts`): base URL from `VITE_API_BASE_URL` (or `VITE_API_URL`), default `http://localhost:8000/api/v1`. A request interceptor adds the Bearer token. On a `401` outside login and register, the response interceptor clears the session and the query cache and redirects to `/login`.
- **Query keys** (`lib/queryKeys.ts`): one factory, hierarchical, scoped by shop (`['shops', shopId, 'products', 'list']`). Invalidating a parent refreshes all children.
- **Stale times:** live 30 s (dashboard, transactions, stock), normal 2 min (customers, credit sales), slow 30 min (categories, shop, model info). The daily brief uses `staleTime: Infinity`.
- **Retries:** none for 4xx errors, one retry otherwise.
- **Mutations:** one hook per action (`useCreateX`, `useUpdateX`, `useDeleteX`), each invalidating every affected query. A credit transaction, for example, refreshes transactions, credit sales, customers, credit risk, dashboard and products. Every mutation error appears as a toast through `MutationCache.onError`. Optimistic updates are used only for low-risk actions, never for transactions.
- **Storage** (`utils/storage.ts`): owns all localStorage keys (`karobar_access_token`, `karobar_user`, `karobar_shop`). It migrates the pre-rebrand `vyapar_*` keys once so old sessions keep working.

### 13.4 Design system

- Brand tokens in `src/index.css`: primary `#E3182D`, accent `#FF6B35`, background `#F4F6F9`, white surfaces, slate neutrals. Semantic colours: success emerald-600, warning amber-600, danger red-600.
- Shared components: `PageHeader`, `StatCard`, `StatusBadge`, `RelativeTime`, `ConfirmDialog`, loading skeletons, empty and error states.
- Money is shown in NPR with lakh grouping (`formatCurrency`). Money and quantity columns use tabular figures.
- Charts use Recharts only. The SHAP colour set was checked for colour-vision deficiency, and values are always shown as text.
- Responsive layout: collapsing sidebar, scrollable tables. Labelled inputs, `aria-label` on icon buttons, keyboard-accessible dialogs. Motion respects `prefers-reduced-motion`.

### 13.5 Build and serve

`npm run build` runs `tsc -b` and then `vite build`. The Docker image builds with Node 22 and serves `dist/` from nginx, with an SPA fallback (`try_files ... /index.html`) for React Router. `VITE_API_BASE_URL` is baked in at build time.

---

## 14. Mobile app

### 14.1 Structure

```
mobile/src/
  app/          Expo Router screens: index (home), login, register, shops,
                create-shop, voice, brief, offline
  api/          client.ts (fetch wrapper, auth, timeouts), endpoints.ts (one function per route)
  features/     voice/ (recorder, draft logic, offline store, review components), shops/
  components/   ui/ primitives, auth/, dashboard/
  providers/    session-provider (token, user and active shop in SecureStore)
  theme/        tokens.ts (colours, spacing, type)
  lib/          format.ts, validation.ts
  types/        api.ts (mirrors backend schemas)
```

App config (`app.json`): name KarobarAI, scheme `karobarai`, portrait, light mode, Android package `com.saurav777.mobile`. Typed routes and the React Compiler are enabled. Background recording and playback are off.

### 14.2 Screens

| Screen | Purpose |
| --- | --- |
| `login`, `register` | Auth |
| `shops`, `create-shop` | Pick or create the active shop |
| `index` (home) | Stat tiles from the dashboard endpoint, daily brief hero card, entry to voice and offline recordings |
| `voice` | The full voice flow as a state machine: `record → transcribing → transcript → extracting → review → confirming → done` |
| `brief` | Daily brief transcript, AI insight, audio player |
| `offline` | Offline recording queue: record without a network, list, process, delete |

### 14.3 Networking and session

- `api/client.ts` wraps `expo/fetch`. It adds the Bearer token, applies a 60 s timeout (120 s for the brief), and combines caller cancellation with the timeout. `AbortSignal.any` is not available on Hermes, so this is done by hand.
- Network failures become `ApiError` with status `0`. The voice screen uses this to switch to offline saving.
- On a `401` with a token present, an unauthorized handler signs the user out.
- `api<T>()` unwraps the `ApiResponse` envelope. For 422 errors, `errorMessage()` shows the backend's field-level `detail`.
- `EXPO_PUBLIC_API_URL` is the backend origin without `/api/v1`. `config/env.ts` appends `/api/v1` and throws at startup if the variable is missing. On a physical device it must be the computer's LAN IP, not `localhost`.
- `SessionProvider` keeps the token, user and active shop in `expo-secure-store` (keys `karobar.token`, `karobar.user`, `karobar.shop`). Sign-out clears the query cache and the secure store.
- Audio responses are written to cache files and played by `ConfirmationPlayer`, which both the voice and brief screens use.

### 14.4 Offline recordings

Many shops have unreliable connectivity. A sale should never be lost because the network dropped.

- Recordings are stored in `Paths.document/offline-voice/` as `<shopId>_<recordedAt>_<durationMs>.m4a`. The folder is the queue, listed oldest first and filtered by shop.
- A recording is saved there when `/voice/transcribe` fails with status 0 (unreachable or timed out), or when the user records directly on the offline screen.
- **Process** opens `voice?recording=<name>`, which runs the normal flow.
- On confirm the app sends `recorded_at`, so the transaction is dated to when it was spoken, not when it was uploaded. The backend caps it at "now".
- The file is deleted after a successful confirm.

---

## 15. Third-party services

| Service | Used for | Model / voice | Auth | Position in chain | Key variable |
| --- | --- | --- | --- | --- | --- |
| ElevenLabs Speech-to-Text | Nepali transcription | Scribe v2, `ne` | SDK API key | Only STT provider | `ELEVEN_LABS_API_KEY` |
| ElevenLabs Text-to-Speech | Spoken confirmations and brief | `eleven_v4`, `ne` | SDK API key | TTS #3 | `ELEVEN_LABS_API_KEY` |
| Microsoft Edge-TTS | Spoken confirmations and brief | `ne-NP-SagarNeural` | None (unofficial endpoint) | TTS #1 | none |
| Sarvam AI | Spoken confirmations and brief | `bulbul:v3`, speaker `shubh`, `hi-IN` | `api-subscription-key` header | TTS #2 | `SARVAM_API_KEY` |
| Google gTTS | Spoken confirmations and brief | `ne` | None | TTS #4 | none |
| Google Gemini | Extraction, confirmation wording, daily brief | `gemini-3.5-flash` | API key | LLM #1 | `GEMINI_API_KEY` |
| Groq | Same | `openai/gpt-oss-120b` | API key | LLM #2 | `GROQ_API_KEY` |
| OpenRouter | Same | Nemotron 3 Super 120B, Gemma 4 31B, Qwen 3.8 27B (free tier) | Bearer | LLM #3 | `OPENROUTER_API_KEY` |
| Neon | Managed serverless PostgreSQL | | Connection string | | `DATABASE_URL` |

Implementation notes:

- Provider clients are lazy singletons (`_get_ai_client()`, `_get_groq_client()`, `_get_openrouter_client()`, `_get_stt_client()`, `_get_sarvam_client()`). They are created on first use, so a missing key only affects calls to that provider. New providers should follow the same pattern.
- Fallback happens only on real failures: exception, timeout, rate limit, 5xx, empty output, invalid JSON.
- Free OpenRouter models often return `429`. Sending three models in the `models` array lets OpenRouter route around them on its side.
- Edge-TTS uses an unofficial Microsoft endpoint with no SLA. It is first because it has the best native Nepali voice at no cost, and the chain covers it if it breaks.
- Data sent to third parties: audio and transcripts go to ElevenLabs; transcripts, product names and stock counts go to the LLM providers; confirmation and brief text (product names, amounts, a customer name) go to the TTS providers. Passwords and tokens never leave the backend.

---

## 16. Libraries

### 16.1 Backend (Python)

| Library | Role |
| --- | --- |
| `fastapi`, `uvicorn`, `starlette`, `python-multipart` | HTTP API, ASGI server, multipart uploads |
| `sqlalchemy`, `alembic`, `psycopg`, `psycopg2-binary` | ORM, migrations, PostgreSQL drivers |
| `pydantic`, `pydantic-settings`, `email-validator` | Schemas, settings, email validation |
| `python-jose`, `passlib`, `bcrypt` | JWT, password hashing |
| `scikit-learn`, `xgboost`, `lightgbm`, `catboost` | Model training and inference |
| `shap` | Explanations |
| `pandas`, `numpy`, `scipy`, `joblib` | Data handling, model serialization |
| `pydub`, `noisereduce`, `ffmpeg` (system) | Audio decoding, cleanup, denoise |
| `google-genai`, `groq`, `httpx` | LLM providers |
| `elevenlabs`, `edge-tts`, `gTTS` | Speech providers |
| `matplotlib`, `plotly` | Training-time plots and EDA |

### 16.2 Web (npm)

`react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `axios`, `react-hook-form`, `@hookform/resolvers`, `zod`, `recharts`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `react-hot-toast`. Dev: `vite`, `@vitejs/plugin-react`, `babel-plugin-react-compiler`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `eslint` with React Hooks and React Refresh plugins.

### 16.3 Mobile (npm)

`expo`, `expo-router`, `react-native`, `@tanstack/react-query`, `expo-audio`, `expo-file-system`, `expo-secure-store`, `expo-haptics`, `expo-image`, `expo-splash-screen`, `expo-symbols`, `@expo/ui`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`. Dev: `typescript`, `eslint-config-expo`.

---

## 17. Setup and deployment

### 17.1 Prerequisites

- Python 3.13+ (the Docker image uses 3.14)
- Node.js 18+ (the Docker build uses 22)
- PostgreSQL, local or Neon
- ffmpeg on the PATH for audio decoding
- API keys for the providers you want to use (see 8.2)

### 17.2 Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # then fill in DATABASE_URL, SECRET_KEY, API keys
alembic upgrade head
uvicorn app.main:app --reload     # add --host 0.0.0.0 so a phone on the LAN can reach it
```

Optional demo data:

```bash
python -m app.seed                # demo categories and products
python -m app.seed_transactions   # demo sales history (--email, --shop-id, --days N, --end-date, --reset)
```

### 17.3 Web

```bash
cd web
npm install
# .env: VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

### 17.4 Mobile

```bash
cd mobile
npm install
cp .env.example .env.local        # EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000
npx expo start
```

### 17.5 Docker Compose

```bash
docker compose up --build
docker compose exec backend alembic upgrade head
```

| Service | Port | Image |
| --- | --- | --- |
| `backend` | 8000 | `python:3.14-slim` + ffmpeg + libgomp1, reads `backend/.env` |
| `web` | 3000 → 80 | Node 22 build, served by `nginx:alpine` |

Set `VITE_API_BASE_URL` in the environment before building if the API is not at `http://localhost:8000/api/v1`. The database is external (Neon or your own PostgreSQL). Compose does not start one.

### 17.6 Retraining the models

```bash
cd backend/ml/credit && python scripts/generate_credit_data.py && python train.py
cd backend/ml/demand && python scripts/generate_demand.py && python train.py
```

Each run writes a new `.joblib` to `models/` and refreshes `artifacts/`. Restart the API to load it. Only `ml/*/models/*.joblib` is needed at runtime.

---

## 18. Testing and quality

| App | Check |
| --- | --- |
| Backend | `python -m unittest discover -s tests` (from `backend/`). Five DB-backed tests on in-memory SQLite: duplicate email and login; cash sale and purchase update stock; insufficient stock is rejected with no side effects; credit limit enforcement and repayment; another user cannot touch a shop. Also import-check touched modules with the venv Python. |
| Web | `npm run build` (type check + build) and `npm run lint` |
| Mobile | `npx tsc --noEmit` and `npx expo lint` |
| ML | Held-out test metrics in `ml/*/artifacts/metrics.json`; model comparison, validation results and SHAP tables in the same folder |

There are no end-to-end or UI tests yet.

---

## 19. Security and privacy

What is in place:

- Passwords are bcrypt-hashed. JWTs are signed with `SECRET_KEY` and expire after 30 minutes by default.
- Every shop-scoped route checks that the shop belongs to the user.
- Prices are always taken from the server, never the client.
- Credit-limit checks run under a row lock.
- Client-supplied timestamps cannot be in the future.
- All AI provider keys stay on the server.
- The mobile app stores tokens in the OS secure store.

Gaps to close before production:

- **CORS** allows `*` together with `allow_credentials=True`. Restrict origins to the deployed web domain.
- **`POST /voice/tts`** has no authentication. Anyone who can reach the API can use it to spend TTS quota. Add `get_current_user`.
- **Categories** are global, and any logged-in user can create, rename or delete them. Scope them to shops or restrict writes.
- **Error responses** for unhandled exceptions include `str(exc)` in `detail`. That can leak internals. Return a generic message in production.
- **Tokens:** no refresh tokens and no revocation. Web stores the token in localStorage.
- **Third-party data:** customer names and amounts go to external LLM and TTS providers (see section 15). This needs a privacy notice and a data processing review.
- Encryption at rest, access control and data retention have not been formally audited.

---

## 20. Known limitations and roadmap

### 20.1 Limitations

- **Synthetic training data.** Neither model has been validated on real shop data yet. Real-world accuracy is unknown until the retraining pipeline runs on real transactions.
- **Cold start.** A new customer has no repayment history, so features are mostly zero and scores carry little information. A new product needs 21 days of history for a meaningful forecast.
- **Pooled models.** One model for all shops, with shop-level features, not one model per shop.
- **Nepali STT accuracy** has not been benchmarked formally against dialects, Nepali-English code-switching or noisy shops.
- **Sarvam TTS** uses a Hindi voice (`hi-IN`) to read Nepali text, so pronunciation may be off when it serves a request.
- **Demand history day boundary.** The demand service groups a product's sales by the UTC date of `created_at`, while the dashboard and brief use Nepal dates. Sales between 00:00 and 05:45 Nepal time count toward the previous day in forecasts.
- **Forecast confidence** is the model's global R², not a per-prediction interval.
- **External dependency.** The app needs internet access and third-party APIs. Offline mode only queues recordings. It does not process them on the device.
- **Scores are informational only.** There is no bank or micro-lending integration.

### 20.2 Backend gaps (documented, not built)

- No date-range parameters on the dashboard.
- No routes that read saved credit predictions or demand forecasts back (history is written but not exposed).
- No credit report export.
- No customer filter on `GET /transactions/`.
- No notification system (push, SMS repayment alerts).
- No scheduled jobs. A nightly refresh would call `credit_risk_service.predict_for_customer(..., save_result=True)` for each active customer and mark overdue credit sales.

### 20.3 Roadmap

1. **ETL and retraining pipeline:** extract real transactions from the ledger, clean them, append to the training data, retrain both models on a schedule, evaluate against the current model, and deploy only if better.
2. Scheduled jobs: nightly credit refresh, automatic overdue marking.
3. Push and SMS notifications for restock and overdue credit (Pro tier).
4. Mobile: credit-score badge per customer, quick inventory and khata lookup.
5. History endpoints for predictions and forecasts, and trend views on web.
6. Distributor features (Enterprise Hub): demand heatmaps, margin analytics, credit-risk checks.
7. Security hardening from section 19.

---

## 21. Glossary

| Term | Meaning |
| --- | --- |
| Kirana | Small neighbourhood grocery or general store |
| Bahi khata | Traditional paper ledger book |
| Udharo (उधारो) | Informal store credit given to customers |
| Khata | Customer's running credit account |
| Dashain, Tihar | Nepal's two biggest festivals (Sep–Nov). They drive large demand spikes. |
| NPR / Rs. | Nepalese rupee |
| STT / TTS | Speech-to-text / text-to-speech |
| LLM | Large language model |
| SHAP | SHapley Additive exPlanations, a method that splits a prediction into per-feature contributions |
| ROC-AUC, PR-AUC | Ranking quality of a classifier overall, and on the positive (risky) class |
| MCC | Matthews correlation coefficient, a balanced metric for imbalanced classes |
| Brier score | Mean squared error of predicted probabilities (lower is better) |
| RMSE, MAE, MAPE, R² | Regression error metrics |
| Recursive forecasting | Multi-day forecasting where each day's prediction becomes input for the next |
| Vyapar | Earlier project name. It survives in some legacy keys, tags and notes. |

---

## 22. Sources

- Nepal Rastra Bank: SME Financial Integration Survey and Policy Guidelines
- UNCDF: Digitizing MSMEs: Traditional Kirana Outlets in Nepal
- National Statistics Office: National Economic Census and Enterprise Datasets
- Samriddhi Foundation: Informal Retail Market Regulations and Trade Friction

---

*Team DeepStack: Saurav Pant, Swastika Dhakal. Built for MBMC IdeaX 2026.*

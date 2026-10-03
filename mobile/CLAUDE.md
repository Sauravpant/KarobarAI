@AGENTS.md

# KarobarAI Mobile

Expo (React Native) app for KarobarAI, a voice-first AI copilot for Nepal's kirana shops. Mobile owns voice capture: a shopkeeper speaks a sale, reviews the extracted transactions, confirms them, and hears a spoken confirmation. The web dashboard (`../web`) is the desk-based analytics surface.

## Stack

Expo SDK 57, React Native 0.86, Expo Router, TanStack Query 5, `expo-audio`, `expo-file-system`, `expo-secure-store`. Backend: FastAPI in `../backend`, all routes under `/api/v1`.

## Environment

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL` to the backend origin, without `/api/v1`. On a physical device, use the machine's LAN IP, not `localhost`. `src/config/env.ts` throws at startup when the variable is missing.

## Structure

```
src/
  app/          Expo Router screens: index (home), login, register, shops,
                create-shop, voice, brief
  api/          client.ts (fetch wrapper + auth), endpoints.ts (one function per route)
  features/     voice/ (recorder, draft state, review components), shops/
  components/   ui/ primitives, auth/, dashboard/
  providers/    session-provider (token and shop in SecureStore)
  theme/        tokens.ts (colors, spacing, type)
  lib/          format.ts, validation.ts
  types/        api.ts, mirrors backend schemas
```

## Voice flow

1. Record locally with `expo-audio`. Use mono 16 kHz AAC (`.m4a`).
2. Upload one `multipart/form-data` request to `/voice/transcribe` (field `audio`). No streaming or chunked upload.
3. `/voice/extract-transactions`: the user reviews and edits the drafts.
4. `/voice/confirm` or `/voice/confirm-with-audio`. Save the confirmation audio to a cache file and play it with `ConfirmationPlayer`.

Use the existing backend endpoints and response shapes. Do not design a new API surface.

## Offline recordings

`features/voice/offline-store.ts` keeps recordings in `Paths.document/offline-voice/`, named `<shopId>_<recordedAt>_<durationMs>.m4a` (the folder is the queue, listed oldest first). Audio is saved there when `/voice/transcribe` fails with a network error (status 0), or recorded directly on `src/app/offline.tsx`. "Process" opens `voice?recording=<uri>&recordedAt=<ms>`, which runs the normal flow, sends `recorded_at` on confirm so the sale is dated to when it was spoken, then deletes the file.

## Daily brief

`src/app/brief.tsx` (plus a hero card on home) calls `GET /shops/{shop_id}/dashboard/brief`. It shows the transcript and the AI insight line, and reuses `ConfirmationPlayer` for audio from `.../brief/audio`. Audio is synthesized on every call (about 10 s), so render the text first and load the audio after.

## Rules

- Read the backend router and schemas before adding or changing an API call. Match routes and field names exactly.
- No mock data. Every screen reads from the backend and handles loading, empty, and error states (`StateView`).
- Use theme tokens from `src/theme/tokens.ts`, not hardcoded colors.
- Credit and forecast detail (SHAP breakdowns, charts, PDF export) stays on web. Mobile shows only simple summaries.

## Open items

- Confirm that `.m4a` uploads work with the backend's `pydub` preprocessing and ElevenLabs STT. If not, record `.wav` or `.mp3` instead. The endpoint does not change.
- Simple credit-score badge (low/medium/high) from the per-customer credit-risk endpoint.
- Quick inventory and customer (khata) lookup.
- Push notifications (restock, overdue credit). Blocked: the backend has no notification system.

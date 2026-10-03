# CLAUDE.md

Guidance for working in `web/`, the KarobarAI web dashboard. KarobarAI is a voice-first AI copilot for Nepal's kirana shops. The web app is the detailed-insights surface: dashboard, inventory, customers, credit risk, demand forecasting, transactions, and reports. Voice capture and transcription live only in the mobile app (`../mobile`).

## Stack

React 19, TypeScript, Vite 8 (React Compiler enabled), Tailwind 4, shadcn primitives on `radix-ui`, TanStack Query 5, React Hook Form + Zod, React Router 7, Recharts, axios.

Backend: FastAPI + PostgreSQL in `../backend`, all routes under `/api/v1`.

## Commands

```bash
npm run dev      # dev server
npm run build    # typecheck (tsc -b) + production build
npm run lint     # eslint
npm run preview  # serve the production build
```

Run `npm run build` and `npm run lint` before calling a task done.

## Environment

- `VITE_API_BASE_URL` (or `VITE_API_URL`): backend base URL including `/api/v1`. Defaults to `http://localhost:8000/api/v1`.
- Do not rename env vars or break existing `.env` files.

## Structure

```
src/
  pages/        one component per route
  routes/       router config; every page is lazy-loaded
  layouts/      MainLayout (app shell), AuthLayout, AuthShell
  components/   ui/ (shadcn primitives), charts/, dashboard/, inventory/
  services/     axios clients, one per backend domain
  hooks/        TanStack Query hooks (queries and mutations)
  lib/          api.ts (axios instance), queryClient.ts, queryKeys.ts, utils.ts
  providers/    AuthProvider
  types/        types mirroring backend schemas
  utils/        format.ts (NPR, dates), storage.ts (localStorage)
  constants/    route paths
```

Import from `src` with the `@/` alias.

## Rules

- **No mock data.** No hardcoded arrays, fake KPIs, placeholder charts, or faked responses. Every number, list, and chart comes from a backend API. If a feature has no endpoint, leave it out.
- **Read the backend first.** Before touching a page, read its router in `backend/app/api/` and its Pydantic models in `backend/app/schemas/`. Match routes, params, and response shapes exactly. Do not guess endpoints or field names.
- Every data view needs loading, empty, and error states. Use skeletons for page loads.

## Conventions

- **Services:** one client per domain in `src/services/`, matching backend routes 1:1. Types in `src/types/` are derived from the Pydantic models.
- **Data fetching:** pages use hooks from `src/hooks/`, never axios directly.
- **Query keys:** always from `src/lib/queryKeys.ts`, never inline arrays. Keys are hierarchical and scoped by shop id (for example `['shops', shopId, 'products', filters]`), so invalidating a parent refreshes its children.
- **Mutations:** each mutation is a hook (`useCreateX`, `useUpdateX`, `useDeleteX`) that invalidates every affected query. A mutation that leaves related data stale is a bug. Examples:
  - Credit transaction: transactions, credit sales, customers, credit risk, dashboard, products.
  - Stock in/out: products, low-stock list, dashboard, demand stock summary.
  - Logout or shop switch: clear the query cache.
- **Optimistic updates** only for low-risk actions (deletes, toggles, stock adjustments). Never for transactions or server-computed values.
- **Daily brief:** the backend stores one brief per shop and date. Fetch it once (`staleTime: Infinity`) and fetch audio only when the user presses Play, because audio generation runs TTS on every call.
- **Errors:** 401 handling lives in `lib/api.ts` (clear cache, redirect to login). Mutation errors surface as toasts through `MutationCache.onError` in `lib/queryClient.ts`.
- **Forms:** React Hook Form + Zod, with validation matching backend constraints.
- **UI:** reuse primitives in `src/components/ui/` before adding new ones. Recharts is the only charting library. Do not add dependencies for what a few lines can do.
- **Storage:** `utils/storage.ts` owns all localStorage keys (`karobar_*`). It also migrates the legacy `vyapar_*` keys so old sessions keep working. Keep that migration map.

## Design

Brand colors are tokens in `src/index.css`. Do not add brand colors or change the hues.

- Primary `#E3182D` (`brand`), accent `#FF6B35` (`brand-accent`), background `#F4F6F9`, white surfaces, Tailwind slate neutrals.
- Semantic colors: success emerald-600, warning amber-600, danger red-600.
- Use tokens, not hardcoded hex values. Use shared `PageHeader`, `StatCard`, `StatusBadge`, and `RelativeTime` components. Add the `tabular` utility to money and quantity columns.
- Format money in NPR with lakh grouping (`formatCurrency`).
- Use subtle motion only, and respect `prefers-reduced-motion`.
- Pages must be responsive: the sidebar collapses, and tables scroll or hide low-priority columns on small screens.
- Accessibility: every input has a label, icon buttons have `aria-label`, and dialogs and menus work with the keyboard.

## Known backend gaps

Do not build UI for these until the backend adds them:

- The dashboard endpoint takes no date-range params.
- No route reads persisted credit predictions or demand forecasts back.
- No credit report export route. `GET /transactions/` has no customer filter.

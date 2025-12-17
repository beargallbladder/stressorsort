## Dealer Lead Stressor Enrichment - V1

Monorepo:
- `backend/` Node/TypeScript API + worker (Render)
- `frontend/` Next.js (Vercel)
- `config/score_weights.json` scoring config (file-versioned)

### Backend (Render)
- API routes:
  - POST `/api/leads/ingest` (batch insert, enqueue enrichment)
  - GET `/api/dealers/:dealerId/leads?sort=priority`
  - GET `/api/leads/:leadId/explain`
  - POST `/api/events`
- Auth: `X-API-Key` header (set `API_KEY` env)
- DB: Render Postgres (`DATABASE_URL`)
- Worker: long-running loop that enriches leads and writes `feature_vectors` + `lead_scores`

Env vars:
- `DATABASE_URL` (postgres connection)
- `API_KEY` (shared API key)
- `NOAA_TOKEN` (optional for NOAA CDO)
- `LOG_LEVEL` (default `info`)
- `RATE_LIMIT_PER_MIN` (default `120`)
- `NWS_USER_AGENT` (e.g., `stressorsort (ops@yourdomain.com)`)
- `NWS_RPS` (requests/sec cap per host, default `4`)
- `SCORING_MODE` (`lookup` | `compute`, default `lookup`)
- `TENSOR_VERSION` (e.g., `v1.0.0`)
- `RECALLS_MODE` (`disabled` | `nhtsa` | `external`, default `disabled`)

Local dev:
```bash
cd backend
npm install
npm run migrate
npm run dev   # API on :3001
# in another terminal
npm run worker:dev
```

Offline precompute (tensor):
```bash
# Populate vehicle_classes from decoded facts
npm run offline:classes
# Create full scenario grid from config/scenario_bins.json
npm run offline:scenarios
# Precompute vehicle_scenario_scores with deterministic rules
npm run offline:tensor
```

### Frontend (Vercel)
- Pages:
  - `/dealer/[dealerId]` table of sorted leads
  - `/lead/[leadId]` explain view (features + inputs audit)
- Server-side fetch with env:
  - `API_BASE_URL` (Render API URL)
  - `API_KEY` (same as backend)

Local dev:
```bash
cd frontend
npm install
API_BASE_URL=http://localhost:3001 API_KEY=dev-local-key npm run dev
```

### Security/Compliance
- VIN is never logged (redacted logger) and masked in UI.
- `vin_hash` (SHA-256) is stored in facts/recalls/vectors to reduce VIN sprawl.
- Public enrichment sources only.
- Feature vector includes inputs with `feature_vector_id` for auditability.

### Deploy
- Render: create Web Service (API) and Background Worker (Worker). Provide env vars above. Point start commands to `npm run start` (web) and `npm run worker:start` (worker) after `npm run build`.
- Vercel: set `API_BASE_URL` to Render API base, set `API_KEY` as an encrypted env.



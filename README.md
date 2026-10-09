# The Internet Goes Down — Network Router

A foundational network resilience simulation with a React dashboard, NestJS monitoring API, and five reusable FastAPI host agents. This milestone monitors host health only; routing, topology, traffic, and failure-recovery algorithms are intentionally reserved for the next milestone.

## Prerequisites

- Node.js 24+
- npm 11+
- Docker Desktop (for the complete seven-service demo)

## Local development

```bash
npm install
npm run dev
```

The API runs at `http://localhost:3001` and the Vite dashboard at `http://localhost:5173`. For local API development without Docker, set `HOST_1_URL` through `HOST_5_URL` in `apps/api/.env` to point at running host agents.

## Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:8080`. Nginx serves the frontend and proxies `/api` to the internal API service. Host agents are private to the Compose network; only the web (`8080`) and API (`3001`) ports are published.

Stop the stack with `docker compose down`.

## API

- `GET /api/health` — API health
- `GET /api/hosts` — all configured hosts and live health
- `GET /api/hosts/:id` — one host by ID, or `404` when unknown

Each host agent also exposes `/health` and `/info` inside the Compose network.
# CampusResQ

# Running PulseBoard Locally

## Prerequisites
- Docker Desktop (for PostgreSQL + Redis)
- Node.js 22 LTS
- pnpm 9+

## 1. Start infrastructure

```bash
cd dashboard_product/pulseboard
docker compose -f docker-compose.dev.yml up -d
```

Waits for healthchecks on both postgres and redis before returning.

## 2. Install dependencies

```bash
pnpm install
```

## 3. Configure environment

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` — at minimum set:
```
DATABASE_URL=postgres://pulseboard:pulseboard@localhost:5432/pulseboard
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=<any 32+ char string for dev>
JWT_REFRESH_SECRET=<different 32+ char string>
ENCRYPTION_KEY=<64 hex chars — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

## 4. Run migrations

```bash
pnpm --filter api db:migrate
```

## 5. Run seed data (segment templates)

```bash
pnpm --filter api db:seed
```

## 6. Start the API

```bash
pnpm --filter api dev
```

API is now at `http://localhost:3001`. Confirm with:
```bash
curl http://localhost:3001/health
# → {"ok":true}
```

## 7. Smoke test: register + login

```bash
# Register (creates user + org in one call)
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123","organizationName":"Acme","organizationSlug":"acme"}' | jq .

# Login
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq .
```

Save the `accessToken` from the login response, then:

```bash
TOKEN=<paste accessToken here>
curl -s http://localhost:3001/api/v1/orgs/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## 8. Start the frontend

In a second terminal:
```bash
pnpm --filter web dev
```

Open `http://localhost:5173`. Register and log in — you should reach the dashboard.

## 9. Start the worker (optional — needed for sync)

```bash
pnpm --filter api dev:worker
```

## Teardown

```bash
docker compose -f docker-compose.dev.yml down -v
```

`-v` removes the postgres and redis volumes (wipes data). Omit it to keep data between restarts.

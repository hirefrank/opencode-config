---
name: unified-worker
description: Pattern for consolidating multiple micro-workers (API, SSR, Webhooks) into a single Cloudflare Worker using TanStack Start.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
---

# Unified Worker Consolidation

Consolidate multiple specialized workers into a single deployment target to minimize cold start overhead and simplify architectural complexity.

## The Pattern

Instead of separate workers for `api`, `frontend`, and `webhooks`, use a single TanStack Start application that handles all entry points.

### 1. Wrangler Configuration

Configure a single `wrangler.toml` at the app root that includes all necessary bindings (D1, R2, KV, Queues) previously spread across workers.

```toml
name = "unified-app"
main = "@tanstack/react-start/server-entry"
compatibility_date = "2025-08-15"

[[d1_databases]]
binding = "DATABASE"
database_name = "app-db"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "app-assets"

[[queues.producers]]
binding = "ProcessingQueue"
queue = "app-queue"
```

### 2. Route-based API Separation

Use TanStack Start's file-based routing to define your API and Webhook endpoints alongside your UI routes.

- `src/routes/api.images.ts` -> `/api/images`
- `src/routes/api.webhooks.stripe.ts` -> `/api/webhooks/stripe`
- `src/routes/dashboard.tsx` -> `/dashboard`

## Why it's Better

1. **Reduced Cold Starts**: A single "hot" worker handles all traffic. A request to a webhook keeps the worker warm for a subsequent UI request.
2. **Simplified Environment**: Secrets and bindings are managed in one place rather than being duplicated across 5+ workers.
3. **Atomic Deployments**: API and Frontend changes are deployed together, eliminating version mismatch issues between workers.
4. **Shared Logic**: Native access to shared utilities and types without complex monorepo linking.

## Constraints

- **Execution Limits**: Ensure the consolidated worker stays within Cloudflare's 1MB (compressed) limit and 50ms CPU time (for standard plan).
- **Isolation**: If a specific task (like heavy image processing) requires significantly different resources or long execution times, keep it as a separate Worker triggered via Queues.

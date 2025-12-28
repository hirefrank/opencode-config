---
name: cloudflare-workers
description: Develop, deploy, and optimize Cloudflare Workers applications. Use for edge-first architecture, serverless functions, and Workers runtime patterns.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires wrangler CLI, Cloudflare account
allowed-tools: Bash(wrangler:*) Read Write
triggers:
  - "worker"
  - "workers"
  - "cloudflare"
  - "edge"
  - "serverless"
  - "kv"
  - "r2"
  - "d1"
  - "binding"
  - "wrangler"
  - "deploy"
  - "fetch handler"
  - "env"
  - "environment"
---

# Cloudflare Workers Development

## Quick Start

1. Create worker: `wrangler init my-worker`
2. Write handler in `src/index.ts`
3. Deploy: `wrangler deploy`

## Core Principles

### 1. Workers Are Stateless

All state must be in bindings (KV, R2, D1, Durable Objects). Never use in-memory state.

```typescript
// ❌ WRONG: In-memory state
let cache = new Map();

// ✅ CORRECT: State in bindings
export default {
  async fetch(request: Request, env: Env) {
    const value = await env.KV.get("key");
  },
};
```

### 2. Use env Parameter

Access all environment variables and secrets via the `env` parameter.

```typescript
// ❌ WRONG: process.env doesn't exist
const apiKey = process.env.API_KEY;

// ✅ CORRECT: Use env parameter
export default {
  async fetch(request: Request, env: Env) {
    const apiKey = env.API_KEY;
  },
};
```

### 3. Web APIs Only

No Node.js APIs (fs, path, process, buffer).

```typescript
// ❌ WRONG: Node.js APIs
import fs from "fs";
import { Buffer } from "buffer";

// ✅ CORRECT: Web APIs
const encoder = new TextEncoder();
const hash = await crypto.subtle.digest("SHA-256", data);
```

## Resource Selection Guide

| Use Case         | Resource        | Reason                            |
| ---------------- | --------------- | --------------------------------- |
| Read-heavy cache | KV              | Eventually consistent, fast reads |
| User sessions    | KV              | Simple key-value, TTL support     |
| Rate limiting    | Durable Objects | Strong consistency required       |
| WebSockets       | Durable Objects | Stateful connections              |
| File storage     | R2              | Large objects, S3-compatible      |
| Relational data  | D1              | SQL queries, joins                |
| Coordination     | Durable Objects | Single-threaded consistency       |

## Performance Optimization

- Keep bundle size < 50KB
- Use async/await for all I/O
- Minimize origin round-trips
- Use Cache API for ephemeral data

## Validation Tools

Run `scripts/validate-runtime.js` to check for Node.js API usage.
Run `scripts/check-bundle-size.js` to verify bundle size limits.

## Infrastructure Auditing

In growing monorepos, it's easy to lose track of orphaned Cloudflare resources (KV namespaces, R2 buckets, D1 databases) that are no longer bound to any active Worker. Regularly audit your infrastructure to minimize costs and security risks.

### Auditing Pattern

Use the Cloudflare API to list all resources and cross-reference them with your `wrangler.toml` configurations or active Worker bindings.

**Key things to check:**

1. **Unbound KV namespaces**: Namespaces with no active bindings.
2. **Empty R2 buckets**: Buckets that are no longer used for storage.
3. **Orphaned D1 databases**: Databases with no active migrations or connections.
4. **Unused Queues**: Queues with no consumers or producers.

See `scripts/audit-cloudflare-infrastructure.ts` in the main repository for an implementation example.

## Reference Materials

See [references/PATTERNS.md](references/PATTERNS.md) for validated patterns.

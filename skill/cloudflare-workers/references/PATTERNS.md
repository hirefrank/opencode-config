# Cloudflare Workers Patterns

This document contains validated patterns for Cloudflare Workers development.

## Rate Limiting with Durable Objects

Durable Objects are ideal for rate limiting because they provide single-threaded, atomic execution. Use `blockConcurrencyWhile` for safe initialization.

```typescript
import { DurableObject } from 'cloudflare:workers';

export class RateLimiter extends DurableObject<Env> {
  private limit: RateLimitData | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Block concurrent requests until initialized from persistent storage
    this.ctx.blockConcurrencyWhile(async () => {
      this.limit = await this.ctx.storage.get<RateLimitData>('limit') || null;

      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + 60000);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const req: RateLimitRequest = await request.json();
    const { maxRequests, windowMs } = req;
    const now = Date.now();

    if (!this.limit || now > this.limit.resetTime) {
      this.limit = { count: 0, resetTime: now + windowMs };
    }

    if (this.limit.count >= maxRequests) {
      const retryAfter = Math.ceil((this.limit.resetTime - now) / 1000);
      return new Response(JSON.stringify({ allowed: false, retryAfter }), { status: 429 });
    }

    this.limit.count++;
    await this.ctx.storage.put('limit', this.limit);

    return new Response(JSON.stringify({ allowed: true, remaining: maxRequests - this.limit.count }));
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    if (this.limit && now > this.limit.resetTime) {
      this.limit = null;
      await this.ctx.storage.delete('limit');
    }
    await this.ctx.storage.setAlarm(Date.now() + 60000);
  }
}
```

## Session Storage with KV

```typescript
// Session management using KV
export async function createSession(env: Env, userId: string, data: any) {
  const sessionId = crypto.randomUUID();
  const sessionKey = `session:${sessionId}`;

  await env.SESSIONS.put(
    sessionKey,
    JSON.stringify({
      userId,
      data,
      createdAt: Date.now(),
    }),
    {
      expirationTtl: 3600, // 1 hour
    },
  );

  return sessionId;
}

export async function getSession(env: Env, sessionId: string) {
  const sessionKey = `session:${sessionId}`;
  const session = await env.SESSIONS.get(sessionKey);

  if (!session) {
    return null;
  }

  return JSON.parse(session);
}
```

## Service Bindings for Worker-to-Worker

```typescript
// Main worker calling another worker via service binding
export default {
  async fetch(request: Request, env: Env) {
    // Direct service binding call
    const apiResponse = await env.API_SERVICE.fetch(request);

    // Transform response if needed
    const data = await apiResponse.json();

    return new Response(
      JSON.stringify({
        processed: true,
        data,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};
```

## Cache-Aside Pattern with KV

```typescript
// Cache-aside implementation
export async function getCachedData(env: Env, key: string) {
  // Try cache first
  const cached = await env.CACHE.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss - fetch from source
  const data = await fetchFromSource(key);

  // Write to cache with TTL
  await env.CACHE.put(key, JSON.stringify(data), {
    expirationTtl: 300, // 5 minutes
  });

  return data;
}

async function fetchFromSource(key: string) {
  // Implement your data fetching logic
  return { key, value: "fetched-data" };
}
```

## WebSocket with Durable Objects

```typescript
// WebSocket handling in Durable Object
export class WebSocketServer {
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map();
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    server.accept();
    const socketId = crypto.randomUUID();
    this.sockets.set(socketId, server);

    server.addEventListener("message", (event) => {
      this.handleMessage(socketId, event.data);
    });

    server.addEventListener("close", () => {
      this.sockets.delete(socketId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(socketId: string, data: string) {
    const message = JSON.parse(data);

    // Broadcast to all connected clients
    this.sockets.forEach((socket, id) => {
      if (id !== socketId) {
        socket.send(JSON.stringify(message));
      }
    });
  }
}
```

## File Upload with R2

```typescript
// File upload handler
export async function handleUpload(env: Env, request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return new Response("No file provided", { status: 400 });
  }

  const key = `uploads/${crypto.randomUUID()}-${file.name}`;

  await env.STORAGE.put(key, file);

  return new Response(
    JSON.stringify({
      key,
      size: file.size,
      type: file.type,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

// File download handler
export async function handleDownload(env: Env, key: string) {
  const object = await env.STORAGE.get(key);

  if (!object) {
    return new Response("File not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType || "application/octet-stream",
      "Content-Length": object.size.toString(),
    },
  });
}
```

## Edge Caching with Middleware

Use the Cloudflare Cache API for edge caching. Wrap handlers in a middleware that handles cache keys and ETags.

```typescript
export function withEdgeCache(handler: Handler, options: CacheOptions) {
  return async (context: Context) => {
    const { request } = context;
    if (request.method !== 'GET') return handler(context);

    const cache = caches.default;
    const cacheKey = new Request(request.url, request);
    let response = await cache.match(cacheKey);

    if (!response) {
      response = await handler(context);
      if (response.ok) {
        // Clone for cache
        const cacheResponse = response.clone();
        cacheResponse.headers.set('Cache-Control', `public, max-age=${options.ttl}`);
        await cache.put(cacheKey, cacheResponse);
      }
    }

    return response;
  };
}
```

## Optimized Bulk Fetching with Caching

Minimize KV reads and database queries by aggregating cache misses and performing a single bulk database query.

```typescript
export async function getEntitiesByIdsCached(db: DB, kv: KVNamespace, ids: string[]) {
  const results = [];
  const missingIds = [];

  // 1. Check cache for each ID
  for (const id of ids) {
    const cached = await kv.get(`entity:${id}`, 'json');
    if (cached) results.push(cached);
    else missingIds.push(id);
  }

  // 2. Bulk query missing IDs from DB
  if (missingIds.length > 0) {
    const dbResults = await db.entities.findMany({ where: { id: { in: missingIds } } });
    for (const entity of dbResults) {
      // 3. Back-fill cache
      await kv.put(`entity:${entity.id}`, JSON.stringify(entity), { expirationTtl: 3600 });
      results.push(entity);
    }
  }

  return results;
}
```

## Real-time Edge Metrics Tracking

Use KV to record performance metrics (hit/miss ratios) directly from the edge.

```typescript
export async function recordCacheMetric(kv: KVNamespace, isHit: boolean) {
  const date = new Date().toISOString().split('T')[0];
  const key = `metrics:cache:${date}`;
  const field = isHit ? 'hits' : 'misses';
  
  // Use atomic increments if supported, or periodic sync
  // For high traffic, consider sharding or Durable Objects
}
```

## D1 Database Operations

```typescript
// User management with D1
export class UserService {
  constructor(private db: D1Database) {}

  async createUser(email: string, name: string) {
    const stmt = this.db.prepare(`
      INSERT INTO users (email, name, created_at)
      VALUES (?, ?, ?)
    `);

    const result = await stmt.bind(email, name, Date.now()).run();

    if (!result.success) {
      throw new Error("Failed to create user");
    }

    return result.meta.last_row_id;
  }

  async getUserById(id: number) {
    const stmt = this.db.prepare(`
      SELECT id, email, name, created_at
      FROM users
      WHERE id = ?
    `);

    const user = await stmt.bind(id).first();
    return user;
  }

  async updateUser(id: number, updates: Partial<{ name: string }>) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return;
    }

    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const stmt = this.db.prepare(`
      UPDATE users
      SET ${setClause}
      WHERE id = ?
    `);

    const result = await stmt.bind(...values, id).run();
    return result.success;
  }
}
```

## Lazy Initialization with Proxy (Advanced)

Use this pattern to safely access Cloudflare bindings in environments like TanStack Start where bindings are only available during request handling. This prevents "binding not available" errors during build/SSR module evaluation.

```typescript
import { env as rawEnv } from 'cloudflare:workers';
import { AsyncLocalStorage } from 'node:async_hooks';

// Request-scoped storage for environment bindings
export const envStorage = new AsyncLocalStorage<Env>();

/**
 * Get the typed environment object
 */
export function getEnv(): Env {
  // Try request-scoped storage first
  const storedEnv = envStorage.getStore();
  if (storedEnv) return storedEnv;

  // Fallback to global env (works in some runtimes)
  return (rawEnv as Env) || ({} as Env);
}

/**
 * Create a lazy proxy for a binding (e.g., D1Database)
 */
export const db = new Proxy({} as D1Database, {
  get(_target, prop) {
    const env = getEnv();
    if (!env.DB) {
      throw new Error("DB binding not found. Ensure you are in a request context.");
    }
    const value = env.DB[prop as keyof D1Database];
    return typeof value === 'function' ? value.bind(env.DB) : value;
  }
});
```

# Cloudflare Workers Patterns

This document contains validated patterns for Cloudflare Workers development.

## Rate Limiting with Durable Objects

```typescript
// DO class for rate limiting
export class RateLimiter {
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = `ratelimit:${ip}`;

    const count = (await this.state.storage.get(key)) || 0;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (count >= 100) {
      return new Response("Rate limit exceeded", { status: 429 });
    }

    await this.state.storage.put(key, count + 1, {
      expirationTtl: 60,
    });

    return new Response("OK");
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

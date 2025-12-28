---
name: durable-objects
description: Design and implement Durable Objects for strongly consistent state, WebSockets, and coordination patterns. Use when single-threaded consistency is required.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires Cloudflare Workers, Durable Objects enabled
allowed-tools: Bash(wrangler:*) Read Write
triggers:
  - "rate limit"
  - "rate limiting"
  - "durable object"
  - "websocket"
  - "realtime"
  - "real-time"
  - "coordination"
  - "state machine"
  - "singleton"
  - "actor model"
  - "strong consistency"
  - "distributed lock"
  - "concurrent"
  - "atomic"
  - "chat room"
  - "collaboration"
---

# Durable Objects Development

## When to Use Durable Objects

### Use Cases

- **Rate limiting**: Atomic operations prevent race conditions
- **WebSockets**: Stateful connections need persistence
- **Real-time collaboration**: Single source of truth
- **Distributed locks**: Coordinated resource access
- **Chat systems**: Message ordering and delivery

### Don't Use For

- Simple key-value storage (use KV)
- Large object storage (use R2)
- Relational queries (use D1)

## Core Principles

### 1. Single-Threaded Consistency

Each Durable Object runs in a single thread, ensuring atomic operations.

```typescript
export class Counter {
  constructor(
    private state: DurableObjectState,
    env: Env,
  ) {}

  async increment() {
    // Atomic operation - no race conditions
    let current = (await this.state.storage.get<number>("count")) || 0;
    current++;
    await this.state.storage.put("count", current);
    return current;
  }
}
```

### 2. Proper Initialization

Always handle initialization in the constructor.

```typescript
export class ChatRoom {
  private messages: Message[] = [];

  constructor(
    private state: DurableObjectState,
    env: Env,
  ) {
    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Message[]>("messages");
      if (stored) {
        this.messages = stored;
      } else {
        // Initial setup
        this.messages = [];
        await this.state.storage.put("messages", this.messages);
      }
    });
  }
}
```

### 3. Implement setAlarm() for Persistence

Use alarms for periodic tasks and persistence.

```typescript
export class ScheduledTask {
  constructor(
    private state: DurableObjectState,
    env: Env,
  ) {
    this.state.setAlarm(60000); // 1 minute
  }

  async alarm() {
    // Perform periodic task
    await this.cleanup();

    // Schedule next alarm
    this.state.setAlarm(60000);
  }
}
```

## Common Patterns

### Rate Limiter

```typescript
export class RateLimiter {
  constructor(
    private state: DurableObjectState,
    env: Env,
  ) {}

  async checkLimit(key: string, limit: number, window: number) {
    const now = Date.now();
    const requests = (await this.state.storage.get<number[]>(key)) || [];

    // Filter old requests outside window
    const valid = requests.filter((time) => now - time < window);

    if (valid.length >= limit) {
      return false;
    }

    // Add new request
    valid.push(now);
    await this.state.storage.put(key, valid);

    return true;
  }
}
```

### WebSocket Manager

```typescript
export class WebSocketManager {
  private sockets = new Map<string, WebSocket>();

  constructor(
    private state: DurableObjectState,
    env: Env,
  ) {}

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const id = crypto.randomUUID();
    this.sockets.set(id, server);

    server.accept();

    server.addEventListener("message", (event) => {
      this.broadcast(id, event.data);
    });

    server.addEventListener("close", () => {
      this.sockets.delete(id);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private broadcast(sender: string, message: string) {
    this.sockets.forEach((socket, id) => {
      if (id !== sender) {
        socket.send(message);
      }
    });
  }
}
```

### Distributed Lock

```typescript
export class DistributedLock {
  constructor(
    private state: DurableObjectState,
    env: Env,
  ) {}

  async acquire(resourceId: string, timeout = 30000) {
    const lock = await this.state.storage.get<LockInfo>(resourceId);

    if (lock && lock.expires > Date.now()) {
      return false; // Already locked
    }

    const newLock: LockInfo = {
      acquired: Date.now(),
      expires: Date.now() + timeout,
      holder: crypto.randomUUID(),
    };

    await this.state.storage.put(resourceId, newLock, {
      expirationTtl: Math.ceil(timeout / 1000) + 1,
    });

    return true;
  }

  async release(resourceId: string) {
    await this.state.storage.delete(resourceId);
  }
}

interface LockInfo {
  acquired: number;
  expires: number;
  holder: string;
}
```

## ID Management

### User-Specific IDs

```typescript
// In your main worker
const userId = "user-123";
const id = env.CHAT_ROOM.idFromName(userId);
const stub = env.CHAT_ROOM.get(id);
```

### Content-Based IDs

```typescript
// For specific resources
const resourceId = `rate-limit-${ip}`;
const id = env.RATE_LIMITER.idFromName(resourceId);
```

### Random IDs

```typescript
// For temporary or isolated objects
const id = env.COUNTER.idFromString(crypto.randomUUID());
```

## Validation Tools

Run `scripts/design-do-pattern.js` to validate Durable Object designs.

## Best Practices

1. **Keep it small** - Each DO should have one responsibility
2. **Use blockConcurrencyWhile()** for initialization
3. **Set alarms** for persistence and cleanup
4. **Consider memory limits** - don't accumulate unbounded data
5. **Handle shutdown** - DOs can be evicted anytime

## Reference Materials

See [references/PATTERNS.md](references/PATTERNS.md) for advanced patterns and [references/ANTI-PATTERNS.md](references/ANTI-PATTERNS.md) for common mistakes.

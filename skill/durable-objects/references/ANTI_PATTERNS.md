# Durable Objects Anti-Patterns

## 1. In-Memory State Without Persistence

**Problem:** In-memory state is lost when the DO hibernates or is evicted.

```typescript
// ❌ WRONG - State lost on hibernation
export class ChatRoom {
  private messages: string[] = [];  // In-memory only!

  async fetch(request: Request) {
    this.messages.push('new message');
    // All messages lost when DO hibernates!
    return new Response(JSON.stringify(this.messages));
  }
}
```

**Solution:** Always persist state to storage:

```typescript
// ✅ CORRECT - Persistent storage
export class ChatRoom {
  constructor(private state: DurableObjectState, env: Env) {}

  async fetch(request: Request) {
    const messages = await this.state.storage.get<string[]>('messages') || [];
    messages.push('new message');
    await this.state.storage.put('messages', messages);
    return new Response(JSON.stringify(messages));
  }
}
```

## 2. Async Operations in Constructor

**Problem:** Constructors cannot be async in JavaScript.

```typescript
// ❌ WRONG - Syntax error or undefined behavior
export class MyDO {
  constructor(state: DurableObjectState) {
    await this.state.storage.get('data'); // Not allowed!
  }
}
```

**Solution:** Use `blockConcurrencyWhile`:

```typescript
// ✅ CORRECT - Use blockConcurrencyWhile
export class MyDO {
  private data: any;

  constructor(private state: DurableObjectState, env: Env) {
    state.blockConcurrencyWhile(async () => {
      this.data = await state.storage.get('data');
    });
  }
}
```

## 3. Non-Hibernatable WebSocket Handling

**Problem:** Manual WebSocket tracking doesn't survive hibernation.

```typescript
// ❌ WRONG - WebSocket Set lost on hibernation
export class ChatRoom {
  private sockets = new Set<WebSocket>();  // Lost!

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();  // Manual acceptance
    this.sockets.add(server);  // Won't survive hibernation

    return new Response(null, { status: 101, webSocket: client });
  }
}
```

**Solution:** Use `state.acceptWebSocket` and `state.getWebSockets`:

```typescript
// ✅ CORRECT - Hibernation-safe WebSockets
export class ChatRoom {
  constructor(private state: DurableObjectState, env: Env) {}

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use state for hibernation support
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Get all sockets (survives hibernation)
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) socket.send(message);
    }
  }
}
```

## 4. Unbounded Data Growth

**Problem:** DOs have storage limits. Unbounded data causes failures.

```typescript
// ❌ WRONG - Unbounded growth
export class Logger {
  async log(message: string) {
    const logs = await this.state.storage.get<string[]>('logs') || [];
    logs.push(message);  // Grows forever!
    await this.state.storage.put('logs', logs);
  }
}
```

**Solution:** Implement rotation or cleanup:

```typescript
// ✅ CORRECT - Bounded with rotation
export class Logger {
  private MAX_LOGS = 1000;

  async log(message: string) {
    const logs = await this.state.storage.get<string[]>('logs') || [];
    logs.push(message);

    // Keep only recent logs
    if (logs.length > this.MAX_LOGS) {
      logs.splice(0, logs.length - this.MAX_LOGS);
    }

    await this.state.storage.put('logs', logs);
  }
}
```

## 5. Using DOs for Simple Key-Value Storage

**Problem:** DOs are heavyweight for simple storage needs.

```typescript
// ❌ OVERKILL - Simple storage doesn't need DO
export class UserPreferences {
  async get(key: string) {
    return this.state.storage.get(key);
  }
  async set(key: string, value: any) {
    await this.state.storage.put(key, value);
  }
}
```

**Solution:** Use KV for simple key-value storage:

```typescript
// ✅ BETTER - Use KV for simple storage
async function getPreference(env: Env, userId: string, key: string) {
  return env.KV.get(`${userId}:${key}`);
}
```

**When to use DOs instead of KV:**
- Need strong consistency (reads after writes)
- Need atomic read-modify-write
- Need coordination between requests
- Need WebSocket connections

## 6. Creating Too Many DO Instances

**Problem:** Creating a DO per request wastes resources.

```typescript
// ❌ WRONG - New DO per request
async fetch(request: Request, env: Env) {
  const id = env.PROCESSOR.newUniqueId();  // New DO every time!
  const stub = env.PROCESSOR.get(id);
  return stub.fetch(request);
}
```

**Solution:** Use consistent IDs for related work:

```typescript
// ✅ CORRECT - Reuse DO for related requests
async fetch(request: Request, env: Env) {
  const userId = getUserId(request);
  const id = env.PROCESSOR.idFromName(`user:${userId}`);  // Same user → same DO
  const stub = env.PROCESSOR.get(id);
  return stub.fetch(request);
}
```

## 7. Ignoring Alarm for Deferred Work

**Problem:** Using setTimeout or external schedulers for deferred work.

```typescript
// ❌ WRONG - setTimeout doesn't survive hibernation
export class Processor {
  async scheduleWork() {
    setTimeout(() => {
      this.doWork();  // Never runs if DO hibernates!
    }, 60000);
  }
}
```

**Solution:** Use alarms:

```typescript
// ✅ CORRECT - Alarms survive hibernation
export class Processor {
  async scheduleWork() {
    await this.state.storage.setAlarm(Date.now() + 60000);
  }

  async alarm() {
    await this.doWork();
  }
}
```

## 8. Blocking the Event Loop

**Problem:** Long synchronous operations block all requests to the DO.

```typescript
// ❌ WRONG - Blocks event loop
export class Processor {
  async fetch(request: Request) {
    // This blocks ALL requests to this DO
    for (let i = 0; i < 1000000000; i++) {
      // Heavy computation
    }
    return new Response('Done');
  }
}
```

**Solution:** Break up work or use Workers for CPU-intensive tasks:

```typescript
// ✅ CORRECT - Offload heavy work
export class Processor {
  async fetch(request: Request) {
    // Queue work and return immediately
    await this.state.storage.put('pending', { task: 'heavy' });
    await this.state.storage.setAlarm(Date.now() + 100);
    return new Response('Queued');
  }

  async alarm() {
    // Process in smaller chunks
    const pending = await this.state.storage.get('pending');
    // Process incrementally...
  }
}
```

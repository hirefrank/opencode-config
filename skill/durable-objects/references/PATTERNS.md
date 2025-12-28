# Durable Objects Design Patterns

## ID Strategies

Choose the right ID strategy based on your use case:

### 1. Singleton per Entity (idFromName)
Use for shared resources where the same logical entity maps to the same DO instance.

```typescript
// Chat rooms, game lobbies, shared documents
const id = env.CHAT_ROOM.idFromName(`room:${roomId}`);
// Same roomId → same DO instance globally

// User-specific DOs
const id = env.USER_STATE.idFromName(`user:${userId}`);
// User's state is always in the same DO
```

### 2. Recreatable Entities (idFromString)
Use when you have an existing ID and need to recreate the DO reference.

```typescript
// Workflows, orders, transactions
const id = env.WORKFLOW.idFromString(workflowId);
// Can recreate DO reference from stored ID

// Useful for:
// - Database records that reference DOs
// - Cross-request coordination with known IDs
```

### 3. New Unique Entities (newUniqueId)
Use for new, independent entities that don't need to be recreated.

```typescript
// Sessions, temporary operations
const id = env.SESSION.newUniqueId();
// Creates new globally unique DO

// Store the ID if you need to access it later:
const idString = id.toString();
```

## Single-Threaded Execution

Durable Objects guarantee single-threaded execution within an instance. Leverage this for atomic operations:

```typescript
export class AtomicCounter {
  async fetch(request: Request) {
    // These operations are atomic - no race conditions possible
    const count = await this.state.storage.get<number>('count') || 0;
    const newCount = count + 1;
    await this.state.storage.put('count', newCount);
    return new Response(String(newCount));
  }
}
```

**Key insight:** You don't need locks, mutexes, or CAS operations within a single DO.

## Initialization with blockConcurrencyWhile

Load state during construction without blocking the event loop:

```typescript
export class StatefulDO {
  private data: Map<string, any>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.data = new Map();

    // Block concurrent requests until initialized
    state.blockConcurrencyWhile(async () => {
      const stored = await state.storage.list();
      for (const [key, value] of stored) {
        this.data.set(key, value);
      }
    });
  }
}
```

## WebSocket Hibernation Pattern

Use `acceptWebSocket` for WebSocket connections that survive hibernation:

```typescript
export class HibernatableChatRoom {
  constructor(private state: DurableObjectState, env: Env) {}

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Use state.acceptWebSocket for hibernation support
      this.state.acceptWebSocket(server);

      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Expected WebSocket', { status: 400 });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Get all connected WebSockets (survives hibernation)
    const sockets = this.state.getWebSockets();

    for (const socket of sockets) {
      if (socket !== ws && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    // Cleanup handled automatically
  }
}
```

## Alarm Pattern for Scheduled Work

Use alarms for reliable deferred execution:

```typescript
export class ScheduledProcessor {
  constructor(private state: DurableObjectState, env: Env) {}

  async schedule(delayMs: number) {
    // Schedule alarm - survives hibernation
    await this.state.storage.setAlarm(Date.now() + delayMs);
  }

  async alarm() {
    // Execute scheduled work
    const pending = await this.state.storage.get<Task[]>('pending') || [];

    for (const task of pending) {
      await this.processTask(task);
    }

    // Clear processed tasks
    await this.state.storage.put('pending', []);

    // Optionally reschedule for periodic work
    // await this.state.storage.setAlarm(Date.now() + 60000);
  }
}
```

## Transactional Storage Operations

Batch operations for consistency and performance:

```typescript
async updateMultipleKeys() {
  // Batch writes are atomic
  await this.state.storage.put({
    'key1': 'value1',
    'key2': 'value2',
    'key3': 'value3',
  });

  // Batch deletes
  await this.state.storage.delete(['key1', 'key2']);

  // Transaction helper
  await this.state.storage.transaction(async (txn) => {
    const balance = await txn.get<number>('balance') || 0;
    if (balance >= amount) {
      await txn.put('balance', balance - amount);
      return true;
    }
    return false;
  });
}
```

## Actor Model Communication

Route requests to the right DO instance:

```typescript
// In your Worker
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Extract entity ID from request
    const entityId = url.searchParams.get('id');
    if (!entityId) {
      return new Response('Missing ID', { status: 400 });
    }

    // Route to correct DO instance
    const id = env.MY_DO.idFromName(entityId);
    const stub = env.MY_DO.get(id);

    // Forward request
    return stub.fetch(request);
  }
}
```

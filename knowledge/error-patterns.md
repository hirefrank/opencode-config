# Error Patterns Knowledge Base

This file contains validated error signatures and remediation patterns for Cloudflare Workers and Tanstack Start applications.

---

## Pattern: Handle KV Eventually Consistent Reads

**Category**: Reliability
**Confidence**: High
**Source**: Cloudflare KV Documentation

### Problem

Cloudflare KV is eventually consistent. A write to a key may not be immediately visible to subsequent reads, leading to "stale data" or "not found" errors in distributed environments.

### Solution

For workflows requiring immediate consistency (like authentication or critical state), use **Durable Objects**. If using KV, implement a retry mechanism with backoff or design the application to handle eventual consistency.

### Example

```typescript
// ❌ RISKY: Assuming immediate consistency
await env.KV.put("user:123", data);
const user = await env.KV.get("user:123"); // Might return null!

// ✅ CORRECT: Use Durable Objects for strong consistency
const id = env.USER_DO.idFromName("123");
const stub = env.USER_DO.get(id);
await stub.update(data);
const user = await stub.get(); // Guaranteed consistent
```

---

## Pattern: D1 Query Timeouts and Limits

**Category**: Database
**Confidence**: High
**Source**: Cloudflare D1 Documentation

### Problem

D1 queries have execution time limits and row limits. Complex joins or large scans can trigger "D1_ERROR: query interrupted" or "D1_ERROR: too many rows".

### Solution

1. Use indexes for all `WHERE` and `JOIN` clauses.
2. Implement pagination for all list queries.
3. Keep transactions short to avoid blocking.

### Example

```typescript
// ❌ SLOW: Unindexed scan
const users = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
  .bind(email)
  .all();

// ✅ FAST: Indexed lookup
// Ensure 'email' is indexed in schema.sql: CREATE INDEX idx_users_email ON users(email);
const user = await env.DB.prepare("SELECT * FROM users WHERE email = ? LIMIT 1")
  .bind(email)
  .first();
```

---

## Pattern: Tanstack Start Hydration Mismatch

**Category**: UI/UX
**Confidence**: High
**Source**: React 19 / Tanstack Start Docs

### Problem

"Hydration failed because the initial UI does not match what was rendered on the server." This often happens when using browser-only APIs (like `window` or `localStorage`) or random values in the initial render.

### Solution

Use `useEffect` to trigger client-only rendering after hydration, or ensure the server and client render identical content for the initial pass.

### Example

```tsx
// ❌ BROKEN: Server doesn't have window
function MyComponent() {
  const width = window.innerWidth; // ReferenceError on server
  return <div>Width: {width}</div>;
}

// ✅ CORRECT: Client-only effect
function MyComponent() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    setWidth(window.innerWidth);
  }, []);

  if (width === null) return <div>Loading...</div>;
  return <div>Width: {width}</div>;
}
```

---

## Pattern: Type-Safe Server Function Errors

**Category**: Backend
**Confidence**: High
**Source**: Tanstack Start Server Functions

### Problem

Server functions that throw generic errors lose type safety on the client and can leak sensitive information.

### Solution

Use a structured error response pattern (e.g., Zod-validated errors) and catch-all wrappers to ensure the client receives predictable error shapes.

### Example

```typescript
// server-functions.ts
export const createUser = createServerFn("POST", async (data: UserInput) => {
  try {
    return await db.insert(data);
  } catch (error) {
    // ❌ Don't leak raw error
    // throw error;

    // ✅ Return structured error
    return { success: false, error: "Failed to create user" };
  }
});

// client.tsx
const result = await createUser(data);
if (!result.success) {
  showToast(result.error); // Fully typed
}
```

---

## Pattern: Workers 50ms CPU Limit

**Category**: Runtime
**Confidence**: High
**Source**: Cloudflare Workers Runtime Docs

### Problem

Free tier Workers have a 50ms CPU time limit per request. Intensive synchronous logic (like large JSON parsing or complex crypto) can trigger "Worker exceeded CPU limit".

### Solution

1. Use `async` versions of APIs whenever available.
2. Offload heavy processing to specialized bindings (like Cloudflare AI).
3. Optimize loop-heavy logic.

### Example

```typescript
// ❌ HEAVY: Sync parsing of massive JSON
const largeData = JSON.parse(await request.text());

// ✅ OPTIMIZED: Use streaming or chunked processing if possible
// Or ensure logic is performant enough for 50ms window.
```

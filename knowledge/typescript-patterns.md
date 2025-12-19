# TypeScript Patterns Knowledge Base

This file contains validated TypeScript patterns for Cloudflare Workers and Tanstack Start applications, focusing on type safety and developer experience at the edge.

---

## Pattern: Strict Env Binding Interface

**Category**: Reliability
**Confidence**: High
**Source**: Cloudflare Workers Documentation

### Problem

Accessing bindings via `env` without explicit types leads to `any` types, bypassing the compiler's ability to catch missing or renamed bindings.

### Solution

Always define a central `Env` interface that matches your `wrangler.toml` configuration and use it in all entry points.

### Example

```typescript
// src/types/env.ts
export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  AUTH_SECRET: string;
}

// src/index.ts
export default {
  async fetch(req: Request, env: Env) {
    // env.DB is now fully typed
  },
};
```

---

## Pattern: Branded Types for Domain IDs

**Category**: Safety
**Confidence**: High
**Source**: TypeScript Advanced Patterns

### Problem

Using `string` for all IDs (User ID, Post ID, Account ID) makes it easy to accidentally pass the wrong ID to a function (e.g., passing a User ID where an Account ID is expected).

### Solution

Use "Branded Types" to create unique, incompatible types for different domain IDs at compile time, while they remain strings at runtime.

### Example

```typescript
type Brand<K, T> = K & { __brand: T };

export type UserId = Brand<string, "UserId">;
export type AccountId = Brand<string, "AccountId">;

function getAccount(id: AccountId) { ... }

const myUserId = "user_123" as UserId;
getAccount(myUserId); // ❌ COMPILE ERROR: UserId is not AccountId
```

---

## Pattern: Generic Server Function Wrapper

**Category**: DX
**Confidence**: High
**Source**: Tanstack Start Best Practices

### Problem

Repeating try/catch logic and error formatting in every Server Function leads to boilerplate and inconsistent error handling.

### Solution

Create a higher-order function that wraps Server Functions to provide consistent error handling and type-safe responses.

### Example

```typescript
export function createSafeAction<TInput, TOutput>(
  schema: z.Schema<TInput>,
  fn: (data: TInput) => Promise<TOutput>,
) {
  return createServerFn("POST", async (data: unknown) => {
    const validated = schema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: "Invalid input" };
    }
    try {
      const result = await fn(validated.data);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: "Server error" };
    }
  });
}
```

---

## Pattern: Schema-to-Type Sync (Zod)

**Category**: Safety
**Confidence**: High
**Source**: Zod Documentation

### Problem

Manually maintaining both a TypeScript interface and a validation schema (like Zod) for the same data structure leads to drift and bugs.

### Solution

Define the schema with Zod and derive the TypeScript type using `z.infer`.

### Example

```typescript
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
});

// ✅ Automatically stays in sync with UserSchema
export type User = z.infer<typeof UserSchema>;
```

---

## Pattern: Discriminated Unions for API States

**Category**: UI/UX
**Confidence**: High
**Source**: TypeScript Handbook

### Problem

Representing API states with multiple booleans (e.g., `isLoading`, `isError`, `data`) leads to invalid states (e.g., `isLoading` and `isError` both being true).

### Solution

Use a discriminated union to represent mutually exclusive states.

### Example

```typescript
type ApiState<T> =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; data: T }
  | { type: 'error'; error: string };

function render(state: ApiState<User>) {
  switch (state.type) {
    case 'loading': return <Spinner />;
    case 'success': return <Profile user={state.data} />;
    case 'error': return <Error msg={state.error} />;
  }
}
```

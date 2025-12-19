---
name: worker-generator
description: Generates production-ready Cloudflare Workers code with proper bindings, runtime compatibility, and TypeScript types. Automatically activates when creating new Workers, adding endpoints, or generating Worker code. Analyzes wrangler.toml for available bindings and generates code that uses them correctly.
triggers:
  [
    "create worker",
    "new worker",
    "generate worker",
    "add endpoint",
    "worker code",
    "create api",
    "new api endpoint",
    "cloudflare worker",
  ]
---

# Worker Generator SKILL

## Activation Patterns

This SKILL automatically activates when:

- User wants to create a new Cloudflare Worker
- Adding new API endpoints to existing Workers
- Generating Worker code from requirements
- Phrases like "create a worker", "new endpoint", "generate worker code"
- When implementing Cloudflare-specific functionality

## Expertise Provided

### Production-Ready Code Generation

- **Binding Analysis**: Reads wrangler.toml to understand available resources
- **Type Generation**: Creates proper TypeScript Env interfaces
- **Runtime Compliance**: Only uses Workers-compatible APIs
- **Best Practices**: Follows Cloudflare patterns and conventions
- **Error Handling**: Includes proper try/catch and HTTP status codes

## Workflow

### Step 1: Analyze Project Context

**Find wrangler.toml**:

```bash
# Look for wrangler.toml in project
find . -name "wrangler.toml" -type f
```

**Extract Bindings**:

```toml
# Parse these binding types:
[[kv_namespaces]]
binding = "USER_DATA"
id = "xxx"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "my-bucket"

[[durable_objects.bindings]]
name = "COUNTER"
class_name = "Counter"

[[d1_databases]]
binding = "DB"
database_id = "xxx"

[[services]]
binding = "API_SERVICE"
service = "api-worker"

[[queues.producers]]
binding = "MY_QUEUE"
queue = "my-queue"

[ai]
binding = "AI"

[vars]
ENVIRONMENT = "production"
```

**Generate Context Summary**:

```
Available Bindings:
- KV Namespaces: USER_DATA
- R2 Buckets: UPLOADS
- Durable Objects: COUNTER (class: Counter)
- D1 Databases: DB
- Services: API_SERVICE
- Queues: MY_QUEUE
- AI: AI
- Variables: ENVIRONMENT
```

### Step 2: Generate Worker Code

#### Required Code Structure

**Export Format**:

```typescript
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Handler code
  },
};
```

**TypeScript Env Interface**:

```typescript
interface Env {
  // KV Namespaces
  USER_DATA: KVNamespace;

  // R2 Buckets
  UPLOADS: R2Bucket;

  // Durable Objects
  COUNTER: DurableObjectNamespace;

  // D1 Databases
  DB: D1Database;

  // Services
  API_SERVICE: Fetcher;

  // Queues
  MY_QUEUE: Queue;

  // AI
  AI: Ai;

  // Environment variables
  ENVIRONMENT: string;

  // Secrets (via wrangler secret)
  API_KEY: string;
}
```

#### Runtime Compatibility Rules

**✅ Allowed APIs**:

```typescript
// Web APIs
fetch, Request, Response, Headers, URL
crypto.subtle, TextEncoder, TextDecoder
Web Streams API
FormData, Blob, File
WebSocket
```

**❌ Forbidden APIs**:

```typescript
// Node.js APIs - DO NOT USE
import fs from "fs"; // No filesystem
import path from "path"; // No path module
import { Buffer } from "buffer"; // Use Uint8Array
const x = process.env.KEY; // Use env parameter
require("./module"); // Use ES imports
```

#### Error Handling Pattern

```typescript
try {
  const result = await operation();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
} catch (error) {
  console.error("Operation failed:", error);
  return new Response(JSON.stringify({ error: "Internal server error" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
```

#### CORS Headers (for APIs)

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight
if (request.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}
```

### Step 3: Binding Usage Examples

**KV Namespace**:

```typescript
// Read
const value = await env.USER_DATA.get(key);
const data = await env.USER_DATA.get(key, "json");

// Write (always with TTL!)
await env.USER_DATA.put(key, value, { expirationTtl: 3600 });

// Delete
await env.USER_DATA.delete(key);

// List
const list = await env.USER_DATA.list({ prefix: "user:" });
```

**R2 Bucket**:

```typescript
// Read
const object = await env.UPLOADS.get(key);
if (object) {
  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType || "application/octet-stream",
    },
  });
}

// Write
await env.UPLOADS.put(key, body, {
  httpMetadata: { contentType: "image/png" },
});

// Delete
await env.UPLOADS.delete(key);
```

**Durable Object**:

```typescript
// Get stub
const id = env.COUNTER.idFromName("my-counter");
const stub = env.COUNTER.get(id);

// Call method
const response = await stub.fetch(request);
```

**D1 Database**:

```typescript
// Query (parameterized!)
const result = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
  .bind(userId)
  .first();

// Insert
await env.DB.prepare("INSERT INTO users (name, email) VALUES (?, ?)")
  .bind(name, email)
  .run();

// Batch
const results = await env.DB.batch([
  env.DB.prepare("INSERT INTO logs (msg) VALUES (?)").bind("log1"),
  env.DB.prepare("INSERT INTO logs (msg) VALUES (?)").bind("log2"),
]);
```

**Service Binding**:

```typescript
// Call another Worker directly (no HTTP overhead)
const response = await env.API_SERVICE.fetch(request);
```

**Queue**:

```typescript
// Send message
await env.MY_QUEUE.send({ type: "task", data: payload });

// Send batch
await env.MY_QUEUE.sendBatch([
  { body: { type: "task1" } },
  { body: { type: "task2" } },
]);
```

### Step 4: Implementation Guidance

**File Location**:

- Main worker: `src/index.ts`
- Durable Objects: `src/durable-objects/[name].ts`
- Utilities: `src/utils/[name].ts`

**Required Bindings Note**:

```
Note: This code expects the following bindings in wrangler.toml:

[[kv_namespaces]]
binding = "USER_DATA"
id = "<your-kv-namespace-id>"

Create with: wrangler kv:namespace create USER_DATA
```

**Testing Instructions**:

```bash
# Local development
npx wrangler dev

# Test endpoint
curl http://localhost:8787/api/test

# With authentication
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/protected
```

**Deployment**:

```bash
# Deploy to production
npx wrangler deploy

# Deploy to staging
npx wrangler deploy --env staging
```

## Critical Guardrails

### YOU MUST NOT:

- Suggest direct modifications to wrangler.toml (only show what's needed)
- Use Node.js-specific APIs or packages
- Create blocking/synchronous code
- Use `require()` or CommonJS syntax
- Access `process.env` directly (use `env` parameter)
- Hardcode secrets in code

### YOU MUST:

- Use only bindings defined in wrangler.toml
- Use Workers runtime APIs (fetch-based)
- Follow TypeScript best practices
- Include proper error handling
- Make code edge-optimized (fast cold starts)
- Use `env` parameter for all bindings and secrets

## Response Format

When generating Worker code, provide:

1. **Project Context Summary**: Detected bindings from wrangler.toml
2. **Generated Code**: Complete, working Worker implementation
3. **Type Definitions**: Full TypeScript Env interface
4. **Setup Instructions**: Any configuration notes
5. **Testing Guide**: How to test locally and in production
6. **Next Steps**: Suggested improvements or additional features

## Integration Points

### Complementary Components

- **workers-runtime-validator SKILL**: Validates generated code
- **workers-binding-validator SKILL**: Validates binding usage
- **es-validate command**: Pre-deployment validation

### Escalation Triggers

- Complex Durable Object patterns → `@durable-objects-architect` agent
- Performance optimization → `@edge-performance-oracle` agent
- Security concerns → `@cloudflare-security-sentinel` agent

## Benefits

### Immediate Impact

- **Correct by Default**: Generated code follows all Workers patterns
- **Type Safety**: Full TypeScript support with proper interfaces
- **Ready to Deploy**: Code works immediately with existing bindings
- **Best Practices**: Includes error handling, CORS, etc.

### Long-term Value

- **Consistent Patterns**: All Workers follow same structure
- **Reduced Debugging**: Fewer runtime errors from API misuse
- **Faster Development**: Skip boilerplate, focus on logic
- **Team Alignment**: Shared code patterns across project

## Usage Examples

### Creating a New API Worker

```
User: "Create a worker that handles user authentication"
SKILL: Analyzes bindings, generates auth worker with KV sessions, D1 users
```

### Adding an Endpoint

```
User: "Add a file upload endpoint"
SKILL: Generates R2 upload handler with proper streaming and metadata
```

### Generating a Durable Object

```
User: "Create a rate limiter Durable Object"
SKILL: Generates DO class with proper state management and hibernation support
```

This SKILL ensures all generated Cloudflare Workers code is production-ready, type-safe, and follows best practices for the Workers runtime.

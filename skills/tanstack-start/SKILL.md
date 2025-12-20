---
name: tanstack-start
description: Build full-stack React applications with Tanstack Start. Use for SSR, streaming, file-based routing, and server functions on Cloudflare Workers.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires React 19, Tanstack Start, Cloudflare Workers
allowed-tools: Bash(npm:*) Bash(pnpm:*) Bash(npx:*) Read Write
triggers:
  - "tanstack"
  - "route"
  - "routing"
  - "ssr"
  - "server function"
  - "server component"
  - "file-based routing"
  - "loader"
  - "action"
  - "react 19"
  - "streaming"
  - "suspense"
  - "page"
  - "layout"
---

# Tanstack Start Development

## Quick Start

```bash
# Create new app
pnpm create tanstack-start@latest

# Install dependencies
pnpm install

# Run in development
pnpm dev
```

## Core Concepts

### 1. File-Based Routing

Routes are automatically created from files in the `routes/` directory:

```
routes/
├── index.tsx           # → /
├── about.tsx           # → /about
├── blog/
│   ├── index.tsx       # → /blog
│   └── $slug.tsx      # → /blog/:slug
└── __root.tsx         # Root layout
```

### 2. Server Functions

Create server-side functions with the `createServerFunction` API:

```typescript
// app/functions/getUser.ts
import { createServerFunction } from "@tanstack/start/server-functions";
import { db } from "./db";

export const getUser = createServerFunction("GET", async (id: string) => {
  return await db.user.findUnique({ where: { id } });
});

// In component:
const user = await getUser("123");
```

### 3. Data Loading

Load data in route components with `loader`:

```typescript
// routes/posts/$postId.tsx
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    if (!post) throw new Error('Post not found');
    return { post };
  },
  component: PostComponent,
});

function PostComponent() {
  const { post } = Route.useLoaderData();
  return <div>{post.title}</div>;
}
```

### 4. SSR and Streaming

Tanstack Start automatically handles SSR and streaming:

```typescript
// Enable streaming for better performance
export const Route = createFileRoute("/search")({
  loader: async ({ search }) => {
    // Stream results as they arrive
    const results = streamSearchResults(search);
    return { results };
  },
  component: SearchComponent,
});
```

## Best Practices

### Component Structure

```typescript
// routes/__root.tsx - Root layout
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export const Route = createFileRoute('/')({
  component: RootComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
        <hr />
        <Outlet />
        <footer>© 2024</footer>
      </div>
    </QueryClientProvider>
  );
}
```

### Server Functions in Cloudflare Workers

```typescript
// app/functions/api.ts
import { createServerFunction } from "@tanstack/start/server-functions";
import { env } from "./env";

export const apiCall = createServerFunction(
  "POST",
  async (endpoint: string, data: any) => {
    // Use Cloudflare bindings
    const response = await fetch(`${env.API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.API_KEY}`,
      },
      body: JSON.stringify(data),
    });

    return response.json();
  },
);
```

### Environment Variables

```typescript
// app/env.ts
export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  KV: KVNamespace;

  // Secrets
  API_KEY: string;
  API_URL: string;
}

// Access in server functions
export const getEnv = (): Env => {
  // In Workers, env is passed to the fetch handler
  return globalThis.env;
};
```

## Common Patterns

### Authentication Flow

```typescript
// app/functions/auth.ts
import { createServerFunction } from "@tanstack/start/server-functions";
import { betterAuth } from "better-auth";
import { auth } from "./auth";

export const signIn = createServerFunction(
  "POST",
  async (email: string, password: string) => {
    const response = await auth.api.signInEmail({
      body: { email, password },
    });

    if (response.user) {
      // Create session in KV
      await env.SESSIONS.put(response.session.token, JSON.stringify(response));
    }

    return response;
  },
);

// In component:
const handleSignIn = async (e: FormEvent) => {
  e.preventDefault();
  const result = await signIn(email, password);
  if (result.user) {
    router.navigate({ to: "/dashboard" });
  }
};
```

### File Uploads

```typescript
// app/functions/upload.ts
import { createServerFunction } from "@tanstack/start/server-functions";

export const uploadFile = createServerFunction("POST", async (file: File) => {
  const key = `uploads/${crypto.randomUUID()}-${file.name}`;

  // Upload to R2
  await env.STORAGE.put(key, file);

  return { key, size: file.size };
});

// In component with form:
const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const result = await uploadFile(file);
    console.log("Uploaded:", result);
  }
};
```

## Deployment

### Wrangler Configuration

```toml
# wrangler.toml
name = "my-tanstack-app"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "KV"
id = "..."
preview_id = "..."

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "my-storage"

[vars]
NODE_VERSION = "20"
```

### Build and Deploy

```bash
# Build for production
pnpm build

# Deploy to Cloudflare Workers
pnpm wrangler deploy
```

## Validation Tools

Run `scripts/validate-router.js` to check:

- Missing loaders for data-dependent routes
- Improper server function usage
- Missing error boundaries

## Reference Materials

- [assets/](assets/) - Example configurations
- [references/ROUTING.md](references/ROUTING.md) - Advanced routing patterns
- [references/SSR.md](references/SSR.md) - SSR optimization techniques

## Migration Guide

See [references/MIGRATION.md](references/MIGRATION.md) for migrating from Next.js or other frameworks.

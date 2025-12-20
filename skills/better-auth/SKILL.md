---
name: better-auth
description: Implement authentication with better-auth in Cloudflare Workers. Use for user management, session handling, OAuth providers, and auth middleware.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires better-auth, D1, Cloudflare Workers
allowed-tools: Bash(npm:*) Bash(pnpm:*) Read Write
---

# Better Auth with D1 in Cloudflare Workers

## Quick Start

```bash
# Install better-auth
pnpm add better-auth

# Install adapter
pnpm @better-auth/d1
```

## Configuration

### Basic Setup

```typescript
// app/lib/auth.ts
import { betterAuth } from "better-auth";
import { d1Adapter } from "@better-auth/d1";
import { env } from "./env";

export const auth = betterAuth({
  database: d1Adapter({
    datasource: {
      db: env.DB, // D1 binding from Cloudflare
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
});
```

### Environment Setup

```typescript
// app/env.ts
export interface Env {
  // D1 database
  DB: D1Database;

  // Auth secrets
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // JWT secret
  BETTER_AUTH_SECRET: string;
}
```

## Database Migration

### Create Auth Tables

```bash
# Generate migration
npx @better-auth/cli generate

# Run migration with D1
pnpm wrangler d1 migrations apply auth-tables
```

### Manual Migration File

```sql
-- migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "email" TEXT UNIQUE NOT NULL,
  "emailVerified" BOOLEAN DEFAULT false,
  "image" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refreshToken" TEXT,
  "accessToken" TEXT,
  "expiresAt" INTEGER,
  "tokenType" TEXT,
  "scope" TEXT,
  "idToken" TEXT,
  "sessionState" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);
```

## Client Integration

### React Setup

```typescript
// app/components/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "/api/auth",
});
```

### Auth Provider

```typescript
// app/providers/auth-provider.tsx
'use client';

import { authClient } from '../components/auth-client';
import { AuthProvider } from 'better-auth/react';

export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider client={authClient}>
      {children}
    </AuthProvider>
  );
}
```

### Authentication Components

```typescript
// app/components/sign-in.tsx
'use client';

import { authClient } from './auth-client';
import { useState } from 'react';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password
      });

      if (result.error) {
        console.error('Sign in error:', result.error.message);
      } else {
        window.location.href = '/dashboard';
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignIn}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

## Server Integration

### Auth Handler for Workers

```typescript
// app/api/auth/[...all].ts
import { auth } from "../../lib/auth";
import type { Env } from "../../env";

export async function onRequest(context: EventContext<Env, any, any>) {
  // Better Auth expects a standard Request object
  return auth.handler(context.request);
}
```

### Middleware for Protected Routes

```typescript
// app/middleware.ts
import { auth } from "./lib/auth";
import type { Env } from "./env";

export async function onRequest(context: EventContext<Env, any, any>) {
  // Get session
  const session = await auth.api.getSession({
    headers: context.request.headers,
  });

  // Protect routes
  if (context.request.url.includes("/api/protected") && !session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Add user to request context
  context.data.user = session?.user || null;

  // Continue
  return await context.next();
}
```

### Server Functions with Auth

```typescript
// app/functions/protected-data.ts
import { createServerFunction } from "@tanstack/start/server-functions";
import { auth } from "../lib/auth";

export const getProtectedData = createServerFunction("GET", async () => {
  // Verify session
  const session = await auth.api.getSession({
    headers: globalThis.requestHeaders,
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Fetch user data
  const user = await auth.api.getUser({
    headers: globalThis.requestHeaders,
  });

  return { user, data: "secret information" };
});
```

## OAuth Providers

### GitHub OAuth Setup

```typescript
// app/lib/auth.ts (continued)
socialProviders: {
  github: {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    enabled: true,
  }
}

// In component:
const handleGitHubSignIn = async () => {
  const result = await authClient.signIn.social({
    provider: 'github',
    callbackURL: '/dashboard'
  });

  if (result.data) {
    window.location.href = result.data.url;
  }
};
```

## Common Patterns

### Email Verification

```typescript
// Send verification email
const handleSignUp = async (email: string, password: string) => {
  const result = await authClient.signUp.email({
    email,
    password,
    callbackURL: "/auth/callback/email",
  });

  if (result.data?.user) {
    console.log("Verification email sent");
  }
};
```

### Password Reset

```typescript
const handlePasswordReset = async (email: string) => {
  const result = await authClient.forgetPassword({
    email,
    redirectTo: "/reset-password",
  });

  if (result.data) {
    console.log("Password reset email sent");
  }
};
```

### Session Management

```typescript
// Check session
const { data: session } = useSession();

// Sign out
const handleSignOut = async () => {
  await authClient.signOut();
  window.location.href = "/";
};

// Update profile
const updateProfile = async (name: string) => {
  await authClient.updateUser({
    name,
  });
};
```

## Validation Tools

Run `scripts/setup-d1-auth.js` to:

- Generate migrations
- Create required tables
- Verify D1 schema

## Best Practices

1. **Always use D1 adapter** - Don't use in-memory storage
2. **Secure your secrets** - Use wrangler secrets, not env vars
3. **Validate emails** - Enable email verification
4. **Use HTTPS** - Required for cookies in production
5. **Set proper CORS** - Configure allowed origins
6. **Handle edge cases** - Network errors, timeouts

## Reference Materials

- [references/PROVIDERS.md](references/PROVIDERS.md) - OAuth provider setup
- [references/SCHEMA.md](references/SCHEMA.md) - Database schema reference

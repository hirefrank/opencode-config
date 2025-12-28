# Database Schema Reference

## Core Tables

### Users Table

```sql
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "email" TEXT UNIQUE NOT NULL,
  "emailVerified" BOOLEAN DEFAULT false,
  "image" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_users_email ON "user"(email);
```

### Accounts Table (OAuth)

```sql
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
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
  UNIQUE("provider", "providerAccountId")
);

CREATE INDEX idx_accounts_user ON "account"(userId);
```

### Sessions Table

```sql
CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON "session"(userId);
CREATE INDEX idx_sessions_token ON "session"(token);
```

### Passkeys Table (WebAuthn)

```sql
CREATE TABLE IF NOT EXISTS "passkey" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT UNIQUE NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX idx_passkeys_user ON "passkey"(userId);
CREATE INDEX idx_passkeys_credential ON "passkey"(credentialId);
```

### Verification Tokens (Magic Links, Email Verification)

```sql
CREATE TABLE IF NOT EXISTS "verification_token" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "expires" INTEGER NOT NULL,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_verification_token ON "verification_token"(token);
CREATE INDEX idx_verification_identifier ON "verification_token"(identifier);
```

## Custom Extensions

### Password Hashes (Email/Password Auth)

If using email/password authentication without better-auth's built-in handling:

```sql
ALTER TABLE "user" ADD COLUMN "passwordHash" TEXT;
```

### User Roles

```sql
CREATE TABLE IF NOT EXISTS "user_role" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
  UNIQUE("userId", "role")
);

CREATE INDEX idx_user_roles ON "user_role"(userId);
```

### Login Attempts (Rate Limiting)

```sql
CREATE TABLE IF NOT EXISTS "login_attempt" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "email" TEXT,
  "success" BOOLEAN NOT NULL,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_login_attempts_ip ON "login_attempt"(ipAddress);
CREATE INDEX idx_login_attempts_time ON "login_attempt"(createdAt);
```

## Migration Commands

```bash
# Generate migrations from better-auth schema
npx @better-auth/cli generate

# Apply migrations to D1
wrangler d1 migrations apply YOUR_DATABASE_NAME

# Create migration manually
wrangler d1 migrations create YOUR_DATABASE_NAME add_auth_tables
```

## Custom Table Mapping

In monorepos or complex projects, you may want to use custom table names to avoid collisions or match existing conventions. Better Auth supports mapping its internal model names to custom table names using the `schema` option in the `drizzleAdapter`.

### Implementation

```typescript
// auth.ts
import * as schema from "./db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
      // Map internal models to custom table definitions
      user: schema.authUser,
      session: schema.authSession,
      account: schema.authAccount,
    },
  }),
  // ... other config
});
```

### Why use custom mapping?

1. **Monorepo clarity**: Prefixing tables with `auth_` or using `authUser` makes it clear which tables belong to the authentication system.
2. **Legacy compatibility**: If you're migrating to Better Auth and already have a `user` table, you can map Better Auth to `auth_user` instead.
3. **Database organization**: Keeps related tables grouped together in database explorers and documentation.

## D1 Best Practices

1. **Use INTEGER for timestamps** - D1 stores dates as Unix timestamps
2. **Always add indexes** - For frequently queried columns
3. **Use TEXT for IDs** - UUIDs are stored as text in SQLite
4. **CASCADE deletes** - Automatically clean up related records
5. **Unique constraints** - Prevent duplicate accounts

## TypeScript Types

```typescript
interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: number;
  updatedAt: number;
}

interface Account {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refreshToken: string | null;
  accessToken: string | null;
  expiresAt: number | null;
  tokenType: string | null;
  scope: string | null;
  idToken: string | null;
  sessionState: string | null;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  ipAddress: string | null;
  userAgent: string | null;
}

interface Passkey {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  name: string | null;
}
```

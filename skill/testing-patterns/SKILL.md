---
name: testing-patterns
description: Write and run tests for Cloudflare Workers and web applications. Use for unit tests, integration tests, E2E tests, and test patterns.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires Vitest, Playwright, Cloudflare Workers testing
allowed-tools: Bash(npm:*) Bash(pnpm:*) Bash(npx:*) Read Write
triggers:
  - "test"
  - "testing"
  - "vitest"
  - "playwright"
  - "e2e"
  - "unit test"
  - "integration test"
  - "mock"
  - "fixture"
  - "coverage"
  - "assertion"
  - "expect"
  - "describe"
---

# Testing Patterns for Cloudflare Workers

## Quick Start

```bash
# Install test dependencies
pnpm add -D vitest @vitest/ui jsdom @cloudflare/vitest-pool-workers

# Install E2E dependencies
pnpm add -D playwright @playwright/test
```

## Unit Testing with Vitest

### Worker Testing

```typescript
// tests/worker.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src";

const env = getMiniflareBindings();

describe("Worker", () => {
  beforeEach(() => {
    // Reset KV between tests
    env.TEST_KV.clear();
  });

  it("returns greeting", async () => {
    const request = new Request("http://localhost/test");
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello World");
  });

  it("handles POST requests", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ test: true }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toEqual({ received: true });
  });
});
```

### Durable Objects Testing

```typescript
// tests/rate-limiter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../src/rate-limiter";
import { unstable_dev } from "cloudflare:test";

describe("RateLimiter DO", () => {
  let DO: DurableObject;
  let id: DurableObjectId;
  let stub: DurableObjectStub;

  beforeEach(async () => {
    DO = unstable_dev(RateLimiter);
    id = env.RATE_LIMITER.idFromName("test");
    stub = env.RATE_LIMITER.get(id);
  });

  it("allows requests under limit", async () => {
    const response = await stub.fetch(
      new Request("http://localhost/check", {
        headers: { "CF-Connecting-IP": "127.0.0.1" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("blocks requests over limit", async () => {
    // Exceed limit
    for (let i = 0; i < 100; i++) {
      await stub.fetch(
        new Request("http://localhost/check", {
          headers: { "CF-Connecting-IP": "127.0.0.1" },
        }),
      );
    }

    const response = await stub.fetch(
      new Request("http://localhost/check", {
        headers: { "CF-Connecting-IP": "127.0.0.1" },
      }),
    );

    expect(response.status).toBe(429);
  });
});
```

### D1 Testing

```typescript
// tests/users.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUserService } from "../src/services/user";

describe("UserService", () => {
  const userService = createUserService(env.DB);

  beforeEach(async () => {
    // Clean up before each test
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("creates a user", async () => {
    const userId = await userService.createUser({
      email: "test@example.com",
      name: "Test User",
    });

    expect(userId).toBeDefined();

    const user = await userService.getUserById(userId);
    expect(user.email).toBe("test@example.com");
    expect(user.name).toBe("Test User");
  });

  it("validates email format", async () => {
    await expect(
      userService.createUser({ email: "invalid", name: "Test" }),
    ).rejects.toThrow("Invalid email");
  });
});
```

## Component Testing

### React Components with Vitest

```typescript
// tests/components/button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('bg-destructive');
  });

  it('handles clicks', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## E2E Testing with Playwright

### Page Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("user can sign in", async ({ page }) => {
    await page.goto("/sign-in");

    // Fill form
    await page.fill('[data-testid="email"]', "test@example.com");
    await page.fill('[data-testid="password"]', "password123");

    // Submit
    await page.click('[data-testid="sign-in-button"]');

    // Verify redirect
    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator('[data-testid="user-menu"]')).toContainText(
      "test@example.com",
    );
  });

  test("shows error with invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");

    await page.fill('[data-testid="email"]', "test@example.com");
    await page.fill('[data-testid="password"]', "wrong");
    await page.click('[data-testid="sign-in-button"]');

    await expect(page.locator('[data-testid="error"]')).toContainText(
      "Invalid credentials",
    );
  });
});
```

### API Testing

```typescript
// tests/e2e/api.spec.ts
import { test, expect } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("POST /api/users creates user", async ({ request }) => {
    const response = await request.post("/api/users", {
      data: {
        email: "new@example.com",
        name: "New User",
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.email).toBe("new@example.com");
  });

  test("GET /api/users requires auth", async ({ request }) => {
    const response = await request.get("/api/users");

    expect(response.status()).toBe(401);
  });
});
```

## Test Configuration

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { defineWorkersConfig } from "@cloudflare/vite-pool-workers";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    pool: "@cloudflare/vitest-pool-workers",
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

### Test Setup

```typescript
// tests/setup.ts
import { beforeAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "vitest-dom/extend-expect";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Global setup for database
beforeAll(async () => {
  // Run migrations
  await runMigrations();
});
```

## Testing Patterns

### Arrange-Act-Assert (AAA)

```typescript
it("updates user preferences", async () => {
  // Arrange
  const user = await createTestUser();
  const prefs = { theme: "dark", language: "en" };

  // Act
  await userService.updatePreferences(user.id, prefs);

  // Assert
  const updated = await userService.getUser(user.id);
  expect(updated.preferences).toEqual(prefs);
});
```

### Test Builders

```typescript
// tests/builders/user.ts
export class UserBuilder {
  private data: Partial<User> = {};

  static create() {
    return new UserBuilder();
  }

  withEmail(email: string) {
    this.data.email = email;
    return this;
  }

  withName(name: string) {
    this.data.name = name;
    return this;
  }

  asAdmin() {
    this.data.role = "admin";
    return this;
  }

  build(): User {
    return {
      id: crypto.randomUUID(),
      email: "test@example.com",
      name: "Test User",
      role: "user",
      ...this.data,
    };
  }
}

// Usage
const adminUser = UserBuilder.create()
  .withEmail("admin@example.com")
  .withName("Admin")
  .asAdmin()
  .build();
```

### Mock External Services

```typescript
// tests/mocks/polar.ts
import { vi } from "vitest";

export const mockPolar = {
  createCheckout: vi.fn().mockResolvedValue({
    url: "https://checkout.polar.sh/test",
  }),

  createSubscription: vi.fn().mockResolvedValue({
    id: "sub_test_123",
    status: "active",
  }),
};

// In test
vi.mock("../lib/polar", () => ({
  polarClient: mockPolar,
}));
```

## Validation Tools

Run `scripts/generate-test-scaffold.js` to create test boilerplate.

## Best Practices

1. **Test in isolation** - Each test should be independent
2. **Use descriptive names** - Test should read like documentation
3. **Mock external deps** - Don't rely on real APIs
4. **Test edge cases** - Error handling, empty data, limits
5. **Cover integration points** - API routes, database, auth
6. **E2E for critical paths** - Sign up, checkout, logout

## Coverage

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
```

## Reference Materials

- [references/MOCKING.md](references/MOCKING.md) - Advanced mocking strategies
- [references/E2E.md](references/E2E.md) - E2E test organization

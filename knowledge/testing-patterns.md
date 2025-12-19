# Testing Patterns Knowledge Base

This file contains validated patterns for testing Tanstack Start applications on Cloudflare Workers.
Patterns focus on reliability, edge performance, and accessibility.

---

## Pattern: Test with Real Bindings (No Mocking)

**Category**: Reliability
**Confidence**: High
**Source**: Cloudflare Workers Best Practices

### Problem

Mocking Cloudflare bindings (KV, D1, R2, DO) in tests can hide environment-specific bugs, such as eventual consistency issues in KV or SQL syntax differences in D1.

### Solution

Use real Cloudflare bindings in a dedicated test environment. Run tests against a local development server (miniflare/wrangler) that uses real (but separate) namespaces and databases.

### Example

```typescript
// ✅ CORRECT - Test with real D1 binding
test("loads user data from D1 database", async ({ page }) => {
  await page.goto("/users/123");
  // Verify data rendered from actual D1 test instance
  await expect(page.locator("h1")).toContainText("John Doe");
});

// ❌ WRONG - Mocking the binding
// jest.mock('env.DB', ...) // Avoid this for E2E tests
```

### Validation

Ensure `.env.test` is configured with dedicated test binding IDs.

---

## Pattern: Automated Accessibility Checks

**Category**: Quality
**Confidence**: High
**Source**: WCAG 2.1 AA Standards

### Problem

Accessibility regressions are easy to introduce but hard to catch manually during rapid development.

### Solution

Integrate automated accessibility scans into the E2E test suite using tools like `@axe-core/playwright`.

### Example

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home page has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Pattern: Edge Performance Validation

**Category**: Performance
**Confidence**: High
**Source**: Cloudflare Performance Benchmarks

### Problem

Edge deployments can suffer from high TTFB (Time to First Byte) or slow cold starts if the application bundle or server-side logic is not optimized.

### Solution

Include performance assertions in E2E tests to ensure the application meets edge-performance targets (e.g., TTFB < 200ms, Cold Start < 500ms).

### Example

```typescript
test("measures TTFB for server-rendered pages", async ({ page }) => {
  await page.goto("/");
  const timing = await page.evaluate(
    () => performance.getEntriesByType("navigation")[0],
  );
  // Time to First Byte should be < 200ms
  expect(timing.responseStart).toBeLessThan(200);
});
```

---

## Pattern: Visual Regression for Components

**Category**: UI/UX
**Confidence**: Medium
**Source**: shadcn/ui Design Consistency

### Problem

CSS changes can have unintended side effects across different components or themes (Dark Mode).

### Solution

Use Playwright's `toHaveScreenshot` to capture and compare component states across different viewports and themes.

### Example

```typescript
test("dark mode renders correctly", async ({ page }) => {
  await page.goto("/");
  await page.click('[data-testid="theme-toggle"]');
  await expect(page).toHaveScreenshot("home-dark-mode.png", {
    fullPage: true,
  });
});
```

---

## Pattern: Page Object Model for E2E

**Category**: Maintainability
**Confidence**: High
**Source**: Playwright Best Practices

### Problem

Tests that interact directly with selectors are fragile and hard to maintain when the UI structure changes.

### Solution

Abstract UI interactions into Page Objects to centralize selector management and common workflows.

### Example

```typescript
// e2e/pages/login.page.ts
export class LoginPage {
  constructor(private page: Page) {}
  async login(email, pass) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', pass);
    await this.page.click('button[type="submit"]');
  }
}

// e2e/auth.spec.ts
test("logs in user", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login("test@example.com", "password");
  await expect(page).toHaveURL("/dashboard");
});
```

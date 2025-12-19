# Prevention Patterns Knowledge Base

This file documents proactive techniques for preventing regressions and environment-specific bugs in Cloudflare Workers and Tanstack Start projects.

---

## Pattern: Hard Tools Validation (Static Analysis)

**Category**: Workflow
**Confidence**: High
**Source**: Edge Stack Best Practices

### Problem

Manual code reviews often miss subtle environment violations, such as using Node.js APIs in a Workers runtime.

### Solution

Use deterministic "Hard Tools" (grep-based scripts) that scan the codebase for forbidden patterns before every commit. These tools provide 100% detection for known signatures.

### Example

Execute `node scripts/validate-runtime.js` in a pre-commit hook to catch:

- `process.env` usage
- `fs`, `path`, `os` imports
- `Buffer` usage (non-web)
- Missing `await` on KV/R2 calls

---

## Pattern: Type-Level Environment Safety

**Category**: Development
**Confidence**: High
**Source**: TypeScript Best Practices

### Problem

Accessing environment variables or bindings via `any` or `Record<string, any>` leads to runtime crashes when a binding is renamed or missing in `wrangler.toml`.

### Solution

Always define a strict `Env` interface and use it in all Worker entry points and Server Functions.

### Example

```typescript
// src/env.d.ts
interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  API_SECRET: string;
}

// src/index.ts
export default {
  async fetch(req: Request, env: Env) {
    // env.DB is fully typed and guaranteed to exist by the compiler
  },
};
```

---

## Pattern: Snapshot-Based Regression Testing

**Category**: Testing
**Confidence**: Medium
**Source**: Playwright Documentation

### Problem

Visual or structural changes in shared components (like a navigation bar or footer) can break multiple pages without being noticed.

### Solution

Use automated snapshots (HTML or screenshots) for critical UI components and routes to detect unintended changes.

### Example

```typescript
test("navigation component matches baseline", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("nav");
  await expect(nav).toHaveScreenshot("nav-baseline.png");
});
```

---

## Pattern: Schema-Driven Input Validation

**Category**: Security
**Confidence**: High
**Source**: OWASP / Zod Documentation

### Problem

Improperly validated user input can lead to SQL injection, XSS, or runtime crashes in Server Functions.

### Solution

Use a validation library like `Zod` to define strict schemas for all external data (API requests, Server Function inputs, KV values).

### Example

```typescript
const UserInputSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

export const updateProfile = createServerFn("POST", async (data: unknown) => {
  const validated = UserInputSchema.parse(data); // Throws if invalid
  // validated is now typed and safe to use in D1
});
```

---

## Pattern: Bundle Size Quality Gate

**Category**: Performance
**Confidence**: High
**Source**: Cloudflare Performance Data

### Problem

Adding a heavy dependency (like `moment` or `lodash`) can silently double the Worker bundle size, leading to slow cold starts.

### Solution

Implement a CI check that verifies the production bundle size stays below a defined threshold (e.g., 50KB).

### Example

```bash
# bin/check-bundle.sh
BUNDLE_SIZE=$(du -k dist/index.js | cut -f1)
if [ "$BUNDLE_SIZE" -gt 50 ]; then
  echo "Error: Bundle size ($BUNDLE_SIZE KB) exceeds 50KB limit"
  exit 1
fi
```

---
name: shadcn-ui
description: Design, validate, and implement shadcn/ui components. Use for React component development, prop validation, and UI consistency.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires React, TypeScript, Tailwind CSS
allowed-tools: Read Write Bash(npm:*) Bash(pnpm:*) Bash(npx:*)
triggers:
  - "component"
  - "button"
  - "form"
  - "modal"
  - "dialog"
  - "dropdown"
  - "shadcn"
  - "radix"
  - "ui"
  - "design system"
  - "input"
  - "card"
  - "table"
  - "navigation"
  - "sidebar"
  - "toast"
  - "alert"
---

# shadcn/ui Development

## Quick Start

1. Install components: `npx shadcn-ui@latest add button`
2. Import: `import { Button } from "@/components/ui/button"`
3. Use with variants: `<Button variant="destructive">Delete</Button>`

## Core Principles

### 1. Always Check Real Props

Never guess component props. Use MCP to validate:

```bash
# Check component props
npx shadcn-ui get-component Button
# Get examples
npx shadcn-ui get-examples button-demo
```

### 2. Customize with cn() Utility

Always use the `cn()` helper for conditional classes:

```typescript
import { cn } from "@/lib/utils"

// ✅ CORRECT: With cn()
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

// ❌ WRONG: Without cn()
className={`base-classes ${variant} ${size} ${className}`}
```

### 3. Follow Design System

- Use semantic color tokens (e.g., `destructive`, `muted`)
- Respect font scale (text-sm, text-base, text-lg)
- Maintain consistent spacing (p-4, m-2, gap-2)

### 4. Monorepo Organization

In monorepos, centralize the `cn()` utility to ensure consistent styling behavior across all applications and shared packages.

```typescript
// packages/utils/src/index.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Usage in components:

```typescript
import { cn } from "@monorepo/utils"; // Shared package import
```

## Common Components

### Button

```typescript
// Available props
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

// Usage examples
<Button variant="default">Default</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="outline" asChild>
  <Link href="/login">Login</Link>
</Button>
```

### Card

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

// Usage
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Footer actions */}
  </CardFooter>
</Card>
```

## Validation

Run `scripts/validate-components.js` to check for:

- Hallucinated props
- Missing variant/size combinations
- Inconsistent patterns

## Customization

See `assets/component-templates/` for example customizations:

- Custom button styles
- Extended variants
- Animated components

## Anti-Patterns

- Don't use `color` prop - use `variant`
- Don't use `loading` prop - combine `disabled` + spinner
- Don't create duplicate components - extend existing ones

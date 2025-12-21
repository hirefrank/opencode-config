---
description: Scaffold shadcn/ui components with distinctive design, accessibility, and animation best practices built-in. Prevents generic aesthetics from the start.
---

# Component Generator Command

<command_purpose> Generate shadcn/ui components with distinctive design patterns, deep customization, accessibility features, and engaging animations built-in. Prevents generic "AI aesthetic" by providing branded templates from the start. </command_purpose>

## Introduction

<role>Senior Component Architect with expertise in shadcn/ui, React 19 with hooks, Tailwind CSS, accessibility, and distinctive design patterns</role>

**Design Philosophy**: Start with distinctive, accessible, engaging components rather than fixing generic patterns later.

## Prerequisites

<requirements>
- Tanstack Start project with React 19
- shadcn/ui component library installed
- Tailwind 4 CSS configured with custom theme (or will be created)
- (Optional) shadcn/ui MCP server for component API validation
- (Optional) Existing `hooks/useDesignSystem.ts` for consistent patterns
</requirements>

## Command Usage

```bash
/f-component <type> <name> [options]
```

### Arguments:

- `<type>`: Component type (button, card, form, modal, hero, navigation, etc.)
- `<name>`: Component name in PascalCase (e.g., `PrimaryButton`, `FeatureCard`)
- `[options]`: Optional flags:
  - `--theme <dark|light|custom>`: Theme variant
  - `--animations <minimal|standard|rich>`: Animation complexity
  - `--accessible`: Include enhanced accessibility features (default: true)
  - `--output <path>`: Custom output path (default: `components/`)

### Examples:

```bash
# Generate primary button component
/f-component button PrimaryButton

# Generate feature card with rich animations
/f-component card FeatureCard --animations rich

# Generate hero section with custom theme
/f-component hero LandingHero --theme custom

# Generate modal with custom output path
/f-component modal ConfirmDialog --output components/dialogs/
```

## Main Tasks

### 1. Project Context Analysis

<thinking>
First, I need to understand existing design system, theme configuration, and component patterns.
This ensures generated components match existing project aesthetics.
</thinking>

#### Immediate Actions:

<task_list>

- [ ] Check for `tailwind.config.ts` and extract custom theme (fonts, colors, animations)
- [ ] Check for `hooks/useDesignSystem.ts` and extract existing variants
- [ ] Check for `app.config.ts` and extract shadcn/ui global customization
- [ ] Scan existing components for naming conventions and structure patterns
- [ ] Determine if design system is established or needs creation

</task_list>

#### Output Summary:

<summary_format>
📦 **Project Context**:

- Custom fonts: Found/Not Found (Inter ❌ or Custom ✅)
- Brand colors: Found/Not Found (Purple ❌ or Custom ✅)
- Design system composable: Exists/Missing
- Component count: X components found
- Naming convention: Detected pattern
  </summary_format>

### 2. Validate Component Type with MCP (if available)

<thinking>
If shadcn/ui MCP is available, validate that the requested component type exists
and get accurate props/slots before generating.
</thinking>

#### MCP Validation:

<mcp_workflow>

If shadcn/ui MCP available:

1. Query `shadcn-ui.list_components()` to get available components
2. Map component type to shadcn/ui component:
   - `button` → `Button`
   - `card` → `Card`
   - `modal` → `Dialog`
   - `form` → `UForm` + `Input`/`UTextarea`/etc.
   - `hero` → Custom layout with `Button`, `Card`
   - `navigation` → `UTabs` or custom
3. Query `shadcn-ui.get_component("Button")` for accurate props
4. Use real props in generated component (prevent hallucination)

If MCP not available:

- Use documented shadcn/ui API
- Include comment: "// TODO: Verify props with shadcn/ui docs"

</mcp_workflow>

### 3. Generate Component with Design Best Practices

<thinking>
Generate React component with:
1. Distinctive typography (custom fonts, not Inter)
2. Brand colors (custom palette, not purple)
3. Rich animations (transitions, micro-interactions)
4. Deep shadcn/ui customization (className + cn() utility)
5. Accessibility features (ARIA, keyboard, focus states)
6. Responsive design
</thinking>

#### Component Templates by Type:

#### Button Component

<button_template>

```tsx
// app/components/PrimaryButton.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PrimaryButtonProps {
  /** Button label */
  label?: string;
  /** Icon component (Lucide React) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Button size */
  size?: "sm" | "md" | "lg" | "xl";
  /** Full width */
  fullWidth?: boolean;
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Children override label */
  children?: React.ReactNode;
}

export function PrimaryButton({
  label,
  icon: Icon,
  loading = false,
  disabled = false,
  size = "lg",
  fullWidth = false,
  onClick,
  children,
}: PrimaryButtonProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
    xl: "px-10 py-5 text-xl",
  };

  return (
    <Button
      variant="default"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "font-heading tracking-wide rounded-full shadow-lg hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "hover:scale-105 hover:-rotate-1",
        "active:scale-95 active:rotate-0",
        "focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        "motion-safe:hover:scale-105",
        "motion-reduce:hover:bg-primary-700",
        sizeClasses[size],
        fullWidth && "w-full",
        "group",
      )}
    >
      <span className="inline-flex items-center gap-2">
        {children || label}

        {/* Animated icon on hover */}
        {Icon && !loading && (
          <Icon className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5" />
        )}

        {/* Loading spinner */}
        {loading && <Loader2 className="animate-spin" />}
      </span>
    </Button>
  );
}
```

**Usage Example**:

```tsx
import { PrimaryButton } from "@/components/PrimaryButton";
import { ArrowRight } from "lucide-react";

export default function MyPage() {
  const handleClick = () => {
    console.log("Clicked!");
  };

  return (
    <PrimaryButton
      label="Get Started"
      icon={ArrowRight}
      size="lg"
      onClick={handleClick}
    />
  );
}
```

</button_template>

#### Card Component

<card_template>

```tsx
// app/components/FeatureCard.tsx
import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  /** Card title */
  title: string;
  /** Card description */
  description?: string;
  /** Icon component (Lucide React) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Enable hover effects */
  hoverable?: boolean;
  /** Card variant */
  variant?: "default" | "elevated" | "outlined";
  /** Children for custom content */
  children?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  hoverable = true,
  variant = "elevated",
  children,
  footer,
}: FeatureCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className={cn(
        "bg-white dark:bg-brand-midnight rounded-2xl",
        variant === "outlined" && "ring-1 ring-brand-coral/20",
        variant === "elevated" ? "shadow-xl hover:shadow-2xl" : "shadow-md",
        "transition-all duration-300",
        hoverable && "hover:-translate-y-2 hover:rotate-1 cursor-pointer",
        "motion-safe:hover:-translate-y-2",
        "motion-reduce:hover:shadow-xl",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-8 bg-gradient-to-br from-white to-gray-50 dark:from-brand-midnight dark:to-gray-900">
        <div className="space-y-4">
          {/* Icon */}
          {Icon && (
            <div
              className={cn(
                "inline-flex items-center justify-center",
                "w-16 h-16 rounded-2xl",
                "bg-gradient-to-br from-brand-coral to-brand-ocean",
                "transition-transform duration-300",
                isHovered && "scale-110 rotate-3",
              )}
            >
              <Icon className="w-8 h-8 text-white" />
            </div>
          )}

          {/* Title */}
          <h3
            className={cn(
              "font-heading text-2xl",
              "text-brand-midnight dark:text-white",
              "transition-colors duration-300",
              isHovered && "text-brand-coral",
            )}
          >
            {title}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {description}
            </p>
          )}

          {/* Custom content */}
          {children}
        </div>
      </CardContent>

      {/* Footer */}
      {footer && (
        <CardFooter className="pt-4 border-t border-gray-200 dark:border-gray-700">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
```

**Usage Example**:

```tsx
import { FeatureCard } from "@/components/FeatureCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Rocket } from "lucide-react";

export default function MyPage() {
  return (
    <FeatureCard
      title="Fast Deployment"
      description="Deploy to the edge in seconds with Cloudflare Workers"
      icon={Rocket}
      hoverable
      footer={<PrimaryButton label="Learn More" size="sm" />}
    />
  );
}
```

</card_template>

#### Form Component

<form_template>

```tsx
// app/components/ContactForm.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { User, Mail, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

// Validation schema
const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type FormData = z.infer<typeof schema>;

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setShowSuccess(false);
    setShowError(false);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Form submitted:", data);

      setShowSuccess(true);
      reset();

      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (error) {
      setShowError(true);
      setErrorMessage("Failed to submit form. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Alert */}
      {showSuccess && (
        <Alert
          className={cn(
            "rounded-xl p-4 border-green-500 bg-green-50 dark:bg-green-950",
            "animate-in slide-in-from-top duration-300",
          )}
        >
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            Your message has been sent successfully.
          </AlertDescription>
          <button
            onClick={() => setShowSuccess(false)}
            className="absolute top-4 right-4 text-green-600 hover:text-green-800"
          >
            ×
          </button>
        </Alert>
      )}

      {/* Error Alert */}
      {showError && (
        <Alert
          className={cn(
            "rounded-xl p-4 border-red-500 bg-red-50 dark:bg-red-950",
            "animate-in slide-in-from-top duration-300",
          )}
        >
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
          <button
            onClick={() => setShowError(false)}
            className="absolute top-4 right-4 text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name" className="font-medium text-sm">
            Name <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              id="name"
              placeholder="Your name"
              {...register("name")}
              className={cn(
                "pl-11 rounded-lg px-4 py-3",
                "transition-all duration-200 focus:ring-2 focus:ring-brand-coral",
                errors.name && "border-red-500",
              )}
            />
          </div>
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="font-medium text-sm">
            Email <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              {...register("email")}
              className={cn(
                "pl-11 rounded-lg px-4 py-3",
                "transition-all duration-200 focus:ring-2 focus:ring-brand-coral",
                errors.email && "border-red-500",
              )}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Message Field */}
        <div className="space-y-2">
          <Label htmlFor="message" className="font-medium text-sm">
            Message <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="message"
            placeholder="Your message..."
            rows={5}
            {...register("message")}
            className={cn(
              "rounded-lg px-4 py-3",
              "transition-all duration-200 focus:ring-2 focus:ring-brand-coral",
              errors.message && "border-red-500",
            )}
          />
          {errors.message && (
            <p className="text-sm text-red-500">{errors.message.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full font-heading rounded-full px-8 py-4",
            "transition-all duration-300",
            "hover:scale-105 hover:shadow-xl",
            "active:scale-95",
            "motion-safe:hover:scale-105",
            "motion-reduce:hover:bg-primary-700",
            "group",
          )}
        >
          <span className="inline-flex items-center gap-2">
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5" />
            )}
            {isSubmitting ? "Sending..." : "Send Message"}
          </span>
        </Button>
      </form>
    </div>
  );
}
```

</form_template>

#### Hero Component

<hero_template>

```tsx
// app/components/LandingHero.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight } from "lucide-react";

interface LandingHeroProps {
  /** Hero title */
  title: string;
  /** Hero subtitle */
  subtitle?: string;
  /** Primary CTA label */
  primaryCta?: string;
  /** Secondary CTA label */
  secondaryCta?: string;
  /** Primary CTA click handler */
  onPrimaryClick?: () => void;
  /** Secondary CTA click handler */
  onSecondaryClick?: () => void;
  /** Additional content */
  children?: React.ReactNode;
}

export function LandingHero({
  title,
  subtitle,
  primaryCta = "Get Started",
  secondaryCta = "Learn More",
  onPrimaryClick,
  onSecondaryClick,
  children,
}: LandingHeroProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-cream via-white to-brand-ocean/10" />

      {/* Animated Gradient Orbs */}
      <div
        className="absolute top-20 left-20 w-96 h-96 bg-brand-coral/20 rounded-full blur-3xl animate-pulse"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-brand-ocean/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
        aria-hidden="true"
      />

      {/* Subtle Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center space-y-8">
          {/* Animated Badge */}
          <div
            className={cn(
              "inline-flex items-center gap-2",
              "px-4 py-2 rounded-full",
              "bg-brand-coral/10 border border-brand-coral/20",
              "text-brand-coral font-medium",
              "animate-in slide-in-from-top duration-500",
            )}
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="text-sm">New: Now on Cloudflare Workers</span>
          </div>

          {/* Title */}
          <h1
            className={cn(
              "font-heading text-6xl sm:text-7xl lg:text-8xl",
              "tracking-tighter leading-none",
              "text-brand-midnight dark:text-white",
              "animate-in slide-in-from-top duration-700",
            )}
            style={{ animationDelay: "100ms" }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p
              className={cn(
                "max-w-2xl mx-auto",
                "text-xl sm:text-2xl leading-relaxed",
                "text-gray-700 dark:text-gray-300",
                "animate-in slide-in-from-top duration-700",
              )}
              style={{ animationDelay: "200ms" }}
            >
              {subtitle}
            </p>
          )}

          {/* CTAs */}
          <div
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-4",
              "animate-in slide-in-from-top duration-700",
            )}
            style={{ animationDelay: "300ms" }}
          >
            <Button
              size="lg"
              onClick={onPrimaryClick}
              className={cn(
                "font-heading tracking-wide rounded-full px-10 py-5",
                "transition-all duration-300",
                "hover:scale-110 hover:-rotate-2 hover:shadow-2xl",
                "active:scale-95 active:rotate-0",
                "motion-safe:hover:scale-110",
                "group",
              )}
            >
              <span className="inline-flex items-center gap-2">
                {primaryCta}
                <ArrowRight className="transition-transform duration-300 group-hover:translate-x-2" />
              </span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={onSecondaryClick}
              className={cn(
                "font-sans rounded-full",
                "transition-all duration-300",
                "hover:scale-105 hover:shadow-lg",
                "active:scale-95",
              )}
            >
              {secondaryCta}
            </Button>
          </div>

          {/* Additional content */}
          {children && <div className="mt-12">{children}</div>}
        </div>
      </div>
    </div>
  );
}
```

</hero_template>

### 4. Create Design System Composable (if missing)

<thinking>
If design system composable doesn't exist, generate it to ensure consistency
across all components.
</thinking>

<design_system_composable>

```typescript
// hooks/useDesignSystem.ts
import { cn } from "@/lib/utils";

export const useDesignSystem = () => {
  /**
   * Button Variants
   */
  const button = {
    primary: {
      className: cn(
        "font-heading tracking-wide rounded-full px-8 py-4",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-300 hover:scale-105 hover:-rotate-1",
        "active:scale-95 active:rotate-0",
      ),
    },

    secondary: {
      variant: "outline" as const,
      className: cn(
        "font-sans rounded-lg",
        "transition-colors duration-200",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
      ),
    },

    ghost: {
      variant: "ghost" as const,
      className: cn("font-sans", "transition-colors duration-200"),
    },
  };

  /**
   * Card Variants
   */
  const card = {
    elevated: {
      className: cn(
        "bg-white dark:bg-brand-midnight",
        "rounded-2xl shadow-xl hover:shadow-2xl",
        "p-8",
        "transition-all duration-300 hover:-translate-y-1",
      ),
    },

    outlined: {
      className: cn(
        "bg-white dark:bg-brand-midnight",
        "ring-1 ring-brand-coral/20",
        "rounded-2xl p-8",
        "transition-all duration-300 hover:ring-brand-coral/40",
      ),
    },
  };

  /**
   * Animation Presets
   */
  const animations = {
    fadeIn: "animate-in fade-in duration-500",
    slideUp: "animate-in slide-in-from-bottom duration-500",
    slideDown: "animate-in slide-in-from-top duration-500",
    scaleIn: "animate-in zoom-in duration-300",
    hover: {
      scale: "transition-transform duration-300 hover:scale-105",
      lift: "transition-all duration-300 hover:-translate-y-1",
      shadow: "transition-shadow duration-300 hover:shadow-xl",
    },
  };

  return {
    button,
    card,
    animations,
  };
};

// Usage example:
// import { useDesignSystem } from '@/hooks/useDesignSystem'
// import { Button } from '@/components/ui/button'
//
// export function MyComponent() {
//   const { button } = useDesignSystem()
//
//   return <Button className={button.primary.className}>Click me</Button>
// }
```

</design_system_composable>

### 5. Generate Component Files

<thinking>
Create the actual files in the filesystem with proper naming and structure.
</thinking>

#### File Creation:

<file_creation_steps>

1. **Determine output path**:
   - Default: `components/<ComponentName>.tsx`
   - Custom: User-specified `--output` path

2. **Generate component file**:
   - Use template for component type
   - Replace placeholders with actual names
   - Include TypeScript types
   - Include JSDoc comments
   - Include usage examples in comments

3. **Update or create design system hook** (if needed):
   - Path: `hooks/useDesignSystem.ts`
   - Add new variants if applicable

4. **Generate Storybook story** (optional, if Storybook detected):
   - Path: `components/<ComponentName>.stories.tsx`

5. **Generate test file** (optional):
   - Path: `components/<ComponentName>.test.tsx`

</file_creation_steps>

### 6. Validate Generated Component

<thinking>
Run validation to ensure generated component follows best practices.
</thinking>

#### Validation Checks:

<validation_checklist>

- [ ] Uses custom fonts (not Inter/Roboto)
- [ ] Uses brand colors (not default purple)
- [ ] Includes animations/transitions
- [ ] Has hover states on interactive elements
- [ ] Has focus states (focus-visible rings)
- [ ] Respects reduced motion (motion-safe/motion-reduce)
- [ ] Includes ARIA labels where needed
- [ ] Uses shadcn/ui components (not reinventing)
- [ ] Deep customization with `ui` prop
- [ ] TypeScript props interface
- [ ] JSDoc comments
- [ ] Accessible (keyboard navigation, screen readers)
- [ ] Responsive design
- [ ] Dark mode support

</validation_checklist>

## Output Format

<output_format>

````
✅ Component Generated: <ComponentName>

📁 Files Created:
- app/components/<ComponentName>.tsx (primary component)
- hooks/useDesignSystem.ts (updated/created)

🎨 Design Features:
✅ Custom typography (font-heading)
✅ Brand colors (brand-coral, brand-ocean)
✅ Rich animations (hover:scale-105, transitions)
✅ Deep shadcn/ui customization (ui prop)
✅ Accessibility features (ARIA, focus states)
✅ Reduced motion support (motion-safe)
✅ Responsive design
✅ Dark mode support

📖 Usage Example:

```tsx
import { <ComponentName> } from '#components';

// Your component logic

  <<ComponentName>
    prop1="value1"
    prop2="value2"
    onEvent="handleEvent"
  />
````

🔍 Next Steps:

1. Review generated component in `components/<ComponentName>.tsx`
2. Customize props/styles as needed
3. Test accessibility with keyboard navigation
4. Test animations with reduced motion preference
5. Run component in dev environment to verify

```

</output_format>

## Success Criteria

✅ Component generated successfully when:
- File created at correct path
- Uses distinctive design patterns (not generic)
- Includes all accessibility features
- Includes rich animations
- TypeScript types included
- Usage examples in comments
- Follows project conventions

## Post-Generation Actions

After generating component:
1. **Review code**: Open generated file and review
2. **Test component**: Add to a page and test interactions
3. **Validate design**: Run `/f-design-review` if needed
4. **Document**: Add to component library docs/Storybook

## Notes

- This command generates **starting templates** with best practices built-in
- Components are **fully customizable** after generation
- **Design system composable** ensures consistency across all generated components
- Use **shadcn/ui MCP** (if available) to prevent prop hallucination
- All generated components follow **WCAG 2.1 AA** accessibility standards
- Generated components respect **user's reduced motion preference**
```

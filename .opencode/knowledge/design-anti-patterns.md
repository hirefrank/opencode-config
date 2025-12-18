# Design Anti-Patterns & Distinctive Design

Preventing "distributional convergence" - the tendency of AI-generated interfaces to default to overused patterns.

---

## The Core Problem

When asked to build interfaces without guidance, LLMs sample from high-probability patterns in training data, resulting in:
- ❌ Inter/Roboto fonts (80%+ of websites)
- ❌ Purple gradients on white backgrounds
- ❌ Minimal animations and interactions
- ❌ Default component props
- ❌ Generic gray color schemes
- ❌ Glass-morphism effects (overused)

**Result**: AI-generated interfaces that are immediately recognizable—and dismissible.

---

## Forbidden Patterns (Never Use)

### Typography
```tsx
// ❌ FORBIDDEN: Inter/Roboto fonts
fontFamily: {
  sans: ['Inter', 'system-ui']  // 80%+ of sites use this
}

<h1 className="font-sans">Title</h1>  // Inter by default

// ✅ REQUIRED: Custom fonts
fontFamily: {
  sans: ['Space Grotesk', 'system-ui'],      // Body text
  heading: ['Archivo Black', 'system-ui'],   // Headings
  mono: ['JetBrains Mono', 'monospace']      // Code
}

<h1 className="font-heading tracking-tight">Title</h1>
```

### Colors
```tsx
// ❌ FORBIDDEN: Purple gradients
<div className="bg-gradient-to-r from-purple-500 to-purple-600">
<div className="bg-purple-600 hover:bg-purple-700">

// ❌ FORBIDDEN: Default grays
<div className="bg-gray-50 text-gray-900">

// ✅ REQUIRED: Custom brand palette
<div className="bg-gradient-to-br from-brand-coral via-brand-ocean to-brand-sunset">

// tailwind.config.ts
colors: {
  brand: {
    coral: '#FF6B6B',      // Primary action color
    ocean: '#4ECDC4',      // Secondary/accent
    sunset: '#FFE66D',     // Highlight/attention
    midnight: '#2C3E50',   // Dark mode base
    cream: '#FFF5E1'       // Light mode base
  }
}
```

### Animations
```tsx
// ❌ FORBIDDEN: No animations
<Button>Click me</Button>

// ❌ FORBIDDEN: Minimal hover only
<Button className="hover:bg-blue-600">Click me</Button>

// ✅ REQUIRED: Rich micro-interactions
<Button
  className="
    transition-all duration-300 ease-out
    hover:scale-105 hover:shadow-xl hover:-rotate-1
    active:scale-95 active:rotate-0
    group
  "
>
  <span className="inline-flex items-center gap-2">
    Click me
    <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
  </span>
</Button>
```

### Backgrounds
```tsx
// ❌ FORBIDDEN: Solid white/gray
<div className="bg-white">Content</div>
<div className="bg-gray-50">Content</div>

// ✅ REQUIRED: Atmospheric backgrounds
<div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-ocean/10">
  {/* Subtle pattern overlay */}
  <div
    className="absolute inset-0 opacity-5"
    style={{
      backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
      backgroundSize: '20px 20px'
    }}
  />
  <div className="relative z-10">Content</div>
</div>
```

### Components
```tsx
// ❌ FORBIDDEN: Default props only
<Card>
  <CardContent>
    <p>Content</p>
  </CardContent>
</Card>

<Button>Action</Button>

// ✅ REQUIRED: Deep customization
<Card
  className={cn(
    "bg-white dark:bg-brand-midnight",
    "ring-1 ring-brand-coral/20",
    "rounded-2xl shadow-xl hover:shadow-2xl",
    "transition-all duration-300 hover:-translate-y-1"
  )}
>
  <CardContent className="p-8">
    <p>Content</p>
  </CardContent>
</Card>

<Button
  className={cn(
    "font-heading tracking-wide",
    "rounded-full px-8 py-4",
    "transition-all duration-300 hover:scale-105"
  )}
>
  Action
</Button>
```

---

## Design Context Framework (4 Dimensions)

Before implementing ANY frontend task, complete this checklist:

### Dimension 1: Purpose & Audience
- Who is the primary user? (developer, business user, consumer)
- What problem does this interface solve?
- What's the user's emotional state? (rushed, relaxed, focused)
- What action should they take?

### Dimension 2: Tone & Direction
Pick an EXTREME direction - not "modern and clean" but specific:

| Tone | Visual Implications |
|------|---------------------|
| **Brutalist** | Raw, unpolished, intentionally harsh, exposed grid |
| **Maximalist** | Dense, colorful, overwhelming (in a good way), layered |
| **Retro-Futuristic** | 80s/90s computing meets future tech, neon, CRT effects |
| **Editorial** | Magazine-like, typography-forward, lots of whitespace |
| **Playful** | Rounded, bouncy, animated, colorful, friendly |
| **Corporate Premium** | Restrained, sophisticated, expensive-feeling |
| **Developer-Focused** | Monospace, terminal-inspired, dark themes, technical |

❌ Avoid: "modern", "clean", "professional" (too generic)
✅ Choose: Specific aesthetic with clear visual implications

### Dimension 3: Technical Constraints
- Bundle size matters (edge deployment)
- shadcn/ui components required
- Tailwind CSS only (minimal custom CSS)
- React 19 with Server Functions
- Must work on Workers runtime

### Dimension 4: Differentiation
The key question: "What makes this UNFORGETTABLE?"

❌ Generic: "A nice-looking dashboard"
✅ Distinctive: "A dashboard that feels like a high-end car's instrument panel"

---

## Distinctiveness Score (Self-Assessment)

Rate your design on these dimensions:

| Category | Score /25 | Criteria |
|----------|-----------|----------|
| **Typography** | /25 | Custom fonts, hierarchy, sizing, tracking |
| **Colors** | /25 | Brand palette, contrast, distinctive gradients |
| **Animations** | /25 | Transitions, micro-interactions, engagement |
| **Components** | /25 | Customization depth, consistency |

**Target Scores**:
- 35/100 - Generic, AI-generated aesthetic (UNACCEPTABLE)
- 75/100 - Distinctive, branded (MINIMUM ACCEPTABLE)
- 90/100 - Excellent, highly polished (GOOD)
- 95/100 - Outstanding, delightful (TARGET)

---

## Aesthetic Commitments Template

Before coding frontend, document:

```markdown
## Design Context

**Purpose**: [What problem does this solve?]
**Audience**: [Who uses this and in what context?]
**Tone**: [Pick ONE extreme direction from table above]
**Differentiation**: [What makes this UNFORGETTABLE?]

## Aesthetic Commitments

- Typography: [e.g., "Space Grotesk body + Archivo Black headings"]
- Color: [e.g., "Coral primary, ocean accent, cream backgrounds"]
- Motion: [e.g., "Scale on hover, staggered list reveals"]
- Layout: [e.g., "Asymmetric hero, card grid with varying heights"]
```

---

## Tailwind Config Template

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      // Custom color palette (not default purple)
      colors: {
        brand: {
          coral: '#FF6B6B',
          ocean: '#4ECDC4',
          sunset: '#FFE66D',
          midnight: '#2C3E50',
          cream: '#FFF5E1'
        }
      },

      // Distinctive fonts (not Inter/Roboto)
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        heading: ['Archivo Black', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },

      // Custom animation presets
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'bounce-subtle': 'bounceSubtle 1s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        }
      },

      // Custom shadows
      boxShadow: {
        'brand': '0 4px 20px rgba(255, 107, 107, 0.2)',
        'brand-lg': '0 10px 40px rgba(255, 107, 107, 0.3)',
      }
    }
  }
}
```

---

## Success Metrics

After implementing design, verify:

- ✅ 0% usage of Inter/Roboto fonts
- ✅ 0% usage of default purple gradients
- ✅ 100% of interactive elements have hover states
- ✅ 100% of async actions have loading states
- ✅ Custom brand colors in all components
- ✅ Atmospheric backgrounds (not solid white/gray)
- ✅ All shadcn/ui components deeply customized with cn()
- ✅ Reduced motion support (motion-safe: / motion-reduce:)

---

## Font Recommendations

### For Developer Tools
- JetBrains Mono (code)
- IBM Plex Sans (labels)
- Space Grotesk (body)

### For Marketing Sites
- Archivo Black (headings)
- Space Grotesk (body)
- Fraunces (accents)

### For SaaS Dashboards
- Geist Sans (body)
- Geist Mono (data)
- Custom heading font

---

## Animation Guidelines

### Performance (Edge-Safe)
Only animate these properties (GPU accelerated):
- `transform` (scale, rotate, translate)
- `opacity`

Avoid animating:
- `width`, `height` (causes layout reflow)
- `margin`, `padding` (causes layout reflow)
- `box-shadow` (use opacity on pseudo-element instead)

### Standard Hover Pattern
```tsx
className="
  transition-all duration-300 ease-out
  hover:scale-105 hover:shadow-xl
  active:scale-95
"
```

### Staggered List Animation
```tsx
{items.map((item, index) => (
  <div
    key={item.id}
    style={{ transitionDelay: `${index * 50}ms` }}
    className="transition-all duration-300 hover:scale-105"
  >
    {item.content}
  </div>
))}
```

### Reduced Motion Support
```tsx
className="
  motion-safe:hover:scale-105
  motion-reduce:hover:bg-gray-100
"
```

---

Source: Consolidated from frontend-design-specialist, es-design-review, es-component commands.

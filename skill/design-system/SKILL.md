# Design System Patterns

Reference knowledge for Tailwind CSS theming, shadcn/ui customization, and distinctive design tokens.

**Goal:** Avoid generic "AI aesthetic" (Inter fonts, purple gradients, minimal animations).

## Color Palettes

### Coral Ocean (Warm & Vibrant)
```typescript
colors: {
  brand: {
    coral: {
      DEFAULT: '#FF6B6B',
      50: '#FFF5F5', 100: '#FFE3E3', 200: '#FFC9C9', 300: '#FFA8A8',
      400: '#FF8787', 500: '#FF6B6B', 600: '#FA5252', 700: '#F03E3E',
      800: '#E03131', 900: '#C92A2A',
    },
    ocean: {
      DEFAULT: '#4ECDC4',
      50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4',
      400: '#2DD4BF', 500: '#4ECDC4', 600: '#0D9488', 700: '#0F766E',
      800: '#115E59', 900: '#134E4A',
    },
    sunset: {
      DEFAULT: '#FFE66D',
      50: '#FFFEF0', 100: '#FFFACD', 200: '#FFF59D', 300: '#FFF176',
      400: '#FFEE58', 500: '#FFE66D', 600: '#FDD835', 700: '#FBC02D',
      800: '#F9A825', 900: '#F57F17',
    },
  }
}
```

### Midnight Gold (Elegant & Professional)
```typescript
colors: {
  brand: {
    midnight: {
      DEFAULT: '#2C3E50',
      50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
      400: '#94A3B8', 500: '#2C3E50', 600: '#475569', 700: '#334155',
      800: '#1E293B', 900: '#0F172A',
    },
    gold: {
      DEFAULT: '#D4AF37',
      50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
      400: '#FBBF24', 500: '#D4AF37', 600: '#D97706', 700: '#B45309',
      800: '#92400E', 900: '#78350F',
    }
  }
}
```

### Forest Sage (Natural & Calming)
```typescript
colors: {
  brand: {
    forest: {
      DEFAULT: '#2D5F3F',
      50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC',
      400: '#4ADE80', 500: '#2D5F3F', 600: '#16A34A', 700: '#15803D',
      800: '#166534', 900: '#14532D',
    },
    sage: {
      DEFAULT: '#8B9A7C',
      50: '#F7F7F5', 100: '#EAEAE5', 200: '#D4D4C8', 300: '#B8B8A7',
      400: '#9C9C88', 500: '#8B9A7C', 600: '#6F7F63', 700: '#5A664F',
      800: '#454D3F', 900: '#313730',
    }
  }
}
```

## Font Pairings

### Modern (Clean & Contemporary)
```typescript
fontFamily: {
  sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
  heading: ['Archivo Black', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace']
}
```

### Classic (Timeless & Professional)
```typescript
fontFamily: {
  sans: ['Crimson Pro', 'Georgia', 'serif'],
  heading: ['Playfair Display', 'Georgia', 'serif'],
  mono: ['IBM Plex Mono', 'monospace']
}
```

### Playful (Creative & Energetic)
```typescript
fontFamily: {
  sans: ['DM Sans', 'system-ui', 'sans-serif'],
  heading: ['Fredoka', 'system-ui', 'sans-serif'],
  mono: ['Fira Code', 'monospace']
}
```

### Technical (Precise & Modern)
```typescript
fontFamily: {
  sans: ['Inter Display', 'system-ui', 'sans-serif'],
  heading: ['JetBrains Mono', 'monospace'],
  mono: ['Source Code Pro', 'monospace']
}
```

## Animation Presets

```typescript
animation: {
  'fade-in': 'fadeIn 0.5s ease-out',
  'fade-out': 'fadeOut 0.3s ease-in',
  'slide-up': 'slideUp 0.4s ease-out',
  'slide-down': 'slideDown 0.4s ease-out',
  'slide-left': 'slideLeft 0.4s ease-out',
  'slide-right': 'slideRight 0.4s ease-out',
  'scale-in': 'scaleIn 0.3s ease-out',
  'scale-out': 'scaleOut 0.2s ease-in',
  'bounce-subtle': 'bounceSubtle 1s ease-in-out infinite',
  'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  'spin-slow': 'spin 3s linear infinite',
},
keyframes: {
  fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
  fadeOut: { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
  slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
  slideDown: { '0%': { transform: 'translateY(-20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
  scaleIn: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
  bounceSubtle: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
}
```

## Complete tailwind.config.ts Template

```typescript
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default <Partial<Config>>{
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', ...defaultTheme.fontFamily.sans],
        heading: ['Archivo Black', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        brand: {
          // Add chosen palette here
        },
      },
      boxShadow: {
        'brand-sm': '0 2px 8px rgba(255, 107, 107, 0.1)',
        'brand': '0 4px 20px rgba(255, 107, 107, 0.2)',
        'brand-lg': '0 10px 40px rgba(255, 107, 107, 0.3)',
        'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      // Add animation presets here
    },
  },
};
```

## shadcn/ui Customization

```typescript
// app.config.ts
export default defineAppConfig({
  ui: {
    primary: 'brand-coral',
    secondary: 'brand-ocean',
    button: {
      rounded: 'rounded-lg',
      font: 'font-heading tracking-wide',
    },
    card: {
      background: 'bg-white dark:bg-brand-midnight-800',
      rounded: 'rounded-2xl',
      shadow: 'shadow-lg',
    },
    input: {
      rounded: 'rounded-lg',
    },
    modal: {
      rounded: 'rounded-2xl',
      shadow: 'shadow-2xl',
    },
  },
});
```

## Font Loading

### Google Fonts
```typescript
googleFonts: {
  families: {
    'Space Grotesk': [400, 500, 600, 700],
    'Archivo Black': [400],
    'JetBrains Mono': [400, 500, 600, 700],
  },
  display: 'swap',
  preload: true,
}
```

### Local Fonts
```css
@font-face {
  font-family: 'Space Grotesk';
  src: url('/fonts/SpaceGrotesk-Variable.woff2') format('woff2-variations');
  font-weight: 300 700;
  font-display: swap;
}
```

## Usage Examples

```tsx
// Typography
<h1 class="font-heading text-6xl text-brand-midnight">Heading</h1>
<p class="font-sans text-lg text-gray-700">Body text</p>

// Colors
<div class="bg-brand-coral text-white">Primary</div>
<div class="bg-gradient-to-br from-brand-coral via-brand-ocean to-brand-sunset">Gradient</div>

// Animations
<div class="animate-slide-up">Slides up</div>
<button class="transition-all hover:scale-105 hover:shadow-brand-lg">Hover me</button>
```

## Accessibility Checklist

- All color combinations meet WCAG 2.1 AA (4.5:1 contrast ratio)
- Focus states on all interactive elements
- Animations respect `prefers-reduced-motion`
- Font sizes use rem units for scaling

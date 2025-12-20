# TanStack Router Advanced Patterns

## File-Based Routing Patterns

### Route File Naming

| Pattern | File | Route | Example |
|---------|------|-------|---------|
| **Index** | `index.tsx` | `/` | Home page |
| **Static** | `about.tsx` | `/about` | About page |
| **Dynamic** | `users.$id.tsx` | `/users/:id` | User detail |
| **Catch-all** | `blog.$$.tsx` | `/blog/*` | Blog posts |
| **Layout** | `_layout.tsx` | - | Shared layout |
| **Pathless** | `_auth.tsx` | - | Auth wrapper |
| **API** | `api/users.ts` | `/api/users` | API endpoint |

### Route Structure

```
src/routes/
├── index.tsx                    # /
├── about.tsx                    # /about
├── _layout.tsx                  # Layout for all routes
├── users/
│   ├── index.tsx                # /users
│   ├── $id.tsx                  # /users/:id
│   └── $id.edit.tsx             # /users/:id/edit
├── blog/
│   ├── index.tsx                # /blog
│   └── $slug.tsx                # /blog/:slug
├── _auth/                       # Pathless route (auth wrapper)
│   ├── login.tsx                # /login (with auth layout)
│   └── register.tsx             # /register (with auth layout)
└── api/
    └── users.ts                 # /api/users (server function)
```

## Route Loaders

### Basic Loader

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$id')({
  loader: async ({ params, context }) => {
    const { env } = context.cloudflare

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(params.id).first()

    if (!user) {
      throw new Error('User not found')
    }

    return { user }
  },
  component: UserPage,
})

function UserPage() {
  const { user } = Route.useLoaderData()
  return <div><h1>{user.name}</h1></div>
}
```

### Loader with TanStack Query

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

const userQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}`)
      return res.json()
    },
  })

export const Route = createFileRoute('/users/$id')({
  loader: ({ params, context }) => {
    // Prefetch on server
    return context.queryClient.ensureQueryData(
      userQueryOptions(params.id)
    )
  },
  component: UserPage,
})

function UserPage() {
  const { id } = Route.useParams()
  const { data: user } = useSuspenseQuery(userQueryOptions(id))

  return <div><h1>{user.name}</h1></div>
}
```

### Parallel Data Loading

```typescript
export const Route = createFileRoute('/dashboard')({
  loader: async ({ context }) => {
    const { env } = context.cloudflare
    const userId = context.session?.userId

    // Load data in parallel
    const [user, stats, notifications] = await Promise.all([
      env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first(),
      env.DB.prepare('SELECT * FROM stats WHERE user_id = ?').bind(userId).first(),
      env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? LIMIT 10').bind(userId).all(),
    ])

    return { user, stats, notifications }
  },
  component: Dashboard,
})
```

## Type-Safe Search Params

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().int().positive().default(1),
  sort: z.enum(['name', 'date', 'popularity']).default('name'),
  filter: z.string().optional(),
})

export const Route = createFileRoute('/users')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: { page, sort, filter }, context }) => {
    const { env } = context.cloudflare

    let query = env.DB.prepare('SELECT * FROM users')

    if (filter) {
      query = env.DB.prepare('SELECT * FROM users WHERE name LIKE ?').bind(`%${filter}%`)
    }

    const users = await query.all()
    return { users, page, sort }
  },
  component: UsersPage,
})

function UsersPage() {
  const { users, page, sort } = Route.useLoaderData()
  const navigate = Route.useNavigate()

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    })
  }

  return (
    <div>
      <h1>Users (Page {page}, Sort: {sort})</h1>
      {/* ... */}
    </div>
  )
}
```

## Route Guards and Middleware

### Authentication Guard

```typescript
// src/routes/_auth/_layout.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/_layout')({
  beforeLoad: async ({ context, location }) => {
    const { env } = context.cloudflare

    // Check authentication
    const session = await getSession(env)

    if (!session) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    return { session }
  },
  component: AuthLayout,
})
```

### Role-Based Guard

```typescript
export const Route = createFileRoute('/_auth/admin')({
  beforeLoad: async ({ context }) => {
    const { session } = context

    if (session.role !== 'admin') {
      throw redirect({ to: '/unauthorized' })
    }
  },
  component: AdminPage,
})
```

## Error Handling

### Error Boundaries

```typescript
import { ErrorComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$id')({
  loader: async ({ params }) => {
    const user = await fetchUser(params.id)
    if (!user) {
      throw new Error('User not found')
    }
    return { user }
  },
  errorComponent: ({ error }) => {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-red-600">Error</h1>
        <p>{error.message}</p>
      </div>
    )
  },
  component: UserPage,
})
```

### Not Found Handling

```typescript
// src/routes/$$.tsx (catch-all route)
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$')({
  component: NotFound,
})

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="text-xl">Page not found</p>
        <Link to="/" className="text-blue-600">
          Go home
        </Link>
      </div>
    </div>
  )
}
```

## Navigation

### Link Component

```typescript
import { Link } from '@tanstack/react-router'

// Basic link
<Link to="/about">About</Link>

// Link with params
<Link to="/users/$id" params={{ id: '123' }}>
  View User
</Link>

// Link with search params
<Link
  to="/users"
  search={{ page: 2, sort: 'name' }}
>
  Users Page 2
</Link>

// Link with active state
<Link
  to="/dashboard"
  activeOptions={{ exact: true }}
  activeProps={{
    className: 'font-bold text-blue-600',
  }}
  inactiveProps={{
    className: 'text-gray-600',
  }}
>
  Dashboard
</Link>
```

### Programmatic Navigation

```typescript
import { useNavigate } from '@tanstack/react-router'

function MyComponent() {
  const navigate = useNavigate()

  const handleSubmit = async (data) => {
    await saveData(data)

    // Navigate to detail page
    navigate({
      to: '/users/$id',
      params: { id: data.id },
    })
  }

  // Navigate with search params
  const handleFilter = (filter: string) => {
    navigate({
      to: '/users',
      search: (prev) => ({ ...prev, filter }),
    })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

## Prefetching Strategies

### Automatic Prefetching

```typescript
import { Link } from '@tanstack/react-router'

// Prefetch on hover (default)
<Link to="/users/$id" params={{ id: '123' }}>
  View User
</Link>

// Prefetch immediately
<Link
  to="/users/$id"
  params={{ id: '123' }}
  preload="intent"
>
  View User
</Link>

// Don't prefetch
<Link
  to="/users/$id"
  params={{ id: '123' }}
  preload={false}
>
  View User
</Link>
```

### Manual Prefetching

```typescript
import { useRouter } from '@tanstack/react-router'

function UserList({ users }) {
  const router = useRouter()

  const handleMouseEnter = (userId: string) => {
    // Prefetch route data
    router.preloadRoute({
      to: '/users/$id',
      params: { id: userId },
    })
  }

  return (
    <ul>
      {users.map((user) => (
        <li
          key={user.id}
          onMouseEnter={() => handleMouseEnter(user.id)}
        >
          <Link to="/users/$id" params={{ id: user.id }}>
            {user.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

## Pending States

### Loading UI

```typescript
import { useRouterState } from '@tanstack/react-router'

function GlobalPendingIndicator() {
  const isLoading = useRouterState({ select: (s) => s.isLoading })

  return isLoading ? (
    <div className="fixed top-0 left-0 right-0 h-1 bg-blue-600 animate-pulse" />
  ) : null
}
```

### Per-Route Pending

```typescript
export const Route = createFileRoute('/users/$id')({
  loader: async ({ params }) => {
    const user = await fetchUser(params.id)
    return { user }
  },
  pendingComponent: () => (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">Loading user...</span>
    </div>
  ),
  component: UserPage,
})
```

## Common Patterns

### Dashboard with Sidebar

```typescript
// _layout/dashboard.tsx
export const Route = createFileRoute('/_layout/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="flex">
      <aside className="w-64 bg-gray-100">
        <nav>
          <Link to="/dashboard">Overview</Link>
          <Link to="/dashboard/users">Users</Link>
          <Link to="/dashboard/settings">Settings</Link>
        </nav>
      </aside>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
```

### Multi-Step Form

```typescript
export const Route = createFileRoute('/onboarding/$step')({
  validateSearch: z.object({
    data: z.record(z.any()).optional(),
  }),
  component: OnboardingStep,
})

function OnboardingStep() {
  const { step } = Route.useParams()
  const navigate = Route.useNavigate()
  const { data } = Route.useSearch()

  const handleNext = (formData) => {
    navigate({
      to: '/onboarding/$step',
      params: { step: (parseInt(step) + 1).toString() },
      search: { data: { ...data, ...formData } },
    })
  }

  return <StepForm step={step} onNext={handleNext} />
}
```

## Best Practices

**DO:**
- Use loaders for all data fetching
- Type search params with Zod
- Implement error boundaries
- Use nested layouts for shared UI
- Prefetch critical routes
- Cache data in loaders when appropriate
- Use route guards for auth
- Handle 404s with catch-all route

**DON'T:**
- Fetch data in useEffect
- Hardcode route paths (use type-safe navigation)
- Skip error handling
- Duplicate layout code
- Ignore prefetching opportunities
- Load data sequentially when parallel is possible
- Skip validation for search params

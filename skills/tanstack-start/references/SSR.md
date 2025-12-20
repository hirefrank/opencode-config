# Tanstack Start SSR Optimization

## Server Functions

### Basic Server Function

```typescript
// src/lib/server-functions.ts
import { createServerFn } from '@tanstack/start'

export const getUser = createServerFn(
  'GET',
  async (id: string, context) => {
    const { env } = context.cloudflare

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first()

    return user
  }
)

// Usage in component
import { getUser } from '@/lib/server-functions'

function UserProfile({ id }: { id: string }) {
  const user = await getUser(id)
  return <div>{user.name}</div>
}
```

### Mutation Server Function

```typescript
export const updateUser = createServerFn(
  'POST',
  async (data: { id: string; name: string }, context) => {
    const { env } = context.cloudflare

    await env.DB.prepare(
      'UPDATE users SET name = ? WHERE id = ?'
    ).bind(data.name, data.id).run()

    return { success: true }
  }
)

// Usage in form
function EditUserForm({ user }) {
  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    await updateUser({
      id: user.id,
      name: formData.get('name') as string,
    })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

## State Management Architecture

### Decision Tree

```
What type of state do you need?
├─ Data from API/database (server state)?
│   └─ Use TanStack Query
│
├─ UI state (modals, forms, preferences)?
│   └─ Use Zustand
│
└─ URL state (filters, pagination)?
    └─ Use TanStack Router search params
```

### Approved Libraries

**Server State**: TanStack Query
- Handles data fetching, caching, deduplication, invalidation
- Built-in support for Tanstack Start
- Official Cloudflare Workers integration

**Client State**: Zustand
- Lightweight, zero boilerplate
- Simple state management without ceremony

**URL State**: TanStack Router
- Type-safe URL state management
- Built-in search params validation

### Forbidden Libraries

- ❌ Redux / Redux Toolkit - Too much boilerplate
- ❌ MobX - Not needed
- ❌ Recoil - Use Zustand instead
- ❌ Jotai - Use Zustand for consistency
- ❌ XState - Too complex for most use cases

### TanStack Query Example

```typescript
// src/lib/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { getUserList } from './server-functions'

export const userQueryOptions = queryOptions({
  queryKey: ['users'],
  queryFn: async () => {
    return await getUserList()
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
})

// Usage in component
import { useSuspenseQuery } from '@tanstack/react-query'
import { userQueryOptions } from '@/lib/queries'

function UsersList() {
  const { data: users } = useSuspenseQuery(userQueryOptions)
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

### Zustand Example

```typescript
// src/lib/stores/ui-store.ts
import { create } from 'zustand'

interface UIState {
  isModalOpen: boolean
  isSidebarCollapsed: boolean
  selectedTheme: 'light' | 'dark'
  openModal: () => void
  closeModal: () => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>((set) => ({
  isModalOpen: false,
  isSidebarCollapsed: false,
  selectedTheme: 'light',
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setTheme: (theme) => set({ selectedTheme: theme }),
}))

// Usage in component
function Modal() {
  const { isModalOpen, closeModal } = useUIStore()

  if (!isModalOpen) return null

  return (
    <div className="modal">
      <button onClick={closeModal}>Close</button>
    </div>
  )
}
```

## Streaming SSR

### Suspense Boundaries

```typescript
import { Suspense } from 'react'

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<Skeleton />}>
        <SlowComponent />
      </Suspense>
      <Suspense fallback={<Skeleton />}>
        <AnotherSlowComponent />
      </Suspense>
    </div>
  )
}

// SlowComponent can load data async
async function SlowComponent() {
  const data = await fetchSlowData()
  return <div>{data}</div>
}
```

### Combined Pattern - Full Stack State Management

```typescript
// src/routes/dashboard.tsx
import { Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useUIStore } from '@/lib/stores/ui-store'
import { userQueryOptions } from '@/lib/queries'

function DashboardContent() {
  // Server state from TanStack Query
  const { data: users } = useSuspenseQuery(userQueryOptions)

  // Client state from Zustand
  const { isModalOpen, openModal, closeModal } = useUIStore()

  // URL state from TanStack Router
  const { page, filter } = Route.useSearch()

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Suspense for async data */}
      <Suspense fallback={<div>Loading users...</div>}>
        <UsersList users={users} />
      </Suspense>

      {/* Client state managing UI */}
      {isModalOpen && (
        <Modal onClose={closeModal} />
      )}

      {/* URL state for pagination */}
      <p>Current page: {page}</p>
      <p>Current filter: {filter}</p>

      <button onClick={openModal}>Open Modal</button>
    </div>
  )
}

export const Route = createFileRoute('/dashboard')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: (search.page as number) ?? 1,
    filter: (search.filter as string) ?? '',
  }),
  component: () => (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  ),
})
```

## Cloudflare Bindings Access

```typescript
export const getUsersFromKV = createServerFn(
  'GET',
  async (context) => {
    const { env } = context.cloudflare

    // Access KV
    const cached = await env.MY_KV.get('users')
    if (cached) return JSON.parse(cached)

    // Access D1
    const users = await env.DB.prepare('SELECT * FROM users').all()

    // Cache in KV
    await env.MY_KV.put('users', JSON.stringify(users), {
      expirationTtl: 3600,
    })

    return users
  }
)
```

## Cache Control

```typescript
export const Route = createFileRoute('/blog')({
  loader: async ({ context }) => {
    const { env } = context.cloudflare

    // Check KV cache first
    const cached = await env.CACHE.get('blog-posts')
    if (cached) {
      return JSON.parse(cached)
    }

    // Fetch from D1
    const posts = await env.DB.prepare('SELECT * FROM posts').all()

    // Cache for 1 hour
    await env.CACHE.put('blog-posts', JSON.stringify(posts), {
      expirationTtl: 3600,
    })

    return { posts }
  },
})
```

## Critical Constraints

**DO:**
- Use server functions for mutations
- Use loaders for data fetching
- Implement Suspense boundaries
- Cache data in KV when appropriate
- Type server functions properly
- Handle errors gracefully

**DON'T:**
- Use Node.js APIs (fs, path, process)
- Fetch data client-side in loaders
- Create large bundle sizes (> 1MB for Workers)
- Hardcode secrets
- Skip error handling

## Efficient Data Loading

```typescript
// ✅ GOOD: Load data on server (loader)
export const Route = createFileRoute('/users/$id')({
  loader: async ({ params, context }) => {
    const { env } = context.cloudflare
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(params.id)
      .first()
    return { user }
  },
})

// ❌ BAD: Load data on client (useEffect)
function UserPage() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch(`/api/users/${id}`).then(setUser)
  }, [id])
}
```

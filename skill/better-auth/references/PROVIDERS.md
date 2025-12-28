# OAuth Provider Setup Guide

## Supported Providers

better-auth supports multiple OAuth providers. Configure them in your auth setup.

## Google OAuth

### 1. Create Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Set authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourapp.com/api/auth/callback/google`

### 2. Configuration

```typescript
socialProviders: {
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    scopes: ['openid', 'email', 'profile'],
  },
}
```

### 3. Required Scopes

- `openid` - OpenID Connect
- `email` - User email address
- `profile` - User profile info (name, avatar)

## GitHub OAuth

### 1. Create OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set callback URL:
   - Development: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://yourapp.com/api/auth/callback/github`

### 2. Configuration

```typescript
socialProviders: {
  github: {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    scopes: ['user:email'],
  },
}
```

### 3. Required Scopes

- `user:email` - Access user email (may be private)
- `read:user` - Access user profile (optional)

## Client-Side OAuth Integration

```tsx
import { createAuthClient } from 'better-auth/client';

const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
});

// Google Sign In
async function signInWithGoogle() {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/dashboard',
  });
}

// GitHub Sign In
async function signInWithGitHub() {
  await authClient.signIn.social({
    provider: 'github',
    callbackURL: '/dashboard',
  });
}
```

## Passkeys (WebAuthn)

### Configuration

```typescript
passkey: {
  enabled: true,
  rpName: 'My SaaS App',  // Display name
  rpID: 'myapp.com',      // Your domain
}
```

### Client-Side Registration

```tsx
async function registerPasskey() {
  await authClient.passkey.register({
    callbackURL: '/dashboard',
  });
}

async function signInWithPasskey() {
  await authClient.passkey.authenticate({
    callbackURL: '/dashboard',
  });
}
```

## Magic Links

### Configuration

```typescript
magicLink: {
  enabled: true,
  sendMagicLink: async ({ email, url, token }) => {
    // Send email via Resend, SendGrid, etc.
    await resend.emails.send({
      from: 'noreply@myapp.com',
      to: email,
      subject: 'Sign in to My App',
      html: `<a href="${url}">Click to sign in</a>`,
    });
  },
}
```

### Client-Side Usage

```tsx
async function sendMagicLink(email: string) {
  const result = await authClient.signIn.magicLink({
    email,
    callbackURL: '/dashboard',
  });

  if (result.data) {
    alert('Check your email for the magic link!');
  }
}
```

## Security Considerations

### 1. Redirect URI Validation

Always validate redirect URIs match your allowed origins:

```typescript
trustedOrigins: [
  'http://localhost:3000',
  'https://myapp.com',
  'https://www.myapp.com',
]
```

### 2. PKCE for Public Clients

Use PKCE (Proof Key for Code Exchange) for additional security in public clients.

### 3. State Parameter

better-auth automatically handles the state parameter to prevent CSRF attacks.

### 4. Token Storage

- Access tokens: In-memory only
- Refresh tokens: Secure HTTP-only cookies
- Session: Encrypted cookies or database

## Environment Variables

```bash
# Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# GitHub
GITHUB_CLIENT_ID=Iv1.xxx
GITHUB_CLIENT_SECRET=xxx

# JWT Secret (32+ characters)
BETTER_AUTH_SECRET=generate-a-long-random-string-here

# Store using wrangler secrets in production
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put BETTER_AUTH_SECRET
```

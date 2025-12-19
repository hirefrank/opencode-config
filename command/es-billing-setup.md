---
description: Interactive Polar.sh billing integration wizard. Sets up products, webhooks, database schema, and subscription middleware for Cloudflare Workers.
---

# Billing Setup Command

<command_purpose> Guide developers through complete Polar.sh billing integration with automated code generation, database migrations, and MCP-driven product configuration. </command_purpose>

## Introduction

<role>Senior Payments Integration Engineer with expertise in Polar.sh, Cloudflare Workers, and subscription management</role>

**This command will**:

- Query Polar MCP for existing products/subscriptions
- Generate webhook handler with signature verification
- Create D1 database schema for customers/subscriptions/failed emails
- Generate subscription middleware for protected routes
- Configure environment variables (Polar + Resend)
- Set up payment failure notifications via Resend
- Integrate with better-auth for session management
- Validate setup via Polar MCP

## Prerequisites

<requirements>
- Cloudflare Workers project (Tanstack Start or Hono)
- Polar.sh account: https://polar.sh
- D1 database configured in wrangler.toml (or will create)
- Polar Access Token (will guide through obtaining)
- Resend account for payment failure notifications: https://resend.com
- better-auth configured for session management (see /es-auth-setup)
</requirements>

## Main Tasks

### 1. Check Polar Account Setup

<thinking>
First, verify user has Polar account and products created.
Use Polar MCP to check for existing products.
</thinking>

#### Immediate Actions:

<task_list>

- [ ] Check if Polar MCP is available
- [ ] Prompt user for Polar Access Token (if not in env)
- [ ] Query Polar MCP for existing products
- [ ] If no products found, guide to Polar dashboard
- [ ] Display available products and let user select which to integrate

</task_list>

**Check Polar Products**:

```typescript
// Query MCP for products
const products = await mcp.polar.listProducts();

if (products.length === 0) {
  console.log("⚠️  No products found in your Polar account");
  console.log("📋 Next steps:");
  console.log("1. Go to https://polar.sh/dashboard");
  console.log("2. Create your products (Pro, Enterprise, etc.)");
  console.log("3. Run this command again");
  process.exit(0);
}

// Display products
console.log("✅ Found Polar products:");
products.forEach((p, i) => {
  console.log(
    `${i + 1}. ${p.name} - $${p.prices[0].amount / 100}/${p.prices[0].interval}`,
  );
  console.log(`   ID: ${p.id}`);
});
```

### 2. Generate Webhook Handler

<thinking>
Create comprehensive webhook handler with signature verification
and all critical event handlers.
</thinking>

**Generate File**: `app/routes/api/webhooks/polar.ts` (Tanstack Start) or `src/webhooks/polar.ts` (Hono)

```typescript
// Generated webhook handler
import { Polar } from '@polar-sh/sdk';

export interface Env {
  POLAR_ACCESS_TOKEN: string;
  POLAR_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  APP_URL: string;
  DB: D1Database;
}

export async function handlePolarWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // 1. Verify webhook signature
  const signature = request.headers.get('polar-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  const body = await request.text();
  const polar = new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });

  let event;
  try {
    event = polar.webhooks.verify(body, signature, env.POLAR_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Invalid signature', { status: 401 });
  }

  // 2. Log event for debugging
  await env.DB.prepare(
    \`INSERT INTO webhook_events (id, type, data, created_at)
     VALUES (?, ?, ?, ?)\`
  ).bind(
    crypto.randomUUID(),
    event.type,
    JSON.stringify(event.data),
    new Date().toISOString()
  ).run();

  // 3. Handle event types
  try {
    switch (event.type) {
      case 'checkout.completed':
        await handleCheckoutCompleted(event.data, env);
        break;

      case 'subscription.created':
        await handleSubscriptionCreated(event.data, env);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data, env);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event.data, env);
        break;

      case 'subscription.past_due':
        await handleSubscriptionPastDue(event.data, env);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response('Processing failed', { status: 500 });
  }
}

// Event handlers
async function handleCheckoutCompleted(data: any, env: Env) {
  const { customer_id, product_id, metadata } = data;

  await env.DB.prepare(
    \`UPDATE users
     SET polar_customer_id = ?,
         product_id = ?,
         subscription_status = 'active',
         updated_at = ?
     WHERE id = ?\`
  ).bind(customer_id, product_id, new Date().toISOString(), metadata.user_id).run();
}

async function handleSubscriptionCreated(data: any, env: Env) {
  const { id, customer_id, product_id, status, current_period_end } = data;

  await env.DB.prepare(
    \`INSERT INTO subscriptions (id, polar_customer_id, product_id, status, current_period_end, created_at)
     VALUES (?, ?, ?, ?, ?, ?)\`
  ).bind(id, customer_id, product_id, status, current_period_end, new Date().toISOString()).run();
}

async function handleSubscriptionUpdated(data: any, env: Env) {
  const { id, status, product_id, current_period_end } = data;

  await env.DB.prepare(
    \`UPDATE subscriptions
     SET status = ?, product_id = ?, current_period_end = ?, updated_at = ?
     WHERE id = ?\`
  ).bind(status, product_id, current_period_end, new Date().toISOString(), id).run();
}

async function handleSubscriptionCanceled(data: any, env: Env) {
  const { id } = data;

  await env.DB.prepare(
    \`UPDATE subscriptions
     SET status = 'canceled', canceled_at = ?, updated_at = ?
     WHERE id = ?\`
  ).bind(new Date().toISOString(), new Date().toISOString(), id).run();
}

async function handleSubscriptionPastDue(data: any, env: Env) {
  const { id, customer_id, product_id, current_period_end } = data;

  await env.DB.prepare(
    \`UPDATE subscriptions
     SET status = 'past_due', updated_at = ?
     WHERE id = ?\`
  ).bind(new Date().toISOString(), id).run();

  // Get user info for notification
  const user = await env.DB.prepare(
    \`SELECT id, email, polar_customer_id
     FROM users
     WHERE polar_customer_id = ?\`
  ).bind(customer_id).first();

  if (!user) {
    console.error('User not found for customer:', customer_id);
    return;
  }

  // Send payment failure notification via Resend
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(env.RESEND_API_KEY);

    const { data: result, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'billing@yourdomain.com',
      to: user.email,
      subject: 'Payment Failed - Action Required',
      html: \`
        <h1>Payment Failed</h1>
        <p>We were unable to process your payment for your subscription.</p>
        <p><strong>Subscription ID:</strong> \${id}</p>
        <p><strong>Status:</strong> Past Due</p>
        <p>Please update your payment method to continue your subscription.</p>
        <p><a href="\${env.APP_URL}/billing">Update Payment Method</a></p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          If you have any questions, please contact support.
        </p>
      \`,
    });

    if (error) {
      console.error('Failed to send payment failure email:', error);

      // Store failed email for retry
      await env.DB.prepare(
        \`INSERT INTO failed_emails (id, to, subject, template, error, retry_count, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)\`
      ).bind(
        crypto.randomUUID(),
        user.email,
        'Payment Failed - Action Required',
        'payment_failed',
        error.message,
        new Date().toISOString()
      ).run();
    } else {
      console.log('Payment failure notification sent:', result?.id);
    }
  } catch (err) {
    console.error('Error sending payment failure notification:', err);
  }
}

// App-specific export
export default defineEventHandler(async (event) => {
  return await handlePolarWebhook(
    event.node.req,
    event.context.cloudflare.env
  );
});
```

### 3. Generate Database Migration

<thinking>
Create D1 schema for users, subscriptions, and webhook event logging.
</thinking>

**Generate File**: `migrations/0001_polar_billing.sql`

```sql
-- Users table (add Polar fields)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  polar_customer_id TEXT UNIQUE,
  product_id TEXT,
  subscription_status TEXT, -- 'active', 'canceled', 'past_due', NULL
  current_period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Subscriptions table (detailed tracking)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY, -- Polar subscription ID
  polar_customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start TEXT,
  current_period_end TEXT,
  canceled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (polar_customer_id) REFERENCES users(polar_customer_id)
);

-- Webhook events log (debugging/auditing)
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON blob
  created_at TEXT NOT NULL
);

-- Failed emails (for retry logic)
CREATE TABLE failed_emails (
  id TEXT PRIMARY KEY,
  to TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL, -- Template name (e.g., 'payment_failed')
  error TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_retry_at TEXT
);

-- Indexes for performance
CREATE INDEX idx_users_polar_customer ON users(polar_customer_id);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_subscriptions_customer ON subscriptions(polar_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_webhook_events_type ON webhook_events(type);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);
CREATE INDEX idx_failed_emails_retry ON failed_emails(retry_count);
CREATE INDEX idx_failed_emails_created ON failed_emails(created_at);
```

**Run Migration**:

```bash
wrangler d1 migrations apply DB --local
wrangler d1 migrations apply DB --remote
```

### 4. Generate Payment Failure Email Template (Optional - React Email)

<thinking>
Create a professional React Email template for payment failures.
This is optional but recommended for better user experience.
</thinking>

**Generate File**: `app/emails/payment-failed.tsx`

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface PaymentFailedEmailProps {
  subscriptionId: string;
  billingUrl: string;
}

export function PaymentFailedEmail({
  subscriptionId,
  billingUrl,
}: PaymentFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Action Required: Payment Failed</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f4" }}>
        <Container
          style={{
            padding: "20px",
            backgroundColor: "#ffffff",
            maxWidth: "600px",
          }}
        >
          <Heading
            style={{ fontSize: "24px", marginBottom: "20px", color: "#dc3545" }}
          >
            Payment Failed
          </Heading>

          <Text
            style={{
              fontSize: "16px",
              lineHeight: "1.6",
              marginBottom: "10px",
            }}
          >
            We were unable to process your payment for your subscription.
          </Text>

          <Text
            style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}
          >
            <strong>Subscription ID:</strong> {subscriptionId}
          </Text>

          <Text
            style={{
              fontSize: "16px",
              lineHeight: "1.6",
              marginBottom: "30px",
            }}
          >
            To continue your subscription without interruption, please update
            your payment method.
          </Text>

          <Button
            href={billingUrl}
            style={{
              backgroundColor: "#007bff",
              color: "white",
              padding: "12px 24px",
              borderRadius: "4px",
              textDecoration: "none",
              display: "inline-block",
              fontSize: "16px",
            }}
          >
            Update Payment Method
          </Button>

          <Text style={{ fontSize: "14px", color: "#999", marginTop: "30px" }}>
            Or copy this link: <Link href={billingUrl}>{billingUrl}</Link>
          </Text>

          <Text
            style={{
              fontSize: "12px",
              color: "#999",
              marginTop: "20px",
              paddingTop: "20px",
              borderTop: "1px solid #eee",
            }}
          >
            If you have any questions or need assistance, please contact our
            support team.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

**Updated Handler with React Email**:

```typescript
// In handleSubscriptionPastDue function, replace HTML with React Email:

import { PaymentFailedEmail } from '@/emails/payment-failed';

// ... existing code ...

const { data: result, error } = await resend.emails.send({
  from: env.RESEND_FROM_EMAIL || 'billing@yourdomain.com',
  to: user.email,
  subject: 'Payment Failed - Action Required',
  react: PaymentFailedEmail({
    subscriptionId: id,
    billingUrl: \`\${env.APP_URL}/billing\`,
  }),
});
```

### 5. Generate Subscription Middleware

<thinking>
Create middleware to check subscription status on protected routes.
</thinking>

**Generate File**: `app/middleware/subscription.ts` (Tanstack Start) or `src/middleware/subscription.ts` (Hono)

```typescript
// Subscription check middleware
export async function requireActiveSubscription(
  request: Request,
  env: Env,
  ctx?: ExecutionContext
) {
  // Get user ID from session (assumes auth is already set up)
  const userId = await getUserIdFromSession(request, env);

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check subscription status
  const user = await env.DB.prepare(
    \`SELECT subscription_status, current_period_end, product_id
     FROM users
     WHERE id = ?\`
  ).bind(userId).first();

  if (!user) {
    return new Response('User not found', { status: 404 });
  }

  // Check if subscription is active
  if (user.subscription_status !== 'active') {
    return new Response(JSON.stringify({
      error: 'subscription_required',
      message: 'Active subscription required to access this feature',
      upgrade_url: '/pricing'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check if subscription hasn't expired
  if (user.current_period_end) {
    const periodEnd = new Date(user.current_period_end);
    if (periodEnd < new Date()) {
      return new Response(JSON.stringify({
        error: 'subscription_expired',
        message: 'Your subscription has expired',
        renew_url: '/pricing'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Subscription is valid, continue
  return null;
}

// Helper to get user ID from session
async function getUserIdFromSession(request: Request, env: Env): Promise<string | null> {
  try {
    // Import better-auth (assumes it's configured in your project)
    const { auth } = await import('@/server/utils/auth'); // Adjust path as needed

    // Get session from better-auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Return user ID if session exists
    return session?.user?.id || null;
  } catch (error) {
    console.error('Failed to get user session:', error);
    return null;
  }
}
```

**Usage Example**:

```typescript
// Protected API route
export default defineEventHandler(async (event) => {
  // Check subscription
  const subscriptionCheck = await requireActiveSubscription(
    event.node.req,
    event.context.cloudflare.env,
  );

  if (subscriptionCheck) {
    return subscriptionCheck; // Return 403 if no subscription
  }

  // User has active subscription, proceed
  return {
    message: "Premium feature accessed",
    data: "...",
  };
});
```

### 6. Configure Environment Variables

<thinking>
Update wrangler.toml and create .dev.vars template.
</thinking>

**Update**: `wrangler.toml`

```toml
# Add Polar and Resend configuration (public, not sensitive)
[vars]
POLAR_WEBHOOK_SECRET = "whsec_..."  # Get from Polar dashboard
RESEND_FROM_EMAIL = "billing@yourdomain.com"  # Your verified Resend domain
APP_URL = "https://yourdomain.com"  # For email links

# D1 database (if not already configured)
[[d1_databases]]
binding = "DB"
database_name = "my-app-db"
database_id = "..."  # Get from: wrangler d1 create my-app-db
```

**Create**: `.dev.vars` (local development)

```bash
# Polar Access Token (sensitive - DO NOT COMMIT)
POLAR_ACCESS_TOKEN=polar_at_xxxxxxxxxxxxx

# Resend API Key (sensitive - DO NOT COMMIT)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# App URL for local testing
APP_URL=http://localhost:3000

# Get Polar token from: https://polar.sh/dashboard/settings/api
# Get Resend key from: https://resend.com/api-keys
```

**Production Setup**:

```bash
# Set secrets in Cloudflare Workers
wrangler secret put POLAR_ACCESS_TOKEN
# Paste: polar_at_xxxxxxxxxxxxx

wrangler secret put RESEND_API_KEY
# Paste: re_xxxxxxxxxxxxx
```

**Create**: `.dev.vars` (local development)

```bash
# Polar Access Token (sensitive - DO NOT COMMIT)
POLAR_ACCESS_TOKEN=polar_at_xxxxxxxxxxxxx

# Get this from: https://polar.sh/dashboard/settings/api
```

**Production Setup**:

```bash
# Set secret in Cloudflare Workers
wrangler secret put POLAR_ACCESS_TOKEN
# Paste: polar_at_xxxxxxxxxxxxx
```

### 7. Configure Polar Webhook Endpoint

<thinking>
User needs to configure webhook endpoint in Polar dashboard.
</thinking>

**Instructions for User**:

```markdown
## Configure Polar Webhook

1. Go to https://polar.sh/dashboard/settings/webhooks
2. Click "Add Webhook Endpoint"
3. Enter your webhook URL:
   - Development: http://localhost:3000/api/webhooks/polar
   - Production: https://yourdomain.com/api/webhooks/polar
4. Select events to send:
   ✅ checkout.completed
   ✅ subscription.created
   ✅ subscription.updated
   ✅ subscription.canceled
   ✅ subscription.past_due
5. Copy the "Webhook Secret" (whsec\_...)
6. Add to wrangler.toml: POLAR*WEBHOOK_SECRET = "whsec*..."
7. Click "Create Endpoint"
8. Test with "Send Test Event" button
```

### 8. Email Retry Worker (Optional)

<thinking>
Create a scheduled worker to retry failed email notifications.
This ensures payment failure notifications are eventually delivered.
</thinking>

**Generate File**: `src/workers/email-retry.ts`

```typescript
// Scheduled worker to retry failed emails (runs every hour)
import { Resend } from 'resend';
import { PaymentFailedEmail } from '@/emails/payment-failed';

export interface Env {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  APP_URL: string;
  DB: D1Database;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Email retry worker started');

    const resend = new Resend(env.RESEND_API_KEY);

    // Get failed emails with retry_count < 3
    const failedEmails = await env.DB.prepare(
      \`SELECT id, to, subject, template, retry_count
       FROM failed_emails
       WHERE retry_count < 3
       ORDER BY created_at ASC
       LIMIT 50\`
    ).all();

    if (!failedEmails.results || failedEmails.results.length === 0) {
      console.log('No failed emails to retry');
      return;
    }

    console.log(\`Retrying \${failedEmails.results.length} failed emails\`);

    for (const record of failedEmails.results) {
      try {
        let emailContent;

        // Get template based on type
        if (record.template === 'payment_failed') {
          // For payment failures, we need to get subscription details
          const subscription = await env.DB.prepare(
            'SELECT id FROM subscriptions WHERE status = "past_due" LIMIT 1'
          ).first();

          emailContent = {
            from: env.RESEND_FROM_EMAIL || 'billing@yourdomain.com',
            to: record.to,
            subject: record.subject,
            react: PaymentFailedEmail({
              subscriptionId: subscription?.id || 'unknown',
              billingUrl: \`\${env.APP_URL}/billing\`,
            }),
          };
        } else {
          // Fallback for unknown templates
          console.warn(\`Unknown template: \${record.template}\`);
          continue;
        }

        const { error } = await resend.emails.send(emailContent);

        if (!error) {
          // Success - remove from failed emails
          await env.DB.prepare(
            'DELETE FROM failed_emails WHERE id = ?'
          ).bind(record.id).run();

          console.log(\`Successfully sent email to \${record.to}\`);
        } else {
          // Increment retry count
          await env.DB.prepare(
            \`UPDATE failed_emails
             SET retry_count = retry_count + 1,
                 last_retry_at = ?
             WHERE id = ?\`
          ).bind(new Date().toISOString(), record.id).run();

          console.error(\`Retry failed for \${record.to}:\`, error);
        }
      } catch (err) {
        console.error(\`Unexpected error retrying email \${record.id}:\`, err);
      }
    }

    console.log('Email retry worker completed');
  },
};
```

**Update wrangler.toml** (add scheduled trigger):

```toml
# Email retry worker (runs every hour)
[triggers]
crons = ["0 * * * *"]  # Every hour
```

### 9. Validate Setup

<thinking>
Use Polar MCP to verify configuration is correct.
</thinking>

**Validation Checklist**:

```typescript
// Run validation checks
const validation = {
  polarAccount: await mcp.polar.verifySetup(),
  products: await mcp.polar.listProducts(),
  webhookEvents: await mcp.polar.getWebhookEvents(),
  database: await checkDatabaseSchema(env),
  environment: await checkEnvironmentVars(env),
  webhookEndpoint: await checkWebhookHandler(),
};

console.log("🔍 Polar.sh Integration Validation\n");

// 1. Polar Account
console.log("✅ Polar Account:", validation.polarAccount.status);
console.log(`   Found ${validation.products.length} products`);

// 2. Database Schema
if (validation.database.users && validation.database.subscriptions) {
  console.log("✅ Database Schema: Complete");
} else {
  console.log("❌ Database Schema: Missing tables");
  console.log("   Run: wrangler d1 migrations apply DB");
}

// 3. Environment Variables
if (
  validation.environment.POLAR_ACCESS_TOKEN &&
  validation.environment.POLAR_WEBHOOK_SECRET
) {
  console.log("✅ Environment Variables: Configured");
} else {
  console.log("❌ Environment Variables: Missing");
  if (!validation.environment.POLAR_ACCESS_TOKEN) {
    console.log("   Missing: POLAR_ACCESS_TOKEN");
  }
  if (!validation.environment.POLAR_WEBHOOK_SECRET) {
    console.log("   Missing: POLAR_WEBHOOK_SECRET");
  }
}

// 4. Webhook Handler
if (validation.webhookEndpoint.exists) {
  console.log("✅ Webhook Handler: Exists");
} else {
  console.log("❌ Webhook Handler: Not found");
}

console.log("\n📋 Next Steps:");
console.log("1. Configure webhook in Polar dashboard");
console.log("2. Test webhook with Polar's 'Send Test Event'");
console.log("3. Implement subscription checks on protected routes");
console.log("4. Deploy to production with: /es-deploy");
```

## Success Criteria

✅ Billing setup complete when:

- Polar products queried successfully via MCP
- Webhook handler generated with signature verification
- Database schema created (users, subscriptions, webhook_events, failed_emails)
- Subscription middleware generated with better-auth integration
- Payment failure notifications configured with Resend
- Email retry worker generated (optional)
- Environment variables configured (Polar + Resend)
- Validation passes all checks
- User guided through Polar dashboard configuration

## Output Summary

**Files Created**:

- `server/api/webhooks/polar.ts` (or `src/webhooks/polar.ts`) - Webhook handler with payment failure notifications
- `server/middleware/subscription.ts` (or `src/middleware/subscription.ts`) - Subscription checks with better-auth
- `app/emails/payment-failed.tsx` - React Email template for payment failures (optional)
- `src/workers/email-retry.ts` - Scheduled worker for email retries (optional)
- `migrations/0001_polar_billing.sql` - Database schema including failed_emails table
- `.dev.vars` (template) - Local environment variables

**Files Updated**:

- `wrangler.toml` (added Polar + Resend vars, D1 binding, and scheduled triggers)

**Dependencies to Install**:

```bash
pnpm add @polar-sh/sdk resend
pnpm add -D react-email @react-email/components  # Optional for React Email
```

**Secrets to Configure**:

```bash
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put RESEND_API_KEY
```

**Next Actions**:

1. Install dependencies (`pnpm add @polar-sh/sdk resend`)
2. Run database migration (`wrangler d1 migrations apply DB`)
3. Set up Resend account and verify domain
4. Configure secrets (`wrangler secret put POLAR_ACCESS_TOKEN` and `RESEND_API_KEY`)
5. Configure webhook in Polar dashboard
6. Test webhook with Polar simulator
7. Add subscription checks to protected routes
8. Deploy with `/es-deploy`

## Notes

- Always use Polar MCP for real-time product data
- Test webhooks locally with Polar's test event feature
- Store POLAR_ACCESS_TOKEN and RESEND_API_KEY as Cloudflare secrets (not in wrangler.toml)
- Webhook endpoint must be publicly accessible (use ngrok for local testing)
- Payment failure notifications are sent automatically via Resend when subscription goes past_due
- Failed emails are stored in D1 for retry (implement a scheduled worker for retries)
- getUserIdFromSession requires better-auth to be configured (see /es-auth-setup)
- For React Email templates, install: `pnpm add react-email @react-email/components`
- See `agents/integrations/polar-billing-specialist` for detailed implementation guidance
- See `agents/integrations/resend-email-specialist` for email best practices
- See `agents/integrations/better-auth-specialist` for session management patterns

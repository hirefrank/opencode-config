---
name: polar-billing
description: Integrate Polar.sh billing for SaaS applications. Use for subscriptions, one-time purchases, webhooks, and customer management in Cloudflare Workers.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires Polar.sh account, D1, Cloudflare Workers
allowed-tools: Bash(wrangler:*) Read Write
---

# Polar.sh Billing Integration

## Quick Start

1. **Create Polar Account**
   - Go to [polar.sh](https://polar.sh)
   - Create organization and products

2. **Get API Credentials**
   ```bash
   # Store as secrets
   wrangler secret put POLAR_ACCESS_TOKEN
   wrangler secret put POLAR_WEBHOOK_SECRET
   ```

## Configuration

### Basic Setup

```typescript
// app/lib/polar.ts
export interface PolarConfig {
  accessToken: string;
  server: "production" | "sandbox";
  webhookSecret: string;
}

export const polarConfig: PolarConfig = {
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "production", // or 'sandbox' for testing
  webhookSecret: env.POLAR_WEBHOOK_SECRET,
};
```

### API Client

```typescript
// app/lib/polar-client.ts
export class PolarClient {
  private config: PolarConfig;
  private baseURL: string;

  constructor(config: PolarConfig) {
    this.config = config;
    this.baseURL =
      config.server === "production"
        ? "https://api.polar.sh"
        : "https://api.polar.sh";
  }

  async createCheckout(productId: string, customerEmail?: string) {
    const response = await fetch(
      `${this.baseURL}/v1/products/${productId}/checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_email: customerEmail,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to create checkout");
    }

    return response.json();
  }

  async getCustomer(customerId: string) {
    const response = await fetch(`${this.baseURL}/v1/customers/${customerId}`, {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
    });

    return response.json();
  }

  async createSubscription(productId: string, customerId: string) {
    const response = await fetch(`${this.baseURL}/v1/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        customer_id: customerId,
      }),
    });

    return response.json();
  }
}
```

## Database Schema

### D1 Tables

```sql
-- migrations/002_polar_billing.sql
CREATE TABLE IF NOT EXISTS "customers" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "polarId" TEXT UNIQUE NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "customerId" TEXT NOT NULL,
  "polarId" TEXT UNIQUE NOT NULL,
  "productId" TEXT NOT NULL,
  "status" TEXT NOT NULL, -- active, canceled, past_due
  "currentPeriodStart" INTEGER,
  "currentPeriodEnd" INTEGER,
  "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  "updatedAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "purchases" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "customerId" TEXT,
  "polarId" TEXT UNIQUE NOT NULL,
  "productId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, -- in cents
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL, -- completed, pending, failed
  "createdAt" INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL
);
```

## Server Functions

### Create Checkout

```typescript
// app/functions/checkout.ts
import { createServerFunction } from "@tanstack/start/server-functions";
import { PolarClient } from "../lib/polar-client";
import { env } from "../env";
import { db } from "../db";

export const createCheckout = createServerFunction(
  "POST",
  async (productId: string) => {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("Authentication required");

    // Find or create customer
    let customer = await db.customers.findFirst({
      where: { email: user.email },
    });

    if (!customer) {
      const polarClient = new PolarClient(polarConfig);
      const polarCustomer = await polarClient.getCustomer(user.polarId);

      customer = await db.customers.create({
        data: {
          id: crypto.randomUUID(),
          polarId: polarCustomer.id,
          email: user.email,
          name: user.name,
        },
      });
    }

    // Create checkout
    const polarClient = new PolarClient(polarConfig);
    const checkout = await polarClient.createCheckout(
      productId,
      customer.email,
    );

    return checkout.url;
  },
);
```

### Webhook Handler

```typescript
// app/api/webhooks/polar.ts
import { polarConfig } from "../../lib/polar";
import { db } from "../../db";
import { crypto } from "crypto";

async function verifyWebhook(request: Request): Promise<boolean> {
  const signature = request.headers.get("Polar-Signature");
  if (!signature) return false;

  const body = await request.text();
  const expectedSignature = crypto
    .createHmac("sha256", polarConfig.webhookSecret)
    .update(body)
    .digest("hex");

  return signature === `sha256=${expectedSignature}`;
}

async function handleSubscriptionCreated(data: any) {
  await db.subscriptions.create({
    data: {
      id: crypto.randomUUID(),
      polarId: data.id,
      customerId: data.customer_id,
      productId: data.product_id,
      status: data.status,
      currentPeriodStart: new Date(data.current_period_start).getTime(),
      currentPeriodEnd: new Date(data.current_period_end).getTime(),
    },
  });
}

async function handleSubscriptionUpdated(data: any) {
  await db.subscriptions.update({
    where: { polarId: data.id },
    data: {
      status: data.status,
      currentPeriodStart: new Date(data.current_period_start).getTime(),
      currentPeriodEnd: new Date(data.current_period_end).getTime(),
      cancelAtPeriodEnd: data.cancel_at_period_end,
    },
  });
}

export async function onRequest(context: EventContext<Env, any, any>) {
  if (!(await verifyWebhook(context.request))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const data = await context.request.json();
  const eventType = context.request.headers.get("Polar-Event-Type");

  try {
    switch (eventType) {
      case "subscription.created":
        await handleSubscriptionCreated(data);
        break;
      case "subscription.updated":
        await handleSubscriptionUpdated(data);
        break;
      case "order.completed":
        await handleOrderCompleted(data);
        break;
      default:
        console.log("Unhandled event:", eventType);
    }

    return new Response("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook failed", { status: 500 });
  }
}
```

## Client Integration

### Checkout Button

```typescript
// app/components/checkout-button.tsx
'use client';

import { createCheckout } from '../app/functions/checkout';
import { useState } from 'react';

export function CheckoutButton({ productId, price }: { productId: string, price: number }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);

    try {
      const checkoutUrl = await createCheckout(productId);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
    >
      {isLoading ? 'Processing...' : `Buy for $${(price / 100).toFixed(2)}`}
    </button>
  );
}
```

### Subscription Management

```typescript
// app/components/subscription-manager.tsx
'use client';

import { useState, useEffect } from 'react';
import { getSubscriptions } from '../app/functions/subscriptions';
import { cancelSubscription } from '../app/functions/subscriptions';

export function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    try {
      const subs = await getSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      console.error('Failed to load subscriptions');
    } finally {
      setIsLoading(false);
    }
  }

  const handleCancel = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel?')) return;

    try {
      await cancelSubscription(subscriptionId);
      loadSubscriptions();
    } catch (error) {
      alert('Failed to cancel subscription');
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Your Subscriptions</h2>

      {subscriptions.map(sub => (
        <div key={sub.id} className="border p-4 rounded">
          <h3>{sub.productName}</h3>
          <p>Status: {sub.status}</p>
          <p>Next billing: {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>

          {sub.status === 'active' && (
            <button
              onClick={() => handleCancel(sub.id)}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      ))}

      {subscriptions.length === 0 && (
        <p>No active subscriptions</p>
      )}
    </div>
  );
}
```

## Common Patterns

### License Key Delivery

```typescript
async function handleLicensePurchase(purchaseId: string) {
  // Generate unique license key
  const licenseKey = generateLicenseKey();

  // Store in D1
  await db.licenses.create({
    data: {
      id: crypto.randomUUID(),
      purchaseId,
      key: licenseKey,
      createdAt: Date.now(),
    },
  });

  // Send via email
  await sendLicenseEmail(customerEmail, licenseKey);
}
```

### Usage Tracking

```typescript
export const trackUsage = createServerFunction(
  "POST",
  async (feature: string) => {
    const user = await getAuthenticatedUser();

    // Check subscription limits
    const subscription = await db.subscriptions.findFirst({
      where: {
        customerId: user.customerId,
        status: "active",
      },
    });

    const usage = await db.usage.findMany({
      where: {
        customerId: user.customerId,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
      },
    });

    if (usage.length >= subscription.limit) {
      throw new Error("Usage limit exceeded");
    }

    // Record usage
    await db.usage.create({
      data: {
        customerId: user.customerId,
        feature,
        period: new Date().toISOString().slice(0, 7),
      },
    });
  },
);
```

## Validation Tools

Run `scripts/validate-webhooks.js` to verify webhook security and configuration.

## Best Practices

1. **Always verify webhook signatures** - Prevent fraud
2. **Store minimal data** - Only keep what you need
3. **Handle edge cases** - Failed payments, refunds, disputes
4. **Implement grace periods** - For failed subscriptions
5. **Test in sandbox** - Before going live
6. **Log everything** - For debugging and compliance

## Reference Materials

- [references/WEBHOOKS.md](references/WEBHOOKS.md) - Webhook event types
- [references/PRODUCTS.md](references/PRODUCTS.md) - Product configuration guide

# Polar Webhook Events Reference

## Event Types

### Checkout Events

#### `checkout.completed`

Triggered when a customer completes a checkout session.

```typescript
interface CheckoutCompleted {
  type: 'checkout.completed';
  data: {
    id: string;
    customer_id: string;
    customer_email: string;
    product_id: string;
    price_id: string;
    amount: number;        // in cents
    currency: string;
    metadata: Record<string, any>;
    created_at: string;
  };
}
```

**Action**: Create/update customer, provision access

### Subscription Events

#### `subscription.created`

New subscription created.

```typescript
interface SubscriptionCreated {
  type: 'subscription.created';
  data: {
    id: string;
    customer_id: string;
    product_id: string;
    price_id: string;
    status: 'active';
    current_period_start: string;
    current_period_end: string;
    created_at: string;
  };
}
```

**Action**: Store subscription, grant access

#### `subscription.updated`

Subscription changed (plan change, renewal).

```typescript
interface SubscriptionUpdated {
  type: 'subscription.updated';
  data: {
    id: string;
    customer_id: string;
    product_id: string;
    price_id: string;
    status: 'active' | 'past_due' | 'canceled';
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    updated_at: string;
  };
}
```

**Action**: Update subscription record, adjust access level

#### `subscription.canceled`

Subscription canceled (immediate or at period end).

```typescript
interface SubscriptionCanceled {
  type: 'subscription.canceled';
  data: {
    id: string;
    customer_id: string;
    status: 'canceled';
    canceled_at: string;
    cancel_at_period_end: boolean;
  };
}
```

**Action**: Mark as canceled, revoke access (immediate or at period end)

#### `subscription.past_due`

Payment failed, subscription past due.

```typescript
interface SubscriptionPastDue {
  type: 'subscription.past_due';
  data: {
    id: string;
    customer_id: string;
    status: 'past_due';
    updated_at: string;
  };
}
```

**Action**: Notify customer, implement grace period

### Customer Events

#### `customer.created`

New customer registered.

```typescript
interface CustomerCreated {
  type: 'customer.created';
  data: {
    id: string;
    email: string;
    name: string | null;
    metadata: Record<string, any>;
    created_at: string;
  };
}
```

**Action**: Store customer record, link to user

#### `customer.updated`

Customer information changed.

```typescript
interface CustomerUpdated {
  type: 'customer.updated';
  data: {
    id: string;
    email: string;
    name: string | null;
    metadata: Record<string, any>;
    updated_at: string;
  };
}
```

**Action**: Update customer record

## Webhook Handler Pattern

```typescript
import { Polar } from '@polar-sh/sdk';

export async function handlePolarWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // 1. Verify signature
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
  console.log('Webhook received:', event.type, event.data.id);

  // 3. Handle event
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
      case 'customer.created':
        await handleCustomerCreated(event.data, env);
        break;
      case 'customer.updated':
        await handleCustomerUpdated(event.data, env);
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }

    // 4. Store event for audit
    await env.DB.prepare(
      `INSERT INTO webhook_events (id, type, data, processed_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      event.data.id,
      event.type,
      JSON.stringify(event.data),
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    // Return 500 so Polar retries
    return new Response('Processing failed', { status: 500 });
  }
}
```

## Security Best Practices

1. **Always verify signatures** - Never process unverified webhooks
2. **Use idempotency** - Handle duplicate deliveries gracefully
3. **Log everything** - Store raw events for debugging
4. **Return quickly** - Process async if needed, return 200 fast
5. **Handle retries** - Polar retries failed webhooks
6. **Use HTTPS** - Required for production webhooks

## Testing Webhooks

### Polar Webhook Simulator

Use the Polar dashboard webhook simulator:

1. Go to Polar Dashboard → Settings → Webhooks
2. Find your webhook endpoint
3. Click "Send Test Event"
4. Select event type
5. Verify your handler processes correctly

### Local Development

```bash
# Use ngrok for local testing
ngrok http 3000

# Configure webhook URL in Polar:
# https://abc123.ngrok.io/api/webhooks/polar
```

## Error Handling

```typescript
async function handleWithRetry(handler: () => Promise<void>) {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await handler();
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }
  }

  throw lastError;
}
```

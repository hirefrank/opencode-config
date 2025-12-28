# Polar Product Configuration Guide

## Product Types

### Subscription Products

Recurring billing (monthly/yearly).

```typescript
interface SubscriptionProduct {
  id: string;
  name: string;
  description: string;
  prices: {
    id: string;
    amount: number;      // in cents (e.g., 2900 = $29.00)
    currency: string;    // "USD"
    interval: "month" | "year";
  }[];
  metadata: Record<string, any>;
}
```

### One-Time Products

Single purchase (licenses, downloads).

```typescript
interface OneTimeProduct {
  id: string;
  name: string;
  description: string;
  prices: {
    id: string;
    amount: number;
    currency: string;
  }[];
  metadata: Record<string, any>;
}
```

## Creating Products in Polar

1. **Go to Polar Dashboard**
   - Navigate to [polar.sh/dashboard](https://polar.sh/dashboard)
   - Select your organization

2. **Create Product**
   - Click "Products" → "New Product"
   - Set name, description, pricing
   - Add metadata for feature flags

3. **Configure Pricing**
   - Set price in cents (2900 = $29.00)
   - Choose interval for subscriptions
   - Add multiple prices for different plans

## Feature Flags with Metadata

Use metadata to control features per plan:

```typescript
// Product metadata in Polar dashboard
{
  "tier": "pro",
  "api_calls": 10000,
  "team_members": 5,
  "features": ["analytics", "export", "api"]
}
```

### Reading Features

```typescript
async function getUserFeatures(userId: string, env: Env): Promise<Features> {
  const subscription = await env.DB.prepare(
    `SELECT product_id, metadata FROM subscriptions
     WHERE user_id = ? AND status = 'active'`
  ).bind(userId).first();

  if (!subscription) {
    return DEFAULT_FEATURES;
  }

  const metadata = JSON.parse(subscription.metadata);

  return {
    tier: metadata.tier,
    apiCalls: metadata.api_calls,
    teamMembers: metadata.team_members,
    features: metadata.features,
  };
}
```

### Feature Checks

```typescript
async function canUseFeature(userId: string, feature: string, env: Env): Promise<boolean> {
  const features = await getUserFeatures(userId, env);
  return features.features.includes(feature);
}

// Usage
if (await canUseFeature(userId, 'analytics', env)) {
  // Show analytics
} else {
  // Show upgrade prompt
}
```

## Pricing Page Integration

```typescript
// Fetch products from Polar
async function getProducts(env: Env) {
  const polar = new PolarClient({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: 'production',
  });

  const products = await polar.products.list();
  return products.data;
}

// In your pricing component
const products = await getProducts(env);

return (
  <div className="grid grid-cols-3 gap-8">
    {products.map(product => (
      <PricingCard
        key={product.id}
        name={product.name}
        description={product.description}
        price={product.prices[0].amount / 100}
        interval={product.prices[0].interval}
        features={product.metadata.features}
        onSelect={() => handleCheckout(product.id)}
      />
    ))}
  </div>
);
```

## Plan Comparison

```typescript
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      api_calls: 100,
      team_members: 1,
      storage_gb: 1,
      support: 'community',
    },
  },
  pro: {
    name: 'Pro',
    price: 29,
    productId: 'polar_prod_xxx',
    features: {
      api_calls: 10000,
      team_members: 5,
      storage_gb: 50,
      support: 'email',
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    productId: 'polar_prod_yyy',
    features: {
      api_calls: -1, // unlimited
      team_members: -1,
      storage_gb: 500,
      support: 'priority',
    },
  },
};
```

## Upgrade/Downgrade Flow

```typescript
async function changePlan(
  subscriptionId: string,
  newProductId: string,
  env: Env
): Promise<void> {
  const polar = new PolarClient({
    accessToken: env.POLAR_ACCESS_TOKEN,
  });

  // Update subscription in Polar
  await polar.subscriptions.update({
    id: subscriptionId,
    product_id: newProductId,
    prorate: true, // Handle prorated billing
  });

  // Webhook will update local database
}
```

## Usage-Based Pricing

For metered billing:

```typescript
// Track usage
async function recordUsage(
  customerId: string,
  feature: string,
  quantity: number,
  env: Env
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO usage (customer_id, feature, quantity, recorded_at)
     VALUES (?, ?, ?, ?)`
  ).bind(
    customerId,
    feature,
    quantity,
    new Date().toISOString()
  ).run();
}

// Report to Polar (batch job)
async function reportUsage(env: Env): Promise<void> {
  const polar = new PolarClient({
    accessToken: env.POLAR_ACCESS_TOKEN,
  });

  // Get unreported usage
  const usage = await env.DB.prepare(
    `SELECT customer_id, feature, SUM(quantity) as total
     FROM usage
     WHERE reported = 0
     GROUP BY customer_id, feature`
  ).all();

  for (const record of usage.results) {
    await polar.usage.report({
      customer_id: record.customer_id,
      feature: record.feature,
      quantity: record.total,
    });
  }

  // Mark as reported
  await env.DB.prepare(
    `UPDATE usage SET reported = 1 WHERE reported = 0`
  ).run();
}
```

## Best Practices

1. **Use metadata for features** - Avoid hardcoding plan features
2. **Cache product data** - Products don't change often
3. **Handle plan changes gracefully** - Prorated billing, immediate access
4. **Show clear pricing** - Display in user's currency
5. **Offer annual discounts** - Common: 2 months free
6. **Track conversion** - Measure free → paid rate

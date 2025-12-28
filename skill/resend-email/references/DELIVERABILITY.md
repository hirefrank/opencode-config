# Email Deliverability Best Practices

## Domain Configuration

### Why Custom Domain?

- **Production requirement** - Improves deliverability significantly
- **Brand identity** - Emails from your domain, not resend.dev
- **SPF/DKIM/DMARC** - Authentication for security and compliance
- **Better inbox placement** - Major providers trust branded domains

### Setup Steps

1. **Add Domain in Resend Dashboard**
   - Go to Settings → Domains
   - Click "Add Domain"
   - Enter your domain (e.g., `yourdomain.com`)

2. **Add DNS Records**

   **SPF Record** (TXT):
   ```
   Host: @
   Value: v=spf1 include:resend.com ~all
   ```

   **DKIM Record** (CNAME):
   ```
   Host: resend._domainkey
   Value: (provided by Resend dashboard)
   ```

   **DMARC Record** (TXT):
   ```
   Host: _dmarc
   Value: v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com
   ```

3. **Verify Domain**
   - Wait 24-48 hours for DNS propagation
   - Click "Verify" in Resend dashboard
   - Green checkmark = verified

### Development vs Production

```typescript
// Development (using Resend's domain)
from: 'onboarding@resend.dev'  // Only sends to verified addresses

// Production (using your domain)
from: 'hello@yourdomain.com'   // Can send to anyone
```

## Email Authentication

### SPF (Sender Policy Framework)

Tells receiving servers which IPs can send email for your domain.

```
v=spf1 include:resend.com ~all
```

- `include:resend.com` - Authorizes Resend's servers
- `~all` - Soft fail for others (recommended for transition)
- `-all` - Hard fail (use after testing)

### DKIM (DomainKeys Identified Mail)

Cryptographic signature proving email wasn't modified.

- Resend auto-generates DKIM keys
- Add CNAME record from dashboard
- Emails are signed automatically

### DMARC (Domain-based Message Authentication)

Policy for handling failed SPF/DKIM checks.

```
v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com
```

- `p=none` - Monitor only (start here)
- `p=quarantine` - Send to spam
- `p=reject` - Block entirely

**Recommended progression:**
1. Week 1-2: `p=none` (monitor)
2. Week 3-4: `p=quarantine`
3. Week 5+: `p=reject` (if no issues)

## Sender Best Practices

### Use Consistent From Addresses

```typescript
// ✅ GOOD - Consistent, recognizable
from: 'hello@yourdomain.com'
from: 'support@yourdomain.com'
from: 'notifications@yourdomain.com'

// ❌ BAD - Random, looks spammy
from: 'noreply123@yourdomain.com'
from: 'do-not-reply@yourdomain.com'
```

### Reply-To Header

Allow recipients to reply:

```typescript
await resend.emails.send({
  from: 'notifications@yourdomain.com',
  replyTo: 'support@yourdomain.com',  // Replies go here
  to: user.email,
  subject: 'Your order shipped',
  react: OrderShippedEmail({ ... }),
});
```

### Display Name

```typescript
// With display name
from: 'Your Company <hello@yourdomain.com>'

// Just email
from: 'hello@yourdomain.com'
```

## Content Best Practices

### Subject Lines

```typescript
// ✅ GOOD - Clear, specific
'Welcome to [Company]'
'Your order #12345 has shipped'
'Reset your password'

// ❌ BAD - Spammy, vague
'URGENT: Act now!!!'
'You won't believe this'
'Re: Important'
```

### Avoid Spam Triggers

- Don't use ALL CAPS
- Avoid excessive punctuation (!!!, ???)
- Don't use spam keywords ("free", "winner", "urgent")
- Include plain text version
- Balance text and images

### Unsubscribe Link

**Required for marketing emails:**

```tsx
<Text style={{ fontSize: '12px', color: '#999' }}>
  You received this because you subscribed to our newsletter.
  <Link href={unsubscribeUrl}>Unsubscribe</Link>
</Text>
```

### Physical Address

**Required for commercial emails (CAN-SPAM):**

```tsx
<Text style={{ fontSize: '12px', color: '#999' }}>
  Your Company, Inc.
  123 Main Street, City, ST 12345
</Text>
```

## Monitoring & Analytics

### Resend Dashboard

Monitor in real-time:
- **Delivery rate** - % successfully delivered
- **Open rate** - % opened (tracking pixel)
- **Click rate** - % clicked links
- **Bounce rate** - % that bounced
- **Spam complaints** - % marked as spam

### Bounce Handling

```typescript
// Resend automatically handles bounces
// Access via API:
const { data } = await resend.emails.get('email-id');
console.log(data.status); // 'delivered', 'bounced', 'complained'
```

### Hard vs Soft Bounces

- **Hard bounce**: Invalid email (remove from list)
- **Soft bounce**: Temporary issue (retry later)

## Error Handling

### Retry Failed Emails

```typescript
// Store failed emails for retry
if (error) {
  await env.DB.prepare(
    `INSERT INTO failed_emails (email, template, error, retry_count, created_at)
     VALUES (?, ?, ?, 0, datetime('now'))`
  ).bind(email, 'welcome', error.message).run();
}

// Scheduled worker retries up to 3 times
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `validation_error` | Invalid email format | Validate before sending |
| `rate_limit_exceeded` | Too many requests | Implement backoff |
| `invalid_api_key` | Wrong/expired key | Check wrangler secrets |
| `domain_not_verified` | DNS not configured | Verify in dashboard |

## Rate Limits

### Resend Limits

- **Free tier**: 100 emails/day, 3,000/month
- **Pro tier**: Higher limits, batch API

### Handling Rate Limits

```typescript
const { error } = await resend.emails.send({ ... });

if (error?.name === 'rate_limit_exceeded') {
  // Queue for later
  await queueEmail(emailData);
}
```

## Warm-Up New Domains

### Why Warm Up?

New domains sending high volumes immediately trigger spam filters.

### Warm-Up Schedule

| Week | Daily Volume | Notes |
|------|-------------|-------|
| 1 | 50 | Only engaged users |
| 2 | 100 | Monitor bounces |
| 3 | 250 | Check spam rate |
| 4 | 500 | Increase if clean |
| 5+ | 1000+ | Full volume |

### Signs of Problems

- Bounce rate > 5%
- Spam complaints > 0.1%
- Low open rates

## Troubleshooting

### Email Not Arriving

1. Check Resend dashboard for status
2. Verify domain is confirmed
3. Check recipient's spam folder
4. Verify SPF/DKIM/DMARC records

### Going to Spam

1. Check DMARC policy
2. Reduce spam trigger words
3. Add physical address
4. Include unsubscribe link
5. Balance images/text ratio

### Low Open Rates

1. Improve subject lines
2. Send at optimal times
3. Segment your audience
4. Clean inactive subscribers

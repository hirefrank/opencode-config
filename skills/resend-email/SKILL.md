---
name: resend-email
description: Integrate Resend email service for Cloudflare Workers. Use for transactional emails, React Email templates, verification flows, newsletters, and batch operations.
license: MIT
metadata:
  author: opencode-config
  version: "1.0"
compatibility: Requires Resend account, Cloudflare Workers, React Email
allowed-tools: Bash(pnpm:*) Bash(wrangler:*) Read Write
triggers:
  - "email"
  - "resend"
  - "transactional"
  - "newsletter"
  - "verification email"
  - "password reset"
  - "welcome email"
  - "react email"
  - "email template"
  - "send email"
  - "batch email"
  - "notification"
  - "mail"
---

# Resend Email Integration

## Quick Start

```bash
# Install Resend SDK
pnpm add resend

# Install React Email (recommended)
pnpm add -E react-email @react-email/components

# Set API key
wrangler secret put RESEND_API_KEY
```

## Why Resend

- **Developer-First**: Clean TypeScript SDK, excellent DX
- **Cloudflare Workers Compatible**: No Node.js dependencies
- **React Email Support**: Type-safe templates using React components
- **Generous Free Tier**: 3,000 emails/month free
- **Built-in Analytics**: Track opens, clicks, bounces

## Basic Email Setup

### Simple Email (Server Function)

```typescript
import { createServerFn } from '@tanstack/start';
import { Resend } from 'resend';

export const sendEmail = createServerFn(
  { method: 'POST' },
  async (data: { to: string; subject: string; html: string }, context) => {
    const { env } = context.cloudflare;
    const resend = new Resend(env.RESEND_API_KEY);

    const { data: result, error } = await resend.emails.send({
      from: 'hello@yourdomain.com',
      to: data.to,
      subject: data.subject,
      html: data.html,
    });

    if (error) {
      throw new Error(`Email failed: ${error.message}`);
    }

    return { success: true, id: result.id };
  }
);
```

### With React Email Template

```typescript
import { Resend } from 'resend';
import { WelcomeEmail } from '@/emails/welcome';

const { data, error } = await resend.emails.send({
  from: 'welcome@yourdomain.com',
  to: user.email,
  subject: `Welcome, ${user.name}!`,
  react: WelcomeEmail({ name: user.name }),
});
```

## React Email Templates

Create email templates in `/app/emails/` directory:

```tsx
// app/emails/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
}

export function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to our platform!</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ padding: '20px', backgroundColor: '#ffffff' }}>
          <Heading>Welcome, {name}!</Heading>
          <Text>Thanks for signing up. We're excited to have you on board.</Text>
          <Button
            href={loginUrl}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
            }}
          >
            Get Started
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

## Common Email Types

### Email Verification

```typescript
export const sendVerificationEmail = createServerFn(
  { method: 'POST' },
  async (data: { email: string; token: string; name: string }, context) => {
    const { env } = context.cloudflare;
    const resend = new Resend(env.RESEND_API_KEY);

    const verificationUrl = `${env.APP_URL}/verify?token=${data.token}`;

    const { error } = await resend.emails.send({
      from: 'auth@yourdomain.com',
      to: data.email,
      subject: 'Verify your email address',
      react: VerifyEmailTemplate({
        verificationUrl,
        userName: data.name,
      }),
    });

    if (error) throw new Error('Failed to send verification email');
    return { success: true };
  }
);
```

### Password Reset

```typescript
export const sendPasswordResetEmail = createServerFn(
  { method: 'POST' },
  async (data: { email: string; token: string; name: string }, context) => {
    const { env } = context.cloudflare;
    const resend = new Resend(env.RESEND_API_KEY);

    const resetUrl = `${env.APP_URL}/reset-password?token=${data.token}`;

    const { error } = await resend.emails.send({
      from: 'auth@yourdomain.com',
      to: data.email,
      subject: 'Reset your password',
      react: PasswordResetEmail({ resetUrl, userName: data.name }),
    });

    if (error) throw new Error('Failed to send password reset email');
    return { success: true };
  }
);
```

### Batch Emails (High Volume)

```typescript
export const sendBatchNotifications = createServerFn(
  { method: 'POST' },
  async (data: { recipients: Array<{ email: string; name: string }>; message: string }, context) => {
    const { env } = context.cloudflare;
    const resend = new Resend(env.RESEND_API_KEY);

    const batchEmails = data.recipients.map((r) => ({
      from: 'notifications@yourdomain.com',
      to: r.email,
      subject: 'Notification',
      react: NotificationTemplate({ name: r.name, message: data.message }),
    }));

    const { data: result, error } = await resend.batch.send(batchEmails);

    if (error) throw new Error('Batch send failed');
    return { success: true, count: batchEmails.length };
  }
);
```

## Error Handling

```typescript
export const sendEmailWithRetry = createServerFn(
  { method: 'POST' },
  async (data: { email: string; name: string }, context) => {
    const { env } = context.cloudflare;
    const resend = new Resend(env.RESEND_API_KEY);

    const { data: result, error } = await resend.emails.send({
      from: 'welcome@yourdomain.com',
      to: data.email,
      subject: 'Welcome!',
      react: WelcomeEmail({ name: data.name }),
    });

    if (error) {
      // Store failed email for retry
      await env.DB.prepare(
        `INSERT INTO failed_emails (email, template, error, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      ).bind(data.email, 'welcome', error.message).run();

      return { success: false, error: 'Email queued for retry' };
    }

    return { success: true, id: result.id };
  }
);
```

## Domain Configuration

For production, configure a custom domain:

1. Add domain in Resend Dashboard (Settings → Domains)
2. Add DNS records:
   ```
   SPF: v=spf1 include:resend.com ~all
   DKIM: (auto-generated by Resend)
   DMARC: v=DMARC1; p=quarantine;
   ```
3. Verify domain in Resend dashboard
4. Use custom domain in `from` field

## Environment Variables

```bash
# Set secrets
wrangler secret put RESEND_API_KEY

# Local development (.dev.vars)
RESEND_API_KEY=re_your_test_key
APP_URL=http://localhost:3000
```

## Forbidden Alternatives

**Never use these** - Resend is the required email provider:
- ❌ SendGrid
- ❌ Mailgun
- ❌ AWS SES
- ❌ Postmark
- ❌ MailChimp
- ❌ Custom SMTP

## Validation Tools

Run `scripts/validate-email-config.js` to verify:
- API key is set
- Domain is verified
- Templates render correctly

## Reference Materials

- [references/TEMPLATES.md](references/TEMPLATES.md) - Email template patterns
- [references/DELIVERABILITY.md](references/DELIVERABILITY.md) - Domain setup and best practices

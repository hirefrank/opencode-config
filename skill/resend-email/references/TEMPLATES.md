# React Email Template Patterns

## Template Structure

All email templates should be placed in `/app/emails/` and use React Email components.

## Component Imports

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
```

## Base Template Pattern

```tsx
interface EmailProps {
  previewText: string;
  children: React.ReactNode;
}

export function BaseEmail({ previewText, children }: EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f4f4f4',
    margin: 0,
    padding: '20px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '600px',
    margin: '0 auto',
  },
};
```

## Welcome Email

```tsx
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
        <Container style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>
            Welcome, {name}!
          </Heading>
          <Text style={{ color: '#666', lineHeight: '1.6', fontSize: '16px' }}>
            Thanks for signing up. We're excited to have you on board.
          </Text>
          <Section style={{ marginTop: '30px', marginBottom: '30px' }}>
            <Button
              href={loginUrl}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              Get Started
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eee', margin: '20px 0' }} />
          <Text style={{ color: '#999', fontSize: '12px' }}>
            If you didn't sign up for this account, please ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## Email Verification

```tsx
interface VerifyEmailProps {
  verificationUrl: string;
  userName: string;
  expiresIn?: string;
}

export function VerifyEmailTemplate({ verificationUrl, userName, expiresIn = '24 hours' }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '24px', color: '#333' }}>Verify your email</Heading>
          <Text style={{ color: '#666', fontSize: '16px' }}>Hi {userName},</Text>
          <Text style={{ color: '#666', fontSize: '16px', lineHeight: '1.6' }}>
            Click the button below to verify your email address and complete your registration.
          </Text>
          <Section style={{ margin: '30px 0' }}>
            <Button
              href={verificationUrl}
              style={{
                backgroundColor: '#22c55e',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              Verify Email
            </Button>
          </Section>
          <Text style={{ color: '#999', fontSize: '14px' }}>
            Or copy this link: <Link href={verificationUrl} style={{ color: '#007bff' }}>{verificationUrl}</Link>
          </Text>
          <Text style={{ color: '#999', fontSize: '12px', marginTop: '20px' }}>
            This link expires in {expiresIn}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## Password Reset

```tsx
interface PasswordResetProps {
  resetUrl: string;
  userName: string;
}

export function PasswordResetEmail({ resetUrl, userName }: PasswordResetProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '24px', color: '#333' }}>Reset your password</Heading>
          <Text style={{ color: '#666', fontSize: '16px' }}>Hi {userName},</Text>
          <Text style={{ color: '#666', fontSize: '16px', lineHeight: '1.6' }}>
            We received a request to reset your password. Click below to create a new one.
          </Text>
          <Section style={{ margin: '30px 0' }}>
            <Button
              href={resetUrl}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              Reset Password
            </Button>
          </Section>
          <Text style={{ color: '#999', fontSize: '14px' }}>
            Or copy this link: <Link href={resetUrl} style={{ color: '#007bff' }}>{resetUrl}</Link>
          </Text>
          <Text style={{ color: '#999', fontSize: '12px', marginTop: '20px' }}>
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## Newsletter

```tsx
interface NewsletterProps {
  month: string;
  year: number;
  articles: Array<{
    title: string;
    description: string;
    link: string;
  }>;
  unsubscribeLink: string;
}

export function NewsletterTemplate({ month, year, articles, unsubscribeLink }: NewsletterProps) {
  return (
    <Html>
      <Head />
      <Preview>{month} Newsletter</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '28px', color: '#333', marginBottom: '30px' }}>
            {month} {year} Newsletter
          </Heading>

          {articles.map((article, idx) => (
            <Section key={idx} style={{ marginBottom: '25px', paddingBottom: '25px', borderBottom: '1px solid #eee' }}>
              <Heading as="h3" style={{ fontSize: '18px', marginBottom: '10px', color: '#333' }}>
                {article.title}
              </Heading>
              <Text style={{ color: '#666', lineHeight: '1.6' }}>{article.description}</Text>
              <Link href={article.link} style={{ color: '#007bff', fontWeight: 'bold' }}>
                Read more →
              </Link>
            </Section>
          ))}

          <Hr style={{ borderColor: '#eee', margin: '30px 0' }} />
          <Text style={{ color: '#999', fontSize: '12px', textAlign: 'center' }}>
            <Link href={unsubscribeLink} style={{ color: '#999' }}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## Notification

```tsx
interface NotificationProps {
  name: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

export function NotificationTemplate({ name, title, message, actionUrl, actionText }: NotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '20px', color: '#333' }}>{title}</Heading>
          <Text style={{ color: '#666', fontSize: '16px' }}>Hi {name},</Text>
          <Text style={{ color: '#666', fontSize: '16px', lineHeight: '1.6' }}>{message}</Text>

          {actionUrl && actionText && (
            <Section style={{ margin: '30px 0' }}>
              <Button
                href={actionUrl}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                }}
              >
                {actionText}
              </Button>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}
```

## Invoice/Receipt

```tsx
interface InvoiceEmailProps {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  invoiceUrl: string;
}

export function InvoiceEmail({ customerName, invoiceNumber, amount, currency, items, invoiceUrl }: InvoiceEmailProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100);

  return (
    <Html>
      <Head />
      <Preview>Invoice #{invoiceNumber}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '24px', color: '#333' }}>Invoice #{invoiceNumber}</Heading>
          <Text style={{ color: '#666' }}>Hi {customerName},</Text>
          <Text style={{ color: '#666' }}>Thank you for your purchase.</Text>

          <Section style={{ margin: '30px 0', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '6px' }}>
            {items.map((item, idx) => (
              <Row key={idx} style={{ marginBottom: '10px' }}>
                <Text style={{ margin: 0 }}>
                  {item.name} x{item.quantity} - {formatCurrency(item.price * item.quantity)}
                </Text>
              </Row>
            ))}
            <Hr style={{ borderColor: '#ddd', margin: '15px 0' }} />
            <Text style={{ fontWeight: 'bold', fontSize: '18px', margin: 0 }}>
              Total: {formatCurrency(amount)}
            </Text>
          </Section>

          <Button
            href={invoiceUrl}
            style={{
              backgroundColor: '#333',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '6px',
              textDecoration: 'none',
            }}
          >
            View Invoice
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

## Styling Best Practices

### Inline Styles Only

Email clients don't support external CSS or `<style>` tags reliably. Use inline styles:

```tsx
// ✅ CORRECT
<Text style={{ color: '#666', fontSize: '16px' }}>Content</Text>

// ❌ WRONG
<Text className="text-gray-600">Content</Text>
```

### Safe Fonts

```tsx
fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
```

### Safe Colors

Use hex colors, not CSS variables:

```tsx
// ✅ CORRECT
color: '#007bff'

// ❌ WRONG
color: 'var(--primary)'
```

### Width Constraints

Keep content width under 600px for mobile compatibility:

```tsx
<Container style={{ maxWidth: '600px', margin: '0 auto' }}>
```

## Testing Templates

```typescript
import { render } from '@react-email/render';
import { WelcomeEmail } from '@/emails/welcome';

// Render to HTML string for testing
const html = render(WelcomeEmail({ name: 'John', loginUrl: 'https://example.com' }));
console.log(html);
```

## Preview During Development

```bash
# Start React Email preview server
pnpm email dev

# Opens at http://localhost:3000
# Live preview of all templates in /app/emails/
```

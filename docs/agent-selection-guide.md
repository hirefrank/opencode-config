# Agent Selection Guide

Use this guide to determine which agent is best suited for your current task.

## The Decision Matrix

| Task Type                 | Recommended Agent   | Model Tier | When to Use                                                  |
| :------------------------ | :------------------ | :--------- | :----------------------------------------------------------- |
| **High-level Design**     | `@architect`        | 1 (Opus)   | System architecture, breaking changes, complex logic design. |
| **Full Code Review**      | `@reviewer`         | 1 (Opus)   | Comprehensive PR analysis using the review swarm.            |
| **Daily Implementation**  | `@general`          | 3 (Flash)  | General coding, bug fixes, small features.                   |
| **Quick Sanity Check**    | `@reviewer-fast`    | 3 (Flash)  | Rapid feedback on a small change.                            |
| **Quota Saving (Design)** | `@architect-alt`    | 2 (Pro)    | Use when Opus quota is low but you need high reasoning.      |
| **UI/UX Validation**      | `@ui-validator`     | 3 (Flash)  | Checking shadcn/ui props and Tailwind 4 patterns.            |
| **E2E Testing**           | `@testing`          | 3 (Flash)  | Generating Playwright tests.                                 |
| **Runtime Safety**        | `@runtime-guardian` | 4 (Script) | Verifying Workers compatibility (Node.js API checks).        |

## Escalation Path

1.  **Start with Tier 3 (Gemini Flash)**: Fast, cheap, and capable for 80% of tasks.
2.  **Escalate to Tier 2 (Gemini Pro)**: If Flash is struggling with complexity or you are low on Anthropic quota. Use the `-alt` agents.
3.  **Peak Reasoning (Claude 3.5 Opus)**: Use for the most critical architectural decisions or when synthesis of many complex perspectives is required.

## Specialized Integration Agents

| Agent                       | Domain                                         |
| :-------------------------- | :--------------------------------------------- |
| `@better-auth-specialist`   | Authentication patterns and D1 integration.    |
| `@polar-billing-specialist` | Polar.sh product setup and subscription logic. |
| `@tanstack-ssr-specialist`  | Server Functions and streaming patterns.       |
| `@resend-email-specialist`  | Transactional email setup and React Email.     |

## How to Invoke

In the CLI, you can invoke these agents using their handle:

```bash
# Example: Ask the architect for a design review
@architect "Review my proposed D1 schema for the marketplace"

# Example: Run a fast review
@reviewer-fast "Does this change break the KV cache logic?"
```

# Agent Consolidation Rationale

This document explains the architectural decision to consolidate specialized agents into a tiered, swarm-based system.

## Context

Initially, the Edge Stack project utilized a large number of highly specialized agents (over 30). While this provided depth in specific domains, it introduced several inefficiencies as the project scaled.

## Problems with High Specialization

1.  **Context Window Fragmentation**: Each specialized agent required its own set of instructions and patterns. When multiple agents were needed for a single task (e.g., a code review covering security, performance, and UI), the redundant loading of base project context was token-inefficient.
2.  **Sequential Bottlenecks**: Complex workflows like `es-review` were forced to run agents sequentially or required manual orchestration. This led to significantly longer feedback loops (e.g., 20-minute reviews).
3.  **Perspective Silos**: Specialized agents often lacked awareness of how their recommendations impacted other domains. A performance optimization might inadvertently introduce an accessibility regression if the agents didn't "talk" to each other.
4.  **Quota Inefficiency**: Without a tiered model system, expensive models (like Claude 3.5 Opus) were often used for simple tasks like syntax checking or documentation auditing, leading to rapid quota exhaustion.

## The Tiered Swarm Solution

We moved to a tiered architecture optimized for the "Hard Tools over Soft Instructions" philosophy.

### 1. Model Tiering (Bucket Philosophy)

We categorize agents by model tier to optimize for cost, quality, and quota management:

- **Tier 1 (Gold Standard)**: Opus 4.5 for complex reasoning and coordination.
- **Tier 2 (High-Reasoning Alternatives)**: Gemini Pro for high-quality work when Opus quota is low.
- **Tier 3 (Fast & Lightweight)**: Gemini Flash for parallel workers, general chat, and quick tasks.
- **Tier 4 (Validation Scripts)**: Deterministic scripts ("Big Pickle") for objective verification.

### 2. Swarm Orchestration

Instead of one agent trying to know everything, we use a **Coordinator-Worker** pattern:

- A high-reasoning **Coordinator** (Tier 1) decomposes the task.
- Multiple **Workers** (Tier 3) execute specialized analysis in parallel.
- The Coordinator synthesizes the results into a single, coherent output.

## Benefits

- **70% Cost Reduction**: Orchestrating one Tier 1 call with multiple Tier 3 calls is significantly cheaper than multiple Tier 1 calls.
- **75% Time Savings**: Parallel execution reduces the duration of complex tasks from ~20 minutes to ~5 minutes.
- **Quota Protection**: Proactive use of Tier 2 and Tier 3 models preserves Tier 1 quota for truly difficult problems.
- **Unified Intelligence**: The synthesis phase ensures that conflicting recommendations are resolved before being presented to the user.

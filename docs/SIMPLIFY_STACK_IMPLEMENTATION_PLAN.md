# Simplify-Stack Implementation Plan

Detailed phased plan for implementing semantic skill selection, knowledge migration, and CLI hardening.

---

## Phase 1: Semantic Skill Selection

**Goal**: Replace naive keyword matching with embedding-based semantic search.

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Task Input                        │
│            "Design a rate limiter for API"          │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Embedding Generation                    │
│         task_embedding = embed(task_text)           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│            Skill Index (Pre-computed)               │
│  ┌─────────────────────────────────────────────┐   │
│  │ cloudflare-workers: [0.23, 0.87, ...]       │   │
│  │ durable-objects:    [0.91, 0.12, ...]       │   │
│  │ tanstack-start:     [0.05, 0.34, ...]       │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│           Cosine Similarity Ranking                 │
│  1. durable-objects (0.89) ✓                       │
│  2. cloudflare-workers (0.72) ✓                    │
│  3. tanstack-start (0.31) ✗                        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│         Selected Skills (threshold > 0.6)           │
│    [durable-objects, cloudflare-workers]           │
└─────────────────────────────────────────────────────┘
```

### 1.2 Implementation Steps

#### Step 1: Add Embedding Dependencies

```json
// package.json additions
{
  "dependencies": {
    "@xenova/transformers": "^2.17.0"  // Local embeddings, no API needed
  }
}
```

**Why local embeddings?**
- No API costs or rate limits
- Works offline
- Fast (~50ms per embedding)
- Model: `all-MiniLM-L6-v2` (22MB, 384 dimensions)

#### Step 2: Create Skill Indexer

```typescript
// src/skill-indexer.ts
import { pipeline } from "@xenova/transformers";

interface SkillIndex {
  name: string;
  embedding: number[];
  content: string;
  path: string;
}

export class SkillIndexer {
  private embedder: any;
  private index: SkillIndex[] = [];
  private indexPath = ".opencode/skill-index.json";

  async initialize(): Promise<void> {
    this.embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    await this.loadOrBuildIndex();
  }

  private async embed(text: string): Promise<number[]> {
    const output = await this.embedder(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }

  async buildIndex(skillsDir: string): Promise<void> {
    const skills = await this.loadSkillFiles(skillsDir);

    for (const skill of skills) {
      // Embed: name + description + first 500 chars of content
      const textToEmbed = `${skill.name} ${skill.description} ${skill.content.slice(0, 500)}`;
      const embedding = await this.embed(textToEmbed);

      this.index.push({
        name: skill.name,
        embedding,
        content: skill.content,
        path: skill.path,
      });
    }

    await this.saveIndex();
  }

  async search(query: string, topK = 3, threshold = 0.6): Promise<SkillIndex[]> {
    const queryEmbedding = await this.embed(query);

    const scored = this.index.map((skill) => ({
      skill,
      score: this.cosineSimilarity(queryEmbedding, skill.embedding),
    }));

    return scored
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ skill }) => skill);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async loadOrBuildIndex(): Promise<void> {
    try {
      const cached = await Bun.file(this.indexPath).json();
      if (await this.isIndexStale(cached)) {
        await this.buildIndex("skills/");
      } else {
        this.index = cached.skills;
      }
    } catch {
      await this.buildIndex("skills/");
    }
  }

  private async isIndexStale(cached: any): Promise<boolean> {
    // Check if any skill file is newer than index
    const indexMtime = cached.timestamp;
    const skillFiles = await this.getSkillFiles("skills/");

    for (const file of skillFiles) {
      const stat = await Bun.file(file).stat();
      if (stat.mtime > indexMtime) return true;
    }
    return false;
  }
}
```

#### Step 3: Integrate with Edge Agent

```typescript
// src/edge-agent.ts (modified)
import { SkillIndexer } from "./skill-indexer";

export class EdgeStackAgent {
  private skillIndexer: SkillIndexer;

  async initialize(): Promise<void> {
    this.skillIndexer = new SkillIndexer();
    await this.skillIndexer.initialize();
  }

  async selectSkills(task: string): Promise<Skill[]> {
    // Semantic search replaces keyword matching
    const matches = await this.skillIndexer.search(task, 3, 0.6);

    console.log(`📎 Semantic matches: ${matches.map(m => m.name).join(", ")}`);

    return matches.map(m => ({
      name: m.name,
      content: m.content,
      path: m.path,
    }));
  }
}
```

#### Step 4: Add Index Rebuild Command

```typescript
// src/edge-cli.ts addition
program
  .command("reindex")
  .description("Rebuild skill embedding index")
  .action(async () => {
    const indexer = new SkillIndexer();
    console.log("🔄 Building skill index...");
    await indexer.buildIndex("skills/");
    console.log("✅ Index rebuilt");
  });
```

### 1.3 Testing Plan

| Test Case | Input Task | Expected Skills | Threshold |
|-----------|-----------|-----------------|-----------|
| Rate limiting | "Design rate limiter" | durable-objects, cloudflare-workers | 0.6+ |
| Auth setup | "Add GitHub OAuth" | better-auth | 0.6+ |
| UI work | "Create dashboard component" | shadcn-ui, tanstack-start | 0.6+ |
| Billing | "Integrate subscriptions" | polar-billing | 0.6+ |
| Ambiguous | "Fix the bug" | (none - too vague) | < 0.6 |

### 1.4 Deliverables

- [ ] `src/skill-indexer.ts` - Embedding-based skill indexer
- [ ] `.opencode/skill-index.json` - Cached embeddings
- [ ] `edge reindex` command
- [ ] Unit tests for similarity scoring
- [ ] Integration test for skill selection

---

## Phase 2: Knowledge Migration

**Goal**: Migrate deep agent expertise from `agent/*.md` files to enriched skills.

### 2.1 Migration Mapping

| Source Agent | Target Skill | Content to Migrate |
|--------------|--------------|-------------------|
| `agent/cloudflare/durable-objects.md` | `skills/durable-objects/` | State patterns, anti-patterns, examples |
| `agent/tanstack/tanstack-ui-architect.md` | `skills/tanstack-start/` | Architecture patterns, SSR guidance |
| `agent/tanstack/frontend-design-specialist.md` | `skills/shadcn-ui/` | Anti-patterns, distinctiveness rules |
| `agent/integrations/better-auth-specialist.md` | `skills/better-auth/` | D1 setup, provider configs |
| `agent/integrations/polar-billing-specialist.md` | `skills/polar-billing/` | Webhook patterns, subscription flows |
| `agent/reviewer.md` | `skills/code-reviewer/` | Swarm patterns, confidence scoring |

### 2.2 Enhanced Skill Structure

```
skills/durable-objects/
├── SKILL.md                    # Quick reference (existing)
├── PATTERNS.md                 # ← NEW: Validated patterns from agent
├── ANTI_PATTERNS.md            # ← NEW: What NOT to do
├── EXAMPLES/                   # ← NEW: Working code examples
│   ├── rate-limiter.ts
│   ├── websocket-hub.ts
│   └── coordination-lock.ts
├── DECISION_TREE.md            # ← NEW: When to use DO vs KV vs D1
└── scripts/
    ├── validate-do.js          # Runtime validation
    └── design-do-pattern.js    # Pattern generator (existing)
```

### 2.3 Migration Script

```typescript
// scripts/migrate-agent-knowledge.ts
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface AgentMigration {
  agentPath: string;
  skillPath: string;
  sections: {
    patterns: string[];      // Headings to extract for PATTERNS.md
    antiPatterns: string[];  // Headings for ANTI_PATTERNS.md
    examples: string[];      // Code blocks to extract
  };
}

const migrations: AgentMigration[] = [
  {
    agentPath: "agent/cloudflare/durable-objects.md",
    skillPath: "skills/durable-objects",
    sections: {
      patterns: ["State Management", "Alarm Patterns", "Singleton Pattern"],
      antiPatterns: ["Common Mistakes", "Performance Pitfalls"],
      examples: ["Rate Limiter", "WebSocket Hub"],
    },
  },
  {
    agentPath: "agent/tanstack/frontend-design-specialist.md",
    skillPath: "skills/shadcn-ui",
    sections: {
      patterns: ["Component Customization", "Theme System"],
      antiPatterns: ["Generic UI", "Forbidden Patterns", "Typography"],
      examples: ["Custom Button", "Dashboard Layout"],
    },
  },
  // ... more migrations
];

async function migrateAgent(migration: AgentMigration): Promise<void> {
  const content = await readFile(migration.agentPath, "utf-8");
  const sections = parseMarkdownSections(content);

  // Create PATTERNS.md
  const patterns = migration.sections.patterns
    .map((heading) => sections[heading])
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (patterns) {
    await writeFile(
      join(migration.skillPath, "PATTERNS.md"),
      `# Validated Patterns\n\n${patterns}`
    );
  }

  // Create ANTI_PATTERNS.md
  const antiPatterns = migration.sections.antiPatterns
    .map((heading) => sections[heading])
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (antiPatterns) {
    await writeFile(
      join(migration.skillPath, "ANTI_PATTERNS.md"),
      `# Anti-Patterns (AVOID)\n\n${antiPatterns}`
    );
  }

  // Extract code examples
  const examples = extractCodeBlocks(content, migration.sections.examples);
  if (examples.length > 0) {
    await mkdir(join(migration.skillPath, "EXAMPLES"), { recursive: true });
    for (const example of examples) {
      await writeFile(
        join(migration.skillPath, "EXAMPLES", `${example.name}.ts`),
        example.code
      );
    }
  }

  console.log(`✅ Migrated ${migration.agentPath} → ${migration.skillPath}`);
}

async function main(): Promise<void> {
  for (const migration of migrations) {
    await migrateAgent(migration);
  }
}
```

### 2.4 SKILL.md Enhancement

Update frontmatter to reference new files:

```yaml
---
name: durable-objects
description: Stateful coordination on Cloudflare Workers edge
license: MIT
metadata:
  author: opencode-config
  version: "2.0"
  migrated_from: agent/cloudflare/durable-objects.md
compatibility: Requires wrangler CLI, Cloudflare account
allowed-tools: Bash(wrangler:*) Read Write

# NEW: Reference additional knowledge
includes:
  - PATTERNS.md
  - ANTI_PATTERNS.md
  - DECISION_TREE.md

# NEW: Escalation hints for complex tasks
escalation:
  triggers:
    - "design.*durable object"
    - "state.*coordination"
    - "websocket.*realtime"
  recommended_mode: architect
---
```

### 2.5 Validation Checklist

For each migrated skill:

- [ ] All patterns from agent are preserved
- [ ] Anti-patterns are clearly marked as "AVOID"
- [ ] Code examples compile and run
- [ ] SKILL.md frontmatter updated with `includes`
- [ ] Escalation triggers defined for complex tasks
- [ ] Original agent file marked as deprecated

### 2.6 Deliverables

- [ ] `scripts/migrate-agent-knowledge.ts`
- [ ] 6 enriched skill directories with PATTERNS.md, ANTI_PATTERNS.md
- [ ] EXAMPLES/ directories with working code
- [ ] Updated SKILL.md frontmatter
- [ ] Deprecation notices in original agent files

---

## Phase 3: CLI Hardening

**Goal**: Production-ready CLI with streaming, error handling, and beads integration.

### 3.1 Error Handling Framework

```typescript
// src/errors.ts
export class EdgeStackError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = "EdgeStackError";
  }
}

export class ProviderError extends EdgeStackError {
  constructor(provider: string, cause: Error) {
    super(
      `Provider ${provider} failed: ${cause.message}`,
      "PROVIDER_ERROR",
      true // Recoverable via fallback
    );
  }
}

export class SkillNotFoundError extends EdgeStackError {
  constructor(skillName: string) {
    super(
      `Skill "${skillName}" not found. Run 'edge skills' to list available skills.`,
      "SKILL_NOT_FOUND",
      false
    );
  }
}

export class IndexStaleError extends EdgeStackError {
  constructor() {
    super(
      "Skill index is stale. Run 'edge reindex' to rebuild.",
      "INDEX_STALE",
      true
    );
  }
}
```

### 3.2 Streaming Implementation

```typescript
// src/streaming.ts
import { harness, ChatMessage } from "./model-harness";

export async function* streamChat(
  messages: ChatMessage[],
  mode: "architect" | "worker" | "intern"
): AsyncGenerator<string, void, unknown> {
  const provider = harness.getPrimaryProvider();

  if (!provider) {
    throw new EdgeStackError("No provider available", "NO_PROVIDER");
  }

  // Anthropic streaming
  if (provider.name === "anthropic") {
    const stream = await provider.client.messages.stream({
      model: provider.models[mode],
      max_tokens: 4096,
      messages: messages.filter(m => m.role !== "system"),
      system: messages.find(m => m.role === "system")?.content,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" &&
          event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }

  // OpenAI streaming
  else if (provider.name === "openai") {
    const stream = await provider.client.chat.completions.create({
      model: provider.models[mode],
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  // Google streaming
  else if (provider.name === "google") {
    const model = provider.client.getGenerativeModel({
      model: provider.models[mode],
    });
    const result = await model.generateContentStream(
      messages.map(m => m.content).join("\n")
    );

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}
```

### 3.3 Beads Integration

```typescript
// src/beads.ts
import { $ } from "bun";

interface BeadsTask {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  priority: number;
}

export class BeadsIntegration {
  async ready(): Promise<BeadsTask[]> {
    const result = await $`bd ready --json`.quiet();
    return JSON.parse(result.stdout.toString());
  }

  async claim(id: string): Promise<void> {
    await $`bd update ${id} --status in_progress`.quiet();
  }

  async done(id: string): Promise<void> {
    await $`bd done ${id}`.quiet();
  }

  async create(title: string, body?: string): Promise<string> {
    const result = await $`bd create ${title} ${body ? `--body "${body}"` : ""}`.quiet();
    // Parse ID from output
    const match = result.stdout.toString().match(/Created: (bd-\w+)/);
    return match?.[1] ?? "";
  }

  async sync(): Promise<void> {
    await $`bd sync`.quiet();
  }

  async extractTaskMentions(text: string): Promise<string[]> {
    const matches = text.match(/bd-[a-z0-9]+/gi);
    return matches ?? [];
  }
}
```

### 3.4 Enhanced CLI

```typescript
// src/edge-cli.ts (complete rewrite)
import { program } from "commander";
import { EdgeStackAgent } from "./edge-agent";
import { streamChat } from "./streaming";
import { BeadsIntegration } from "./beads";
import { EdgeStackError } from "./errors";
import ora from "ora";

const agent = new EdgeStackAgent();
const beads = new BeadsIntegration();

async function initialize(): Promise<void> {
  const spinner = ora("Initializing Edge Stack...").start();
  try {
    await agent.initialize();
    spinner.succeed("Edge Stack ready");
  } catch (error) {
    spinner.fail(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

program
  .name("edge")
  .description("Edge Stack Development Agent")
  .version("2.0.0");

// Main work command
program
  .command("work")
  .description("Work on a task")
  .option("-m, --mode <mode>", "Agent mode", "worker")
  .option("-s, --stream", "Stream response", false)
  .option("--dry-run", "Show selected skills without executing", false)
  .option("-t, --task <id>", "Beads task ID to work on")
  .argument("[description]", "Task description")
  .action(async (description, options) => {
    await initialize();

    // Get task from beads if ID provided
    if (options.task) {
      await beads.claim(options.task);
      console.log(`📋 Claimed task: ${options.task}`);
    }

    // Read from stdin if no description
    if (!description) {
      description = await readStdin();
    }

    if (!description) {
      console.error("❌ No task description provided");
      process.exit(1);
    }

    agent.setMode(options.mode);

    // Dry run: show skills only
    if (options.dryRun) {
      const skills = await agent.selectSkills(description);
      console.log("📚 Would use skills:");
      skills.forEach(s => console.log(`   - ${s.name}`));
      return;
    }

    try {
      if (options.stream) {
        // Streaming mode
        process.stdout.write("\n🤖 ");
        for await (const chunk of agent.streamTask(description)) {
          process.stdout.write(chunk);
        }
        console.log("\n");
      } else {
        // Batch mode
        const spinner = ora("Thinking...").start();
        const response = await agent.handleTask(description);
        spinner.stop();
        console.log("\n🤖 Response:\n");
        console.log(response);
      }

      // Check for beads mentions
      if (options.task) {
        console.log(`\n💡 Run 'bd done ${options.task}' when complete`);
      }
    } catch (error) {
      handleError(error);
    }
  });

// Task list from beads
program
  .command("tasks")
  .description("Show available tasks from beads")
  .action(async () => {
    try {
      const tasks = await beads.ready();
      if (tasks.length === 0) {
        console.log("✨ No tasks available. Create one with 'bd create'");
        return;
      }

      console.log("📋 Available tasks:\n");
      tasks.forEach(task => {
        const priority = "!".repeat(task.priority);
        console.log(`  ${task.id} ${priority} ${task.title}`);
      });
      console.log(`\nRun 'edge work -t <id>' to claim and work on a task`);
    } catch (error) {
      console.error("❌ Beads not available. Run 'bd onboard' first.");
    }
  });

// Skill management
program
  .command("skills")
  .description("List available skills")
  .option("-v, --verbose", "Show skill details", false)
  .action(async (options) => {
    await initialize();
    const status = agent.getStatus();

    console.log("📚 Available Skills:\n");
    for (const skill of status.skills) {
      if (options.verbose) {
        const info = await agent.getSkillInfo(skill);
        console.log(`  ${skill}`);
        console.log(`     ${info.description}`);
        console.log(`     Files: ${info.files.join(", ")}\n`);
      } else {
        console.log(`  - ${skill}`);
      }
    }
  });

// Reindex skills
program
  .command("reindex")
  .description("Rebuild skill embedding index")
  .action(async () => {
    const spinner = ora("Building skill index...").start();
    try {
      await agent.rebuildIndex();
      spinner.succeed("Index rebuilt");
    } catch (error) {
      spinner.fail(`Reindex failed: ${error.message}`);
    }
  });

// Provider status
program
  .command("status")
  .description("Show agent and provider status")
  .action(async () => {
    await initialize();
    const status = agent.getStatus();

    console.log("\n📊 Edge Stack Status\n");
    console.log(`  Mode:     ${status.mode}`);
    console.log(`  Primary:  ${status.primary ?? "None"}`);
    console.log(`  Fallback: ${status.providers.filter(p => p !== status.primary).join(", ") || "None"}`);
    console.log(`  Skills:   ${status.skills.length} loaded`);
    console.log(`  Index:    ${status.indexAge}`);
  });

// Error handler
function handleError(error: unknown): void {
  if (error instanceof EdgeStackError) {
    console.error(`\n❌ ${error.message}`);
    if (error.recoverable) {
      console.log("   This error may be recoverable. Check your configuration.");
    }
    process.exit(1);
  }

  console.error(`\n❌ Unexpected error: ${error}`);
  process.exit(1);
}

// Stdin helper
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString().trim();
}

program.parse();
```

### 3.5 Deliverables

- [ ] `src/errors.ts` - Error hierarchy
- [ ] `src/streaming.ts` - Multi-provider streaming
- [ ] `src/beads.ts` - Beads integration
- [ ] `src/edge-cli.ts` - Hardened CLI
- [ ] Unit tests for each module
- [ ] Integration tests for full workflows

---

## Timeline Summary

| Phase | Focus | Key Deliverables | Effort |
|-------|-------|------------------|--------|
| **1** | Semantic Skill Selection | Embedding indexer, search API, reindex command | 3-4 days |
| **2** | Knowledge Migration | Migration script, 6 enriched skills, deprecation | 2-3 days |
| **3** | CLI Hardening | Streaming, errors, beads, status commands | 3-4 days |

**Total: ~10 days of focused work**

---

## Appendix: File Manifest

### New Files
```
src/
├── skill-indexer.ts      # Phase 1
├── streaming.ts          # Phase 3
├── errors.ts             # Phase 3
├── beads.ts              # Phase 3
└── edge-cli.ts           # Phase 3 (rewrite)

scripts/
└── migrate-agent-knowledge.ts  # Phase 2

.opencode/
└── skill-index.json      # Generated by Phase 1
```

### Modified Files
```
skills/*/SKILL.md         # Phase 2: Updated frontmatter
skills/*/PATTERNS.md      # Phase 2: Migrated content
skills/*/ANTI_PATTERNS.md # Phase 2: Migrated content
skills/*/EXAMPLES/        # Phase 2: Code examples
package.json              # Phase 1: Add @xenova/transformers
```

### Deprecated Files (after Phase 2)
```
agent/cloudflare/durable-objects.md
agent/tanstack/frontend-design-specialist.md
agent/tanstack/tanstack-ui-architect.md
agent/integrations/better-auth-specialist.md
agent/integrations/polar-billing-specialist.md
agent/reviewer.md  # Partial - keep swarm patterns
```

---

## Build vs Leverage: oh-my-opencode Analysis

### What oh-my-opencode Provides

[oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) is the #1 OpenCode plugin with:

| Feature | Description | Relevance to Our Goals |
|---------|-------------|------------------------|
| **7 Curated Agents** | Sisyphus (Opus), Oracle (GPT-5.2), Librarian, Explore, Frontend, etc. | Overlaps with our multi-agent needs |
| **21 Hooks** | `tool.execute.before/after`, `chat.message`, `permission.ask`, etc. | Could implement skill selection |
| **Skill Loading** | `find_skills` and `use_skills` tools, Claude Code compatible | **Direct match for Phase 1** |
| **Background Agents** | Async subagent spawning via `BackgroundManager` | Parallel execution support |
| **LSP/AST-Grep Tools** | 11 LSP tools, AST-based search | Better code understanding |
| **MCP Integration** | Context7, Exa, Grep.app pre-configured | Ground truth sources |
| **Todo Continuation** | Prevents agents from abandoning tasks | Workflow reliability |

### Mapping Our Phases to oh-my-opencode

#### Phase 1: Semantic Skill Selection

**oh-my-opencode approach**:
```
src/tools/skill.ts → find_skills, use_skills
~/.config/opencode/skills/ → User skills
.opencode/skills/ → Project skills
```

**What we'd need to add**:
- Embedding-based search (oh-my-opencode uses file discovery, not semantic)
- Our custom skill format with PATTERNS.md, scripts, etc.

**Verdict**: oh-my-opencode provides the **loading infrastructure** but not **semantic selection**. We'd extend, not replace.

#### Phase 2: Knowledge Migration

**oh-my-opencode approach**:
- Skills are markdown files, similar to ours
- Claude Code compatible format
- No script execution in skills

**What we'd need to add**:
- Our enhanced skill structure (PATTERNS.md, EXAMPLES/, scripts/)
- Skill script execution hooks

**Verdict**: **Fully compatible**. Our enriched skills work with oh-my-opencode's loader.

#### Phase 3: CLI Hardening

**oh-my-opencode approach**:
- No standalone CLI (runs within OpenCode)
- Uses OpenCode's streaming, error handling, etc.
- Beads integration would need a custom hook

**What we'd lose**:
- Standalone `edge` CLI
- Model-agnostic harness (tied to OpenCode providers)

**Verdict**: **Different paradigm**. oh-my-opencode is a plugin, not a CLI.

### Decision Matrix

| Criteria | Build from Scratch | Leverage oh-my-opencode |
|----------|-------------------|------------------------|
| **Time to MVP** | ~10 days | ~4 days |
| **Semantic skill selection** | Must build | Must build (extend) |
| **Skill loading infra** | Must build | ✅ Already done |
| **Multi-provider support** | ✅ Model harness | Tied to OpenCode |
| **Background agents** | Must build | ✅ Already done |
| **Hook system** | Must build | ✅ 21 hooks ready |
| **Standalone CLI** | ✅ Full control | ❌ Plugin only |
| **Community support** | None | Active community |
| **Maintenance burden** | High | Shared with maintainer |

### Recommendation: Hybrid Approach

**Leverage oh-my-opencode for**:
1. Skill loading infrastructure (`find_skills`, `use_skills`)
2. Hook system for injecting behavior
3. Background agent spawning
4. LSP/AST tools for code understanding

**Build custom for**:
1. Semantic skill selection (extend their skill tool)
2. Enhanced skill format (PATTERNS.md, scripts/)
3. Beads integration hook

### Implementation as oh-my-opencode Extension

```typescript
// oh-my-opencode-edge-stack/src/index.ts
import { Plugin } from "opencode";
import { SkillIndexer } from "./skill-indexer";

export const EdgeStackPlugin: Plugin = async (ctx) => {
  const indexer = new SkillIndexer();
  await indexer.initialize();

  return {
    // Extend skill selection with semantic search
    tool: {
      find_skills_semantic: {
        description: "Find relevant skills using semantic search",
        schema: { query: "string" },
        async execute({ query }) {
          const matches = await indexer.search(query);
          return matches.map(m => m.name);
        }
      }
    },

    // Hook into chat to inject skills
    async event({ event }) {
      if (event.type === "chat.message") {
        const skills = await indexer.search(event.message);
        if (skills.length > 0) {
          // Inject skill content into context
          event.context.skills = skills;
        }
      }
    },

    // Beads integration hook
    async "tool.execute.after"({ tool, result }) {
      if (tool.name === "TodoWrite") {
        // Sync with beads
        await syncWithBeads(result);
      }
    }
  };
};
```

### Revised Timeline with oh-my-opencode

| Phase | Build from Scratch | With oh-my-opencode |
|-------|-------------------|---------------------|
| **1: Semantic Selection** | 3-4 days | 2 days (extend their tool) |
| **2: Knowledge Migration** | 2-3 days | 2-3 days (same) |
| **3: Integration** | 3-4 days | 1-2 days (use their hooks) |
| **Total** | ~10 days | **~5-6 days** |

### Final Answer

**Yes, leverage oh-my-opencode**. Here's why:

1. **Skill infrastructure exists** - Don't rebuild file discovery, loading, caching
2. **Hook system is mature** - 21 hooks vs building our own event system
3. **Background agents work** - Parallel execution without rolling our own
4. **Community maintained** - Bugs get fixed by others
5. **Claude Code compatible** - Skills work across tools

**What we build**:
1. `oh-my-opencode-edge-stack` extension plugin
2. `SkillIndexer` with embeddings (same code, different integration)
3. Beads sync hook
4. Enhanced skill format (PATTERNS.md, scripts/)

**What we skip**:
1. Standalone CLI (use OpenCode directly)
2. Model harness (use OpenCode's providers)
3. Streaming implementation (OpenCode handles it)
4. Error handling framework (OpenCode handles it)

The model-agnostic harness was nice-to-have, but OpenCode already supports Anthropic, OpenAI, and Google. Portability isn't worth 5 extra days of work.

---

## Revised Implementation Plan (oh-my-opencode Extension)

### Phase 1: Semantic Skill Selection (2 days)

**Day 1: Indexer**
- [ ] Create `oh-my-opencode-edge-stack` npm package
- [ ] Port `SkillIndexer` from simplify-stack
- [ ] Add `@xenova/transformers` for local embeddings
- [ ] Implement index caching in `.opencode/`

**Day 2: Integration**
- [ ] Create `find_skills_semantic` tool
- [ ] Hook into `chat.message` for auto-injection
- [ ] Test with existing skills

### Phase 2: Knowledge Migration (2-3 days)

**Day 3-4: Content Migration**
- [ ] Run migration script (same as before)
- [ ] Create PATTERNS.md, ANTI_PATTERNS.md for 6 skills
- [ ] Add EXAMPLES/ directories
- [ ] Update SKILL.md frontmatter

**Day 5: Validation**
- [ ] Verify skills load correctly
- [ ] Test semantic matching accuracy
- [ ] Deprecate old agent files

### Phase 3: Beads & Polish (1-2 days)

**Day 6: Integration**
- [ ] Add `tool.execute.after` hook for beads sync
- [ ] Create `bd` command shortcuts as tools
- [ ] Add status/health check tool

**Day 7: Documentation**
- [ ] Update README for plugin installation
- [ ] Document skill creation workflow
- [ ] Add troubleshooting guide

### Deliverables

```
oh-my-opencode-edge-stack/
├── package.json
├── src/
│   ├── index.ts           # Plugin entry
│   ├── skill-indexer.ts   # Semantic search
│   ├── beads-hook.ts      # Task sync
│   └── tools/
│       └── find-skills-semantic.ts
└── README.md

# In opencode-config repo:
skills/
├── durable-objects/
│   ├── SKILL.md
│   ├── PATTERNS.md        # NEW
│   ├── ANTI_PATTERNS.md   # NEW
│   └── EXAMPLES/          # NEW
└── ... (5 more enriched)
```

**Total: ~6 days** (vs 10 days building from scratch)

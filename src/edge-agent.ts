/**
 * Unified Edge Stack Agent
 * Single entry point with 3 modes + UI specialist
 */

import { harness, ChatMessage, ChatResponse } from "./model-harness";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Agent modes
type AgentMode = "architect" | "worker" | "intern";

// Skills registry
interface Skill {
  name: string;
  description: string;
  path: string;
  content: string;
}

export class EdgeStackAgent {
  private mode: AgentMode = "worker";
  private skills = new Map<string, Skill>();
  private uiAgent: UISpecialist;
  private beads: BeadsIntegration;

  constructor() {
    this.uiAgent = new UISpecialist();
    this.beads = new BeadsIntegration();
    this.loadSkills();
  }

  /**
   * Set agent mode
   */
  setMode(mode: AgentMode): void {
    this.mode = mode;
    console.log(`🤖 Agent mode set to: ${mode}`);
  }

  /**
   * Load all skills from skills/ directory
   */
  private loadSkills(): void {
    const skillsDir = join(process.cwd(), "skills");

    if (!readdirSync(skillsDir)) {
      console.warn("⚠️ No skills directory found");
      return;
    }

    for (const skillDir of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skillDir.isDirectory()) continue;

      const skillPath = join(skillsDir, skillDir.name);
      const skillFile = join(skillPath, "SKILL.md");

      try {
        const content = readFileSync(skillFile, "utf8");
        const match = content.match(/^---\nname: (.+)\ndescription: (.+)\n/);

        if (match) {
          const [, name, description] = match;
          this.skills.set(name, {
            name,
            description,
            path: skillPath,
            content,
          });
          console.log(`📚 Loaded skill: ${name}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load skill ${skillDir.name}: ${error}`);
      }
    }

    console.log(`✅ Loaded ${this.skills.size} skills`);
  }

  /**
   * Determine which skills are relevant for a task
   */
  private selectSkills(task: string): Skill[] {
    const relevant: Skill[] = [];
    const taskLower = task.toLowerCase();

    // Simple keyword matching for now - can be enhanced with embeddings
    for (const skill of this.skills.values()) {
      const keywords = skill.name.split("-");
      const descriptionLower = skill.description.toLowerCase();

      // Check if keywords appear in task or description
      if (
        keywords.some((kw) => taskLower.includes(kw)) ||
        descriptionLower.split(" ").some((word) => taskLower.includes(word))
      ) {
        relevant.push(skill);
      }
    }

    return relevant;
  }

  /**
   * Build system prompt based on mode and skills
   */
  private buildSystemPrompt(skills: Skill[]): string {
    const modePrompts = {
      architect: `You are an expert Cloudflare Architect. You excel at:
- System design and architecture decisions
- Complex problem decomposition
- Technical strategy and planning
- High-level implementation guidance

Focus on providing well-reasoned, architectural solutions. Consider edge cases, scalability, and maintainability.`,

      worker: `You are an expert Cloudflare Worker implementer. You excel at:
- Writing efficient, edge-optimized code
- Implementing features and fixing bugs
- Following best practices and patterns
- Providing working code examples

Focus on practical, production-ready implementations. Include error handling and validation.`,

      intern: `You are an eager Cloudflare intern. You excel at:
- Simple, well-defined tasks
- Documentation and examples
- Validation and testing
- Research and information gathering

Focus on clear, step-by-step solutions. Ask for clarification if the task is complex.`,
    };

    const skillsInfo = skills
      .map((s) => `- ${s.name}: ${s.description}`)
      .join("\n");

    return `${modePrompts[this.mode]}

## Available Skills
${skillsInfo}

## Guidelines
1. Use the skills relevant to the task
2. When UI work is detected, delegate to ui-specialist
3. Always follow Cloudflare Workers best practices
4. Use beads for task tracking
5. Provide concrete, actionable solutions`;
  }

  /**
   * Check if task requires UI expertise
   */
  private requiresUI(task: string): boolean {
    const uiKeywords = [
      "ui",
      "component",
      "design",
      "button",
      "form",
      "layout",
      "shadcn",
      "tailwind",
      "styling",
      "interface",
      "ux",
      "color",
      "typography",
      "responsive",
      "animation",
    ];

    return uiKeywords.some((kw) => task.toLowerCase().includes(kw));
  }

  /**
   * Handle a task request
   */
  async handleTask(
    task: string,
    options: {
      stream?: boolean;
      context?: string;
    } = {},
  ): Promise<string> {
    console.log(`🎯 Handling task: ${task}`);

    // Check if UI work
    if (this.requiresUI(task)) {
      console.log("🎨 Delegating to UI specialist...");
      return await this.uiAgent.handle(task, {
        mode: this.mode,
        context: options.context,
      });
    }

    // Select relevant skills
    const skills = this.selectSkills(task);
    console.log(`📎 Selected skills: ${skills.map((s) => s.name).join(", ")}`);

    // Build messages
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: this.buildSystemPrompt(skills),
      },
    ];

    // Add context if provided
    if (options.context) {
      messages.push({
        role: "user",
        content: `Context: ${options.context}`,
      });
    }

    // Add the main task
    messages.push({
      role: "user",
      content: task,
    });

    try {
      // Call the model
      const response = await harness.chat(messages, this.mode, {
        maxTokens: 4096,
        temperature: this.mode === "architect" ? 0.8 : 0.5,
      });

      // Extract any bead mentions
      const bdMatches = response.content.match(/bd \w+/g);
      if (bdMatches) {
        console.log(`📝 Beads commands found: ${bdMatches.join(", ")}`);
      }

      return response.content;
    } catch (error) {
      return `❌ Error: ${error.message}`;
    }
  }

  /**
   * Get current configuration
   */
  getStatus(): {
    mode: AgentMode;
    skills: string[];
    providers: string[];
    primary: string | null;
  } {
    return {
      mode: this.mode,
      skills: Array.from(this.skills.keys()),
      providers: harness.getAvailableProviders(),
      primary: harness.getPrimaryProvider(),
    };
  }
}

/**
 * UI Specialist Agent
 */
class UISpecialist {
  async handle(
    task: string,
    options: { mode?: AgentMode; context?: string },
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a UI/UX specialist expert in:
- shadcn/ui component library and patterns
- Tailwind CSS utilities and best practices
- Design systems and component architecture
- Accessibility and responsive design

Focus on providing specific, implementable UI solutions with correct props and patterns. Never hallucinate component props.`,
      },
      {
        role: "user",
        content: `Task: ${task}
${options.context ? `Context: ${options.context}` : ""}

Please provide a detailed UI solution with code examples.`,
      },
    ];

    try {
      const response = await harness.chat(messages, "worker", {
        maxTokens: 4096,
        temperature: 0.3, // Lower temperature for UI accuracy
      });

      return response.content;
    } catch (error) {
      return `❌ UI Error: ${error.message}`;
    }
  }
}

/**
 * Beads Integration Helper
 */
class BeadsIntegration {
  async createTask(description: string): Promise<string> {
    // This would integrate with actual beads CLI
    return `bd add "${description}"`;
  }

  async updateStatus(id: string, status: string): Promise<string> {
    return `bd update ${id} --status ${status}`;
  }

  async done(id: string): Promise<string> {
    return `bd done ${id}`;
  }
}

// Export singleton instance
export const agent = new EdgeStackAgent();

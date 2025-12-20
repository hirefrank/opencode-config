/**
 * Skill Matcher
 *
 * Matches task descriptions to relevant skills based on trigger keywords.
 * Used by oh-my-opencode to auto-select skills for tasks.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

interface SkillFrontmatter {
  name: string;
  description: string;
  triggers?: string[];
  compatibility?: string;
  "allowed-tools"?: string;
}

interface Skill {
  name: string;
  description: string;
  triggers: string[];
  path: string;
  content: string;
}

interface MatchResult {
  skill: Skill;
  matchedTriggers: string[];
  score: number;
}

/**
 * Parse YAML frontmatter from a markdown file
 */
function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, any> = {};

  // Simple YAML parser for our frontmatter format
  let currentKey = "";
  let inArray = false;
  let arrayItems: string[] = [];

  for (const line of yaml.split("\n")) {
    // Array item
    if (line.match(/^\s+-\s+/)) {
      const value = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
      arrayItems.push(value);
      continue;
    }

    // If we were in an array, save it
    if (inArray && currentKey) {
      result[currentKey] = arrayItems;
      inArray = false;
      arrayItems = [];
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w-]*?):\s*(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      currentKey = key;

      if (value === "" || value === "|") {
        // Start of array or multiline
        inArray = true;
        arrayItems = [];
      } else {
        // Simple value
        result[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  }

  // Handle trailing array
  if (inArray && currentKey) {
    result[currentKey] = arrayItems;
  }

  return result as SkillFrontmatter;
}

/**
 * Load all skills from a directory
 */
export function loadSkills(skillsDir: string): Skill[] {
  const skills: Skill[] = [];

  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    console.warn(`⚠️ Skills directory not found: ${skillsDir}`);
    return [];
  }

  for (const entry of entries) {
    const entryPath = join(skillsDir, entry);

    try {
      const stat = statSync(entryPath);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const skillFile = join(entryPath, "SKILL.md");

    try {
      const content = readFileSync(skillFile, "utf-8");
      const frontmatter = parseFrontmatter(content);

      if (frontmatter) {
        skills.push({
          name: frontmatter.name || entry,
          description: frontmatter.description || "",
          triggers: frontmatter.triggers || [],
          path: skillFile,
          content,
        });
      }
    } catch {
      // Skip if no SKILL.md or can't parse
    }
  }

  return skills;
}

/**
 * Match a task description to relevant skills
 */
export function matchSkills(task: string, skills: Skill[]): MatchResult[] {
  const taskLower = task.toLowerCase();
  const results: MatchResult[] = [];

  for (const skill of skills) {
    const matchedTriggers: string[] = [];

    for (const trigger of skill.triggers) {
      if (taskLower.includes(trigger.toLowerCase())) {
        matchedTriggers.push(trigger);
      }
    }

    if (matchedTriggers.length > 0) {
      results.push({
        skill,
        matchedTriggers,
        // Score based on number of matches and trigger specificity
        score:
          matchedTriggers.reduce((sum, t) => sum + t.length, 0) /
          task.length,
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Get skill names that match a task
 */
export function getMatchingSkillNames(
  task: string,
  skillsDir: string = "skills/"
): string[] {
  const skills = loadSkills(skillsDir);
  const matches = matchSkills(task, skills);
  return matches.map((m) => m.skill.name);
}

/**
 * CLI entry point
 */
if (typeof Bun !== "undefined" && Bun.main === import.meta.path) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: bun .opencode/skill-matcher.ts <task description>");
    console.log('Example: bun .opencode/skill-matcher.ts "design a rate limiter"');
    process.exit(1);
  }

  const task = args.join(" ");
  const skillsDir = process.env.SKILLS_DIR || "skills/";

  console.log(`🔍 Matching skills for: "${task}"\n`);

  const skills = loadSkills(skillsDir);
  console.log(`📚 Loaded ${skills.length} skills\n`);

  const matches = matchSkills(task, skills);

  if (matches.length === 0) {
    console.log("❌ No matching skills found");
    console.log("\nAvailable skills:");
    skills.forEach((s) => console.log(`  - ${s.name}: ${s.triggers.slice(0, 3).join(", ")}...`));
  } else {
    console.log("✅ Matching skills:\n");
    matches.forEach((m) => {
      console.log(`  ${m.skill.name} (score: ${m.score.toFixed(2)})`);
      console.log(`    Matched: ${m.matchedTriggers.join(", ")}`);
      console.log();
    });
  }
}

// Export for use as module
export default {
  loadSkills,
  matchSkills,
  getMatchingSkillNames,
};

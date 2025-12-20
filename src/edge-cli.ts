#!/usr/bin/env node

/**
 * Edge Stack CLI
 * Simplified command entry point
 */

import { program } from "commander";
import { agent } from "./edge-agent";
import { harness, defaultConfig } from "./model-harness";
import { execSync } from "child_process";

// Initialize agent and providers
async function initialize() {
  try {
    console.log("🚀 Initializing Edge Stack Agent...");

    // Initialize model providers
    await harness.initialize(defaultConfig);

    const status = agent.getStatus();
    console.log(`📊 Agent Status:`);
    console.log(`   Mode: ${status.mode}`);
    console.log(`   Skills: ${status.skills.length} loaded`);
    console.log(`   Primary Provider: ${status.primary || "None"}`);
    console.log(`   Available Providers: ${status.providers.join(", ")}`);
  } catch (error) {
    console.error(`❌ Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

// Main work command
program
  .name("edge")
  .description("Simplified Edge Stack Development Agent")
  .version("2.0.0");

program
  .command("work")
  .description("Work on a task with the agent")
  .option(
    "-m, --mode <mode>",
    "Agent mode (architect, worker, intern)",
    "worker",
  )
  .option("-c, --context <context>", "Additional context for the task")
  .argument("[task]", "Task description or omit to read from stdin")
  .action(async (task, options) => {
    await initialize();

    // Set mode
    agent.setMode(options.mode);

    // Get task if not provided
    if (!task) {
      console.log("📝 Enter task description (Ctrl+D to finish):");
      task = await new Promise((resolve) => {
        let input = "";
        process.stdin.on("data", (chunk) => (input += chunk));
        process.stdin.on("end", () => resolve(input.trim()));
      });
    }

    if (!task) {
      console.log("❌ No task provided");
      process.exit(1);
    }

    // Handle task
    const response = await agent.handleTask(task, {
      context: options.context,
    });

    console.log("\n🤖 Agent Response:");
    console.log(response);

    // Check for bead commands
    if (response.includes("bd ")) {
      console.log("\n💡 Beads commands detected. Run them to track your work.");
    }
  });

// Mode switching command
program
  .command("mode")
  .description("Switch agent mode")
  .argument("<mode>", "Mode: architect, worker, intern")
  .action(async (mode) => {
    if (!["architect", "worker", "intern"].includes(mode)) {
      console.log("❌ Invalid mode. Use: architect, worker, or intern");
      process.exit(1);
    }

    await initialize();
    agent.setMode(mode);

    console.log(`✅ Mode set to: ${mode}`);
    console.log("\nExamples:");
    console.log(`  ${mode}: "Design a rate limiting system"`);
    console.log(`  ${mode}: "Fix authentication bug"`);
    console.log(`  ${mode}: "Update documentation"`);
  });

// Status command
program
  .command("status")
  .description("Show agent status")
  .action(async () => {
    await initialize();
    const status = agent.getStatus();

    console.log("📊 Edge Stack Agent Status:");
    console.log(`   Mode: ${status.mode}`);
    console.log(`   Skills: ${status.skills.join(", ")}`);
    console.log(`   Primary Provider: ${status.primary || "None"}`);
    console.log(`   Available Providers: ${status.providers.join(", ")}`);
  });

// Skills command
program
  .command("skills")
  .description("List available skills")
  .action(async () => {
    await initialize();
    const status = agent.getStatus();

    console.log("📚 Available Skills:");
    status.skills.forEach((skill) => {
      console.log(`   - ${skill}`);
    });
  });

// Config command
program
  .command("config")
  .description("Show configuration")
  .action(() => {
    console.log("⚙️ Configuration:");
    console.log("\nModel Providers (set environment variables):");
    console.log("   ANTHROPIC_API_KEY - For Claude");
    console.log("   OPENAI_API_KEY - For GPT");
    console.log("   GOOGLE_API_KEY - For Gemini");
    console.log("   LOCAL_LLM_URL - For local models");
    console.log("\nExample:");
    console.log('   export ANTHROPIC_API_KEY="sk-ant-..."');
  });

// Run command
program
  .command("run")
  .description("Run a skill script directly")
  .argument("<skill>", "Skill name")
  .argument("[script]", "Script name without extension")
  .option("--watch", "Watch for changes", false)
  .action(async (skill, script, options) => {
    const skillPath = `skills/${skill}/scripts/${script || "validate"}.js`;

    try {
      if (options.watch) {
        console.log(`👀 Watching ${skillPath}...`);
        execSync(`nodemon ${skillPath}`, { stdio: "inherit" });
      } else {
        console.log(`🏃 Running ${skillPath}...`);
        execSync(`node ${skillPath}`, { stdio: "inherit" });
      }
    } catch (error) {
      console.error(`❌ Failed to run script: ${error.message}`);
      process.exit(1);
    }
  });

// Parse and run
program.parse();

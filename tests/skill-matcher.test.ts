/**
 * Skill Matcher Tests
 *
 * Tests for trigger-based skill matching
 */

import { expect, test, describe, beforeAll } from "bun:test";
import { loadSkills, matchSkills, getMatchingSkillNames } from "../.opencode/skill-matcher";

describe("skill-matcher", () => {
  let skills: ReturnType<typeof loadSkills>;

  beforeAll(() => {
    skills = loadSkills("skills/");
  });

  describe("loadSkills", () => {
    test("loads skills from directory", () => {
      expect(skills.length).toBeGreaterThan(0);
    });

    test("each skill has required fields", () => {
      for (const skill of skills) {
        expect(skill.name).toBeTruthy();
        expect(skill.path).toBeTruthy();
        expect(Array.isArray(skill.triggers)).toBe(true);
      }
    });

    test("key skills are loaded", () => {
      const names = skills.map((s) => s.name);
      expect(names).toContain("durable-objects");
      expect(names).toContain("tanstack-start");
      expect(names).toContain("better-auth");
      expect(names).toContain("cloudflare-workers");
      expect(names).toContain("shadcn-ui");
    });
  });

  describe("matchSkills", () => {
    test("rate limiting → durable-objects", () => {
      const matches = matchSkills("design a rate limiter for the API", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("durable-objects");
    });

    test("websocket → durable-objects", () => {
      const matches = matchSkills("implement websocket chat", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("durable-objects");
    });

    test("oauth login → better-auth", () => {
      const matches = matchSkills("add GitHub OAuth login", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("better-auth");
    });

    test("component → shadcn-ui", () => {
      const matches = matchSkills("create a button component", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("shadcn-ui");
    });

    test("routing → tanstack-start", () => {
      const matches = matchSkills("add a new route for dashboard", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("tanstack-start");
    });

    test("billing subscription → polar-billing", () => {
      const matches = matchSkills("set up subscription billing", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("polar-billing");
    });

    test("deploy worker → cloudflare-workers", () => {
      const matches = matchSkills("deploy the worker to cloudflare", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("cloudflare-workers");
    });

    test("code review → code-reviewer", () => {
      const matches = matchSkills("review the PR changes", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("code-reviewer");
    });

    test("test → testing-patterns", () => {
      const matches = matchSkills("write unit tests for the auth module", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("testing-patterns");
    });

    test("vague query returns no matches", () => {
      const matches = matchSkills("fix the bug", skills);
      // Should have no or few matches for vague queries
      expect(matches.length).toBeLessThanOrEqual(2);
    });

    test("multiple triggers return multiple skills", () => {
      const matches = matchSkills("deploy worker with subscription billing", skills);
      const names = matches.map((m) => m.skill.name);
      expect(names).toContain("cloudflare-workers");
      expect(names).toContain("polar-billing");
    });
  });

  describe("getMatchingSkillNames", () => {
    test("returns array of skill names", () => {
      const names = getMatchingSkillNames("add authentication", "skills/");
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain("better-auth");
    });
  });

  describe("match scoring", () => {
    test("more specific matches score higher", () => {
      const matches = matchSkills("durable object rate limiting", skills);

      // durable-objects should score high with multiple trigger matches
      const doMatch = matches.find((m) => m.skill.name === "durable-objects");
      expect(doMatch).toBeTruthy();
      expect(doMatch!.matchedTriggers.length).toBeGreaterThan(1);
    });

    test("results are sorted by score", () => {
      const matches = matchSkills("implement rate limiting with websockets", skills);

      // Scores should be in descending order
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
      }
    });
  });
});

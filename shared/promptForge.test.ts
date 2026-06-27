import { describe, expect, it } from "vitest";
import { buildSystemPrompt, heuristicOptimize, optimizePrompt } from "./promptForge";

describe("heuristicOptimize", () => {
  it("wraps the prompt in an English Codex scaffold", () => {
    const text = heuristicOptimize({
      prompt: "Add login with GitHub",
      agent: "codex",
      purpose: "coder",
    });
    expect(text).toContain("You are Codex");
    expect(text).toContain("Add login with GitHub");
    expect(text).toContain("Output format:");
  });
});

describe("buildSystemPrompt", () => {
  it("instructs translation to English for the chosen agent and purpose", () => {
    const sys = buildSystemPrompt("claude", "code-review");
    expect(sys).toContain("Translate");
    expect(sys).toContain("English");
    expect(sys).toContain("Claude");
    expect(sys).toContain("review the work for defects");
  });
});

describe("optimizePrompt", () => {
  it("falls back to heuristic mode when no provider key is set", async () => {
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    const originalGemini = process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const result = await optimizePrompt({
        prompt: "Add login with GitHub",
        agent: "codex",
        purpose: "coder",
      });
      expect(result.mode).toBe("heuristic");
      expect(result.optimizedPrompt).toContain("You are Codex");
    } finally {
      if (originalAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = originalAnthropic;
      if (originalGemini !== undefined) process.env.GEMINI_API_KEY = originalGemini;
    }
  });
});

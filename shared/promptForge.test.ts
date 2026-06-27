import { describe, expect, it } from "vitest";
import { optimizePrompt } from "./promptForge";

describe("optimizePrompt", () => {
  it("builds a structured Codex prompt", () => {
    const result = optimizePrompt({
      prompt: "Add login with GitHub",
      language: "en",
      agent: "codex",
      purpose: "coder"
    });

    expect(result.optimizedPrompt).toContain("You are Codex");
    expect(result.optimizedPrompt).toContain("Output format:");
    expect(result.recommendations[0]).toContain("repository context");
  });
});

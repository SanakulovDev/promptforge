import Anthropic from "@anthropic-ai/sdk";

export type Agent = "codex" | "claude" | "general";
export type Purpose = "coder" | "tester" | "code-review" | "general";

export interface OptimizeRequest {
  prompt: string;
  agent: Agent;
  purpose: Purpose;
}

export interface OptimizeResponse {
  optimizedPrompt: string;
  mode: "ai" | "heuristic";
}

const agentLabels: Record<Agent, string> = {
  codex: "Codex",
  claude: "Claude",
  general: "a general AI agent",
};

const purposeIntent: Record<Purpose, string> = {
  coder: "implement the requested software change",
  tester: "verify behavior, edge cases, and regressions",
  "code-review": "review the work for defects, risks, and missing tests",
  general: "complete the requested task clearly and accurately",
};

export function buildSystemPrompt(agent: Agent, purpose: Purpose): string {
  const label = agentLabels[agent];
  const intent = purposeIntent[purpose];
  return [
    `You are a prompt engineer. Rewrite the user's prompt into a single, clear, well-structured instruction for ${label}, whose goal is to ${intent}.`,
    "",
    "Rules:",
    "- Translate the prompt into English, regardless of its original language.",
    "- Preserve the user's original intent; do not invent requirements.",
    "- Produce a structured prompt with a clear goal, relevant context, explicit instructions, and an expected output format.",
    "- Output ONLY the rewritten prompt. No preamble, explanation, commentary, or surrounding quotes or markdown fences.",
  ].join("\n");
}

export function heuristicOptimize(input: OptimizeRequest): string {
  const label = agentLabels[input.agent];
  const intent = purposeIntent[input.purpose];
  const promptBody = input.prompt.trim() || "Describe the task here.";
  return [
    `You are ${label}. Your goal is to ${intent}.`,
    "",
    "Context:",
    promptBody,
    "",
    "Instructions:",
    "- Preserve the user's intent even if the original prompt is informal or multilingual.",
    "- Prefer concrete actions, explicit assumptions, and verifiable output.",
    "",
    "Output format:",
    "1. Brief understanding of the task.",
    "2. Completed answer or implementation plan.",
    "3. Verification, risks, or recommendations.",
  ].join("\n");
}

async function callClaude(input: OptimizeRequest): Promise<string> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: buildSystemPrompt(input.agent, input.purpose),
    messages: [{ role: "user", content: input.prompt }],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw new Error("Empty response from Claude");
  return text;
}

export async function optimizePrompt(input: OptimizeRequest): Promise<OptimizeResponse> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const optimizedPrompt = await callClaude(input);
      return { optimizedPrompt, mode: "ai" };
    } catch (error) {
      console.error("Claude optimize failed, using heuristic fallback:", error);
    }
  }
  return { optimizedPrompt: heuristicOptimize(input), mode: "heuristic" };
}

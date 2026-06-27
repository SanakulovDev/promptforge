export type Language = "uz" | "en" | "ru";
export type Agent = "codex" | "claude" | "general";
export type Purpose = "coder" | "tester" | "code-review" | "general";

export interface OptimizeRequest {
  prompt: string;
  language: Language;
  agent: Agent;
  purpose: Purpose;
}

export interface OptimizeResponse {
  optimizedPrompt: string;
  recommendations: string[];
  structure: string[];
  detectedLanguage: string;
  usage: {
    used: number;
    limit: number;
  };
}

const agentLabels: Record<Agent, string> = {
  codex: "Codex",
  claude: "Claude",
  general: "General agent"
};

const purposeIntent: Record<Purpose, string> = {
  coder: "implement the requested software change",
  tester: "verify behavior, edge cases, and regressions",
  "code-review": "review the work for defects, risks, and missing tests",
  general: "complete the requested task clearly and accurately"
};

const outputContract: Record<Purpose, string[]> = {
  coder: [
    "Read the existing project before editing.",
    "Implement the smallest complete change.",
    "Run relevant checks and report what passed or could not be run."
  ],
  tester: [
    "Identify the behavior under test.",
    "Cover success, failure, boundary, and regression cases.",
    "Return concise findings with reproduction steps where relevant."
  ],
  "code-review": [
    "Lead with bugs and risks ordered by severity.",
    "Reference exact files, functions, or lines when possible.",
    "Mention missing tests and assumptions after findings."
  ],
  general: [
    "Clarify assumptions only when required.",
    "Complete the task directly.",
    "Return a concise result with next steps if useful."
  ]
};

export function detectLanguage(prompt: string): string {
  if (/[А-Яа-яЁё]/.test(prompt)) return "Russian or Cyrillic-script text";
  if (/[ЎўҚқҒғҲҳ]/.test(prompt)) return "Uzbek Cyrillic text";
  if (/\b(va|uchun|bilan|kerak|qiling|qil|men|siz)\b/i.test(prompt)) {
    return "Uzbek Latin text";
  }
  return "Latin-script text";
}

export function optimizePrompt(input: OptimizeRequest, used = 0): OptimizeResponse {
  const cleanPrompt = input.prompt.trim();
  const agentName = agentLabels[input.agent];
  const intent = purposeIntent[input.purpose];
  const contract = outputContract[input.purpose];
  const promptBody = cleanPrompt || "Describe the task here.";

  const optimizedPrompt = [
    `You are ${agentName}. Your goal is to ${intent}.`,
    "",
    "Context:",
    promptBody,
    "",
    "Instructions:",
    "- Preserve the user's intent even if the original prompt is informal or multilingual.",
    "- Ask a clarifying question only if a missing detail blocks a correct result.",
    "- Prefer concrete actions, explicit assumptions, and verifiable output.",
    ...contract.map((line) => `- ${line}`),
    "",
    "Output format:",
    "1. Brief understanding of the task.",
    "2. Completed answer or implementation plan.",
    "3. Verification, risks, or recommendations."
  ].join("\n");

  return {
    optimizedPrompt,
    detectedLanguage: detectLanguage(promptBody),
    recommendations: buildRecommendations(input),
    structure: ["Role", "Context", "Instructions", "Output format", "Verification"],
    usage: {
      used: Math.min(used + 1, 10),
      limit: 10
    }
  };
}

export function buildRecommendations(input: OptimizeRequest): string[] {
  const base = [
    "State the desired result before constraints.",
    "Separate context, task, and output format.",
    "Name files, tools, or examples when they matter."
  ];

  if (input.agent === "codex") {
    return [
      "Codex works best with repository context, exact files, expected commands, and verification criteria.",
      "For coding tasks, say whether it should implement, review, explain, or only plan.",
      ...base
    ];
  }

  if (input.agent === "claude") {
    return [
      "Claude works well with clear reasoning boundaries, examples, and a concise final response format.",
      "For analysis-heavy tasks, provide source material and ask for assumptions to be listed.",
      ...base
    ];
  }

  return [
    "General agents understand role, goal, context, constraints, and output format better than one long paragraph.",
    ...base
  ];
}

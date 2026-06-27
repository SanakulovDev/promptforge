import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  FileCode2,
  Languages,
  MonitorCog,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Agent, OptimizeResponse, Purpose } from "../shared/promptForge";
import "./styles.css";

type Language = "uz" | "en" | "ru";

type Copy = {
  tagline: string;
  agent: string;
  purpose: string;
  promptLabel: string;
  placeholder: string;
  clear: string;
  optimize: string;
  optimizing: string;
  output: string;
  outputEmpty: string;
  copy: string;
  copied: string;
  error: string;
  aiMode: string;
  heuristicMode: string;
};

const copy: Record<Language, Copy> = {
  uz: {
    tagline: "Promptni agent tushunadigan inglizcha topshiriqqa aylantiring",
    agent: "Agent",
    purpose: "Maqsad",
    promptLabel: "Sizning promptingiz · istalgan til",
    placeholder: "Masalan: React ilovamga GitHub orqali login qo'shib ber...",
    clear: "Tozalash",
    optimize: "Optimallashtirish",
    optimizing: "...",
    output: "Optimallashtirilgan prompt · English",
    outputEmpty: "Optimallashtirilgan prompt shu yerda chiqadi.",
    copy: "Nusxalash",
    copied: "Nusxalandi",
    error: "Xatolik yuz berdi. Qayta urinib ko'ring.",
    aiMode: "AI rewriting",
    heuristicMode: "Heuristik rejim · to'liq AI uchun ANTHROPIC_API_KEY o'rnating",
  },
  en: {
    tagline: "Turn any prompt into an English, agent-ready instruction",
    agent: "Agent",
    purpose: "Purpose",
    promptLabel: "Your prompt · any language",
    placeholder: "Example: Add GitHub login to my React app...",
    clear: "Clear",
    optimize: "Optimize",
    optimizing: "...",
    output: "Optimized prompt · English",
    outputEmpty: "Your optimized prompt will appear here.",
    copy: "Copy",
    copied: "Copied",
    error: "Something went wrong. Try again.",
    aiMode: "AI rewriting",
    heuristicMode: "Heuristic mode · set ANTHROPIC_API_KEY for full AI rewriting",
  },
  ru: {
    tagline: "Преобразуйте любой промпт в понятную англоязычную инструкцию",
    agent: "Агент",
    purpose: "Назначение",
    promptLabel: "Ваш промпт · любой язык",
    placeholder: "Например: Добавь вход через GitHub в моё React-приложение...",
    clear: "Очистить",
    optimize: "Оптимизировать",
    optimizing: "...",
    output: "Оптимизированный промпт · English",
    outputEmpty: "Оптимизированный промпт появится здесь.",
    copy: "Скопировать",
    copied: "Скопировано",
    error: "Произошла ошибка. Попробуйте снова.",
    aiMode: "AI rewriting",
    heuristicMode: "Эвристический режим · установите ANTHROPIC_API_KEY для полного AI",
  },
};

const agents: Array<{ value: Agent; label: string; detail: string; icon: typeof Code2 }> = [
  { value: "codex", label: "Codex", detail: "Codebase changes", icon: Code2 },
  { value: "claude", label: "Claude", detail: "Long context", icon: Bot },
  { value: "general", label: "General", detail: "Any assistant", icon: Sparkles },
];

const purposes: Array<{ value: Purpose; label: string; icon: typeof Code2 }> = [
  { value: "coder", label: "Coder", icon: FileCode2 },
  { value: "tester", label: "Tester", icon: MonitorCog },
  { value: "code-review", label: "Code Review", icon: Search },
  { value: "general", label: "General", icon: Sparkles },
];

function App() {
  const [language, setLanguage] = useState<Language>("uz");
  const [agent, setAgent] = useState<Agent>("codex");
  const [purpose, setPurpose] = useState<Purpose>("coder");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const t = copy[language];

  async function optimize() {
    if (prompt.trim().length < 3) return;
    setLoading(true);
    setCopied(false);
    setError(false);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, agent, purpose }),
      });
      if (!response.ok) throw new Error("request failed");
      const data = (await response.json()) as OptimizeResponse;
      setResult(data);
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPrompt("");
    setResult(null);
    setError(false);
    setCopied(false);
  }

  async function copyOutput() {
    if (!result) return;
    await navigator.clipboard.writeText(result.optimizedPrompt);
    setCopied(true);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <div>
            <h1>PromptForge</h1>
            <p>{t.tagline}</p>
          </div>
        </div>
        <label className="language-select">
          <Languages size={16} />
          <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            <option value="uz">Uz</option>
            <option value="en">En</option>
            <option value="ru">Ru</option>
          </select>
        </label>
      </header>

      <section className="controls">
        <div className="control-group">
          <span className="control-label">{t.agent}</span>
          <div className="segmented">
            {agents.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  className={agent === item.value ? "segment selected" : "segment"}
                  onClick={() => setAgent(item.value)}
                >
                  <Icon size={16} />
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">{t.purpose}</span>
          <div className="segmented">
            {purposes.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  className={purpose === item.value ? "segment selected" : "segment"}
                  onClick={() => setPurpose(item.value)}
                >
                  <Icon size={16} />
                  <strong>{item.label}</strong>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panes">
        <section className="pane">
          <div className="pane-head">
            <span className="pane-label">{t.promptLabel}</span>
            <span className="counter">{prompt.trim().length} / 4000</span>
          </div>
          <textarea
            className="prompt-input"
            value={prompt}
            maxLength={4000}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t.placeholder}
          />
          <div className="pane-actions">
            <button className="ghost" disabled={loading} onClick={reset}>
              {t.clear}
            </button>
            <button className="primary" disabled={loading || prompt.trim().length < 3} onClick={optimize}>
              <Wand2 size={16} />
              {loading ? t.optimizing : t.optimize}
            </button>
          </div>
        </section>

        <section className="pane result">
          <div className="pane-head">
            <span className="pane-label">{t.output}</span>
            <button className="icon-button" disabled={!result || loading} onClick={copyOutput}>
              {copied ? <CheckCircle2 size={16} /> : <Clipboard size={16} />}
              <span>{copied ? t.copied : t.copy}</span>
            </button>
          </div>
          <pre className={error ? "result-box error-text" : "result-box"}>
            {error ? t.error : result ? result.optimizedPrompt : t.outputEmpty}
          </pre>
        </section>
      </section>

      <footer className="footer">{result?.mode === "ai" ? t.aiMode : t.heuristicMode}</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

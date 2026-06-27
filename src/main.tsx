import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDown, Bot, Check, Code2, Copy, FileCode2, Hammer, MonitorCog, Search, Sparkles } from "lucide-react";
import type { Agent, OptimizeResponse, Purpose } from "../shared/promptForge";
import "./styles.css";

type Language = "uz" | "en" | "ru";

type Copy = {
  eyebrow: string;
  heroLead: string;
  heroEmph: string;
  heroSub: string;
  agent: string;
  purpose: string;
  rawLabel: string;
  forgedLabel: string;
  placeholder: string;
  tryLabel: string;
  examples: string[];
  clear: string;
  forge: string;
  forging: string;
  copy: string;
  copied: string;
  empty: string;
  error: string;
  aiMode: string;
  heuristicMode: string;
};

const copy: Record<Language, Copy> = {
  uz: {
    eyebrow: "PromptForge · istalgan til → English",
    heroLead: "Istalgan til kiradi.",
    heroEmph: "Inglizcha, aniq topshiriq chiqadi.",
    heroSub:
      "Promptingizni Codex, Claude yoki istalgan agent birinchi urinishdayoq tushunadigan aniq, tuzilgan topshiriqqa aylantiramiz.",
    agent: "Agent",
    purpose: "Maqsad",
    rawLabel: "Xom prompt — istalgan til",
    forgedLabel: "Tayyor prompt — English",
    placeholder: "Promptingizni shu yerga yozing — o'zbekcha, ruscha yoki istalgan tilda.",
    tryLabel: "Namuna:",
    examples: ["React ilovamga GitHub login qo'sh", "Bu API uchun unit testlar yoz"],
    clear: "Tozalash",
    forge: "Tayyorlash",
    forging: "Tayyorlanmoqda…",
    copy: "Nusxalash",
    copied: "Nusxalandi",
    empty: "Tayyor prompt shu yerda — toza, inglizcha va agentga tayyor — paydo bo'ladi.",
    error: "Xatolik yuz berdi. Qayta urinib ko'ring.",
    aiMode: "AI",
    heuristicMode: "Heuristik",
  },
  en: {
    eyebrow: "PromptForge · any language → English",
    heroLead: "Any language in.",
    heroEmph: "Agent-ready English out.",
    heroSub:
      "We rewrite your prompt into a clear, structured instruction that Codex, Claude, or any agent follows on the first try.",
    agent: "Agent",
    purpose: "Purpose",
    rawLabel: "Raw prompt — any language",
    forgedLabel: "Forged prompt — English",
    placeholder: "Write your prompt here — in any language.",
    tryLabel: "Try one:",
    examples: ["Add GitHub login to my React app", "Write unit tests for this API"],
    clear: "Clear",
    forge: "Forge prompt",
    forging: "Forging…",
    copy: "Copy",
    copied: "Copied",
    empty: "Your forged prompt — clean, English, agent-ready — lands here.",
    error: "Something went wrong. Try again.",
    aiMode: "AI",
    heuristicMode: "Heuristic",
  },
  ru: {
    eyebrow: "PromptForge · любой язык → English",
    heroLead: "Любой язык на входе.",
    heroEmph: "Чёткая английская инструкция на выходе.",
    heroSub:
      "Мы переписываем ваш промпт в ясную структурированную инструкцию, которую Codex, Claude или любой агент выполнит с первого раза.",
    agent: "Агент",
    purpose: "Назначение",
    rawLabel: "Сырой промпт — любой язык",
    forgedLabel: "Готовый промпт — English",
    placeholder: "Напишите промпт здесь — на любом языке.",
    tryLabel: "Пример:",
    examples: ["Добавь вход через GitHub в React-приложение", "Напиши unit-тесты для этого API"],
    clear: "Очистить",
    forge: "Преобразовать",
    forging: "Обработка…",
    copy: "Скопировать",
    copied: "Скопировано",
    empty: "Готовый промпт — ясный, английский, для агента — появится здесь.",
    error: "Произошла ошибка. Попробуйте снова.",
    aiMode: "AI",
    heuristicMode: "Эвристика",
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

  async function forge() {
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

  const languages: Language[] = ["uz", "en", "ru"];

  return (
    <div className="page">
      <div className="shell">
        <header className="masthead">
          <div className="wordmark">
            <span className="wordmark-mark">
              <Hammer size={16} strokeWidth={2.4} />
            </span>
            <span className="wordmark-name">PromptForge</span>
          </div>
          <div className="lang-switch" role="group" aria-label="Interface language">
            {languages.map((code) => (
              <button
                key={code}
                className={language === code ? "lang on" : "lang"}
                onClick={() => setLanguage(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <div className="rule" />

        <section className="hero">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 className="hero-title">
            {t.heroLead} <span className="hero-emph">{t.heroEmph}</span>
          </h1>
          <p className="hero-sub">{t.heroSub}</p>
        </section>

        <section className="forge">
          <div className="settings">
            <div className="setting">
              <span className="setting-label">{t.agent}</span>
              <div className="chips">
                {agents.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      className={agent === item.value ? "chip on" : "chip"}
                      onClick={() => setAgent(item.value)}
                    >
                      <Icon size={15} />
                      <span className="chip-body">
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="setting">
              <span className="setting-label">{t.purpose}</span>
              <div className="chips">
                {purposes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      className={purpose === item.value ? "chip on" : "chip"}
                      onClick={() => setPurpose(item.value)}
                    >
                      <Icon size={15} />
                      <span className="chip-body">
                        <strong>{item.label}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="plate raw">
            <div className="plate-head">
              <span className="index">01</span>
              <span className="plate-label">{t.rawLabel}</span>
              <span className="char-count">{prompt.trim().length}/4000</span>
            </div>
            <textarea
              className="raw-input"
              value={prompt}
              maxLength={4000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t.placeholder}
            />
            {prompt.length === 0 && (
              <div className="examples">
                <span className="examples-label">{t.tryLabel}</span>
                {t.examples.map((ex) => (
                  <button key={ex} className="example" onClick={() => setPrompt(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            )}
            <div className="raw-actions">
              <button className="text-btn" disabled={loading || prompt.length === 0} onClick={reset}>
                {t.clear}
              </button>
              <button className="forge-btn" disabled={loading || prompt.trim().length < 3} onClick={forge}>
                <Hammer size={16} strokeWidth={2.4} />
                {loading ? t.forging : t.forge}
              </button>
            </div>
          </div>

          <div className="seam" aria-hidden="true">
            <ArrowDown size={16} />
          </div>

          <div className={`plate forged${error ? " is-error" : ""}${result || error ? " filled" : ""}`}>
            <div className="plate-head">
              <span className="index">02</span>
              <span className="plate-label">{t.forgedLabel}</span>
              {result && <span className="stamp">{result.mode === "ai" ? t.aiMode : t.heuristicMode}</span>}
              <button
                className="copy-btn"
                disabled={!result || loading}
                onClick={copyOutput}
                aria-label={t.copy}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? t.copied : t.copy}</span>
              </button>
            </div>
            <pre className={result || error ? "forged-out" : "forged-out empty"}>
              {error ? t.error : result ? result.optimizedPrompt : t.empty}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

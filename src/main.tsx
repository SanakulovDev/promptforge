import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Clock3,
  Code2,
  Eye,
  FileCode2,
  Github,
  History,
  Languages,
  LogIn,
  MonitorCog,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2
} from "lucide-react";
import type { Agent, Language, OptimizeResponse, Purpose } from "../shared/promptForge";
import "./styles.css";

type Copy = {
  nav: string;
  signIn: string;
  google: string;
  github: string;
  prompt: string;
  promptHint: string;
  agent: string;
  purpose: string;
  optimize: string;
  reset: string;
  output: string;
  recommendations: string;
  structure: string;
  usage: string;
  history: string;
  copied: string;
  placeholder: string;
  detected: string;
  future: string;
  dashboard: string;
  templates: string;
  favorites: string;
  settings: string;
  comingSoon: string;
  stayTuned: string;
  clear: string;
  copiedReady: string;
  viewAll: string;
};

const copy: Record<Language, Copy> = {
  uz: {
    nav: "Promptni agent tushunadigan topshiriqqa aylantiring",
    signIn: "Kirish",
    google: "Google",
    github: "GitHub",
    prompt: "Prompt",
    promptHint: "Istalgan tilda yozing. Natija agent uchun aniq strukturaga o'tadi.",
    agent: "Agent",
    purpose: "Maqsad",
    optimize: "Promptni optimallashtirish",
    reset: "Tozalash",
    output: "Optimized agent prompt",
    recommendations: "Tavsiyalar",
    structure: "Struktura",
    usage: "10 prompts / month",
    history: "Oxirgi promptlar",
    copied: "Nusxalandi",
    placeholder: "Masalan: Mening React ilovamda GitHub orqali login qo'shib ber...",
    detected: "Aniqlangan til",
    future: "Pullik obuna keyin qo'shiladi. Hozir limit faqat mahsulot oqimini ko'rsatadi."
    ,
    dashboard: "Dashboard",
    templates: "Shablonlar",
    favorites: "Sevimlilar",
    settings: "Sozlamalar",
    comingSoon: "Yaqinda ko'proq",
    stayTuned: "Kuzatib boring",
    clear: "Tozalash",
    copiedReady: "Nusxalash",
    viewAll: "Hammasi"
  },
  en: {
    nav: "Convert any prompt into agent-ready instructions",
    signIn: "Sign in",
    google: "Google",
    github: "GitHub",
    prompt: "Prompt",
    promptHint: "Write in any language. PromptForge turns it into a clear agent structure.",
    agent: "Agent",
    purpose: "Purpose",
    optimize: "Optimize prompt",
    reset: "Reset",
    output: "Optimized agent prompt",
    recommendations: "Recommendations",
    structure: "Structure",
    usage: "10 prompts / month",
    history: "Recent prompts",
    copied: "Copied",
    placeholder: "Example: Add GitHub login to my React app...",
    detected: "Detected language",
    future: "Paid subscription can be added later. For now the limit shows the product flow."
    ,
    dashboard: "Dashboard",
    templates: "Templates",
    favorites: "Favorites",
    settings: "Settings",
    comingSoon: "More coming soon",
    stayTuned: "Stay tuned",
    clear: "Clear",
    copiedReady: "Copy",
    viewAll: "View all"
  },
  ru: {
    nav: "Преобразуйте любой промпт в понятную инструкцию для агента",
    signIn: "Войти",
    google: "Google",
    github: "GitHub",
    prompt: "Промпт",
    promptHint: "Пишите на любом языке. Сервис сделает структуру понятной агенту.",
    agent: "Агент",
    purpose: "Назначение",
    optimize: "Оптимизировать промпт",
    reset: "Очистить",
    output: "Оптимизированный промпт",
    recommendations: "Рекомендации",
    structure: "Структура",
    usage: "10 prompts / month",
    history: "Последние промпты",
    copied: "Скопировано",
    placeholder: "Например: Добавь вход через GitHub в мое React-приложение...",
    detected: "Определенный язык",
    future: "Платную подписку можно добавить позже. Сейчас лимит показывает будущий поток."
    ,
    dashboard: "Панель",
    templates: "Шаблоны",
    favorites: "Избранное",
    settings: "Настройки",
    comingSoon: "Скоро больше",
    stayTuned: "Следить",
    clear: "Очистить",
    copiedReady: "Скопировать",
    viewAll: "Все"
  }
};

const agents: Array<{ value: Agent; label: string; detail: string; icon: typeof Code2 }> = [
  { value: "codex", label: "Codex", detail: "Codebase changes", icon: Code2 },
  { value: "claude", label: "Claude", detail: "Long context", icon: Bot },
  { value: "general", label: "General", detail: "Any assistant", icon: Sparkles }
];

const purposes: Array<{ value: Purpose; label: string; icon: typeof Code2 }> = [
  { value: "coder", label: "Coder", icon: FileCode2 },
  { value: "tester", label: "Tester", icon: MonitorCog },
  { value: "code-review", label: "Code Review", icon: Search },
  { value: "general", label: "General", icon: Sparkles }
];

const samplePrompt =
  "Mening Node.js va React web ilovam bor. Google yoki GitHub orqali login qo'shish, promptni Codex uchun yaxshilash va natijani tez ko'rsatish kerak.";

function App() {
  const [language, setLanguage] = useState<Language>("uz");
  const [agent, setAgent] = useState<Agent>("codex");
  const [purpose, setPurpose] = useState<Purpose>("coder");
  const [prompt, setPrompt] = useState(samplePrompt);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signedIn, setSignedIn] = useState<string | null>(null);
  const t = copy[language];

  const usagePercent = useMemo(() => {
    const usage = result?.usage ?? { used: 0, limit: 10 };
    return Math.min(100, Math.round((usage.used / usage.limit) * 100));
  }, [result]);

  async function optimize() {
    if (prompt.trim().length < 3) return;
    setLoading(true);
    setCopied(false);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language, agent, purpose })
      });
      const data = (await response.json()) as OptimizeResponse;
      setResult(data);
      setHistory((items) => [prompt.slice(0, 92), ...items.filter((item) => item !== prompt)].slice(0, 4));
    } finally {
      setLoading(false);
    }
  }

  async function demoSignIn(provider: "Google" | "GitHub") {
    const response = await fetch(`/api/auth/demo?provider=${provider.toLowerCase()}`);
    if (response.ok) setSignedIn(provider);
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
            <Sparkles size={20} />
          </span>
          <div>
            <h1>PromptForge</h1>
            <p>{t.nav}</p>
          </div>
        </div>
        <div className="top-actions">
          <label className="language-select">
            <Languages size={17} />
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="uz">Uz</option>
              <option value="en">En</option>
              <option value="ru">Ru</option>
            </select>
          </label>
          <button className="ghost-button" onClick={() => demoSignIn("Google")}>
            <LogIn size={16} />
            {signedIn === "Google" ? "Google user" : t.google}
          </button>
          <button className="ghost-button" onClick={() => demoSignIn("GitHub")}>
            <Github size={16} />
            {signedIn === "GitHub" ? "GitHub user" : t.github}
          </button>
        </div>
      </header>

      <section className="shell">
        <aside className="sidebar" aria-label="Navigation">
          <nav className="nav-list">
            <button className="active">
              <Sparkles size={18} />
              {t.dashboard}
            </button>
            <button>
              <History size={18} />
              {t.history}
            </button>
            <button>
              <FileCode2 size={18} />
              {t.templates}
            </button>
            <button>
              <Star size={18} />
              {t.favorites}
            </button>
            <button>
              <Settings size={18} />
              {t.settings}
            </button>
          </nav>
          <div className="soon-card">
            <Sparkles size={24} />
            <h2>{t.comingSoon}</h2>
            <p>{t.future}</p>
            <button>{t.stayTuned}</button>
          </div>
        </aside>

        <div className="content">
          <section className="control-strip" aria-label="Prompt settings">
            <div className="selector-group wide">
              <span>{t.agent}</span>
              <div className="segmented">
                {agents.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      className={agent === item.value ? "segment selected" : "segment"}
                      onClick={() => setAgent(item.value)}
                    >
                      <Icon size={17} />
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="selector-group wide">
              <span>{t.purpose}</span>
              <div className="segmented purpose-segments">
                {purposes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      className={purpose === item.value ? "segment selected" : "segment"}
                      onClick={() => setPurpose(item.value)}
                    >
                      <Icon size={17} />
                      <strong>{item.label}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="workspace" aria-label="Prompt optimizer workspace">
            <section className="panel input-panel">
              <div className="section-heading">
                <div>
                  <h2>{t.prompt}</h2>
                  <p>{t.promptHint}</p>
                </div>
                <span>{prompt.trim().length} / 4000</span>
              </div>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t.placeholder} />
              <div className="editor-toolbar">
                <button className="tool-button" aria-label={t.reset} onClick={() => setPrompt("")}>
                  <RotateCcw size={17} />
                </button>
                <button className="soft-button" onClick={() => setPrompt("")}>
                  {t.clear}
                </button>
                <button className="primary-button" disabled={loading || prompt.trim().length < 3} onClick={optimize}>
                  <Wand2 size={18} />
                  {loading ? "..." : t.optimize}
                </button>
              </div>
            </section>

            <section className="panel output-panel">
              <div className="section-heading row">
                <div>
                  <h2>{t.output}</h2>
                  <p>{result ? `${t.detected}: ${result.detectedLanguage}` : "Ready for Codex, Claude, or any AI agent."}</p>
                </div>
                <div className="copy-state">
                  {copied && <span><CheckCircle2 size={15} /> {t.copied}</span>}
                  <button className="icon-button" disabled={!result} onClick={copyOutput} aria-label={t.copiedReady}>
                    {copied ? <CheckCircle2 size={18} /> : <Clipboard size={18} />}
                  </button>
                </div>
              </div>
              <div className="output-grid">
                <pre className="output-box">{result?.optimizedPrompt || "Your structured agent prompt will appear here."}</pre>
                <aside className="recommendation-panel">
                  <h2>{t.recommendations}</h2>
                  <div className="recommendation-list">
                    {(result?.recommendations || [
                      "Codex prefers exact repository context, files, commands, and verification rules.",
                      "Claude prefers clear reasoning boundaries, examples, and concise output contracts.",
                      "Always separate role, context, task, constraints, and output format.",
                      "Keep output format explicit so agents know when to stop."
                    ]).map((item, index) => (
                      <p key={item}>
                        {index % 3 === 0 ? <ShieldCheck size={17} /> : index % 3 === 1 ? <CheckCircle2 size={17} /> : <Sparkles size={17} />}
                        {item}
                      </p>
                    ))}
                  </div>
                </aside>
              </div>
            </section>
          </section>

          <section className="lower-grid">
            <article className="insight-panel history-panel">
              <div className="panel-title">
                <h2>{t.history}</h2>
                <button>{t.viewAll}</button>
              </div>
              <div className="history-table">
                {(history.length ? history : [
                  samplePrompt.slice(0, 68),
                  "API testlarini yozish kerak",
                  "Ushbu kod review qilin"
                ]).map((item, index) => (
                  <button key={`${item}-${index}`} onClick={() => setPrompt(item)}>
                    <span>{item}</span>
                    <small>{agent.toUpperCase()}</small>
                    <small>{purpose}</small>
                    <Clock3 size={15} />
                    <Eye size={15} />
                  </button>
                ))}
              </div>
            </article>

            <article className="insight-panel usage-panel">
              <h2>{t.usage}</h2>
              <div className="usage-content">
                <div className="usage-ring" style={{ "--usage": `${usagePercent}%` } as React.CSSProperties}>
                  <strong>{result?.usage.used ?? 0}</strong>
                  <span>of 10</span>
                </div>
                <div className="usage-copy">
                  <strong>{result?.usage.used ?? 0}/10 used</strong>
                  <div className="meter">
                    <span style={{ width: `${usagePercent}%` }} />
                  </div>
                  <p>{t.future}</p>
                </div>
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

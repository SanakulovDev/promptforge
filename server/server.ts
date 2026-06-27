import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { optimizePrompt, type OptimizeRequest } from "../shared/promptForge.js";

const port = Number(process.env.PORT || 4174);
let usedPrompts = 0;

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function authUrl(provider: "google" | "github") {
  const envKey = provider === "google" ? "GOOGLE_CLIENT_ID" : "GITHUB_CLIENT_ID";
  const clientId = process.env[envKey];
  if (!clientId) return `/api/auth/demo?provider=${provider}`;

  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/api/auth/callback/google`,
      response_type: "code",
      scope: "openid email profile"
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: process.env.GITHUB_REDIRECT_URI || `http://localhost:${port}/api/auth/callback/github`,
    scope: "read:user user:email"
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(process.cwd(), "dist", safePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    const index = await readFile(join(process.cwd(), "dist", "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(index);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, service: "promptforge-api" });
    }

    if (req.method === "GET" && url.pathname === "/api/auth/providers") {
      return sendJson(res, 200, {
        providers: [
          { id: "google", name: "Google", url: authUrl("google") },
          { id: "github", name: "GitHub", url: authUrl("github") }
        ]
      });
    }

    if (req.method === "GET" && url.pathname === "/api/auth/demo") {
      const provider = url.searchParams.get("provider") || "github";
      return sendJson(res, 200, {
        user: {
          name: "Demo user",
          provider,
          avatar: provider.slice(0, 1).toUpperCase()
        }
      });
    }

    if (req.method === "POST" && url.pathname === "/api/optimize") {
      const body = (await readJson(req)) as OptimizeRequest;
      if (!body.prompt || body.prompt.trim().length < 3) {
        return sendJson(res, 400, { error: "Prompt must contain at least 3 characters." });
      }
      const result = optimizePrompt(body, usedPrompts);
      usedPrompts = result.usage.used;
      return sendJson(res, 200, result);
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Not found" });
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error"
    });
  }
});

server.listen(port, () => {
  console.log(`PromptForge API listening on http://localhost:${port}`);
});

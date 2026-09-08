import "./load-env.js";
import { appendFileSync } from "node:fs";
import OpenAI from "openai";

const LOG = "/Users/yanivbarkai/finance_app/.cursor/debug-6bce40.log";
const SESSION = "6bce40";

function dbg(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>
) {
  // #region agent log
  const payload = {
    sessionId: SESSION,
    runId: "openai-probe",
    hypothesisId,
    location: "probe-openai.ts",
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(LOG, JSON.stringify(payload) + "\n");
  } catch {
    /* ignore */
  }
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

async function tryModel(openai: OpenAI, model: string) {
  try {
    const c = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: 'Reply with JSON: {"ok":true}' }],
      response_format: { type: "json_object" },
      max_tokens: 20,
    });
    dbg("H2", "model ok", {
      model,
      contentLen: (c.choices[0]?.message?.content ?? "").length,
    });
    return { model, ok: true as const };
  } catch (err: unknown) {
    const e = err as {
      status?: number;
      code?: string;
      type?: string;
      message?: string;
      error?: { type?: string; code?: string; message?: string };
    };
    dbg("H2", "model failed", {
      model,
      status: e.status ?? null,
      code: e.code ?? e.error?.code ?? null,
      type: e.type ?? e.error?.type ?? null,
      message: String(e.message ?? err).slice(0, 240),
    });
    return {
      model,
      ok: false as const,
      status: e.status ?? null,
      message: String(e.message ?? err).slice(0, 240),
    };
  }
}

async function main() {
  const key = process.env.OPENAI_API_KEY ?? "";
  dbg("H1", "key shape (no secret)", {
    hasKey: Boolean(key),
    keyPrefix: key.slice(0, 10),
    keyLen: key.length,
    isServiceAccount: key.startsWith("sk-svcacct-"),
  });

  if (!key) {
    console.log(JSON.stringify({ error: "missing OPENAI_API_KEY" }));
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: key });
  const results = [];
  for (const model of ["gpt-4o-mini", "gpt-4o"]) {
    results.push(await tryModel(openai, model));
  }
  console.log(JSON.stringify({ results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

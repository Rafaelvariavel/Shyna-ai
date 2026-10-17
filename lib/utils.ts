import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(request: Request, maxBytes = 16_000) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  try { return JSON.parse(raw) as unknown; } catch { throw new Error("JSON_INVALID"); }
}

export function checkSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    return !!requestHost && originHost.toLowerCase() === requestHost.toLowerCase();
  } catch { return false; }
}

const bucket = new Map<string, { count: number; resetAt: number }>();
export function allowRate(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const current = bucket.get(key);
  if (!current || current.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    if (bucket.size > 2000) {
      for (const [k, v] of bucket) if (v.resetAt < now) bucket.delete(k);
    }
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function errorMessage(error: unknown, fallback = "Não foi possível concluir a solicitação.") {
  if (error instanceof Error) {
    if (error.message === "PAYLOAD_TOO_LARGE") return "A solicitação é muito grande. Reduza o tamanho e tente novamente.";
    if (error.message === "JSON_INVALID") return "O conteúdo enviado não é um JSON válido.";
    if (/Configure DATABASE_URL|connection string/.test(error.message)) return "Banco não configurado: adicione DATABASE_URL ou NEON nas variáveis do Vercel.";
    if (/SESSION_SECRET/.test(error.message)) return "Configure SESSION_SECRET no Vercel antes de usar o login.";
  }
  return fallback;
}

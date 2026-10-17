import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { allowRate, checkSameOrigin, errorMessage, jsonError, readJson } from "@/lib/utils";

export const runtime = "nodejs";
const schema = z.object({ text: z.string().trim().min(1).max(5000) });
function endpointAndKey() {
  const raw = process.env.IDIOMAS_API || "";
  const url = process.env.IDIOMAS_API_URL || (raw.startsWith("https://") || raw.startsWith("http://") ? raw : "");
  const key = raw.startsWith("https://") || raw.startsWith("http://") ? "" : raw;
  return { url, key };
}
export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    if (!allowRate(`language:${user.id}`, 30)) return jsonError("Muitas análises. Aguarde um minuto.", 429);
    const parsed = schema.safeParse(await readJson(request, 7_000));
    if (!parsed.success) return jsonError("Informe um texto de até 5.000 caracteres.");
    const { url, key } = endpointAndKey();
    if (!url) return jsonError("Configure IDIOMAS_API_URL com o endpoint da sua API de idiomas. IDIOMAS_API fica como chave/token.", 503);
    let response: Response;
    try {
      response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}`, "x-api-key": key } : {}) }, body: JSON.stringify({ text: parsed.data.text }), signal: AbortSignal.timeout(12_000) });
    } catch { return jsonError("A API de idiomas não respondeu. Confira IDIOMAS_API_URL.", 502); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(`A API de idiomas retornou HTTP ${response.status}.`, 502);
    const language = payload?.language ?? payload?.lang ?? payload?.label ?? payload?.prediction ?? payload?.result ?? payload?.data?.language ?? null;
    return NextResponse.json({ language, result: payload });
  } catch (error) { return jsonError(errorMessage(error, "Falha ao classificar idioma."), 500); }
}

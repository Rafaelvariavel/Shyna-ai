import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { allowRate, checkSameOrigin, errorMessage, jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    if (!allowRate(`classify:${user.id}`, 10)) return jsonError("Você atingiu o limite temporário de análises de imagem.", 429);
    if (!process.env.GEMINI_API) return jsonError("GEMINI_API não está configurada no Vercel.", 503);
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return jsonError("Selecione uma imagem.");
    if (!file.type.startsWith("image/") || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return jsonError("Formato não suportado. Use PNG, JPEG, WebP ou GIF.");
    if (file.size > MAX_IMAGE_BYTES) return jsonError("A imagem deve ter no máximo 4 MB para respeitar limites de payload da hospedagem.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API },
        body: JSON.stringify({ contents: [{ role: "user", parts: [
          { text: "Classifique esta imagem. Responda em português brasileiro com: categoria principal, objetos/elementos visíveis, breve descrição e nível de confiança aproximado. Separe observações de inferências e não identifique pessoas." },
          { inline_data: { mime_type: file.type, data: base64 } },
        ] }], generationConfig: { temperature: 0.2, maxOutputTokens: 500 } }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch { return jsonError("O serviço Gemini demorou demais para responder.", 502); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || `HTTP ${response.status}`;
      return jsonError(/429|quota|rate.?limit/i.test(String(detail)) ? "Cota do Gemini atingida. Aguarde ou confira o plano da chave." : `Gemini retornou erro: ${String(detail).slice(0, 150)}`, response.status === 429 ? 429 : 502);
    }
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
    if (!text) return jsonError("Gemini não retornou uma classificação legível.", 502);
    return NextResponse.json({ classification: text, model });
  } catch (error) { return jsonError(errorMessage(error, "Falha ao classificar imagem."), 500); }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ensureSchema, getDb, newId } from "@/lib/db";
import { allowRate, checkSameOrigin, errorMessage, jsonError, readJson } from "@/lib/utils";
import { improvePrompt } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({ prompt: z.string().trim().min(3).max(1800), conversationId: z.string().uuid().nullable().optional(), improvePrompt: z.boolean().optional() });
function getEndpointAndKey() {
  const raw = process.env.IMAGENS_API || "";
  const url = process.env.IMAGENS_API_URL || (raw.startsWith("https://") || raw.startsWith("http://") ? raw : "");
  const key = raw.startsWith("https://") || raw.startsWith("http://") ? "" : raw;
  return { url, key };
}
function normalizeImage(payload: any): { imageUrl: string | null; jobId: string | null } {
  const candidates = [payload?.url, payload?.image_url, payload?.imageUrl, payload?.output_url, payload?.result?.url, payload?.result?.image_url, payload?.data?.url, payload?.data?.image_url, payload?.images?.[0]?.url, payload?.data?.[0]?.url, payload?.output?.[0]?.url, payload?.image, payload?.data?.image];
  const url = candidates.find((v) => typeof v === "string" && (/^https?:\/\//i.test(v) || /^data:image\//i.test(v)));
  if (url) return { imageUrl: url, jobId: null };
  const b64 = payload?.b64_json ?? payload?.data?.[0]?.b64_json ?? payload?.image_base64;
  const mime = payload?.mime_type || "image/png";
  if (typeof b64 === "string" && b64.length > 0) return { imageUrl: `data:${mime};base64,${b64}`, jobId: null };
  const jobId = payload?.id || payload?.job_id || payload?.task_id || payload?.request_id || null;
  return { imageUrl: null, jobId: typeof jobId === "string" ? jobId : null };
}
export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    if (!allowRate(`images:${user.id}`, 5, 60_000)) return jsonError("Muitas gerações. Aguarde um minuto.", 429);
    const parsed = schema.safeParse(await readJson(request, 5_000));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Prompt inválido.");
    const { url, key } = getEndpointAndKey();
    if (!url) return jsonError("Configure IMAGENS_API_URL com o endpoint da API de geração. IMAGENS_API fica como chave/token.", 503);
    await ensureSchema();
    const sql = getDb();
    let conversationId = parsed.data.conversationId || newId();
    if (parsed.data.conversationId) {
      const owns = await sql`SELECT id FROM conversations WHERE id = ${conversationId} AND user_id = ${user.id} LIMIT 1`;
      if (!owns.length) return jsonError("Conversa não encontrada.", 404);
    } else {
      await sql`INSERT INTO conversations (id, user_id, title) VALUES (${conversationId}, ${user.id}, ${`Imagem: ${parsed.data.prompt.slice(0, 38)}`})`;
    }
    let shouldImprove = parsed.data.improvePrompt !== false;
    if (parsed.data.improvePrompt === undefined) {
      const prefs = await sql`SELECT data FROM preferences WHERE user_id = ${user.id} LIMIT 1`;
      const data = prefs[0]?.data as Record<string, unknown> | undefined;
      shouldImprove = data?.improveImagePrompts !== false;
    }
    const finalPrompt = shouldImprove ? await improvePrompt(parsed.data.prompt) : parsed.data.prompt;
    await sql`INSERT INTO messages (id, conversation_id, user_id, role, content, metadata) VALUES (${newId()}, ${conversationId}, ${user.id}, 'user', ${`Gerar imagem: ${parsed.data.prompt}`}, ${JSON.stringify({ type: "image_prompt", enhancedPrompt: finalPrompt })}::jsonb)`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}`, "x-api-key": key } : {}) },
        body: JSON.stringify({ prompt: finalPrompt }),
        signal: AbortSignal.timeout(55_000),
      });
    } catch {
      return NextResponse.json({ error: "A API de imagens não respondeu. Confira IMAGENS_API_URL e a disponibilidade do provedor.", conversationId }, { status: 502 });
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.error || payload?.message || `HTTP ${response.status}`;
      return NextResponse.json({ error: /429|quota|rate.?limit/i.test(String(detail)) ? "Limite da API de imagens atingido. Aguarde e tente novamente." : `API de imagens: ${String(detail).slice(0, 160)}`, conversationId }, { status: response.status === 429 ? 429 : 502 });
    }
    const normalized = normalizeImage(payload);
    if (!normalized.imageUrl) {
      if (normalized.jobId) return NextResponse.json({ error: `A API aceitou a tarefa (${normalized.jobId}), mas respondeu em modo assíncrono. Este protótipo espera uma resposta com URL da imagem ou b64_json. Configure um endpoint síncrono ou adicione o endpoint de consulta da tarefa.`, conversationId }, { status: 501 });
      return NextResponse.json({ error: "Resposta da API de imagens desconhecida. Ela deve retornar url/image_url ou data[0].url ou b64_json.", conversationId }, { status: 502 });
    }
    // Não persistir payload base64 grande no Postgres: retorna à sessão atual, mas no histórico
    // guardamos apenas metadados compactos. APIs que retornam URL preservam a imagem no histórico.
    const imageIsDataUrl = normalized.imageUrl.startsWith("data:image/");
    const storedImageUrl = imageIsDataUrl ? null : normalized.imageUrl;
    const assistantContent = imageIsDataUrl
      ? `Imagem gerada. O provedor retornou a imagem em base64, então ela foi exibida nesta sessão sem ser salva no histórico. Configure IMAGENS_API para retornar uma URL pública/assinada para preservar imagens no histórico. Prompt: ${finalPrompt}`
      : `Imagem gerada. Prompt: ${finalPrompt}`;
    await sql`INSERT INTO messages (id, conversation_id, user_id, role, content, metadata) VALUES (${newId()}, ${conversationId}, ${user.id}, 'assistant', ${assistantContent.slice(0, 6000)}, ${JSON.stringify({ type: "image", imageUrl: storedImageUrl, imageNotPersisted: imageIsDataUrl, prompt: parsed.data.prompt, enhancedPrompt: finalPrompt })}::jsonb)`;
    await sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${conversationId} AND user_id = ${user.id}`;
    return NextResponse.json({ conversationId, imageUrl: normalized.imageUrl, imagePersisted: !imageIsDataUrl, prompt: parsed.data.prompt, enhancedPrompt: finalPrompt });
  } catch (error) { return jsonError(errorMessage(error, "Falha na geração de imagem."), 500); }
}

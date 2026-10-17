import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ensureSchema, getDb, newId } from "@/lib/db";
import { allowRate, checkSameOrigin, errorMessage, jsonError, readJson } from "@/lib/utils";
import { publicProviderError } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 60;
const inputSchema = z.object({ message: z.string().trim().min(1).max(4000), conversationId: z.string().uuid().nullable().optional() });

export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  let conversationIdForError: string | null = null;
  try {
    const user = await getSession();
    if (!user) return jsonError("Sua sessão expirou. Entre novamente.", 401);
    if (!allowRate(`chat:${user.id}`, 20, 60_000)) return jsonError("Você enviou muitas mensagens. Aguarde um minuto.", 429);
    if (!process.env.GROQ_API) return jsonError("GROQ_API não está configurada nas variáveis do Vercel.", 503);
    const parsed = inputSchema.safeParse(await readJson(request, 12_000));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Mensagem inválida.");
    await ensureSchema();
    const sql = getDb();
    let conversationId = parsed.data.conversationId || newId();
    conversationIdForError = conversationId;
    if (parsed.data.conversationId) {
      const owns = await sql`SELECT id FROM conversations WHERE id = ${conversationId} AND user_id = ${user.id} LIMIT 1`;
      if (!owns.length) return jsonError("A conversa não existe ou não pertence a esta conta.", 404);
    } else {
      const title = parsed.data.message.slice(0, 52).trim() || "Nova conversa";
      await sql`INSERT INTO conversations (id, user_id, title) VALUES (${conversationId}, ${user.id}, ${title})`;
    }
    await sql`INSERT INTO messages (id, conversation_id, user_id, role, content, metadata) VALUES (${newId()}, ${conversationId}, ${user.id}, 'user', ${parsed.data.message}, '{}'::jsonb)`;
    await sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${conversationId} AND user_id = ${user.id}`;
    const history = await sql`SELECT role, content FROM messages WHERE conversation_id = ${conversationId} AND user_id = ${user.id} AND role IN ('user','assistant') ORDER BY created_at DESC LIMIT 20`;
    const messages = (history as Array<{ role: "user" | "assistant"; content: string }>).reverse().map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
    const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.65,
        max_completion_tokens: 1200,
        messages: [
          { role: "system", content: "Você é Shyna AI, assistente útil, acolhedor e direto. Responda em português brasileiro quando o usuário escrever em português. Seja claro, honesto sobre incertezas e não invente resultados de ferramentas. Use Markdown simples quando ajudar." },
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      const detail = err?.error?.message || `HTTP ${upstream.status}`;
      const mapped = /429|rate.?limit/i.test(String(detail)) ? "Limite da API Groq atingido. Aguarde e tente novamente." : /401|403|api.?key|authentication/i.test(String(detail)) ? "A chave GROQ_API foi recusada. Confira a configuração no Vercel." : `A API Groq retornou um erro: ${String(detail).slice(0, 160)}`;
      return NextResponse.json({ error: mapped, conversationId }, { status: upstream.status === 429 ? 429 : 502 });
    }
    if (!upstream.body) return jsonError("A API de IA não iniciou o fluxo de resposta.", 502);

    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = "";
        let buffer = "";
        const send = (event: Record<string, unknown>) => { if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
        send({ type: "meta", conversationId });
        try {
          const reader = upstream.body!.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const event = JSON.parse(payload);
                const delta = event?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta) {
                  answer += delta;
                  send({ type: "delta", text: delta });
                }
              } catch { /* ignora fragmentos/eventos SSE incompletos */ }
            }
          }
          if (buffer.startsWith("data:")) {
            const payload = buffer.slice(5).trim();
            try {
              const event = JSON.parse(payload);
              const delta = event?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) { answer += delta; send({ type: "delta", text: delta }); }
            } catch { /* final parcial inválido */ }
          }
          if (!answer.trim()) throw new Error("A API retornou uma resposta vazia.");
          await sql`INSERT INTO messages (id, conversation_id, user_id, role, content, metadata) VALUES (${newId()}, ${conversationId}, ${user.id}, 'assistant', ${answer.slice(0, 30000)}, '{}'::jsonb)`;
          await sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${conversationId} AND user_id = ${user.id}`;
          send({ type: "done" });
        } catch (error) {
          send({ type: "error", error: publicProviderError(error) });
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() { cancelled = true; upstream.body?.cancel().catch(() => undefined); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", Connection: "keep-alive" } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, publicProviderError(error)), conversationId: conversationIdForError }, { status: 500 });
  }
}

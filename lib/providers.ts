export type ChatMessage = { role: "user" | "assistant"; content: string };
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function groqCompletion(apiKey: string, model: string, messages: Array<{ role: string; content: string }>, maxTokens = 500) {
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.65, max_completion_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`GROQ_PROVIDER:${String(detail).slice(0, 220)}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("GROQ_PROVIDER: resposta vazia");
  return content.trim();
}

export async function improvePrompt(prompt: string) {
  const key = process.env.GROQ2_API;
  if (!key) return prompt;
  const model = process.env.GROQ2_MODEL || "llama-3.1-8b-instant";
  try {
    return await groqCompletion(key, model, [
      { role: "system", content: "Você é um editor de prompts para geração de imagens. Melhore o prompt do usuário para torná-lo claro, descritivo e visualmente específico. Preserve exatamente a intenção e o idioma original do usuário. Não acrescente pessoas, marcas ou conteúdo não solicitado. Responda somente com o prompt final, sem aspas, explicações ou prefácio. Limite a 120 palavras." },
      { role: "user", content: prompt.slice(0, 1800) },
    ], 180);
  } catch {
    // A melhoria é opcional; falhas do provedor secundário não bloqueiam a geração.
    return prompt;
  }
}

export function publicProviderError(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (raw.startsWith("GROQ_PROVIDER:")) {
    const detail = raw.slice("GROQ_PROVIDER:".length);
    if (/rate.?limit|429/i.test(detail)) return "Limite da API de IA atingido. Aguarde um pouco e tente novamente.";
    if (/api.?key|authentication|unauthorized|401|403/i.test(detail)) return "A chave GROQ_API/GROQ2_API foi recusada. Confira as variáveis no Vercel.";
    return `A API Groq retornou um erro: ${detail}`;
  }
  if (raw.includes("timed out") || raw.includes("TimeoutError")) return "A API demorou demais para responder. Tente novamente.";
  return "O serviço de IA está temporariamente indisponível. Tente novamente em instantes.";
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ensureSchema, getDb, newId } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { allowRate, checkSameOrigin, errorMessage, jsonError, readJson } from "@/lib/utils";

export const runtime = "nodejs";
const schema = z.object({ username: z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N}_.-]+$/u, "Use letras, números, ponto, hífen ou underline."), password: z.string().min(8).max(72) });

export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRate(`register:${ip}`, 5, 60_000)) return jsonError("Muitas tentativas. Aguarde um minuto.", 429);
  try {
    const parsed = schema.safeParse(await readJson(request, 4_000));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Dados de cadastro inválidos.");
    const username = parsed.data.username.normalize("NFKC");
    await ensureSchema();
    const sql = getDb();
    const userId = newId();
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    try {
      await sql`INSERT INTO users (id, username, password_hash) VALUES (${userId}, ${username}, ${passwordHash})`;
    } catch (error) {
      if (String((error as { code?: string })?.code) === "23505") return jsonError("Esse nome já está em uso. Escolha outro.", 409);
      throw error;
    }
    await sql`INSERT INTO preferences (user_id, data) VALUES (${userId}, ${JSON.stringify({ theme: "dark", improveImagePrompts: true })}::jsonb) ON CONFLICT (user_id) DO NOTHING`;
    const token = await createSession({ id: userId, username });
    const response = NextResponse.json({ user: { id: userId, username } }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    return jsonError(errorMessage(error, "Não foi possível criar a conta. Confira o banco Neon e tente novamente."), 500);
  }
}

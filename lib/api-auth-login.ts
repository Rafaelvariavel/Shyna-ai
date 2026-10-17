import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ensureSchema, getDb } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { allowRate, checkSameOrigin, errorMessage, jsonError, readJson } from "@/lib/utils";

export const runtime = "nodejs";
const schema = z.object({ username: z.string().trim().min(1).max(24), password: z.string().min(1).max(72) });

export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRate(`login:${ip}`, 10, 60_000)) return jsonError("Muitas tentativas de login. Aguarde um minuto.", 429);
  try {
    const parsed = schema.safeParse(await readJson(request, 4_000));
    if (!parsed.success) return jsonError("Informe nome e senha.");
    await ensureSchema();
    const sql = getDb();
    const rows = await sql`SELECT id, username, password_hash FROM users WHERE username = ${parsed.data.username.normalize("NFKC")} LIMIT 1`;
    const user = rows[0] as { id: string; username: string; password_hash: string } | undefined;
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return jsonError("Nome ou senha incorretos.", 401);
    const token = await createSession({ id: user.id, username: user.username });
    const response = NextResponse.json({ user: { id: user.id, username: user.username } });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    return jsonError(errorMessage(error, "Falha no login. Confira a configuração do banco."), 500);
  }
}

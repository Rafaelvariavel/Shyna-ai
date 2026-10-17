import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { checkSameOrigin, errorMessage, jsonError, readJson } from "@/lib/utils";

export const runtime = "nodejs";
const schema = z.object({ theme: z.enum(["dark", "light"]).optional(), improveImagePrompts: z.boolean().optional() }).strict();
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    await ensureSchema();
    const sql = getDb();
    const rows = await sql`SELECT data FROM preferences WHERE user_id = ${user.id} LIMIT 1`;
    return NextResponse.json({ preferences: rows[0]?.data || { theme: "dark", improveImagePrompts: true } });
  } catch (error) { return jsonError(errorMessage(error, "Não foi possível carregar as preferências."), 500); }
}
export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    const parsed = schema.safeParse(await readJson(request, 3_000));
    if (!parsed.success) return jsonError("Preferências inválidas.");
    await ensureSchema();
    const sql = getDb();
    const existing = await sql`SELECT data FROM preferences WHERE user_id = ${user.id} LIMIT 1`;
    const prior = (existing[0]?.data || {}) as Record<string, unknown>;
    const merged = { theme: prior.theme === "light" ? "light" : "dark", improveImagePrompts: prior.improveImagePrompts !== false, ...parsed.data };
    await sql`INSERT INTO preferences (user_id, data, updated_at) VALUES (${user.id}, ${JSON.stringify(merged)}::jsonb, NOW()) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    return NextResponse.json({ preferences: merged });
  } catch (error) { return jsonError(errorMessage(error, "Não foi possível salvar as preferências."), 500); }
}

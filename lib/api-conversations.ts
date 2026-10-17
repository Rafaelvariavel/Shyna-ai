import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { checkSameOrigin, errorMessage, jsonError } from "@/lib/utils";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return jsonError("Entre na sua conta para ver as conversas.", 401);
    await ensureSchema();
    const sql = getDb();
    const rows = await sql`SELECT c.id, c.title, c.created_at, c.updated_at,
      (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS preview
      FROM conversations c WHERE c.user_id = ${user.id} ORDER BY c.updated_at DESC LIMIT 50`;
    return NextResponse.json({ conversations: rows });
  } catch (error) { return jsonError(errorMessage(error, "Não foi possível carregar as conversas."), 500); }
}

export async function DELETE(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    await ensureSchema();
    const sql = getDb();
    await sql`DELETE FROM conversations WHERE user_id = ${user.id}`;
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(errorMessage(error, "Não foi possível apagar as conversas."), 500); }
}

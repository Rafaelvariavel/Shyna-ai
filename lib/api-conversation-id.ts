import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { checkSameOrigin, errorMessage, jsonError } from "@/lib/utils";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    const { id } = await context.params;
    await ensureSchema();
    const sql = getDb();
    const owners = await sql`SELECT id, title FROM conversations WHERE id = ${id} AND user_id = ${user.id} LIMIT 1`;
    if (!owners.length) return jsonError("Conversa não encontrada.", 404);
    const messages = await sql`SELECT id, role, content, metadata, created_at FROM messages WHERE conversation_id = ${id} AND user_id = ${user.id} ORDER BY created_at ASC LIMIT 300`;
    return NextResponse.json({ conversation: owners[0], messages });
  } catch (error) { return jsonError(errorMessage(error, "Não foi possível abrir a conversa."), 500); }
}
export async function DELETE(request: Request, context: RouteContext) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  try {
    const user = await getSession();
    if (!user) return jsonError("Faça login.", 401);
    const { id } = await context.params;
    await ensureSchema();
    const sql = getDb();
    const result = await sql`DELETE FROM conversations WHERE id = ${id} AND user_id = ${user.id} RETURNING id`;
    if (!result.length) return jsonError("Conversa não encontrada.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(errorMessage(error, "Não foi possível excluir a conversa."), 500); }
}

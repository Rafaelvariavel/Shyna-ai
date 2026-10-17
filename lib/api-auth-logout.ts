import { NextResponse } from "next/server";
import { SESSION_COOKIE, clearedCookieOptions } from "@/lib/auth";
import { checkSameOrigin, jsonError } from "@/lib/utils";
export async function POST(request: Request) {
  if (!checkSameOrigin(request)) return jsonError("Origem da solicitação não permitida.", 403);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", clearedCookieOptions);
  return response;
}

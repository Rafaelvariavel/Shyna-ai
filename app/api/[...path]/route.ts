import { NextResponse } from "next/server";
import * as authLogin from "@/lib/api-auth-login";
import * as authLogout from "@/lib/api-auth-logout";
import * as authMe from "@/lib/api-auth-me";
import * as authRegister from "@/lib/api-auth-register";
import * as chat from "@/lib/api-chat";
import * as images from "@/lib/api-images";
import * as conversations from "@/lib/api-conversations";
import * as conversation from "@/lib/api-conversation-id";
import * as preferences from "@/lib/api-preferences";
import * as classifyImage from "@/lib/api-classify-image";
import * as language from "@/lib/api-language";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };
type ApiHandler = (request: Request, context: RouteContext) => Response | Promise<Response>;
type Methods = Partial<Record<"GET" | "POST" | "DELETE", ApiHandler>>;

// Um único ponto de entrada deixa a árvore de diretórios curta sem alterar as URLs públicas.
const routes: Record<string, Methods> = {
  "auth/login": { POST: authLogin.POST as ApiHandler },
  "auth/logout": { POST: authLogout.POST as ApiHandler },
  "auth/me": { GET: authMe.GET as ApiHandler },
  "auth/register": { POST: authRegister.POST as ApiHandler },
  chat: { POST: chat.POST as ApiHandler },
  images: { POST: images.POST as ApiHandler },
  conversations: {
    GET: conversations.GET as ApiHandler,
    DELETE: conversations.DELETE as ApiHandler,
  },
  preferences: {
    GET: preferences.GET as ApiHandler,
    POST: preferences.POST as ApiHandler,
  },
  "classify-image": { POST: classifyImage.POST as ApiHandler },
  language: { POST: language.POST as ApiHandler },
};

async function dispatch(request: Request) {
  const parts = new URL(request.url).pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);
  let routeKey = parts.join("/");
  let id = "";

  if (parts.length === 2 && parts[0] === "conversations") {
    routeKey = "conversations/:id";
    id = parts[1];
  }

  const route = routeKey === "conversations/:id"
    ? ({ GET: conversation.GET as ApiHandler, DELETE: conversation.DELETE as ApiHandler } satisfies Methods)
    : routes[routeKey];

  if (!route) return NextResponse.json({ error: "Endpoint não encontrado." }, { status: 404 });
  const handler = route[request.method as keyof Methods];
  if (!handler) return NextResponse.json({ error: "Método não permitido." }, { status: 405 });

  return handler(request, { params: Promise.resolve({ id }) });
}

export const GET = dispatch;
export const POST = dispatch;
export const DELETE = dispatch;

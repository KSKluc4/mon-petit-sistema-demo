import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Não redireciona sessão-com-JWT-válido pra fora de /login aqui — o
  // middleware só confere a assinatura, não se a sessão foi invalidada no
  // banco (redefinição de senha do outro usuário, usuário apagado). Essa
  // checagem mais funda mora em app/login/page.tsx, que já usa getSession().
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};

import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  // Confere se a sessão não foi invalidada (outro usuário redefiniu a senha
  // desta conta pelo menos uma vez desde que este token foi emitido).
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    select: { sessionVersion: true },
  });
  if (!usuario || usuario.sessionVersion !== session.sv) {
    return null;
  }

  return session;
}

// Usado dentro de Server Actions para autorizar mutações — o roteamento por
// página não é uma barreira de segurança para os POSTs de Server Actions.
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Não autenticado.");
  }
  return session;
}

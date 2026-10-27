import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "mp_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type SessionPayload = {
  sub: string;
  login: string;
  nome: string;
  sv: number;
};

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET não configurado.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.login !== "string" || typeof payload.nome !== "string") {
      return null;
    }
    // Tokens emitidos antes do campo sv existir não têm essa claim — trata
    // como 0, que é o default de Usuario.sessionVersion (não força logout
    // de quem já estava logado quando este campo foi introduzido).
    const sv = typeof payload.sv === "number" ? payload.sv : 0;
    return { sub: payload.sub, login: payload.login, nome: payload.nome, sv };
  } catch {
    return null;
  }
}

import "server-only";
import { cookies } from "next/headers";
import { decrypt, encrypt, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/session-token";

const SESSION_DAYS = 7;

export async function createSession(userId: string, role: string) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = await encrypt({ userId, role, expiresAt });
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  return decrypt((await cookies()).get(SESSION_COOKIE_NAME)?.value);
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

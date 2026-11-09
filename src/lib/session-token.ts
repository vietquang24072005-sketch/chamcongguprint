/** Ký / xác minh token phiên. Không phụ thuộc next/headers để dùng được cả trong proxy. */
import { jwtVerify, SignJWT } from "jose";

export type SessionPayload = { userId: string; role: string; expiresAt: number };

export const SESSION_COOKIE_NAME = "cc_session";

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET chưa được cấu hình");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(getKey());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getKey(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

import "server-only";
import { headers } from "next/headers";

/**
 * IP và user agent của request hiện tại.
 * Trên Vercel, x-forwarded-for do hạ tầng Vercel ghi đè nên tin được;
 * nếu tự host, chỉ tin khi chạy sau reverse proxy do công ty kiểm soát.
 */
export async function getRequestInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

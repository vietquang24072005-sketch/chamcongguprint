import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/session-token";

/**
 * Kiểm tra lạc quan: chỉ chuyển hướng dựa vào cookie phiên.
 * Phân quyền thật sự vẫn phải kiểm tra lại ở Server Component / Server Action (lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decrypt(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isLogin = pathname === "/login";

  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (session && (isLogin || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};

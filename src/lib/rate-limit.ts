/** Quy tắc giới hạn đăng nhập — hàm thuần. */

export const LOGIN_WINDOW_MINUTES = 15;
/** Số lần sai tối đa cho một tài khoản trong cửa sổ thời gian. */
export const MAX_FAILS_PER_IDENTIFIER = 5;
/** Số lần sai tối đa từ một IP (chặn dò nhiều tài khoản). */
export const MAX_FAILS_PER_IP = 20;

export function isLoginBlocked(failsForIdentifier: number, failsForIp: number): boolean {
  return failsForIdentifier >= MAX_FAILS_PER_IDENTIFIER || failsForIp >= MAX_FAILS_PER_IP;
}

/** Chuẩn hoá chuỗi đăng nhập để đếm đúng dù người dùng gõ hoa/thường. */
export function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

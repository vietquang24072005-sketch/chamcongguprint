import { describe, expect, it } from "vitest";
import { isLoginBlocked, normalizeIdentifier } from "./rate-limit";

describe("isLoginBlocked", () => {
  it("dưới ngưỡng thì cho thử", () => expect(isLoginBlocked(4, 19)).toBe(false));
  it("sai 5 lần một tài khoản thì chặn", () => expect(isLoginBlocked(5, 5)).toBe(true));
  it("sai 20 lần từ một IP thì chặn", () => expect(isLoginBlocked(0, 20)).toBe(true));
});

describe("normalizeIdentifier", () => {
  it("mã NV và email không phân biệt hoa thường", () => {
    expect(normalizeIdentifier(" NV001 ")).toBe("nv001");
    expect(normalizeIdentifier("Admin@Example.com")).toBe("admin@example.com");
  });
});

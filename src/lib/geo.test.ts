import { describe, expect, it } from "vitest";
import { checkLocation, distanceMeters, ipMatches } from "./geo";

const office = { name: "VP", latitude: 21.028511, longitude: 105.804817, radiusM: 100 };

describe("distanceMeters", () => {
  it("cùng một điểm = 0", () => {
    expect(distanceMeters(21, 105, 21, 105)).toBe(0);
  });
  it("lệch 0.001 độ vĩ ≈ 111m", () => {
    expect(distanceMeters(21, 105, 21.001, 105)).toBeGreaterThan(110);
    expect(distanceMeters(21, 105, 21.001, 105)).toBeLessThan(112);
  });
});

describe("ipMatches", () => {
  it("khớp IP đơn", () => expect(ipMatches("203.0.113.5", "203.0.113.5")).toBe(true));
  it("khớp dải CIDR", () => expect(ipMatches("192.168.1.77", "192.168.1.0/24")).toBe(true));
  it("ngoài dải CIDR", () => expect(ipMatches("192.168.2.1", "192.168.1.0/24")).toBe(false));
  it("IPv4-mapped IPv6", () => expect(ipMatches("::ffff:192.168.1.10", "192.168.1.0/24")).toBe(true));
  it("IPv6 khớp chính xác", () => expect(ipMatches("::1", "::1")).toBe(true));
  it("CIDR sai định dạng", () => expect(ipMatches("10.0.0.1", "10.0.0.0/40")).toBe(false));
});

describe("checkLocation", () => {
  const near = { latitude: 21.0286, longitude: 105.8049 };
  const far = { latitude: 21.04, longitude: 105.82 };
  const base = { offices: [office], allowedCidrs: ["10.0.0.0/8"] };

  it("NONE luôn hợp lệ", () => {
    expect(checkLocation({ ...base, mode: "NONE", ip: null, coords: null }).ok).toBe(true);
  });
  it("GPS trong bán kính", () => {
    expect(checkLocation({ ...base, mode: "GPS", ip: null, coords: near }).ok).toBe(true);
  });
  it("GPS ngoài bán kính", () => {
    expect(checkLocation({ ...base, mode: "GPS", ip: null, coords: far }).ok).toBe(false);
  });
  it("GPS_OR_IP: ngoài vùng nhưng đúng mạng công ty", () => {
    expect(checkLocation({ ...base, mode: "GPS_OR_IP", ip: "10.1.2.3", coords: far }).ok).toBe(true);
  });
  it("GPS_AND_IP: đúng vị trí nhưng sai mạng", () => {
    const r = checkLocation({ ...base, mode: "GPS_AND_IP", ip: "8.8.8.8", coords: near });
    expect(r.ok).toBe(false);
  });
});

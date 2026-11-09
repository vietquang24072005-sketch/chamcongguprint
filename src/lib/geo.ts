/** Kiểm tra vị trí chấm công: GPS (Haversine) và IP (CIDR IPv4 hoặc khớp chính xác). */

export type LocationModeValue = "NONE" | "GPS" | "IP" | "GPS_OR_IP" | "GPS_AND_IP";

export type OfficeArea = { name: string; latitude: number; longitude: number; radiusM: number };

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

/** Chuẩn hoá IP: bỏ tiền tố IPv4-mapped "::ffff:". */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}

/** So khớp IP với một IP đơn hoặc dải CIDR IPv4. IPv6 chỉ hỗ trợ khớp chính xác. */
export function ipMatches(ip: string, cidr: string): boolean {
  const addr = normalizeIp(ip);
  const [range, bitsStr] = cidr.trim().split("/");
  if (bitsStr === undefined) return addr === normalizeIp(range);
  const a = ipv4ToInt(addr);
  const r = ipv4ToInt(range);
  const bits = Number(bitsStr);
  if (a === null || r === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((r & mask) >>> 0);
}

export type LocationCheck = { ok: true } | { ok: false; reason: string };

export function checkLocation(input: {
  mode: LocationModeValue;
  offices: OfficeArea[];
  allowedCidrs: string[];
  ip: string | null;
  coords: { latitude: number; longitude: number } | null;
}): LocationCheck {
  const { mode, offices, allowedCidrs, ip, coords } = input;
  if (mode === "NONE") return { ok: true };

  const gpsOk =
    coords !== null &&
    offices.some((o) => distanceMeters(coords.latitude, coords.longitude, o.latitude, o.longitude) <= o.radiusM);
  const ipOk = ip !== null && allowedCidrs.some((c) => ipMatches(ip, c));

  const gpsReason = coords === null ? "Không lấy được vị trí GPS" : "Bạn đang ở ngoài khu vực văn phòng";
  const ipReason = "Bạn không kết nối mạng của công ty";

  switch (mode) {
    case "GPS":
      return gpsOk ? { ok: true } : { ok: false, reason: gpsReason };
    case "IP":
      return ipOk ? { ok: true } : { ok: false, reason: ipReason };
    case "GPS_OR_IP":
      return gpsOk || ipOk ? { ok: true } : { ok: false, reason: `${gpsReason}, đồng thời ${ipReason.toLowerCase()}` };
    case "GPS_AND_IP":
      if (!gpsOk) return { ok: false, reason: gpsReason };
      if (!ipOk) return { ok: false, reason: ipReason };
      return { ok: true };
  }
}

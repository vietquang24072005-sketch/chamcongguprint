"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { checkIn, checkOut, type PunchResult } from "@/lib/attendance/service";
import { punchSchema } from "@/lib/validations/auth";

type Coords = { latitude: number | null; longitude: number | null };

async function buildInput(userId: string, coords: Coords) {
  const parsed = punchSchema.safeParse(coords);
  const h = await headers();
  // Lưu ý: x-forwarded-for chỉ đáng tin khi app chạy sau reverse proxy do công ty kiểm soát.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const valid = parsed.success && parsed.data.latitude !== null && parsed.data.longitude !== null;
  return {
    userId,
    now: new Date(), // Luôn dùng giờ server
    ip,
    userAgent: h.get("user-agent"),
    coords: valid ? { latitude: parsed.data.latitude!, longitude: parsed.data.longitude! } : null,
  };
}

export async function checkInAction(coords: Coords): Promise<PunchResult> {
  const user = await requireUser();
  const result = await checkIn(await buildInput(user.id, coords));
  if (result.ok) refresh();
  return result;
}

export async function checkOutAction(coords: Coords): Promise<PunchResult> {
  const user = await requireUser();
  const result = await checkOut(await buildInput(user.id, coords));
  if (result.ok) refresh();
  return result;
}

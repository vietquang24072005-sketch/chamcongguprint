"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { checkIn, checkOut, type PunchResult } from "@/lib/attendance/service";
import { getRequestInfo } from "@/lib/request-info";
import { punchSchema } from "@/lib/validations/auth";

type Coords = { latitude: number | null; longitude: number | null };

async function buildInput(userId: string, coords: Coords) {
  const parsed = punchSchema.safeParse(coords);
  const { ip, userAgent } = await getRequestInfo();
  const valid = parsed.success && parsed.data.latitude !== null && parsed.data.longitude !== null;
  return {
    userId,
    now: new Date(), // Luôn dùng giờ server
    ip,
    userAgent,
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

import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof db;

/** Ghi một dòng nhật ký. Không ghi mật khẩu hay hash vào before/after. */
export async function audit(
  client: Client,
  entry: {
    actorId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
  },
) {
  const toJson = (v: unknown) =>
    v === undefined || v === null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      before: toJson(entry.before),
      after: toJson(entry.after),
      reason: entry.reason ?? null,
    },
  });
}

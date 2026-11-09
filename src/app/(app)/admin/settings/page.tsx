import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, Field, inputClass } from "@/components/fields";
import {
  createAllowedIpAction,
  createOfficeAction,
  deleteAllowedIpAction,
  deleteOfficeAction,
  updateAppConfigAction,
} from "@/app/actions/admin";

const MODES = [
  { value: "GPS_OR_IP", label: "GPS hoặc mạng công ty", hint: "Ở trong văn phòng hoặc dùng mạng công ty là được (khuyên dùng)" },
  { value: "GPS", label: "Chỉ GPS", hint: "Phải ở trong bán kính văn phòng" },
  { value: "IP", label: "Chỉ mạng công ty", hint: "Phải kết nối mạng/IP công ty" },
  { value: "GPS_AND_IP", label: "GPS và mạng công ty", hint: "Nghiêm ngặt nhất: cần cả hai" },
  { value: "NONE", label: "Không kiểm tra", hint: "Chấm công từ bất kỳ đâu" },
] as const;

const WEEKDAYS = [
  [1, "Thứ 2"],
  [2, "Thứ 3"],
  [3, "Thứ 4"],
  [4, "Thứ 5"],
  [5, "Thứ 6"],
  [6, "Thứ 7"],
  [0, "Chủ nhật"],
] as const;

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await requireRole("ADMIN");
  const [config, offices, ips] = await Promise.all([
    db.appConfig.findUnique({ where: { id: 1 } }),
    db.office.findMany({ orderBy: { name: "asc" } }),
    db.allowedIp.findMany({ orderBy: { cidr: "asc" } }),
  ]);
  const mode = config?.locationMode ?? "GPS_OR_IP";
  const weekdays = config?.workingWeekdays ?? [1, 2, 3, 4, 5];

  return (
    <div className="space-y-6">
      <Card title="Quy định chấm công">
        <ActionForm action={updateAppConfigAction} submitLabel="Lưu cấu hình" className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">Xác thực vị trí khi chấm công</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {MODES.map((m) => (
                <label key={m.value} className="flex gap-2 rounded-lg p-2 ring-1 ring-slate-200 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-300">
                  <input type="radio" name="locationMode" value={m.value} defaultChecked={mode === m.value} className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-slate-500">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Ngày làm việc trong tuần</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ring-1 ring-slate-200 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-300">
                  <input type="checkbox" name="workingWeekdays" value={v} defaultChecked={weekdays.includes(v)} />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Dùng để đếm ngày phép và xác định ngày vắng mặt.</p>
          </fieldset>
        </ActionForm>
      </Card>

      <Card title="Văn phòng (cho kiểm tra GPS)">
        {offices.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100">
            {offices.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="flex-1">
                  <span className="font-medium">{o.name}</span>
                  <span className="block text-xs text-slate-500">
                    {o.latitude.toFixed(6)}, {o.longitude.toFixed(6)} · bán kính {o.radiusM}m ·{" "}
                    <a
                      href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      Xem bản đồ
                    </a>
                  </span>
                </span>
                <ConfirmButton action={deleteOfficeAction.bind(null, o.id)} label="Xoá" confirmText={`Xoá văn phòng "${o.name}"?`} />
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={createOfficeAction} submitLabel="Thêm văn phòng" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <Field label="Tên văn phòng">
                <input name="name" required className={inputClass} />
              </Field>
            </div>
            <Field label="Vĩ độ" hint="Lấy từ Google Maps: chuột phải vào vị trí → bấm vào toạ độ để sao chép">
              <input name="latitude" required inputMode="decimal" placeholder="21.028511" className={inputClass} />
            </Field>
            <Field label="Kinh độ">
              <input name="longitude" required inputMode="decimal" placeholder="105.804817" className={inputClass} />
            </Field>
            <Field label="Bán kính (m)">
              <input name="radiusM" type="number" min={20} max={5000} required defaultValue={100} className={inputClass} />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <Card title="Mạng công ty (cho kiểm tra IP)">
        {ips.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100">
            {ips.map((ip) => (
              <li key={ip.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-mono">{ip.cidr}</span>
                <span className="flex-1 text-slate-500">{ip.description}</span>
                <ConfirmButton action={deleteAllowedIpAction.bind(null, ip.id)} label="Xoá" confirmText={`Xoá IP ${ip.cidr}?`} />
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={createAllowedIpAction} submitLabel="Thêm IP" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="IP hoặc dải CIDR" hint="IP công cộng của văn phòng (xem tại whatismyip khi dùng mạng công ty)">
              <input name="cidr" required placeholder="203.0.113.5 hoặc 192.168.1.0/24" className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Ghi chú">
              <input name="description" placeholder="Vd. Wifi tầng 3" className={inputClass} />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}

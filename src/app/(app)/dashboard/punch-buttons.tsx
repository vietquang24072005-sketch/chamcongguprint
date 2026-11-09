"use client";

import { useState, useTransition } from "react";
import { checkInAction, checkOutAction } from "@/app/actions/attendance";

type Coords = { latitude: number | null; longitude: number | null };

function getPosition(): Promise<Coords> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve({ latitude: null, longitude: null });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

export function PunchButtons({ hasCheckedIn }: { hasCheckedIn: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function punch(kind: "in" | "out") {
    setMessage(null);
    startTransition(async () => {
      const coords = await getPosition();
      const result = kind === "in" ? await checkInAction(coords) : await checkOutAction(coords);
      setMessage(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => punch("in")}
          disabled={pending || hasCheckedIn}
          className="rounded-xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Check-in
        </button>
        <button
          onClick={() => punch("out")}
          disabled={pending || !hasCheckedIn}
          className="rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Check-out
        </button>
      </div>
      {pending && <p className="text-sm text-slate-500">Đang lấy vị trí và ghi nhận...</p>}
      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

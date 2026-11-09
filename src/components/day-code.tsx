import { DAY_CODE_LABEL, type DayCode } from "@/lib/reports/summary";

const CODE_CLASS: Record<DayCode, string> = {
  X: "bg-emerald-100 text-emerald-800",
  M: "bg-amber-100 text-amber-800",
  S: "bg-amber-100 text-amber-800",
  MS: "bg-orange-100 text-orange-800",
  Q: "bg-sky-100 text-sky-800",
  P: "bg-violet-100 text-violet-800",
  "P/2": "bg-violet-100 text-violet-800",
  KL: "bg-fuchsia-100 text-fuchsia-800",
  "KL/2": "bg-fuchsia-100 text-fuchsia-800",
  CT: "bg-teal-100 text-teal-800",
  V: "bg-rose-100 text-rose-800",
  "V/2": "bg-rose-100 text-rose-800",
  L: "bg-slate-200 text-slate-700",
  "-": "text-slate-300",
  "": "",
};

export function DayCodeBadge({ code }: { code: DayCode }) {
  if (!code) return null;
  return (
    <span
      title={DAY_CODE_LABEL[code]}
      className={`inline-block min-w-7 rounded px-1 py-0.5 text-center text-xs font-medium ${CODE_CLASS[code]}`}
    >
      {code}
    </span>
  );
}

export function DayCodeLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {(Object.keys(DAY_CODE_LABEL) as Exclude<DayCode, "">[]).map((c) => (
        <span key={c} className="inline-flex items-center gap-1">
          <DayCodeBadge code={c} /> {DAY_CODE_LABEL[c]}
        </span>
      ))}
    </div>
  );
}

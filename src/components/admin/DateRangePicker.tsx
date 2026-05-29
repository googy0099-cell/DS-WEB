"use client";

function todayBKK(): string {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  return bkk.toISOString().slice(0, 10);
}
function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function firstOfMonth(d: string): string {
  return d.slice(0, 7) + "-01";
}

const PRESETS = [
  { label: "วันนี้", get: () => { const t = todayBKK(); return [t, t] as [string, string]; } },
  { label: "7 วัน",  get: () => [addDays(todayBKK(), -6), todayBKK()] as [string, string] },
  { label: "30 วัน", get: () => [addDays(todayBKK(), -29), todayBKK()] as [string, string] },
  { label: "เดือนนี้", get: () => [firstOfMonth(todayBKK()), todayBKK()] as [string, string] },
];

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export default function DateRangePicker({ from, to, onChange }: Props) {
  const today = todayBKK();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {PRESETS.map((p) => {
          const [pf, pt] = p.get();
          const active = from === pf && to === pt;
          return (
            <button key={p.label} onClick={() => onChange(pf, pt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                active ? "bg-orange text-white" : "bg-white border border-sand text-navy hover:border-orange"
              }`}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span>จาก</span>
        <input type="date" value={from} max={to}
          onChange={(e) => e.target.value && onChange(e.target.value, to)}
          className="border border-sand rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-orange" />
        <span>ถึง</span>
        <input type="date" value={to} min={from} max={today}
          onChange={(e) => e.target.value && onChange(from, e.target.value)}
          className="border border-sand rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-orange" />
      </div>
    </div>
  );
}

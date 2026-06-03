"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import HrNav from "@/components/hr/HrNav";

type DashboardData = {
  staff: { id: number; name: string; avatarUrl: string | null; isCheckedIn: boolean }[];
  attendances: { id: number; staffName: string; checkIn: string; checkOut: string | null; photoUrl: string | null }[];
  checklists: { id: number; type: string; staffName: string; totalItems: number; doneItems: number }[];
  taskCounts: Record<string, number>;
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function HrDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/api/auth/signin"); return; }
    if (status === "authenticated" && role !== "OWNER") { router.replace("/hr/checklist"); return; }
  }, [status, role, router]);

  useEffect(() => {
    if (role !== "OWNER") return;
    fetch("/api/hr/dashboard").then((r) => r.json()).then(setData).catch(() => {});
    const id = setInterval(() => {
      fetch("/api/hr/dashboard").then((r) => r.json()).then(setData).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [role]);

  if (status === "loading" || !data) {
    return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;
  }

  const checkedIn = data.staff.filter((s) => s.isCheckedIn).length;
  const openChecklist = data.checklists.find((c) => c.type === "OPEN");
  const closeChecklist = data.checklists.find((c) => c.type === "CLOSE");
  const totalTasks = Object.values(data.taskCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-lg font-bold mb-1">ภาพรวม HR</h1>
      <p className="text-[#f8f1e5]/50 text-xs mb-5">
        {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[#f8f1e5]/50 text-xs mb-1">พนักงานวันนี้</p>
          <p className="text-2xl font-bold text-emerald-400">{checkedIn}</p>
          <p className="text-[#f8f1e5]/40 text-xs">จาก {data.staff.length} คน</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[#f8f1e5]/50 text-xs mb-1">งานทั้งหมด</p>
          <p className="text-2xl font-bold text-[#fb8500]">{totalTasks}</p>
          <p className="text-[#f8f1e5]/40 text-xs">เสร็จ {data.taskCounts["DONE"] ?? 0} รายการ</p>
        </div>
      </div>

      {/* Checklist status */}
      <div className="mb-6">
        <p className="text-sm font-semibold mb-3">เช็คลิสต์วันนี้</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "🌅 เปิดร้าน", data: openChecklist },
            { label: "🌙 ปิดร้าน", data: closeChecklist },
          ].map(({ label, data: cl }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-sm font-semibold mb-2">{label}</p>
              {cl ? (
                <>
                  <p className={`text-lg font-bold ${cl.doneItems === cl.totalItems ? "text-emerald-400" : "text-amber-400"}`}>
                    {cl.doneItems}/{cl.totalItems}
                  </p>
                  <div className="w-full h-1 bg-white/10 rounded-full mt-2">
                    <div
                      className={`h-1 rounded-full ${cl.doneItems === cl.totalItems ? "bg-emerald-400" : "bg-amber-400"}`}
                      style={{ width: `${(cl.doneItems / cl.totalItems) * 100}%` }}
                    />
                  </div>
                  <p className="text-[#f8f1e5]/40 text-xs mt-1">{cl.staffName}</p>
                </>
              ) : (
                <p className="text-[#f8f1e5]/30 text-xs mt-1">ยังไม่ได้เริ่ม</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Staff attendance grid */}
      <div className="mb-6">
        <p className="text-sm font-semibold mb-3">สถานะพนักงาน</p>
        <div className="grid grid-cols-3 gap-2">
          {data.staff.map((s) => (
            <div key={s.id} className="bg-white/5 rounded-xl p-3 flex flex-col items-center gap-2">
              <div className="relative">
                {s.avatarUrl ? (
                  <Image src={s.avatarUrl} alt={s.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-[#fb8500]">
                    {s.name.charAt(0)}
                  </div>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#182a47] ${s.isCheckedIn ? "bg-emerald-400" : "bg-white/20"}`} />
              </div>
              <p className="text-[10px] text-center text-[#f8f1e5]/70 leading-tight">{s.name.split(" ")[0]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent check-ins */}
      {data.attendances.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3">การเข้า-ออกวันนี้</p>
          <div className="flex flex-col gap-2">
            {data.attendances.slice(0, 8).map((a) => (
              <div key={a.id} className="bg-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                {a.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.staffName}</p>
                  <p className="text-[#f8f1e5]/40 text-xs">
                    เข้า {fmt(a.checkIn)}{a.checkOut ? ` · ออก ${fmt(a.checkOut)}` : " · กำลังทำงาน"}
                  </p>
                </div>
                {!a.checkOut && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <HrNav />
    </div>
  );
}

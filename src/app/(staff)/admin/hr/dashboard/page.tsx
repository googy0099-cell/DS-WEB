"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

type DashboardData = {
  staff: { id: number; name: string; avatarUrl: string | null; isCheckedIn: boolean }[];
  attendances: { id: number; staffName: string; checkIn: string; checkOut: string | null; photoUrl: string | null }[];
  checklists: { id: number; type: string; staffName: string; totalItems: number; doneItems: number }[];
  taskCounts: Record<string, number>;
};

type AbsentStaff = { staffId: number; name: string; alreadyDeducted: boolean };

type OverdueTask = {
  taskId: number;
  title: string;
  status: string;
  deadline: string;
  daysOverdue: number;
  staffId: number;
  staffName: string;
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function todayBkkStr() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export default function AdminHrDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [absentList, setAbsentList] = useState<AbsentStaff[]>([]);
  const [absentLoading, setAbsentLoading] = useState(false);
  const [absentMsg, setAbsentMsg] = useState("");
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [taskDeductLoading, setTaskDeductLoading] = useState<number | null>(null);
  const [taskDeductMsg, setTaskDeductMsg] = useState("");

  const fetchAbsent = useCallback(async () => {
    const res = await fetch(`/api/hr/absent?date=${todayBkkStr()}`);
    if (res.ok) setAbsentList(await res.json());
  }, []);

  const fetchOverdueTasks = useCallback(async () => {
    const res = await fetch("/api/hr/task-deduction");
    if (res.ok) setOverdueTasks(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/hr/dashboard").then((r) => r.json()).then(setData).catch(() => {});
    fetchAbsent();
    fetchOverdueTasks();
    const id = setInterval(() => {
      fetch("/api/hr/dashboard").then((r) => r.json()).then(setData).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchAbsent, fetchOverdueTasks]);

  async function syncSheets() {
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/hr/sync-sheets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const d = await res.json();
    setSyncing(false);
    setSyncMsg(res.ok ? `✓ ซิงค์แล้ว ${d.synced} รายการ` : `✗ ${d.error}`);
    setTimeout(() => setSyncMsg(""), 4000);
  }

  async function applyTaskDeduction(taskId: number) {
    setTaskDeductLoading(taskId);
    setTaskDeductMsg("");
    const res = await fetch("/api/hr/task-deduction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    const d = await res.json();
    setTaskDeductLoading(null);
    if (res.ok) {
      setTaskDeductMsg(`✓ หักแล้ว −฿${d.amount?.toLocaleString()}`);
      fetchOverdueTasks();
    } else {
      setTaskDeductMsg(`✗ ${d.error}`);
    }
    setTimeout(() => setTaskDeductMsg(""), 5000);
  }

  async function applyAbsent(staffIds: number[]) {
    setAbsentLoading(true);
    setAbsentMsg("");
    const res = await fetch("/api/hr/absent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffIds, date: todayBkkStr() }),
    });
    const d = await res.json();
    setAbsentLoading(false);
    if (res.ok) {
      setAbsentMsg(`✓ หักเงินแล้ว ${d.applied} คน`);
      fetchAbsent();
    } else {
      setAbsentMsg(`✗ ${d.error}`);
    }
    setTimeout(() => setAbsentMsg(""), 5000);
  }

  if (!data) {
    return <div className="text-center text-gray-400 text-sm py-10">กำลังโหลด...</div>;
  }

  const checkedIn = data.staff.filter((s) => s.isCheckedIn).length;
  const openChecklist = data.checklists.find((c) => c.type === "OPEN");
  const closeChecklist = data.checklists.find((c) => c.type === "CLOSE");
  const totalTasks = Object.values(data.taskCounts).reduce((a, b) => a + b, 0);
  const pendingAbsent = absentList.filter((a) => !a.alreadyDeducted);
  const overdueCount = overdueTasks.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">ภาพรวม HR</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && <p className={`text-xs font-semibold ${syncMsg.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>{syncMsg}</p>}
          <button onClick={syncSheets} disabled={syncing}
            className="flex items-center gap-1.5 text-sm bg-white border border-sand rounded-xl px-3 py-2 text-gray-600 hover:border-orange transition-colors disabled:opacity-50">
            {syncing ? "⏳ กำลังซิงค์..." : "📊 Sync Sheets"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-sand/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-1">เข้างานแล้ว</p>
          <p className="text-2xl font-bold text-emerald-600">{checkedIn}</p>
          <p className="text-gray-400 text-xs">จาก {data.staff.length} คน</p>
        </div>
        <div className="bg-white border border-sand/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-1">ขาดงานวันนี้</p>
          <p className={`text-2xl font-bold ${pendingAbsent.length > 0 ? "text-red-500" : "text-gray-300"}`}>{pendingAbsent.length}</p>
          <p className="text-gray-400 text-xs">รอหักเงิน</p>
        </div>
        <div className="bg-white border border-sand/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-1">งานเกินกำหนด</p>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-purple-600" : "text-gray-300"}`}>{overdueCount}</p>
          <p className="text-gray-400 text-xs">รายการ</p>
        </div>
        <div className="bg-white border border-sand/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-1">งานทั้งหมด</p>
          <p className="text-2xl font-bold text-orange">{totalTasks}</p>
          <p className="text-gray-400 text-xs">เสร็จ {data.taskCounts["DONE"] ?? 0} รายการ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Absent section */}
        <div className="bg-white border border-sand/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-navy">ขาดงานวันนี้</h2>
            {pendingAbsent.length > 1 && (
              <button
                onClick={() => applyAbsent(pendingAbsent.map((a) => a.staffId))}
                disabled={absentLoading}
                className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {absentLoading ? "..." : `หักทั้งหมด (${pendingAbsent.length} คน)`}
              </button>
            )}
          </div>
          {absentMsg && (
            <p className={`text-xs mb-2 font-semibold ${absentMsg.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>{absentMsg}</p>
          )}
          {absentList.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
              ✓ ทุกคนที่มีตารางงานวันนี้มาทำงานแล้ว
            </div>
          ) : (
            <div className="space-y-2">
              {absentList.map((a) => (
                <div key={a.staffId} className="bg-gray-50 border border-sand/30 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-navy">{a.name}</p>
                    {a.alreadyDeducted && <p className="text-xs text-gray-400">หักเงินแล้ว</p>}
                  </div>
                  {!a.alreadyDeducted ? (
                    <button
                      onClick={() => applyAbsent([a.staffId])}
                      disabled={absentLoading}
                      className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-xl font-semibold disabled:opacity-50"
                    >
                      หักขาดงาน
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">✓ หักแล้ว</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checklist status */}
        <div className="bg-white border border-sand/50 rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-navy">เช็คลิสต์วันนี้</h2>
          <div className="space-y-3">
            {[
              { label: "🌅 เปิดร้าน", cl: openChecklist },
              { label: "🌙 ปิดร้าน", cl: closeChecklist },
            ].map(({ label, cl }) => (
              <div key={label} className="bg-gray-50 border border-sand/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-navy">{label}</p>
                  {cl ? (
                    <span className={`text-sm font-bold ${cl.doneItems === cl.totalItems ? "text-emerald-600" : "text-amber-500"}`}>
                      {cl.doneItems}/{cl.totalItems}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">ยังไม่ได้เริ่ม</span>
                  )}
                </div>
                {cl && (
                  <div className="w-full h-1.5 bg-gray-200 rounded-full">
                    <div
                      className={`h-1.5 rounded-full transition-all ${cl.doneItems === cl.totalItems ? "bg-emerald-500" : "bg-amber-400"}`}
                      style={{ width: `${(cl.doneItems / cl.totalItems) * 100}%` }}
                    />
                  </div>
                )}
                {cl && <p className="text-xs text-gray-400 mt-1">{cl.staffName}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div className="bg-white border border-sand/50 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-navy">งานเกินกำหนด</h2>
            {taskDeductMsg && (
              <p className={`text-xs font-semibold ${taskDeductMsg.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>{taskDeductMsg}</p>
            )}
          </div>
          <div className="space-y-2">
            {overdueTasks.map((t) => (
              <div key={t.taskId} className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.staffName} · เกินกำหนด <span className="text-red-500 font-semibold">{t.daysOverdue} วัน</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    สถานะ: {t.status === "TODO" ? "ยังไม่ได้เริ่ม" : "กำลังทำ"} · กำหนด {new Date(t.deadline).toLocaleDateString("th-TH")}
                  </p>
                </div>
                <button
                  onClick={() => applyTaskDeduction(t.taskId)}
                  disabled={taskDeductLoading === t.taskId}
                  className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 shrink-0 whitespace-nowrap"
                >
                  {taskDeductLoading === t.taskId ? "..." : "หักเงิน"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff grid */}
      <div className="bg-white border border-sand/50 rounded-2xl p-5 mb-6">
        <h2 className="font-bold text-navy mb-3">สถานะพนักงาน</h2>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {data.staff.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <div className="relative">
                {s.avatarUrl ? (
                  <Image src={s.avatarUrl} alt={s.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-sand flex items-center justify-center text-lg font-bold text-orange">
                    {s.name.charAt(0)}
                  </div>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${s.isCheckedIn ? "bg-emerald-500" : "bg-gray-300"}`} />
              </div>
              <p className="text-xs text-center text-gray-600 leading-tight">{s.name.split(" ")[0]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent attendances */}
      {data.attendances.length > 0 && (
        <div className="bg-white border border-sand/50 rounded-2xl p-5">
          <h2 className="font-bold text-navy mb-3">การเข้า-ออกวันนี้</h2>
          <div className="space-y-2">
            {data.attendances.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-sand/20 last:border-0">
                {a.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-sand/50 flex items-center justify-center text-orange font-bold shrink-0">
                    {a.staffName.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{a.staffName}</p>
                  <p className="text-xs text-gray-400">
                    เข้า {fmt(a.checkIn)}{a.checkOut ? ` · ออก ${fmt(a.checkOut)}` : " · กำลังทำงาน"}
                  </p>
                </div>
                {!a.checkOut && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

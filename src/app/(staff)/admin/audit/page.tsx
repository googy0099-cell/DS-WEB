"use client";

import useSWR from "swr";

type AuditLog = {
  id: number;
  action: string;
  targetType: string | null;
  targetId: number | null;
  detail: string | null;
  createdAt: string;
  user: { username: string; role: string };
};

const ACTION_LABELS: Record<string, string> = {
  ORDER_CONFIRMED: "ยืนยันออเดอร์",
  ORDER_SERVED: "เสิร์ฟออเดอร์",
  ORDER_CANCELLED: "ยกเลิกออเดอร์",
  PAYMENT_CONFIRMED: "ยืนยันการชำระเงิน",
  MENU_CREATED: "เพิ่มเมนู",
  MENU_UPDATED: "แก้ไขเมนู",
  MENU_DELETED: "ลบเมนู",
  ACTIVITY_CREATED: "เพิ่มกิจกรรม",
  ACTIVITY_UPDATED: "แก้ไขกิจกรรม",
  ACTIVITY_DELETED: "ลบกิจกรรม",
  GALLERY_UPLOADED: "อัปโหลดรูป Gallery",
  GALLERY_DELETED: "ลบรูป Gallery",
  USER_CREATED: "สร้างบัญชีพนักงาน",
  USER_ROLE_CHANGED: "เปลี่ยน Role",
  USER_DELETED: "ลบบัญชีพนักงาน",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminAuditPage() {
  const { data: logs = [], isLoading } = useSWR<AuditLog[]>("/api/audit", fetcher, {
    refreshInterval: 30000,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy">บันทึกการใช้งาน (Audit Log)</h1>
        <p className="text-gray-400 text-sm">100 รายการล่าสุด</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-0 divide-y divide-sand/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse h-16 bg-white" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-gray-400 py-12">ยังไม่มีบันทึก</p>
        ) : (
          <div className="divide-y divide-sand/50">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium text-navy text-sm">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    {log.targetType && log.targetId && (
                      <span className="text-xs bg-sand text-navy px-2 py-0.5 rounded">
                        {log.targetType} #{log.targetId}
                      </span>
                    )}
                  </div>
                  {log.detail && (
                    <p className="text-gray-500 text-xs truncate">{log.detail}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-1">
                    <span className="font-medium text-navy">@{log.user.username}</span>
                    {" · "}
                    {new Date(log.createdAt).toLocaleString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${log.user.role === "OWNER" ? "bg-orange/10 text-orange" : "bg-blue-50 text-blue-600"}`}>
                  {log.user.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

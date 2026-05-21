"use client";

import useSWR from "swr";

type AnalyticsData = {
  todayOrders: number;
  monthRevenue: number;
  totalMembers: number;
  newMembersMonth: number;
  topMenu: { menuItemId: number; nameTh: string; quantity: number }[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useSWR<AnalyticsData>("/api/analytics", fetcher);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-gray-400">ไม่สามารถโหลดข้อมูลได้</p>;

  const stats = [
    { label: "ออเดอร์วันนี้", value: `${data.todayOrders} รายการ`, icon: "📋", color: "bg-blue-50 text-blue-700" },
    { label: "รายได้เดือนนี้", value: `฿${data.monthRevenue.toLocaleString()}`, icon: "💰", color: "bg-green-50 text-green-700" },
    { label: "สมาชิกทั้งหมด", value: `${data.totalMembers} คน`, icon: "👥", color: "bg-purple-50 text-purple-700" },
    { label: "สมาชิกใหม่เดือนนี้", value: `${data.newMembersMonth} คน`, icon: "✨", color: "bg-orange/10 text-orange" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy">วิเคราะห์ข้อมูล</h1>
        <p className="text-gray-400 text-sm">ภาพรวมธุรกิจ</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl mb-3 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-navy mb-1">{stat.value}</p>
            <p className="text-xs text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-sand">
          <h2 className="font-bold text-navy">🏆 เมนูขายดี (Top 5)</h2>
        </div>
        {data.topMenu.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">ยังไม่มีข้อมูลออเดอร์</p>
        ) : (
          <div className="divide-y divide-sand/50">
            {data.topMenu.map((item, idx) => (
              <div key={item.menuItemId} className="flex items-center gap-3 p-4">
                <span className="w-7 h-7 rounded-full bg-orange/10 text-orange text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="flex-1 font-medium text-navy text-sm">{item.nameTh}</span>
                <span className="text-gray-500 text-sm font-semibold">{item.quantity} ชิ้น</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

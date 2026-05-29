import OrderQueue from "@/components/admin/OrderQueue";
import { DashboardClock } from "@/components/admin/DashboardClock";
import CashierOrderButton from "@/components/admin/CashierOrderButton";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role === "STAFF") redirect("/admin/pos");

  // Quick stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayOrders, totalMembers] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    db.user.count({ where: { role: "USER" } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Dashboard</h1>
          <p className="text-gray-500 text-sm">ยินดีต้อนรับ, {session?.user?.username}</p>
        </div>
        <CashierOrderButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-gray-400 text-xs">ออเดอร์วันนี้</p>
          <p className="text-2xl font-bold text-navy">{todayOrders}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-gray-400 text-xs">สมาชิกทั้งหมด</p>
          <p className="text-2xl font-bold text-orange">{totalMembers}</p>
        </div>
        <div className="bg-orange rounded-2xl p-4 shadow-sm">
          <p className="text-white/70 text-xs">เวลาเปิดทำการ</p>
          <p className="text-lg font-bold text-white">15:00 – 23:00</p>
        </div>
        <DashboardClock />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-navy">ออเดอร์ที่รอดำเนินการ</h2>
        <span className="text-xs text-gray-400">รีเฟรชทุก 10 วินาที</span>
      </div>
      <OrderQueue />
    </div>
  );
}

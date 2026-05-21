import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/profile");

  const user = await db.user.findUnique({
    where: { id: parseInt(session.user.id) },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: { include: { menuItem: true } } },
      },
    },
  });
  if (!user) redirect("/login");

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream">
        <div className="bg-navy px-4 py-10">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-orange flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
              {user.firstName[0]?.toUpperCase()}
            </div>
            <h1 className="text-cream font-bold text-xl">{user.firstName} {user.lastName}</h1>
            <p className="text-cream/60 text-sm">@{user.username}</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Member code */}
          <div className="bg-navy rounded-2xl p-5 text-center">
            <p className="text-cream/60 text-xs mb-1">รหัสสมาชิก</p>
            <p className="text-4xl font-bold text-orange tracking-[0.2em]">{user.memberCode}</p>
            <p className="text-cream/40 text-xs mt-1">แสดงให้พนักงานเพื่อสะสมคะแนน</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-orange">{user.points}</p>
              <p className="text-xs text-gray-500">คะแนน</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-navy">฿{user.totalSpentTHB}</p>
              <p className="text-xs text-gray-500">ยอดใช้จ่าย</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-sage">{user.visitCount}</p>
              <p className="text-xs text-gray-500">ครั้งที่มา</p>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
            <h2 className="font-bold text-navy mb-3">ข้อมูลส่วนตัว</h2>
            {[
              { label: "อีเมล", value: user.email },
              { label: "เบอร์โทร", value: user.phone ?? "-" },
              { label: "สมัครเมื่อ", value: new Date(user.createdAt).toLocaleDateString("th-TH") },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{row.label}</span>
                <span className="text-navy font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Recent orders */}
          {user.orders.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-navy mb-3">ออเดอร์ล่าสุด</h2>
              <div className="space-y-2">
                {user.orders.map((order) => (
                  <div key={order.id} className="flex justify-between text-sm py-2 border-b border-sand last:border-0">
                    <div>
                      <p className="font-medium text-navy">#{order.id} — {order.status}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <p className="font-bold text-orange">฿{order.totalTHB}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/" className="flex-1 text-center bg-sand text-navy font-semibold py-3 rounded-xl text-sm">
              หน้าแรก
            </Link>
            <form action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }} className="flex-1">
              <button type="submit" className="w-full bg-red-50 text-red-500 font-semibold py-3 rounded-xl text-sm">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

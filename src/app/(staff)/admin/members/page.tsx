import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminMembersPage() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") redirect("/admin");

  const members = await db.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy">สมาชิกทั้งหมด</h1>
        <p className="text-gray-400 text-sm">{members.length} คน</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 border-b border-sand">
              <tr>
                <th className="text-left p-3 text-navy font-semibold">สมาชิก</th>
                <th className="text-left p-3 text-navy font-semibold">รหัส</th>
                <th className="text-right p-3 text-navy font-semibold">คะแนน</th>
                <th className="text-right p-3 text-navy font-semibold hidden md:table-cell">ใช้จ่าย</th>
                <th className="text-right p-3 text-navy font-semibold hidden md:table-cell">เข้าร้าน</th>
                <th className="text-left p-3 text-navy font-semibold hidden md:table-cell">สมัครเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: typeof members[0]) => (
                <tr key={m.id} className="border-b border-sand/50 last:border-0">
                  <td className="p-3">
                    <p className="font-medium text-navy">{m.firstName} {m.lastName}</p>
                    <p className="text-gray-400 text-xs">@{m.username} · {m.email}</p>
                  </td>
                  <td className="p-3">
                    <span className="font-mono font-bold text-orange bg-orange/10 px-2 py-0.5 rounded">{m.memberCode}</span>
                  </td>
                  <td className="p-3 text-right font-bold text-navy">{m.points}</td>
                  <td className="p-3 text-right text-gray-500 hidden md:table-cell">฿{m.totalSpentTHB}</td>
                  <td className="p-3 text-right text-gray-500 hidden md:table-cell">{m.visitCount} ครั้ง</td>
                  <td className="p-3 text-gray-400 text-xs hidden md:table-cell">
                    {new Date(m.createdAt).toLocaleDateString("th-TH")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && <p className="text-center text-gray-400 py-8">ยังไม่มีสมาชิก</p>}
        </div>
      </div>
    </div>
  );
}

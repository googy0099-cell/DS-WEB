import Link from "next/link";

const MODULES = [
  {
    href: "/admin/analytics/sales",
    icon: "💰",
    title: "สรุปยอดขาย",
    desc: "รายได้รายวัน, จำนวนบิล, ค่าเฉลี่ย, ออเดอร์ที่ยกเลิก",
    color: "bg-green-50 border-green-200",
    iconBg: "bg-green-100 text-green-700",
  },
  {
    href: "/admin/analytics/menu",
    icon: "🍽️",
    title: "เมนูขายดี",
    desc: "จัดอันดับเมนูตามจำนวนชิ้นและยอดเงิน (ไม่รวมแพ็กเกจเวลา)",
    color: "bg-orange/5 border-orange/20",
    iconBg: "bg-orange/10 text-orange",
  },
  {
    href: "/admin/analytics/gametime",
    icon: "⏱️",
    title: "แพ็กเกจเวลา",
    desc: "จำนวนและรายได้จากแพ็กเกจชั่วโมงเกม",
    color: "bg-sky-50 border-sky-200",
    iconBg: "bg-sky-100 text-sky-700",
  },
  {
    href: "/admin/analytics/drawer",
    icon: "🗃️",
    title: "รายงานลิ้นชัก",
    desc: "ประวัติการเปิด/ปิดลิ้นชักเงินสด",
    color: "bg-blue-50 border-blue-200",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    href: "/admin/analytics/orders",
    icon: "📋",
    title: "ประวัติออเดอร์",
    desc: "ค้นหาและกรองออเดอร์ตามวันที่, สถานะ, ประเภท",
    color: "bg-purple-50 border-purple-200",
    iconBg: "bg-purple-100 text-purple-700",
  },
  {
    href: "/admin/analytics/parties",
    icon: "🎉",
    title: "ประวัติปาร์ตี้",
    desc: "ข้อมูลตี้, ผู้เล่น, แพ็กเกจ, รายได้รวมแต่ละงาน",
    color: "bg-rose-50 border-rose-200",
    iconBg: "bg-rose-100 text-rose-600",
  },
  {
    href: "/admin/analytics/receipts",
    icon: "🧾",
    title: "ใบเสร็จดิจิตอล",
    desc: "ประวัติใบเสร็จทุกใบ กรองตามวันที่ ดูและดาวน์โหลด PDF สำหรับฝ่ายบัญชี",
    color: "bg-teal-50 border-teal-200",
    iconBg: "bg-teal-100 text-teal-700",
  },
];

export default function AnalyticsHubPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy">วิเคราะห์ข้อมูล</h1>
        <p className="text-gray-400 text-sm">เลือกรายงานที่ต้องการดู</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}
            className={`flex items-center gap-4 p-5 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${m.color}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${m.iconBg}`}>
              {m.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-navy text-base">{m.title}</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{m.desc}</p>
            </div>
            <span className="text-gray-300 text-xl shrink-0">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

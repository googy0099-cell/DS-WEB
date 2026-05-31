import KitchenQueue from "@/components/admin/KitchenQueue";

export const dynamic = "force-dynamic";

export default function BarPage() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy">🥤 คิวบาร์</h1>
          <p className="text-sm text-gray-400 mt-0.5">ออเดอร์เครื่องดื่ม — เรียงตามมาก่อนมาก่อน</p>
        </div>
        <span className="text-xs text-gray-400 bg-white rounded-xl px-3 py-1.5 shadow-sm">รีเฟรชทุก 8 วิ</span>
      </div>
      <KitchenQueue type="drink" />
    </div>
  );
}

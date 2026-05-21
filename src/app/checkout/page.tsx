import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ orderId?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const { orderId } = await searchParams;
  if (!orderId) notFound();

  const order = await db.order.findUnique({
    where: { id: Number(orderId) },
    include: {
      items: { include: { menuItem: true } },
    },
  });

  if (!order) notFound();

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
            ✅
          </div>
          <h1 className="text-xl font-bold text-navy mb-1">ส่งออเดอร์แล้ว!</h1>
          <p className="text-gray-400 text-sm mb-6">ทางร้านได้รับออเดอร์ของคุณแล้ว</p>

          <div className="bg-sand/40 rounded-xl p-4 text-left mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400">ออเดอร์ #</span>
              <span className="font-bold text-navy">{order.id}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400">ชื่อ</span>
              <span className="font-semibold text-navy">{order.orderName}</span>
            </div>
            <div className="border-t border-sand pt-3 space-y-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.menuItem.nameTh} × {item.quantity}
                  </span>
                  <span className="font-medium text-navy">
                    ฿{item.unitPriceTHB * item.quantity}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-sand pt-3 mt-3 flex justify-between font-bold">
              <span className="text-navy">รวม</span>
              <span className="text-orange text-lg">฿{order.totalTHB}</span>
            </div>
            {order.note && (
              <p className="text-xs text-gray-400 mt-2">หมายเหตุ: {order.note}</p>
            )}
          </div>

          <div className="bg-navy/5 rounded-xl p-3 text-sm text-gray-500 mb-6">
            <p>กรุณาชำระเงินที่เคาน์เตอร์</p>
            <p className="font-medium text-navy">฿{order.totalTHB}</p>
          </div>

          <Link
            href="/menu"
            className="block w-full bg-orange text-white font-bold py-3 rounded-xl hover:bg-orange/90 transition-colors"
          >
            สั่งเพิ่มเติม
          </Link>
          <Link href="/" className="block mt-3 text-sm text-gray-400 hover:text-navy">
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </>
  );
}

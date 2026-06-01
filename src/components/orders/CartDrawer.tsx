"use client";

import { ShoppingCart, X, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ThaiPrice from "@/components/shared/ThaiPrice";
import { useOrderStore } from "@/store/orderStore";

type PublicBill = { id: number; name: string; tableNumber: number };
type SessionLink = { id: number; nickname: string } | null;
type StaffMember = { id: number; firstName: string; username: string; memberCode: string } | null;

const STAFF_ROLES = ["CASHIER", "STAFF", "OWNER"];

export default function CartDrawer({ tableId }: { tableId?: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<PublicBill[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<number | "">("");
  const [sessionLink, setSessionLink] = useState<SessionLink>(null);
  // Staff-mode member lookup (for staff ordering on behalf of customer)
  const [staffMemberCode, setStaffMemberCode] = useState("");
  const [staffMember, setStaffMember] = useState<StaffMember>(null);
  const [staffMemberError, setStaffMemberError] = useState("");
  const [staffMemberLoading, setStaffMemberLoading] = useState(false);
  const { data: session } = useSession();
  const { cart, total, removeItem, clearCart, setOrderName, setUserId } = useOrderStore();
  const router = useRouter();
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);
  const isStaff = STAFF_ROLES.includes(session?.user?.role ?? "");

  useEffect(() => {
    // Only auto-fill for regular customers, not staff
    if (session?.user && !isStaff) {
      setUserId(parseInt(session.user.id));
      if (!nameInput) {
        const defaultName = `${session.user.username} (${session.user.memberCode})`;
        setNameInput(defaultName);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isStaff]);

  useEffect(() => {
    if (open) {
      const url = tableId ? `/api/pos/bills/public?tableId=${tableId}` : "/api/pos/bills/public";
      fetch(url)
        .then((r) => r.json())
        .then((data: PublicBill[]) => {
          setBills(data);
          if (data.length === 1) setSelectedBillId(data[0].id);
        })
        .catch(() => setBills([]));
    }
  }, [open, tableId]);

  function onStaffMemberCodeChange(code: string) {
    setStaffMemberCode(code);
    setStaffMemberError("");
    if (!code.trim()) { setStaffMember(null); return; }
    setStaffMemberLoading(true);
    fetch(`/api/pos/member?code=${encodeURIComponent(code.trim().toUpperCase())}`)
      .then(async (r) => {
        setStaffMemberLoading(false);
        if (r.ok) {
          const m: StaffMember = await r.json();
          setStaffMember(m);
          if (m) setNameInput(m.firstName);
        } else {
          setStaffMember(null);
          setStaffMemberError("ไม่พบสมาชิก");
        }
      }).catch(() => { setStaffMemberLoading(false); setStaffMember(null); });
  }

  useEffect(() => {
    if (!selectedBillId || !session?.user) {
      setSessionLink(null);
      return;
    }
    fetch(`/api/pos/sessions/lookup?billId=${selectedBillId}&userId=${session.user.id}`)
      .then((r) => r.json())
      .then((data: SessionLink) => {
        setSessionLink(data);
        if (data?.nickname) setNameInput(data.nickname);
      })
      .catch(() => setSessionLink(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBillId, session?.user?.id]);

  async function submitOrder() {
    const finalName = nameInput.trim() || (session?.user ? `${session.user.username} (${session.user.memberCode})` : "");
    if (!cart.length) return;
    if (!finalName) {
      alert("กรุณากรอกชื่อก่อนสั่งอาหาร");
      return;
    }
    if (bills.length > 0 && !selectedBillId) {
      alert("กรุณาเลือกตี้ก่อนสั่งอาหาร");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderName: finalName,
          userId: isStaff ? (staffMember?.id ?? null) : (session?.user ? parseInt(session.user.id) : null),
          note,
          billId: selectedBillId || null,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            selectedSize: c.selectedSize,
            selectedAddons: c.selectedAddons,
            selectedOptions: c.selectedOptions,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      const order = await res.json();
      clearCart();
      setOpen(false);
      router.push(`/checkout?token=${order.checkoutToken}`);
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-4 bg-orange text-white rounded-full p-4 shadow-lg flex items-center gap-2 z-40"
      >
        <ShoppingCart size={22} />
        {itemCount > 0 && (
          <span className="font-bold text-sm">
            {itemCount} | <ThaiPrice amount={total()} />
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Mobile: slide-up drawer | Desktop: centered modal */}
      <div
        className={`fixed z-50 bg-white shadow-xl flex flex-col
          bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]
          md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:right-auto
          md:w-[480px] md:rounded-2xl md:max-h-[85vh]
          transition-all duration-300
          ${open
            ? "translate-y-0 md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-100"
            : "translate-y-full md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-0 md:pointer-events-none"
          }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-sand shrink-0">
          <h2 className="font-bold text-navy text-lg">ตะกร้าสินค้า</h2>
          <button onClick={() => setOpen(false)}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <div className="bg-sand/40 rounded-xl p-3 space-y-2">
            <div>
              <p className="text-xs font-medium text-navy mb-1">ชื่อสำหรับรับอาหาร</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={session?.user ? `${session.user.username} (${session.user.memberCode})` : "กรอกชื่อของคุณ"}
                className="w-full bg-white border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none"
              />
              {isStaff ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] text-gray-400">ลูกค้าต้องการเก็บแต้มสมาชิก? กรอกรหัสด้านล่าง</p>
                  <input
                    type="text"
                    value={staffMemberCode}
                    onChange={(e) => onStaffMemberCodeChange(e.target.value.toUpperCase())}
                    placeholder="DS-XXXX (ไม่บังคับ)"
                    className="w-full bg-white border border-sand rounded-lg px-3 py-1.5 text-sm font-mono focus:border-orange focus:outline-none uppercase"
                  />
                  {staffMemberLoading && <p className="text-[10px] text-gray-400">กำลังค้นหา...</p>}
                  {staffMember && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                      <p className="text-[11px] text-green-700 font-semibold">✅ {staffMember.firstName} ({staffMember.memberCode}) — แต้มจะเข้าบัญชีนี้</p>
                      <button onClick={() => { setStaffMember(null); setStaffMemberCode(""); setNameInput(""); }} className="text-gray-300 hover:text-red-400 ml-1">×</button>
                    </div>
                  )}
                  {staffMemberError && <p className="text-[10px] text-red-400">{staffMemberError}</p>}
                </div>
              ) : sessionLink ? (
                <p className="text-[10px] text-green-600 mt-1">✅ เชื่อมกับตี้แล้ว — แต้มจะเข้าบัญชีสมาชิก</p>
              ) : session?.user ? (
                <p className="text-[10px] text-gray-400 mt-1">login แล้ว — แก้ชื่อได้ตามต้องการ</p>
              ) : null}
            </div>
            {bills.length > 0 && (
              <div>
                <p className="text-xs font-medium text-navy mb-1">
                  เลือกตี้ <span className="text-red-500">*</span>
                </p>
                <select
                  value={selectedBillId}
                  onChange={(e) => setSelectedBillId(e.target.value ? Number(e.target.value) : "")}
                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange ${!selectedBillId ? "border-red-300" : "border-sand"}`}
                >
                  <option value="">— กรุณาเลือกตี้ —</option>
                  {bills.map((b) => (
                    <option key={b.id} value={b.id}>โต๊ะ {b.tableNumber} — {b.name}</option>
                  ))}
                </select>
                {!selectedBillId && (
                  <p className="text-[10px] text-red-400 mt-1">จำเป็นต้องเลือกตี้ก่อนสั่ง</p>
                )}
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-center text-gray-400 py-8">ยังไม่มีรายการ</p>
          ) : (
            cart.map((item) => (
              <div key={item.cartKey} className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm leading-tight">
                    {item.nameTh}
                    {item.selectedSize && (
                      <span className="ml-1 text-xs bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">
                        {item.selectedSize}
                      </span>
                    )}
                  </p>
                  {item.selectedAddons.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      + {item.selectedAddons.map((a) => a.nameTh).join(", ")}
                    </p>
                  )}
                  {item.selectedOptions.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.selectedOptions.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.quantity} x <ThaiPrice amount={item.priceTHB} />
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ThaiPrice
                    amount={item.priceTHB * item.quantity}
                    className="font-bold text-orange text-sm"
                  />
                  <button onClick={() => removeItem(item.cartKey)}>
                    <Trash2 size={16} className="text-gray-300" />
                  </button>
                </div>
              </div>
            ))
          )}

          {cart.length > 0 && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ (เช่น ไม่ใส่ผัก, เผ็ดน้อย)"
              className="w-full border border-sand rounded-lg p-2 text-sm resize-none h-16 mt-2"
            />
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-sand shrink-0">
            <div className="flex justify-between mb-3">
              <span className="font-semibold text-navy">รวมทั้งหมด</span>
              <ThaiPrice amount={total()} className="font-bold text-orange text-lg" />
            </div>
            <button
              onClick={submitOrder}
              disabled={loading || (bills.length > 0 && !selectedBillId)}
              className="w-full bg-navy text-cream font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? "กำลังส่งออเดอร์..." : "ยืนยันการสั่งอาหาร"}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">จะเริ่มทำเมื่อชำระเงินแล้วเท่านั้น</p>
          </div>
        )}
      </div>
    </>
  );
}

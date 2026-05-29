"use client";

import { useState } from "react";
import useSWR from "swr";
import NumpadInput from "@/components/admin/NumpadInput";

const UNITS = ["kg", "g", "liter", "ml", "piece", "pack", "bottle", "box", "bag"];

type StockItem = {
  id: number; sku: string; name: string; unit: string;
  currentQty: number; minQty: number; reorderQty: number;
  costPerUnit: number; isActive: boolean;
};

type StockAlert = {
  id: number; type: string; message: string; createdAt: string;
  stockItem: { id: number; name: string; unit: string; currentQty: number } | null;
};


const BLANK = { sku: "", name: "", unit: "piece", minQty: 0, reorderQty: 0, costPerUnit: 0 };
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function qtyColor(item: StockItem) {
  if (item.currentQty <= 0) return "text-red-600 font-bold";
  if (item.currentQty < item.minQty) return "text-red-500 font-bold";
  if (item.reorderQty > 0 && item.currentQty <= item.reorderQty) return "text-yellow-600 font-semibold";
  return "text-green-600";
}

function qtyBadge(item: StockItem) {
  if (item.currentQty <= 0) return "🔴";
  if (item.currentQty < item.minQty) return "🔴";
  if (item.reorderQty > 0 && item.currentQty <= item.reorderQty) return "🟡";
  return "✅";
}

export default function StockPage() {
  const { data: items = [], mutate } = useSWR<StockItem[]>("/api/stock/items", fetcher);
  const { data: alerts = [], mutate: mutateAlerts } = useSWR<StockAlert[]>(
    "/api/stock/alerts", fetcher, { refreshInterval: 300_000 }
  );

  const [showInactive, setShowInactive] = useState(false);

  // Add/Edit modal — undefined=closed, null=adding, StockItem=editing
  const [modalItem, setModalItem] = useState<StockItem | null | undefined>(undefined);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  // Stock-in modal
  const [stockInItem, setStockInItem] = useState<StockItem | null>(null);
  const [inQty, setInQty] = useState("");
  const [inNote, setInNote] = useState("");
  const [inSaving, setInSaving] = useState(false);

  const visible = showInactive ? items : items.filter((i) => i.isActive);

  // ── Alerts ────────────────────────────────────────────────────────────────

  async function dismissAlerts() {
    await fetch("/api/stock/alerts", { method: "PATCH" });
    mutateAlerts();
  }

  // ── Items CRUD ────────────────────────────────────────────────────────────

  function openAdd() { setModalItem(null); setForm(BLANK); }
  function openEdit(item: StockItem) {
    setModalItem(item);
    setForm({ sku: item.sku, name: item.name, unit: item.unit, minQty: item.minQty, reorderQty: item.reorderQty, costPerUnit: item.costPerUnit });
  }

  async function saveItem() {
    setSaving(true);
    if (modalItem) {
      await fetch(`/api/stock/items/${modalItem.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/stock/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    await mutate();
    setSaving(false);
    setModalItem(undefined);
  }

  async function toggleActive(item: StockItem) {
    await fetch(`/api/stock/items/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    mutate();
  }

  // ── Stock-in ──────────────────────────────────────────────────────────────

  async function submitStockIn() {
    if (!stockInItem || !parseFloat(inQty)) return;
    setInSaving(true);
    await fetch("/api/stock/in", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockItemId: stockInItem.id, qty: parseFloat(inQty), note: inNote || undefined }),
    });
    await mutate();
    await mutateAlerts();
    setInSaving(false);
    setStockInItem(null);
    setInQty(""); setInNote("");
  }

  const showEditModal = modalItem !== undefined;
  const addingNew = modalItem === null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">📦 จัดการสต็อก</h1>
          <p className="text-xs text-gray-400 mt-0.5">วัตถุดิบและสินค้าคงคลัง</p>
        </div>
        <button onClick={openAdd} className="bg-orange text-white font-bold px-4 py-2 rounded-xl text-sm">
          + เพิ่มวัตถุดิบ
        </button>
      </div>

      {/* ── Low-stock alert banner (polls every 5 min) ───────────────────────── */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">วัตถุดิบต่ำกว่าขั้นต่ำ {alerts.length} รายการ</p>
            <div className="mt-1 space-y-0.5">
              {alerts.slice(0, 3).map((a) => (
                <p key={a.id} className="text-xs text-amber-700 truncate">{a.message}</p>
              ))}
              {alerts.length > 3 && (
                <p className="text-xs text-amber-500">+{alerts.length - 3} รายการ...</p>
              )}
            </div>
          </div>
          <button onClick={dismissAlerts} className="text-xs text-amber-600 hover:text-amber-800 font-semibold shrink-0 mt-0.5">
            รับทราบ
          </button>
        </div>
      )}

      {/* Toggle inactive */}
      <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-orange" />
        แสดงรายการที่ปิดใช้งาน
      </label>

      {/* ── Items table ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-center text-gray-400 py-12">ยังไม่มีวัตถุดิบ — กด &quot;+ เพิ่มวัตถุดิบ&quot;</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand text-xs text-gray-400 bg-sand/20">
                <th className="text-left px-4 py-2.5">ชื่อ / SKU</th>
                <th className="text-right px-3 py-2.5">คงเหลือ</th>
                <th className="text-right px-3 py-2.5">ขั้นต่ำ</th>
                <th className="text-right px-3 py-2.5 hidden sm:table-cell">ต้นทุน/หน่วย</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-sand/50">
              {visible.map((item) => (
                <tr key={item.id} className={`hover:bg-sand/10 transition-colors ${!item.isActive ? "opacity-40" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy leading-tight">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.sku} · {item.unit}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={qtyColor(item)}>
                      {qtyBadge(item)} {item.currentQty.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500 text-xs">
                    {item.minQty} {item.unit}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500 text-xs hidden sm:table-cell">
                    {item.costPerUnit > 0 ? `฿${item.costPerUnit.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      {item.isActive && (
                        <button onClick={() => { setStockInItem(item); setInQty(""); setInNote(""); }}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100">
                          รับเข้า
                        </button>
                      )}
                      <button onClick={() => openEdit(item)}
                        className="text-xs border border-sand text-navy px-2 py-1 rounded-lg hover:border-navy">
                        แก้ไข
                      </button>
                      <button onClick={() => toggleActive(item)}
                        className={`text-xs px-2 py-1 rounded-lg border ${item.isActive ? "border-red-200 text-red-400 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                        {item.isActive ? "ปิด" : "เปิด"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add/Edit Modal ───────────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-navy text-lg">{addingNew ? "เพิ่มวัตถุดิบ" : "แก้ไขวัตถุดิบ"}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">SKU *</label>
                <input value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value.toUpperCase() }))}
                  placeholder="เช่น MILK-001"
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-orange" />
              </div>
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">ชื่อวัตถุดิบ *</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="เช่น นมสด"
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              </div>
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">หน่วย *</label>
                <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange">
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-navy block mb-1">ขั้นต่ำ (แจ้งเตือน)</label>
                  <NumpadInput value={form.minQty || ""} onChange={(v) => setForm((p) => ({ ...p, minQty: v }))}
                    allowDecimal placeholder="0"
                    className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy block mb-1">ควรสั่งซื้อเมื่อ</label>
                  <NumpadInput value={form.reorderQty || ""} onChange={(v) => setForm((p) => ({ ...p, reorderQty: v }))}
                    allowDecimal placeholder="0"
                    className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">ต้นทุน/หน่วย (฿)</label>
                <NumpadInput value={form.costPerUnit || ""} onChange={(v) => setForm((p) => ({ ...p, costPerUnit: v }))}
                  allowDecimal placeholder="0"
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalItem(undefined)}
                className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button onClick={saveItem} disabled={saving || !form.sku.trim() || !form.name.trim()}
                className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40">
                {saving ? "..." : addingNew ? "เพิ่ม" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock-in Modal ───────────────────────────────────────────────────── */}
      {stockInItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="font-bold text-navy text-lg">📥 รับสินค้าเข้า</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                {stockInItem.name} · คงเหลือ {stockInItem.currentQty} {stockInItem.unit}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-navy block mb-1">จำนวนที่รับ ({stockInItem.unit}) *</label>
              <NumpadInput value={inQty} onChange={(v) => setInQty(v === 0 ? "" : String(v))}
                allowDecimal placeholder="0"
                className="w-full border-2 border-sand rounded-xl px-3 py-2.5 text-2xl font-bold text-center focus:outline-none focus:border-orange" />
            </div>
            <div>
              <label className="text-xs font-semibold text-navy block mb-1">หมายเหตุ</label>
              <input value={inNote} onChange={(e) => setInNote(e.target.value)}
                placeholder="เช่น รับจากซัพพลายเออร์"
                className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
            </div>
            {inQty && parseFloat(inQty) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm flex justify-between">
                <span className="text-gray-500">คงเหลือหลังรับ</span>
                <span className="font-bold text-green-700">
                  {(stockInItem.currentQty + parseFloat(inQty)).toLocaleString()} {stockInItem.unit}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStockInItem(null)}
                className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button onClick={submitStockIn} disabled={inSaving || !parseFloat(inQty)}
                className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40">
                {inSaving ? "..." : "✅ ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

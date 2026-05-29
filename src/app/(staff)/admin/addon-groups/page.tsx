"use client";

import { useState } from "react";
import useSWR from "swr";
import NumpadInput from "@/components/admin/NumpadInput";

type AddonItem = { id: number; nameTh: string; priceTHB: number; isActive: boolean };
type AddonGroup = { id: number; nameTh: string; isActive: boolean; items: AddonItem[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function call(method: string, body: object) {
  return fetch("/api/addon-groups", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function AdminAddonGroupsPage() {
  const { data: groups = [], mutate } = useSWR<AddonGroup[]>("/api/addon-groups", fetcher);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [newItems, setNewItems] = useState<Record<number, { nameTh: string; priceTHB: string }>>({});
  const [editingItem, setEditingItem] = useState<AddonItem & { groupId: number } | null>(null);

  async function createGroup() {
    if (!newGroupName.trim()) return;
    await call("POST", { action: "create-group", nameTh: newGroupName.trim() });
    setNewGroupName("");
    mutate();
  }

  async function updateGroup(id: number, nameTh: string, isActive?: boolean) {
    await call("PATCH", { action: "update-group", id, nameTh, ...(isActive !== undefined ? { isActive } : {}) });
    setEditingGroupId(null);
    mutate();
  }

  async function deleteGroup(id: number) {
    if (!confirm("ลบ Set Add-on นี้และรายการทั้งหมดในนั้น?")) return;
    await call("DELETE", { action: "delete-group", id });
    mutate();
  }

  async function addItem(groupId: number) {
    const ni = newItems[groupId];
    if (!ni?.nameTh?.trim()) return;
    await call("POST", {
      action: "add-item",
      addonGroupId: groupId,
      nameTh: ni.nameTh.trim(),
      priceTHB: parseInt(ni.priceTHB) || 0,
    });
    setNewItems((prev) => ({ ...prev, [groupId]: { nameTh: "", priceTHB: "" } }));
    mutate();
  }

  async function saveItem() {
    if (!editingItem) return;
    await call("PATCH", {
      action: "update-item",
      id: editingItem.id,
      nameTh: editingItem.nameTh,
      priceTHB: editingItem.priceTHB,
      isActive: editingItem.isActive,
    });
    setEditingItem(null);
    mutate();
  }

  async function deleteItem(id: number) {
    if (!confirm("ลบ Add-on นี้?")) return;
    await call("DELETE", { action: "delete-item", id });
    mutate();
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-navy mb-6">จัดการ Set Add-on</h1>

      {/* Create new group */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex gap-3">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createGroup()}
          placeholder="ชื่อ Set ใหม่ เช่น Add-on เครื่องดื่ม"
          className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
        />
        <button
          onClick={createGroup}
          disabled={!newGroupName.trim()}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-40"
        >
          + สร้าง Set
        </button>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-sand/30 border-b border-sand">
              {editingGroupId === group.id ? (
                <>
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    className="flex-1 border border-sand rounded-lg px-2 py-1 text-sm focus:border-orange focus:outline-none"
                  />
                  <button onClick={() => updateGroup(group.id, editGroupName)} className="text-xs text-orange font-semibold">บันทึก</button>
                  <button onClick={() => setEditingGroupId(null)} className="text-xs text-gray-400">ยกเลิก</button>
                </>
              ) : (
                <>
                  <span className="font-bold text-navy flex-1">{group.nameTh}</span>
                  <button
                    onClick={() => updateGroup(group.id, group.nameTh, !group.isActive)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                  >
                    {group.isActive ? "ใช้งาน" : "ปิด"}
                  </button>
                  <button onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.nameTh); }} className="text-xs text-orange hover:underline">แก้ไขชื่อ</button>
                  <button onClick={() => deleteGroup(group.id)} className="text-xs text-red-400 hover:underline">ลบ Set</button>
                </>
              )}
            </div>

            {/* Items */}
            <div className="divide-y divide-sand/50">
              {group.items.map((item) => (
                <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                  {editingItem?.id === item.id ? (
                    <>
                      <input
                        type="text"
                        value={editingItem.nameTh}
                        onChange={(e) => setEditingItem({ ...editingItem, nameTh: e.target.value })}
                        className="flex-1 border border-sand rounded-lg px-2 py-1 text-sm focus:border-orange focus:outline-none"
                      />
                      <NumpadInput
                        value={editingItem.priceTHB || ""}
                        onChange={(v) => setEditingItem({ ...editingItem, priceTHB: v })}
                        placeholder="0"
                        className="w-20 border border-sand rounded-lg px-2 py-1 text-sm text-right focus:border-orange focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">฿</span>
                      <button onClick={saveItem} className="text-xs text-orange font-semibold">บันทึก</button>
                      <button onClick={() => setEditingItem(null)} className="text-xs text-gray-400">ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-navy">{item.nameTh}</span>
                      <span className="text-sm font-bold text-orange">+฿{item.priceTHB}</span>
                      <button onClick={() => setEditingItem({ ...item, groupId: group.id })} className="text-xs text-orange hover:underline ml-2">แก้ไข</button>
                      <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add item row */}
            <div className="px-4 py-3 bg-gray-50 flex gap-2">
              <input
                type="text"
                value={newItems[group.id]?.nameTh ?? ""}
                onChange={(e) => setNewItems((p) => ({ ...p, [group.id]: { ...p[group.id], nameTh: e.target.value } }))}
                onKeyDown={(e) => e.key === "Enter" && addItem(group.id)}
                placeholder="ชื่อ Add-on"
                className="flex-1 border border-sand rounded-lg px-2 py-1.5 text-sm focus:border-orange focus:outline-none"
              />
              <NumpadInput
                value={Number(newItems[group.id]?.priceTHB) || ""}
                onChange={(v) => setNewItems((p) => ({ ...p, [group.id]: { ...p[group.id], priceTHB: String(v) } }))}
                placeholder="ราคา"
                className="w-20 border border-sand rounded-lg px-2 py-1.5 text-sm text-right focus:border-orange focus:outline-none"
              />
              <button
                onClick={() => addItem(group.id)}
                disabled={!newItems[group.id]?.nameTh?.trim()}
                className="bg-navy text-cream text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
              >
                + เพิ่ม
              </button>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-center text-gray-400 py-8">ยังไม่มี Set Add-on</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";

type OptionChoice = { id: number; nameTh: string; priceTHB: number; isDefault: boolean; isActive: boolean };
type OptionGroup = { id: number; nameTh: string; isRequired: boolean; isActive: boolean; choices: OptionChoice[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function call(method: string, body: object) {
  return fetch("/api/option-groups", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function AdminOptionGroupsPage() {
  const { data: groups = [], mutate } = useSWR<OptionGroup[]>("/api/option-groups", fetcher);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState<Partial<OptionGroup>>({});
  const [newChoices, setNewChoices] = useState<Record<number, { nameTh: string; priceTHB: string; isDefault: boolean }>>({});
  const [editingChoice, setEditingChoice] = useState<OptionChoice & { groupId: number } | null>(null);

  async function createGroup() {
    if (!newGroupName.trim()) return;
    await call("POST", { action: "create-group", nameTh: newGroupName.trim(), isRequired: newGroupRequired });
    setNewGroupName("");
    setNewGroupRequired(false);
    mutate();
  }

  async function updateGroup(id: number, data: Partial<OptionGroup>) {
    await call("PATCH", { action: "update-group", id, ...data });
    setEditingGroupId(null);
    mutate();
  }

  async function deleteGroup(id: number) {
    if (!confirm("ลบกลุ่มตัวเลือกนี้และตัวเลือกทั้งหมดในนั้น?")) return;
    await call("DELETE", { action: "delete-group", id });
    mutate();
  }

  async function addChoice(groupId: number) {
    const nc = newChoices[groupId];
    if (!nc?.nameTh?.trim()) return;
    await call("POST", {
      action: "add-choice",
      optionGroupId: groupId,
      nameTh: nc.nameTh.trim(),
      priceTHB: parseInt(nc.priceTHB) || 0,
      isDefault: nc.isDefault ?? false,
    });
    setNewChoices((p) => ({ ...p, [groupId]: { nameTh: "", priceTHB: "", isDefault: false } }));
    mutate();
  }

  async function saveChoice() {
    if (!editingChoice) return;
    await call("PATCH", {
      action: "update-choice",
      id: editingChoice.id,
      nameTh: editingChoice.nameTh,
      priceTHB: editingChoice.priceTHB,
      isDefault: editingChoice.isDefault,
    });
    setEditingChoice(null);
    mutate();
  }

  async function deleteChoice(id: number) {
    if (!confirm("ลบตัวเลือกนี้?")) return;
    await call("DELETE", { action: "delete-choice", id });
    mutate();
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-navy mb-6">จัดการกลุ่มตัวเลือก</h1>
      <p className="text-sm text-gray-500 mb-4">เช่น ระดับความหวาน, ระดับความเผ็ด, ไซส์แก้ว</p>

      {/* Create new group */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createGroup()}
          placeholder="ชื่อกลุ่ม เช่น ระดับความหวาน"
          className="flex-1 min-w-48 border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
          <input
            type="checkbox"
            checked={newGroupRequired}
            onChange={(e) => setNewGroupRequired(e.target.checked)}
            className="accent-orange"
          />
          บังคับเลือก
        </label>
        <button
          onClick={createGroup}
          disabled={!newGroupName.trim()}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-40"
        >
          + สร้างกลุ่ม
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
                    value={editGroup.nameTh ?? ""}
                    onChange={(e) => setEditGroup({ ...editGroup, nameTh: e.target.value })}
                    className="flex-1 border border-sand rounded-lg px-2 py-1 text-sm focus:border-orange focus:outline-none"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-navy cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editGroup.isRequired ?? false}
                      onChange={(e) => setEditGroup({ ...editGroup, isRequired: e.target.checked })}
                      className="accent-orange"
                    />
                    บังคับ
                  </label>
                  <button onClick={() => updateGroup(group.id, editGroup)} className="text-xs text-orange font-semibold">บันทึก</button>
                  <button onClick={() => setEditingGroupId(null)} className="text-xs text-gray-400">ยกเลิก</button>
                </>
              ) : (
                <>
                  <span className="font-bold text-navy flex-1">{group.nameTh}</span>
                  {group.isRequired && (
                    <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full font-medium">บังคับเลือก</span>
                  )}
                  <button
                    onClick={() => updateGroup(group.id, { isActive: !group.isActive })}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                  >
                    {group.isActive ? "ใช้งาน" : "ปิด"}
                  </button>
                  <button onClick={() => { setEditingGroupId(group.id); setEditGroup({ nameTh: group.nameTh, isRequired: group.isRequired }); }} className="text-xs text-orange hover:underline">แก้ไข</button>
                  <button onClick={() => deleteGroup(group.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                </>
              )}
            </div>

            {/* Choices */}
            <div className="divide-y divide-sand/50">
              {group.choices.map((choice) => (
                <div key={choice.id} className="px-4 py-2.5 flex items-center gap-3">
                  {editingChoice?.id === choice.id ? (
                    <>
                      <input
                        type="text"
                        value={editingChoice.nameTh}
                        onChange={(e) => setEditingChoice({ ...editingChoice, nameTh: e.target.value })}
                        className="flex-1 border border-sand rounded-lg px-2 py-1 text-sm focus:border-orange focus:outline-none"
                      />
                      <input
                        type="number"
                        value={editingChoice.priceTHB || ""}
                        onChange={(e) => setEditingChoice({ ...editingChoice, priceTHB: parseInt(e.target.value) || 0 })}
                        className="w-20 border border-sand rounded-lg px-2 py-1 text-sm text-right focus:border-orange focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">฿</span>
                      <label className="flex items-center gap-1 text-xs text-navy cursor-pointer">
                        <input type="checkbox" checked={editingChoice.isDefault} onChange={(e) => setEditingChoice({ ...editingChoice, isDefault: e.target.checked })} className="accent-orange" />
                        default
                      </label>
                      <button onClick={saveChoice} className="text-xs text-orange font-semibold">บันทึก</button>
                      <button onClick={() => setEditingChoice(null)} className="text-xs text-gray-400">ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-navy flex items-center gap-2">
                        {choice.nameTh}
                        {choice.isDefault && <span className="text-xs bg-navy/10 text-navy px-1.5 py-0.5 rounded-full">default</span>}
                      </span>
                      <span className="text-sm font-bold text-orange">{choice.priceTHB > 0 ? `+฿${choice.priceTHB}` : "ฟรี"}</span>
                      <button onClick={() => setEditingChoice({ ...choice, groupId: group.id })} className="text-xs text-orange hover:underline ml-2">แก้ไข</button>
                      <button onClick={() => deleteChoice(choice.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add choice row */}
            <div className="px-4 py-3 bg-gray-50 flex flex-wrap gap-2">
              <input
                type="text"
                value={newChoices[group.id]?.nameTh ?? ""}
                onChange={(e) => setNewChoices((p) => ({ ...p, [group.id]: { ...p[group.id], nameTh: e.target.value } }))}
                onKeyDown={(e) => e.key === "Enter" && addChoice(group.id)}
                placeholder="ชื่อตัวเลือก เช่น 50%"
                className="flex-1 min-w-32 border border-sand rounded-lg px-2 py-1.5 text-sm focus:border-orange focus:outline-none"
              />
              <input
                type="number"
                value={newChoices[group.id]?.priceTHB ?? ""}
                onChange={(e) => setNewChoices((p) => ({ ...p, [group.id]: { ...p[group.id], priceTHB: e.target.value } }))}
                placeholder="ราคาเพิ่ม"
                className="w-24 border border-sand rounded-lg px-2 py-1.5 text-sm text-right focus:border-orange focus:outline-none"
              />
              <label className="flex items-center gap-1.5 text-xs text-navy cursor-pointer">
                <input
                  type="checkbox"
                  checked={newChoices[group.id]?.isDefault ?? false}
                  onChange={(e) => setNewChoices((p) => ({ ...p, [group.id]: { ...p[group.id], isDefault: e.target.checked } }))}
                  className="accent-orange"
                />
                default
              </label>
              <button
                onClick={() => addChoice(group.id)}
                disabled={!newChoices[group.id]?.nameTh?.trim()}
                className="bg-navy text-cream text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
              >
                + เพิ่ม
              </button>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-center text-gray-400 py-8">ยังไม่มีกลุ่มตัวเลือก</p>
        )}
      </div>
    </div>
  );
}

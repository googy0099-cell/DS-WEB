"use client";

import { useState } from "react";
import { useOrderStore, makeCartKey } from "@/store/orderStore";
import type { MenuItemType, CartSelectedAddon, CartSelectedOption } from "@/types";

function getBangkokHHMM(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

function isWithinSellHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return true;
  const now = getBangkokHHMM();
  return now >= start && now <= end;
}

interface Props {
  item: MenuItemType;
  onClose: () => void;
}

export default function MenuItemPicker({ item, onClose }: Props) {
  const [size, setSize] = useState<"S" | "XL">(() => {
    if (item.priceS != null) return "S";
    return "XL";
  });
  const [addons, setAddons] = useState<CartSelectedAddon[]>([]);
  const [options, setOptions] = useState<CartSelectedOption[]>(() => {
    const defaults: CartSelectedOption[] = [];
    for (const og of item.optionGroups) {
      const def = og.choices.find((c) => c.isDefault && c.isActive);
      if (def) defaults.push({ groupId: og.id, groupName: og.nameTh, choiceId: def.id, choiceName: def.nameTh, priceTHB: def.priceTHB });
    }
    return defaults;
  });

  const { addItem } = useOrderStore();
  const hasSizes = item.priceS != null || item.priceXL != null;

  const basePrice = hasSizes
    ? size === "S" ? (item.priceS ?? item.priceTHB) : (item.priceXL ?? item.priceTHB)
    : item.priceTHB;
  const total = basePrice + addons.reduce((s, a) => s + a.priceTHB, 0) + options.reduce((s, o) => s + o.priceTHB, 0);

  function toggleAddon(groupId: number, id: number, nameTh: string, priceTHB: number) {
    setAddons((prev) => prev.some((a) => a.id === id) ? prev.filter((a) => a.id !== id) : [...prev, { id, groupId, nameTh, priceTHB }]);
  }

  function selectOption(groupId: number, groupName: string, choiceId: number, choiceName: string, priceTHB: number) {
    setOptions((prev) => {
      const filtered = prev.filter((o) => o.groupId !== groupId);
      return choiceId === -1 ? filtered : [...filtered, { groupId, groupName, choiceId, choiceName, priceTHB }];
    });
  }

  function confirm() {
    if (!isWithinSellHours(item.sellStartTime, item.sellEndTime)) {
      alert(`ไม่สามารถสั่งได้ตอนนี้ — รับออเดอร์ ${item.sellStartTime}–${item.sellEndTime} น. เท่านั้น`);
      onClose();
      return;
    }
    for (const og of item.optionGroups) {
      if (og.isRequired && !options.find((o) => o.groupId === og.id)) {
        alert(`กรุณาเลือก ${og.nameTh}`);
        return;
      }
    }
    addItem({
      cartKey: makeCartKey(item.id, hasSizes ? size : null, addons, options),
      menuItemId: item.id,
      nameTh: item.nameTh,
      priceTHB: total,
      selectedSize: hasSizes ? size : null,
      selectedAddons: addons,
      selectedOptions: options,
    });
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-5 max-h-[85vh] overflow-y-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:w-[480px] md:max-h-[85vh]">
        <h3 className="font-bold text-navy text-lg mb-1">{item.nameTh}</h3>
        <p className="text-xs text-gray-400 mb-4">{item.nameEn}</p>

        {hasSizes && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-navy mb-2">เลือกขนาด</p>
            <div className="flex gap-3">
              {item.priceS != null && (
                <button onClick={() => setSize("S")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${size === "S" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>
                  S — ฿{item.priceS}
                </button>
              )}
              {item.priceXL != null && (
                <button onClick={() => setSize("XL")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${size === "XL" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>
                  XL — ฿{item.priceXL}
                </button>
              )}
            </div>
          </div>
        )}

        {item.addonGroups.map((group) => (
          <div key={group.id} className="mb-5">
            <p className="text-sm font-semibold text-navy mb-2">{group.nameTh}</p>
            <div className="space-y-2">
              {group.items.filter((i) => i.isActive).map((ai) => {
                const selected = addons.some((a) => a.id === ai.id);
                return (
                  <button key={ai.id} onClick={() => toggleAddon(group.id, ai.id, ai.nameTh, ai.priceTHB)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${selected ? "border-orange bg-orange/10" : "border-sand"}`}>
                    <span className={`text-sm font-medium flex items-center gap-1.5 ${selected ? "text-orange" : "text-navy"}`}>{selected && "✓ "}{ai.nameTh}</span>
                    <span className="text-sm text-gray-500">+฿{ai.priceTHB}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {item.optionGroups.map((group) => {
          const sel = options.find((o) => o.groupId === group.id);
          return (
            <div key={group.id} className="mb-5">
              <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-2">
                {group.nameTh}
                {group.isRequired && <span className="text-xs text-orange font-normal">*บังคับ</span>}
              </p>
              <div className="space-y-2">
                {!group.isRequired && (
                  <button onClick={() => selectOption(group.id, group.nameTh, -1, "", 0)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${!sel ? "border-orange bg-orange/10" : "border-sand"}`}>
                    <span className={`text-sm font-medium ${!sel ? "text-orange" : "text-navy"}`}>{!sel && "✓ "}ไม่ระบุ</span>
                    <span className="text-sm text-gray-400">ฟรี</span>
                  </button>
                )}
                {group.choices.filter((c) => c.isActive).map((choice) => {
                  const isSelected = sel?.choiceId === choice.id;
                  return (
                    <button key={choice.id} onClick={() => selectOption(group.id, group.nameTh, choice.id, choice.nameTh, choice.priceTHB)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${isSelected ? "border-orange bg-orange/10" : "border-sand"}`}>
                      <span className={`text-sm font-medium ${isSelected ? "text-orange" : "text-navy"}`}>{isSelected && "✓ "}{choice.nameTh}</span>
                      <span className="text-sm text-gray-500">{choice.priceTHB > 0 ? `+฿${choice.priceTHB}` : "ฟรี"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between mb-4 pt-2 border-t border-sand">
          <span className="text-sm text-gray-500">รวม</span>
          <span className="font-bold text-orange text-lg">฿{total}</span>
        </div>
        <button onClick={confirm} className="w-full bg-orange text-white font-bold py-3 rounded-xl">
          เพิ่มลงตะกร้า
        </button>
      </div>
    </>
  );
}

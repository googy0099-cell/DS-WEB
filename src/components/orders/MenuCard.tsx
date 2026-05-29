"use client";

import { Plus, Minus } from "lucide-react";
import ThaiPrice from "@/components/shared/ThaiPrice";
import type { MenuItemType } from "@/types";
import { useOrderStore, makeCartKey } from "@/store/orderStore";

function getBangkokHHMM(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

function isWithinSellHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return true;
  const now = getBangkokHHMM();
  return now >= start && now <= end;
}

interface Props {
  item: MenuItemType;
}

export default function MenuCard({ item }: Props) {
  const { cart, addItem, updateQty } = useOrderStore();
  const cartKey = makeCartKey(item.id, null, [], []);
  const cartItem = cart.find((c) => c.cartKey === cartKey);
  const qty = cartItem?.quantity ?? 0;
  const canOrder = isWithinSellHours(item.sellStartTime, item.sellEndTime);

  return (
    <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-navy text-sm leading-tight">{item.nameTh}</p>
        <p className="text-xs text-gray-400">{item.nameEn}</p>
        <ThaiPrice amount={item.priceTHB} className="text-orange font-bold text-sm mt-0.5" />
        {!canOrder && item.sellStartTime && item.sellEndTime && (
          <p className="text-xs text-red-400 mt-0.5">⏰ รับออเดอร์ {item.sellStartTime}–{item.sellEndTime} น.</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canOrder ? (
          qty > 0 ? (
            <>
              <button
                onClick={() => updateQty(cartKey, qty - 1)}
                className="w-7 h-7 rounded-full bg-sand flex items-center justify-center text-navy"
              >
                <Minus size={14} />
              </button>
              <span className="w-5 text-center font-bold text-navy text-sm">{qty}</span>
              <button
                onClick={() =>
                  addItem({
                    cartKey,
                    menuItemId: item.id,
                    nameTh: item.nameTh,
                    priceTHB: item.priceTHB,
                    selectedSize: null,
                    selectedAddons: [],
                    selectedOptions: [],
                  })
                }
                className="w-7 h-7 rounded-full bg-orange flex items-center justify-center text-white"
              >
                <Plus size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                addItem({
                  cartKey,
                  menuItemId: item.id,
                  nameTh: item.nameTh,
                  priceTHB: item.priceTHB,
                  selectedSize: null,
                  selectedAddons: [],
                  selectedOptions: [],
                })
              }
              className="w-7 h-7 rounded-full bg-orange flex items-center justify-center text-white"
            >
              <Plus size={14} />
            </button>
          )
        ) : (
          <span className="text-xs text-gray-300 font-medium">ปิด</span>
        )}
      </div>
    </div>
  );
}

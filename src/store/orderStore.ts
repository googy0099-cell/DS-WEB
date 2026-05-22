import { create } from "zustand";
import type { CartItem } from "@/types";

interface OrderStore {
  orderName: string;
  userId: number | null;
  cart: CartItem[];
  setOrderName: (name: string) => void;
  setUserId: (id: number | null) => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (cartKey: string) => void;
  updateQty: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orderName: "",
  userId: null,
  cart: [],

  setOrderName: (name) => set({ orderName: name }),
  setUserId: (id) => set({ userId: id }),

  addItem: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.cartKey === item.cartKey);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.cartKey === item.cartKey ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      return { cart: [...state.cart, { ...item, quantity: 1 }] };
    }),

  removeItem: (cartKey) =>
    set((state) => ({ cart: state.cart.filter((c) => c.cartKey !== cartKey) })),

  updateQty: (cartKey, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((c) => c.cartKey !== cartKey)
          : state.cart.map((c) => (c.cartKey === cartKey ? { ...c, quantity } : c)),
    })),

  clearCart: () => set({ cart: [], orderName: "", userId: null }),

  total: () => get().cart.reduce((sum, c) => sum + c.priceTHB * c.quantity, 0),
}));

export function makeCartKey(
  menuItemId: number,
  selectedSize: string | null,
  selectedAddons: { id: number }[],
  selectedOptions: { groupId: number; choiceId: number }[]
): string {
  const addonPart = selectedAddons.map((a) => a.id).sort().join(",");
  const optionPart = selectedOptions
    .map((o) => `${o.groupId}:${o.choiceId}`)
    .sort()
    .join(",");
  return `${menuItemId}-${selectedSize ?? ""}-${addonPart}-${optionPart}`;
}

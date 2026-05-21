import { create } from "zustand";
import type { CartItem } from "@/types";

interface OrderStore {
  orderName: string;
  userId: number | null;
  cart: CartItem[];
  setOrderName: (name: string) => void;
  setUserId: (id: number | null) => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (menuItemId: number) => void;
  updateQty: (menuItemId: number, quantity: number) => void;
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
      const existing = state.cart.find((c) => c.menuItemId === item.menuItemId);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.menuItemId === item.menuItemId
              ? { ...c, quantity: c.quantity + 1 }
              : c
          ),
        };
      }
      return { cart: [...state.cart, { ...item, quantity: 1 }] };
    }),

  removeItem: (menuItemId) =>
    set((state) => ({ cart: state.cart.filter((c) => c.menuItemId !== menuItemId) })),

  updateQty: (menuItemId, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((c) => c.menuItemId !== menuItemId)
          : state.cart.map((c) =>
              c.menuItemId === menuItemId ? { ...c, quantity } : c
            ),
    })),

  clearCart: () => set({ cart: [], orderName: "", userId: null }),

  total: () => get().cart.reduce((sum, c) => sum + c.priceTHB * c.quantity, 0),
}));

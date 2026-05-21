export type OrderStatus = "PENDING" | "CONFIRMED" | "SERVED" | "CANCELLED";
export type PaymentMethod = "PROMPTPAY" | "CASH" | "CREDIT";
export type PaymentStatus = "PENDING" | "CONFIRMED";

export interface CartItem {
  menuItemId: number;
  nameTh: string;
  priceTHB: number;
  quantity: number;
}

export interface MenuItemType {
  id: number;
  nameTh: string;
  nameEn: string;
  category: string;
  priceTHB: number;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface OrderWithItems {
  id: number;
  orderName: string;
  tableId: number | null;
  status: OrderStatus;
  totalTHB: number;
  note: string | null;
  createdAt: string;
  items: {
    id: number;
    quantity: number;
    unitPriceTHB: number;
    menuItem: { nameTh: string; nameEn: string };
  }[];
}

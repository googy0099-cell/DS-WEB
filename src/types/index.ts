export type OrderStatus = "PENDING" | "CONFIRMED" | "SERVED" | "CANCELLED";
export type PaymentMethod = "PROMPTPAY" | "CASH" | "CREDIT";
export type PaymentStatus = "PENDING" | "CONFIRMED";

export interface AddonType {
  id: number;
  nameTh: string;
  priceTHB: number;
  isActive: boolean;
}

export interface CartItem {
  cartKey: string;
  menuItemId: number;
  nameTh: string;
  priceTHB: number;
  selectedSize: string | null;
  selectedAddons: { id: number; nameTh: string; priceTHB: number }[];
  quantity: number;
}

export interface MenuItemType {
  id: number;
  nameTh: string;
  nameEn: string;
  category: string;
  priceTHB: number;
  priceS: number | null;
  priceXL: number | null;
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
    selectedSize: string | null;
    selectedAddons: string | null;
    menuItem: { nameTh: string; nameEn: string };
  }[];
}

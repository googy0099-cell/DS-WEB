export type OrderStatus = "PENDING" | "CONFIRMED" | "PAID" | "SERVED" | "CANCELLED";
export type PaymentMethod = "PROMPTPAY" | "CASH" | "CREDIT";
export type PaymentStatus = "PENDING" | "CONFIRMED";

export interface AddonItemType {
  id: number;
  nameTh: string;
  priceTHB: number;
  isActive: boolean;
}

export interface AddonGroupType {
  id: number;
  nameTh: string;
  isActive: boolean;
  items: AddonItemType[];
}

export interface OptionChoiceType {
  id: number;
  nameTh: string;
  priceTHB: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface OptionGroupType {
  id: number;
  nameTh: string;
  isRequired: boolean;
  isActive: boolean;
  choices: OptionChoiceType[];
}

export interface CartSelectedAddon {
  id: number;
  groupId: number;
  nameTh: string;
  priceTHB: number;
}

export interface CartSelectedOption {
  groupId: number;
  groupName: string;
  choiceId: number;
  choiceName: string;
  priceTHB: number;
}

export interface CartItem {
  cartKey: string;
  menuItemId: number;
  nameTh: string;
  priceTHB: number;
  selectedSize: string | null;
  selectedAddons: CartSelectedAddon[];
  selectedOptions: CartSelectedOption[];
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
  sellStartTime: string | null;
  sellEndTime: string | null;
  queueTarget: string;
  addonGroups: AddonGroupType[];
  optionGroups: OptionGroupType[];
}

export interface OrderWithItems {
  id: number;
  orderName: string;
  tableId: number | null;
  billId: number | null;
  handledById: number | null;
  status: OrderStatus;
  totalTHB: number;
  note: string | null;
  createdAt: string;
  kitchenServedAt: string | null;
  payment?: { id: number; slipUrl: string | null; status: string; method: string; amountTHB: number } | null;
  bill?: { id: number; name: string; color: string; table: { number: number } } | null;
  items: {
    id: number;
    quantity: number;
    unitPriceTHB: number;
    selectedSize: string | null;
    selectedAddons: string | null;
    selectedOptions: string | null;
    kitchenServedAt: string | null;
    menuItem: { nameTh: string; nameEn: string; category: string; queueTarget: string };
  }[];
}

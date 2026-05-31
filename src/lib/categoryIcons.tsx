import { Coffee, Milk, GlassWater, Wine, UtensilsCrossed, Cookie, Cake, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  milktea: Milk,
  coffee: Coffee,
  soda: GlassWater,
  drink: Wine,
  food: UtensilsCrossed,
  snack: Cookie,
  dessert: Cake,
};

export function CategoryIcon({
  id,
  fallback = "🍽️",
  size = 24,
  className = "",
}: {
  id: string;
  fallback?: string;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[id];
  if (Icon) return <Icon size={size} strokeWidth={1.5} className={className} />;
  return <span>{fallback}</span>;
}

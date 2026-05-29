import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db.menuItem.findMany({
    where: { isAvailable: true },
    orderBy: [{ category: "asc" }, { nameTh: "asc" }],
    select: {
      id: true,
      nameTh: true,
      nameEn: true,
      category: true,
      priceTHB: true,
      priceS: true,
      priceXL: true,
      imageUrl: true,
      recipeNote: true,
      stockRecipes: {
        orderBy: [{ size: "asc" }, { id: "asc" }],
        select: {
          id: true,
          size: true,
          qtyUsed: true,
          stockItem: { select: { name: true, unit: true } },
        },
      },
    },
  });

  return NextResponse.json(items);
}

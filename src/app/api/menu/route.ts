import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) {
    return null;
  }
  return session;
}

function includeGroups() {
  return {
    addonGroups: {
      include: {
        addonGroup: {
          include: { items: { where: { isActive: true }, orderBy: { id: "asc" as const } } },
        },
      },
    },
    optionGroups: {
      include: {
        optionGroup: {
          include: { choices: { where: { isActive: true }, orderBy: { id: "asc" as const } } },
        },
      },
    },
  };
}

function flattenItem(item: {
  addonGroups: { addonGroup: unknown }[];
  optionGroups: { optionGroup: unknown }[];
  [k: string]: unknown;
}) {
  const { addonGroups, optionGroups, ...rest } = item;
  return {
    ...rest,
    addonGroups: addonGroups.map((ag) => ag.addonGroup),
    optionGroups: optionGroups.map((og) => og.optionGroup),
  };
}

export async function GET() {
  const items = await db.menuItem.findMany({
    orderBy: [{ category: "asc" }, { nameTh: "asc" }],
    include: includeGroups(),
  });
  return NextResponse.json(items.map(flattenItem));
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { addonGroupIds, optionGroupIds, ...data } = await req.json();
  const item = await db.menuItem.create({
    data,
    include: includeGroups(),
  });
  if (addonGroupIds?.length) {
    await db.menuItemAddonGroup.createMany({
      data: addonGroupIds.map((gid: number) => ({ menuItemId: item.id, addonGroupId: gid })),
    });
  }
  if (optionGroupIds?.length) {
    await db.menuItemOptionGroup.createMany({
      data: optionGroupIds.map((gid: number) => ({ menuItemId: item.id, optionGroupId: gid })),
    });
  }
  const updated = await db.menuItem.findUnique({
    where: { id: item.id },
    include: includeGroups(),
  });
  return NextResponse.json(flattenItem(updated!), { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { id, addonGroupIds, optionGroupIds, ...data } = await req.json();
  await db.menuItem.update({ where: { id }, data });

  if (addonGroupIds !== undefined) {
    await db.menuItemAddonGroup.deleteMany({ where: { menuItemId: id } });
    if (addonGroupIds.length > 0) {
      await db.menuItemAddonGroup.createMany({
        data: addonGroupIds.map((gid: number) => ({ menuItemId: id, addonGroupId: gid })),
      });
    }
  }
  if (optionGroupIds !== undefined) {
    await db.menuItemOptionGroup.deleteMany({ where: { menuItemId: id } });
    if (optionGroupIds.length > 0) {
      await db.menuItemOptionGroup.createMany({
        data: optionGroupIds.map((gid: number) => ({ menuItemId: id, optionGroupId: gid })),
      });
    }
  }

  const updated = await db.menuItem.findUnique({
    where: { id },
    include: includeGroups(),
  });
  return NextResponse.json(flattenItem(updated!));
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { id } = await req.json();
  await db.menuItemAddonGroup.deleteMany({ where: { menuItemId: id } });
  await db.menuItemOptionGroup.deleteMany({ where: { menuItemId: id } });
  await db.orderItem.deleteMany({ where: { menuItemId: id } });
  await db.menuItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

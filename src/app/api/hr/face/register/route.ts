import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { ensurePersonGroup, createPerson, addFaceToPerson, trainPersonGroup } from "@/lib/hr-azure-face";

export async function POST(req: NextRequest) {
  const { staffId, photoBase64 } = (await req.json()) as {
    staffId: number;
    photoBase64: string;
  };

  if (!staffId || !photoBase64) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const staff = await db.hrStaff.findUnique({
    where: { id: staffId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  try {
    await ensurePersonGroup();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let personId = (staff as any).azurePersonId as string | null;

    if (!personId) {
      const name = `${staff.user.firstName} ${staff.user.lastName}`.trim();
      personId = await createPerson(name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.hrStaff.update({ where: { id: staffId }, data: { azurePersonId: personId } as any });
    }

    await addFaceToPerson(personId, photoBase64);
    await trainPersonGroup();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

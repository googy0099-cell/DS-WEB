# 🎲 Dice Shop & Board Game Cafe — CLAUDE.md

## 1. ข้อมูลภาพรวมโปรเจกต์

- **ชื่อโปรเจกต์:** Dice Shop Web App
- **เป้าหมาย:** ระบบ All-in-One สำหรับร้านบอร์ดเกม — ลดขั้นตอนพนักงาน, เพิ่มความสนุกลูกค้า (Gamification), ขับเคลื่อนด้วยระบบอัตโนมัติ
- **สไตล์:** Mobile-First, โทนสีธีมร้านบอร์ดเกม
  - Cream: `#f8f1e5` · Navy: `#182a47` · Orange: `#fb8500` · Sand: `#f0dcbe` · Sage: `#84a98c`
  - อ้างอิงรูปแบบจาก `Web-ref.png`, ใช้โลโก้จาก `DS-new-logo.png`
- **ผู้ใช้งานหลัก:** ลูกค้าในร้าน (ไทย), พนักงาน, เจ้าของร้าน

---

## 2. Tech Stack จริง (ปัจจุบัน)

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 15 App Router, TypeScript strict |
| Database | **Turso (libSQL)** ผ่าน Prisma + `@prisma/adapter-libsql` |
| Auth | NextAuth.js (credentials) |
| Styling | Tailwind CSS |
| State | Zustand (cart), React state สำหรับหน้าอื่น |
| Deploy | **Railway** (ไม่ใช่ Vercel) |
| Face Recognition | face-api.js รันบน browser — สำหรับโมดูล HR เท่านั้น |
| HR Sheets | Google Sheets API — sync รายงาน HR |

**DB Migrations (สำคัญมาก):**
- ❌ ห้าม `prisma migrate deploy` ใน build — ไม่รองรับ libsql:// scheme
- ✅ Build script: `prisma generate && next build`
- ✅ Migration ใหม่: `turso db shell dice-shop < migration.sql` แล้วค่อย `npx prisma generate`

---

## 3. Roles และสิทธิ์

| Role | สิทธิ์ |
|------|--------|
| USER | ลูกค้าทั่วไป |
| CASHIER | Dashboard + ฟีเจอร์พนักงานทั้งหมด |
| STAFF | เหมือน CASHIER แต่ไม่มี Dashboard |
| OWNER | ทุกอย่าง + members/analytics/settings/HR |

> ทุก route ที่ guard ด้วย role ต้องรวม CASHIER ด้วยเสมอ ไม่ใช่แค่ STAFF/OWNER

---

## 4. โครงสร้าง Folder จริง (ปัจจุบัน)

```
src/app/
├── (customer)/           ← หน้าลูกค้า (table/[slug], checkout)
├── (staff)/admin/        ← หน้าพนักงาน (pos, cashier, menu, tables, ...)
├── api/                  ← API routes
├── menu/                 ← เมนูดูอย่างเดียว (browse-only, ไม่สั่งได้)
├── checkout/             ← checkout หลังสั่ง (มี token)
└── hr/                   ← ⬅️ โมดูล HR ใหม่ทั้งหมดอยู่ที่นี่

src/components/
├── orders/               ← CartDrawer, MenuPageContent, PaymentSection
├── admin/                ← OrderQueue, PartyOrderButton, ...
├── shared/               ← Navbar, Footer
├── werewolf/             ← Werewolf game UI
└── hr/                   ← ⬅️ HR components ใหม่ทั้งหมด

src/lib/
├── db.ts                 ← Prisma client (Turso)
├── auth.ts               ← NextAuth config
├── pos-time.ts           ← Timer helpers สำหรับ party sessions
├── hr-face.ts            ← ⬅️ face recognition helpers (ใหม่)
├── hr-sheets.ts          ← ⬅️ Google Sheets sync (ใหม่)
└── hr-notify.ts          ← ⬅️ LINE Notify สำหรับ HR (ใหม่)
```

---

## 5. ระบบสำคัญที่ควรรู้ก่อนแตะโค้ด

**Table QR:** URL เป็น `/table/[slug]` ใช้ 8-char hex slug ไม่ใช่ numeric ID  
**MenuPageContent:** `canOrder = !!tableId` — ถ้าไม่มี tableId = browse-only, ไม่มี cart  
**CartDrawer:** bill selector แสดงเฉพาะเมื่อมี `tableId` เท่านั้น (ป้องกัน bill hijacking)  
**Points:** `floor(totalTHB/10)` = loyalty points, `floor(totalTHB/49)` = dice points  
**Tab-checkout:** auto-detect `userId` จากออเดอร์ในบิลถ้า staff ไม่ได้เลือก member เอง  
**POS page (`/admin/pos`):** มีระบบเสียงเตือน session หมดเวลา + dismissible alert banner — ระวังอย่า overwrite  

---

## 6. โมดูล HR (ใหม่) — ขอบเขตและกฎ

> **แยกขาดจากโมดูล 1-5 อย่างสมบูรณ์** ลูกค้าเข้าไม่ได้

### ฟีเจอร์ที่จะสร้าง
- **เช็คอิน/เอาท์ด้วยใบหน้า** — face-api.js รันบน browser มือถือร้านที่ตั้งไว้ประจำ
- **เช็คลิสต์เปิด-ปิดร้าน** — พนักงานติ๊กรายการ + ถ่ายรูปประกอบบางรายการ
- **ติดตามงาน** — มอบหมายงาน ดูสถานะ กำหนด deadline
- **KPI** — ตั้งเป้าหมายรายบุคคล ติดตามผลรายเดือน
- **Dashboard เจ้าของร้าน** — ดูภาพรวมทีม รายงานเข้างาน ตรวจรูปย้อนหลัง
- **Sync Google Sheets** — ส่งรายงานขึ้น Sheets อัตโนมัติทุกวัน

### Routes HR

| Route | สิทธิ์ | อุปกรณ์ |
|-------|--------|---------|
| `/hr/checkin` | ไม่ต้อง login (PIN กัน) | มือถือร้านประจำ |
| `/hr/checklist` | STAFF+ | มือถือ |
| `/hr/tasks` | STAFF+ | ทุกเครื่อง |
| `/hr/kpi` | STAFF+ | ทุกเครื่อง |
| `/hr/dashboard` | OWNER | ทุกเครื่อง |

### DB Tables ใหม่สำหรับ HR (ห้ามแตะ table เดิม)

```sql
Staff        (id, userId, role, faceData, createdAt)
Attendance   (id, staffId, checkIn, checkOut, photoUrl, createdAt)
Checklist    (id, type, date, staffId, createdAt)
ChecklistItem(id, checklistId, label, done, photoUrl, doneAt)
Task         (id, title, description, status, assignedTo, deadline, createdAt)
KPI          (id, staffId, title, target, actual, unit, month, year)
```

---

## 7. กฎเหล็กสำหรับ Claude

1. **HR Isolation:** โค้ด HR ต้องอยู่ใน `/hr/`, `/components/hr/`, `/lib/hr-*.ts` เท่านั้น
2. **ห้าม migrate เอง:** แสดง SQL ให้เจ้าของ run เอง (`turso db shell dice-shop < file.sql`)
3. **แจ้งก่อนแตะ config กลาง:** `schema.prisma`, `package.json`, `next.config.ts`, `tailwind.config.ts` — บอกก่อนว่าจะแก้อะไรและทำไม
4. **Mobile-First:** ทุกหน้าดูดีบนมือถือก่อน Desktop
5. **ไม่เขียน boilerplate เยิ่นเย้อ:** เขียนเฉพาะที่จำเป็น ไม่ทิ้งโค้ดไม่ใช้
6. **ตรวจ diff ก่อน push:** ถ้า diff ลบไปมากกว่า 100 บรรทัด ให้แสดง `--stat` ให้ดูก่อนเสมอ
7. **Simplicity first:** ถ้าทำแบบธรรมดาได้ก็ไม่ต้องใช้ API ภายนอกที่ซับซ้อน

---

## 8. Development Roadmap

- ✅ **Phase 1:** ระบบสั่งอาหาร + QR โต๊ะ + LINE Notify
- ✅ **Phase 2:** Admin Dashboard + ระบบชำระเงิน + POS จัดการปาร์ตี้
- ✅ **Phase 3:** Werewolf Companion + Auto GM
- ✅ **Phase 4:** ระบบสมาชิก + Leaderboard + Mini-games + Cashier EOD
- 🔄 **Phase 5:** **ระบบ HR** — เช็คอิน, เช็คลิสต์, งาน, KPI ← กำลังสร้าง

---

อะไรที่ทำไม่ได้จริง อย่าทำตรวจสอบผลลัพท์ที่แท้จริงก่อนจะรับปากว่าทำได้จริง

---


*อัปเดตล่าสุด: มิถุนายน 2026*

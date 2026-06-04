import db from "../src/lib/db";

const items = [
  { type: "OPEN", section: "บาร์", label: "เปิดไฟร้าน", order: 1, requiresPhoto: false },
  { type: "OPEN", section: "บาร์", label: "เปิดเครื่องชง/เครื่องบด/อุปกรณ์บาร์", order: 2, requiresPhoto: false },
  { type: "OPEN", section: "บาร์", label: "เปิด POS / เช็คเน็ต", order: 3, requiresPhoto: false },
  { type: "OPEN", section: "บาร์", label: "นับเงินทอนเริ่มกะ ___ บาท + เดรียม", order: 4, requiresPhoto: false },
  { type: "OPEN", section: "บาร์", label: "ปากกา/สมุดจดเวลาโต๊ะ", order: 5, requiresPhoto: false },
  { type: "OPEN", section: "วัตถุดิบบาร์", label: "น้ำในแท้งค์", order: 6, requiresPhoto: false },
  { type: "OPEN", section: "วัตถุดิบบาร์", label: "เมล็ดกาแฟ", order: 7, requiresPhoto: false },
  { type: "OPEN", section: "วัตถุดิบบาร์", label: "นม", order: 8, requiresPhoto: false },
  { type: "OPEN", section: "วัตถุดิบบาร์", label: "ไซรัป", order: 9, requiresPhoto: false },
  { type: "OPEN", section: "วัตถุดิบบาร์", label: "น้ำแข็ง", order: 10, requiresPhoto: false },
  { type: "OPEN", section: "วัตถุดิบบาร์", label: "แก้ว-ฝา-หลอด", order: 11, requiresPhoto: false },
  { type: "OPEN", section: "บาร์", label: "ใส่ถุงขยะ", order: 12, requiresPhoto: false },
  { type: "OPEN", section: "ร้าน", label: "เปิดแอร์", order: 13, requiresPhoto: false },
  { type: "OPEN", section: "ร้าน", label: "เปิดเครื่องเสียง / เปิดเพลง", order: 14, requiresPhoto: false },
  { type: "OPEN", section: "ร้าน", label: "เปิดทีวี / เปิดยูทูป", order: 15, requiresPhoto: false },
  { type: "OPEN", section: "ร้าน", label: "กวาดร้าน (ในร้าน - หน้าเคาน์เตอร์)", order: 16, requiresPhoto: false },
  { type: "OPEN", section: "ร้าน", label: "ยกเก้าอี้ / เช็คโต๊ะทุกโต๊ะ / จัดเก้าอี้", order: 17, requiresPhoto: false },
  { type: "OPEN", section: "ห้องน้ำ", label: "โถส้วม", order: 18, requiresPhoto: false },
  { type: "OPEN", section: "ห้องน้ำ", label: "อ่าง", order: 19, requiresPhoto: false },
  { type: "OPEN", section: "ห้องน้ำ", label: "พื้น", order: 20, requiresPhoto: false },
  { type: "OPEN", section: "ห้องน้ำ", label: "ทิชชู่ / สบู่", order: 21, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "เช็ดกระจกหน้าร้าน + มือจับประตู", order: 22, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "กวาดหน้าร้าน", order: 23, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "เช็คความสะอาดครัว", order: 24, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "เช็คเตาไฟฟ้า / เตาแก๊ส", order: 25, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "เช็คภาชนะ ถ้วย / จาน / ช้อน", order: 26, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "เช็ควัตถุดิบหลักพร้อมขาย", order: 27, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "เสิร์ฟ/ถุง/กล่อง", order: 28, requiresPhoto: false },
  { type: "OPEN", section: "หน้าร้าน/ครัว", label: "ถ่ายรูปเช็คอินร้าน (ทุกคนที่เข้างาน)", order: 29, requiresPhoto: true },
  { type: "CLOSE", section: "POS/เงิน", label: "เคลียร์บิลทุกโต๊ะ 0 โต๊ะค้างจ่าย", order: 1, requiresPhoto: false },
  { type: "CLOSE", section: "บาร์", label: "ปิดเครื่องชง / เครื่องบดตามขั้นตอน", order: 2, requiresPhoto: false },
  { type: "CLOSE", section: "บาร์", label: "ล้างด้ามชง / ตะแกรง / เหยือกนม / อุปกรณ์ชงทั้งหมด", order: 3, requiresPhoto: false },
  { type: "CLOSE", section: "บาร์", label: "ทิ้งกากกาแฟ/ล้างถาดรองน้ำ/เช็ดให้แห้ง", order: 4, requiresPhoto: false },
  { type: "CLOSE", section: "บาร์", label: "ซักผ้าขี้ริ้ว", order: 5, requiresPhoto: false },
  { type: "CLOSE", section: "บาร์", label: "เช็คความสะอาดห้องน้ำ", order: 6, requiresPhoto: false },
  { type: "CLOSE", section: "บาร์", label: "เช็ดเคาน์เตอร์บาร์ + พื้นบาร์", order: 7, requiresPhoto: false },
  { type: "CLOSE", section: "POS/เงิน", label: "สรุปยอดใน POS (รายงาน/ปิดบิล/ส่วนลด/ยกเลิกบิลตรวจครบ)", order: 8, requiresPhoto: false },
  { type: "CLOSE", section: "POS/เงิน", label: "เก็บเงินเข้าที่/ล็อคลิ้นชัก/ส่งมอบกะ", order: 9, requiresPhoto: false },
  { type: "CLOSE", section: "ร้าน", label: "ถูพื้นร้าน", order: 10, requiresPhoto: false },
  { type: "CLOSE", section: "เกม", label: "เช็คเกม", order: 11, requiresPhoto: false },
  { type: "CLOSE", section: "เกม", label: "จัดชั้นเกมให้ตรงทั้งหมด", order: 12, requiresPhoto: false },
  { type: "CLOSE", section: "ร้าน", label: "จัดโต๊ะคอม โต๊ะทำงาน", order: 13, requiresPhoto: false },
  { type: "CLOSE", section: "ร้าน", label: "จัดโซฟา", order: 14, requiresPhoto: false },
  { type: "CLOSE", section: "ร้าน", label: "เช็ดโต๊ะ", order: 15, requiresPhoto: false },
  { type: "CLOSE", section: "ร้าน", label: "ยกเก้าอี้", order: 16, requiresPhoto: false },
  { type: "CLOSE", section: "ร้าน", label: "เอาขยะไปทิ้ง", order: 17, requiresPhoto: false },
  { type: "CLOSE", section: "ครัว", label: "ล้างอุปกรณ์ครัวทั้งหมด", order: 18, requiresPhoto: false },
  { type: "CLOSE", section: "ครัว", label: "เคลียร์อ่างล้าง", order: 19, requiresPhoto: false },
  { type: "CLOSE", section: "ครัว", label: "เก็บวัตถุดิบเข้าที่ / แช่เย็นถูกต้อง", order: 20, requiresPhoto: false },
  { type: "CLOSE", section: "ครัว", label: "เช็คโต๊ะครัว/ผิวสัมผัส + ถูพื้นครัว", order: 21, requiresPhoto: false },
  { type: "CLOSE", section: "ครัว", label: "ทิ้งเศษอาหาร / ขยะครัว", order: 22, requiresPhoto: false },
  { type: "CLOSE", section: "ปิดร้าน", label: "ปิดไฟทั้งหมด / ปิดแอร์ / ปิดเครื่องใช้ไฟฟ้าทุกจุด", order: 23, requiresPhoto: false },
  { type: "CLOSE", section: "ปิดร้าน", label: "ปิดเครื่องเสียง / คอม", order: 24, requiresPhoto: false },
  { type: "CLOSE", section: "ปิดร้าน", label: "ปิดน้ำ (ถ้ามีจุดที่ต้องปิด) / ตรวจปลั๊กจุดเสี่ยง", order: 25, requiresPhoto: false },
  { type: "CLOSE", section: "ปิดร้าน", label: "ล็อคประตู/ประตูหลัง", order: 26, requiresPhoto: false },
  { type: "CLOSE", section: "ปิดร้าน", label: "ถ่ายรูป \"สภาพร้านหลังปิด\" 1 รูป", order: 27, requiresPhoto: true },
];

async function main() {
  const existing = await db.hrChecklistTemplate.count();
  if (existing > 0) {
    console.log(`มีข้อมูลอยู่แล้ว ${existing} รายการ — ลบแล้วใส่ใหม่`);
    await db.hrChecklistTemplate.deleteMany();
  }
  await db.hrChecklistTemplate.createMany({ data: items });
  console.log(`✅ ใส่ข้อมูล ${items.length} รายการเรียบร้อย`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

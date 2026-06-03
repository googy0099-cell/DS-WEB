export type ChecklistTemplateItem = { label: string; requiresPhoto: boolean };

export const CHECKLIST_TEMPLATES: Record<"OPEN" | "CLOSE", ChecklistTemplateItem[]> = {
  OPEN: [
    { label: "เปิดไฟและแอร์", requiresPhoto: false },
    { label: "ทำความสะอาดโต๊ะและพื้นที่", requiresPhoto: true },
    { label: "ตรวจสอบอุปกรณ์บอร์ดเกม", requiresPhoto: false },
    { label: "เตรียมเครื่องดื่มและของว่าง", requiresPhoto: false },
    { label: "ตรวจสอบระบบ POS", requiresPhoto: false },
    { label: "ถ่ายรูปหน้าร้าน", requiresPhoto: true },
  ],
  CLOSE: [
    { label: "เก็บบอร์ดเกมเข้าที่", requiresPhoto: false },
    { label: "ทำความสะอาดโต๊ะ", requiresPhoto: true },
    { label: "ปิดเครื่องใช้ไฟฟ้าทั้งหมด", requiresPhoto: false },
    { label: "เคาน์ตเงินในลิ้นชัก", requiresPhoto: false },
    { label: "ตรวจสอบความเรียบร้อย", requiresPhoto: true },
    { label: "ล็อคประตูและปิดไฟ", requiresPhoto: false },
  ],
};

export function requiresPhoto(label: string, type: "OPEN" | "CLOSE"): boolean {
  return CHECKLIST_TEMPLATES[type].find((t) => t.label === label)?.requiresPhoto ?? false;
}

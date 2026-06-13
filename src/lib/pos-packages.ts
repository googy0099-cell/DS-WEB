// POS party packages. Kept in a plain lib (not a route file) so it can be
// imported anywhere — Next route files may only export HTTP handlers + a few
// reserved fields, not arbitrary consts.
export const PACKAGES = {
  A: { label: "Package A — สั่งเครื่องดื่ม", price: 0, timeSeconds: 3600, desc: "ได้เล่นฟรี 1 ชม." },
  B: { label: "Package B — 49 บาท", price: 49, timeSeconds: 7200, desc: "เล่น 1 ชม. + ฟรี 1 ชม. = 2 ชม." },
  C: { label: "Package C — เหมาวัน 120 บาท", price: 120, timeSeconds: 86400, desc: "ฟรีเครื่องดื่ม 1 แก้ว ไม่จำกัดเวลา" },
  D: { label: "Package D — อัพเกรดเหมาวัน 80 บาท", price: 80, timeSeconds: 86400, desc: "อัพเกรดเป็นเหมาวัน" },
} as const;

export type PackageKey = keyof typeof PACKAGES;

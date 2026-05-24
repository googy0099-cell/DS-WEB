export const wolfRoles = [
  'เขี้ยวยาว (Dire Wolf)', 'นางปีศาจ (Sorcerer)', 'มนุษย์หมาป่ากินเจ (Vegetarian Werewolf)',
  'มนุษย์หมาป่าจ่าฝูง (Alpha Wolf)', 'มนุษย์หมาป่าเดียวดาย (Lone Wolf)',
  'มนุษย์หมาป่าวัยรุ่น (Teenage Werewolf)', 'ลูกหมาป่า (Wolf Cub)', 'วูฟเวอรีน (Wolverine)',
  'สมุนหมาป่า (Minion)', 'หมาป่า (Werewolf)', 'หมาป่ากระหายเลือด (Bloodthirsty Wolf)',
  'หมาป่าขี้เซา (Dream Wolf)', 'หมาป่ามนุษย์ (Human Wolf)', 'หมาป่าสีขาว (White Wolf)',
  'หมาป่าโลกันตร์ (Hellhound)',
];

export const villagerRoles = [
  'กามเทพ (Cupid)', 'คนอดนอน (Insomniac)', 'จอมอึด (Tough Guy)', 'จอมเวทย์ (Magician)',
  'เจ้าชาย (Prince)', 'ชาวบ้าน (Villager)', 'ญาณทิพย์ (Aura Seer)', 'ตาทิพย์ (Clairvoyant)',
  'ตัวป่วน (Troublemaker)', 'ท่านเคาต์ (Count)', 'เทพพยากรณ์ (Seer)', 'เทพผู้รู้แจ้ง (Oracle)',
  'นักบวช (Priest)', 'นักสะกดจิต (Hypnotist)', 'นักสืบเรื่องลี้ลับ (Paranormal Investigator)',
  'นายกเทศมนตรี (Mayor)', 'นายพราน (Hunter)', 'บอดี้การ์ด (Bodyguard)', 'ผู้ใช้คาถา (Spellcaster)',
  'ผู้ป่วยติดเชื้อ (Diseased)', 'ผู้เผยตัวตน (Martyr)', 'ผู้รักสันติ (Pacifist)',
  'พรานหญิง (Huntress)', 'พรายกระซิบ (Whispering Spirit)', 'ภราดรแห่งเมสัน (Mason)',
  'ภูตเลปริคอน (Leprechaun)', 'มือระเบิดพลีชีพ (Bomber)', 'แม่มด (Witch)', 'แม่หมอ (Old Hag)',
  'ลูกครึ่งมนุษย์หมาป่าหมา (Lycan)', 'เวอร์จิเนีย วูล์ฟ (Virginia Woolf)',
  'ศิษย์เทพพยากรณ์ (Apprentice Seer)', 'สัปเหร่อ (Gravedigger)', 'สัมภเวสี (Poltergeist)',
  'ไอทึ่ม (Idiot / Fool)',
];

export const indyRoles = [
  'คนขี้เมา (Drunk)', 'เจ้าลัทธิ (Cult Leader)', 'ซอมบี้ (Zombie)',
  'ท่านเคาต์แดรกคูล่า (Count Dracula)', 'นอสตราดามุส (Nostradamus)', 'นักเป่าขลุ่ย (Piper)',
  'บล็อบจอมเขมือบ (Serial Killer)', 'บิ๊กฟุต (Bigfoot)', 'ผู้ต้องคำสาป (Cursed)',
  'ผีดิบแฟรงค์เกนส์สไตน์ (Frankenstein\'s Monster)', 'ภูดจำแลง (Changeling)',
  'แมรี่กระหายเลือด (Bloody Mary)', 'ยาจก (Tanner / Jester)', 'ร่างโคลน (Doppelganger)',
  'อันธพาล (Hoodlum)',
];

export const vampireRoles = ['แวมไพร์ (Vampire)'];

export function getTeam(role: string): "wolf" | "village" | "indy" | "vampire" {
  if (wolfRoles.includes(role)) return "wolf";
  if (indyRoles.includes(role)) return "indy";
  if (vampireRoles.includes(role)) return "vampire";
  return "village";
}

// Maps a night step key (from orderOfNight / roleInstructions) to the roles that should wake up
export const stepToRoles: Record<string, string[]> = {
  WolfPack: wolfRoles,
  'บอดี้การ์ด_นักบวช': ['บอดี้การ์ด (Bodyguard)', 'นักบวช (Priest)'],
  'บล็อบจอมเขมือบ_แมรี่': ['บล็อบจอมเขมือบ (Serial Killer)', 'แมรี่กระหายเลือด (Bloody Mary)'],
  'หมอดู_นักสืบ': [
    'เทพพยากรณ์ (Seer)', 'ญาณทิพย์ (Aura Seer)',
    'เทพผู้รู้แจ้ง (Oracle)', 'นักสืบเรื่องลี้ลับ (Paranormal Investigator)',
  ],
};

// For individual role keys that map 1-to-1
const soloRoles = [
  'ร่างโคลน (Doppelganger)', 'กามเทพ (Cupid)', 'ภราดรแห่งเมสัน (Mason)',
  'ตาทิพย์ (Clairvoyant)', 'ท่านเคาต์ (Count)', 'อันธพาล (Hoodlum)',
  'นอสตราดามุส (Nostradamus)', 'สมุนหมาป่า (Minion)', 'แวมไพร์ (Vampire)',
  'เจ้าลัทธิ (Cult Leader)', 'นักเป่าขลุ่ย (Piper)', 'ซอมบี้ (Zombie)',
  'นางปีศาจ (Sorcerer)', 'แม่มด (Witch)', 'พรานหญิง (Huntress)',
  'นักสะกดจิต (Hypnotist)', 'จอมเวทย์ (Magician)', 'ผู้ใช้คาถา (Spellcaster)',
  'แม่หมอ (Old Hag)', 'ภูตเลปริคอน (Leprechaun)', 'คนอดนอน (Insomniac)',
];
soloRoles.forEach((r) => { stepToRoles[r] = [r]; });

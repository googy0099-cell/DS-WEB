import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dice-shop.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Tables 1–20
  for (let i = 1; i <= 20; i++) {
    await prisma.table.upsert({
      where: { number: i },
      update: {},
      create: { number: i },
    });
  }

  // Menu items
  const menuItems = [
    { nameTh: "ข้าวผัดกุ้ง", nameEn: "Shrimp Fried Rice", category: "food", priceTHB: 80 },
    { nameTh: "ข้าวผัดหมู", nameEn: "Pork Fried Rice", category: "food", priceTHB: 70 },
    { nameTh: "ผัดไทยกุ้ง", nameEn: "Pad Thai Shrimp", category: "food", priceTHB: 90 },
    { nameTh: "ข้าวมันไก่", nameEn: "Khao Man Gai", category: "food", priceTHB: 65 },
    { nameTh: "ราดหน้าหมู", nameEn: "Rad Na Pork", category: "food", priceTHB: 75 },
    { nameTh: "น้ำเปล่า", nameEn: "Water", category: "drink", priceTHB: 15 },
    { nameTh: "โค้ก / เป๊ปซี่", nameEn: "Coke / Pepsi", category: "drink", priceTHB: 30 },
    { nameTh: "ชาไทย", nameEn: "Thai Iced Tea", category: "drink", priceTHB: 40 },
    { nameTh: "กาแฟเย็น", nameEn: "Iced Coffee", category: "drink", priceTHB: 45 },
    { nameTh: "น้ำส้มคั้น", nameEn: "Fresh Orange Juice", category: "drink", priceTHB: 50 },
    { nameTh: "ชาเขียว", nameEn: "Green Tea", category: "drink", priceTHB: 35 },
    { nameTh: "เฟรนช์ฟรายส์", nameEn: "French Fries", category: "snack", priceTHB: 55 },
    { nameTh: "ไส้กรอกทอด", nameEn: "Fried Sausage", category: "snack", priceTHB: 60 },
    { nameTh: "ปอเปี๊ยะทอด", nameEn: "Spring Rolls", category: "snack", priceTHB: 65 },
    { nameTh: "ไอศกรีมวนิลา", nameEn: "Vanilla Ice Cream", category: "dessert", priceTHB: 45 },
    { nameTh: "วาฟเฟิลช็อคโกแลต", nameEn: "Chocolate Waffle", category: "dessert", priceTHB: 70 },
  ];

  for (let i = 0; i < menuItems.length; i++) {
    await prisma.menuItem.upsert({
      where: { id: i + 1 },
      update: {},
      create: menuItems[i],
    });
  }

  // Admin owner account
  const ownerPasswordHash = await bcrypt.hash("Password1234!", 12);
  await prisma.user.upsert({
    where: { email: "admin@diceshop.com" },
    update: {},
    create: {
      email: "admin@diceshop.com",
      passwordHash: ownerPasswordHash,
      firstName: "Admin",
      lastName: "DiceShop",
      username: "admin",
      memberCode: "ADM0",
      role: "OWNER",
    },
  });

  // Activities
  const activities = [
    {
      emoji: "🎭",
      title: "คืน Werewolf สุดมันส์",
      date: "ทุกวันศุกร์ เวลา 19:00 น.",
      tag: "เกม",
      desc: "เข้าร่วมเล่น Werewolf กับคนแปลกหน้า ฝึกทักษะการสังเกต การโกหก และการโน้มน้าวใจ",
      sortOrder: 1,
    },
    {
      emoji: "🏆",
      title: "Tournament บอร์ดเกมประจำเดือน",
      date: "ทุกสิ้นเดือน เวลา 18:00 น.",
      tag: "การแข่งขัน",
      desc: "แข่งขันบอร์ดเกมหลากหลายชื่อ ชิงของรางวัลและแต้มสะสมพิเศษ",
      sortOrder: 2,
    },
    {
      emoji: "☕",
      title: "Happy Hour เครื่องดื่ม",
      date: "ทุกวัน 15:00 – 17:00 น.",
      tag: "โปรโมชั่น",
      desc: "ซื้อเครื่องดื่ม 1 แก้ว แถมฟรีอีก 1 แก้ว ทุกรายการในช่วง Happy Hour",
      sortOrder: 3,
    },
    {
      emoji: "🎓",
      title: "เวิร์กชอปสอนเล่นเกม",
      date: "ทุกเสาร์ เวลา 15:00 น.",
      tag: "เวิร์กชอป",
      desc: "เรียนรู้วิธีเล่นบอร์ดเกมใหม่กับทีมงาน เหมาะสำหรับผู้เริ่มต้น",
      sortOrder: 4,
    },
  ];

  for (const act of activities) {
    await prisma.activity.create({ data: act }).catch(() => {});
  }

  // Game guides
  const games = [
    {
      nameTh: "คูป (Coup)",
      nameEn: "Coup",
      summaryTh:
        "เกมไพ่แบลฟ 3-6 คน แต่ละคนได้การ์ดบทบาท 2 ใบ (ลับ) ผลัดกันทำ Action เช่น เก็บเงิน, ลอบสังหาร, ท้าทาย ใครถูกกำจัดการ์ดหมดก่อนแพ้ คนสุดท้ายที่เหลือชนะ ใช้เวลา 15-30 นาที",
      minPlayers: 3,
      maxPlayers: 6,
      durationMin: 20,
      tags: JSON.stringify(["bluffing", "card", "quick"]),
      youtubeUrl: null,
    },
    {
      nameTh: "โคดเนมส์ (Codenames)",
      nameEn: "Codenames",
      summaryTh:
        "เกมทีม 4-8 คน แบ่ง 2 ทีม หัวหน้าทีมให้คำใบ้ 1 คำ + ตัวเลข ทีมต้องเดาไพ่สีตัวเองให้ถูกทุกใบก่อน ระวังไพ่สายลับฝั่งตรงข้ามและ Assassin ใช้เวลา 15-30 นาที",
      minPlayers: 4,
      maxPlayers: 8,
      durationMin: 25,
      tags: JSON.stringify(["word", "team", "family"]),
      youtubeUrl: null,
    },
    {
      nameTh: "ดิ๊กซิต (Dixit)",
      nameEn: "Dixit",
      summaryTh:
        "เกมศิลปะและจินตนาการ 3-6 คน ผู้เล่นผลัดกันเป็น Storyteller บอกคำใบ้จากการ์ดภาพสวยงาม คนอื่นเลือกการ์ดตัวเองที่คิดว่าตรง โหวตกัน ใช้เวลา 30 นาที",
      minPlayers: 3,
      maxPlayers: 6,
      durationMin: 30,
      tags: JSON.stringify(["creative", "family", "card"]),
      youtubeUrl: null,
    },
    {
      nameTh: "วันไนท์ (One Night Ultimate Werewolf)",
      nameEn: "One Night Ultimate Werewolf",
      summaryTh:
        "เกมหมาป่าแบบเล่นรอบเดียว 3-10 คน ทุกคนได้บทบาทกลางคืน 1 คืน จากนั้น 5 นาทีถกเถียงเพื่อโหวตว่าใครเป็นหมาป่า ไม่มีการตกรอบกลางเกม ใช้เวลา 15 นาที",
      minPlayers: 3,
      maxPlayers: 10,
      durationMin: 15,
      tags: JSON.stringify(["social deduction", "werewolf", "quick"]),
      youtubeUrl: null,
    },
    {
      nameTh: "ลัฟ เลตเตอร์ (Love Letter)",
      nameEn: "Love Letter",
      summaryTh:
        "เกมไพ่เล็กแต่ลึก 2-4 คน ไพ่ทั้งสำรับมี 16 ใบ 8 ประเภท แต่ละรอบถือได้แค่ 1 ใบ จั่วแล้วเลือกเล่น ใครถือไพ่สูงสุดหรือเหลือคนสุดท้ายชนะ ใช้เวลา 20 นาที",
      minPlayers: 2,
      maxPlayers: 4,
      durationMin: 20,
      tags: JSON.stringify(["card", "quick", "classic"]),
      youtubeUrl: null,
    },
  ];

  for (const game of games) {
    await prisma.gameGuide.create({ data: game }).catch(() => {});
  }

  console.log("✅ Seed เสร็จสมบูรณ์: 20 โต๊ะ, 16 เมนู, 5 คู่มือเกม, Admin OWNER, 4 กิจกรรม");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

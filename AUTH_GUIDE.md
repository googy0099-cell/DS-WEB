# คู่มือตั้งค่า Google OAuth สำหรับ Dice Shop

## ภาพรวม

ระบบรองรับการเข้าสู่ระบบผ่าน Google (สำหรับลูกค้า) โดยอีเมล `googy0099@gmail.com` จะได้รับสิทธิ์ OWNER โดยอัตโนมัติ

---

## ขั้นตอนที่ 1: สร้าง Google Cloud Project

1. ไปที่ [console.cloud.google.com](https://console.cloud.google.com)
2. คลิก **Select a project** → **New Project**
3. ตั้งชื่อ: `Dice Shop`
4. คลิก **Create**

---

## ขั้นตอนที่ 2: เปิดใช้ Google OAuth API

1. ไปที่ **APIs & Services** → **OAuth consent screen**
2. เลือก **External** → **Create**
3. กรอกข้อมูล:
   - App name: `Dice Shop`
   - User support email: อีเมลของคุณ
   - Developer contact: อีเมลของคุณ
4. คลิก **Save and Continue** ผ่านทุกขั้นตอน

---

## ขั้นตอนที่ 3: สร้าง OAuth Credentials

1. ไปที่ **APIs & Services** → **Credentials**
2. คลิก **+ Create Credentials** → **OAuth Client ID**
3. Application type: **Web application**
4. Name: `Dice Shop Web`
5. Authorized redirect URIs: เพิ่ม
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
6. คลิก **Create**
7. **คัดลอก Client ID และ Client Secret**

---

## ขั้นตอนที่ 4: อัปเดต `.env`

เปิดไฟล์ `.env` แล้วใส่ค่าที่ได้:

```env
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxx"
```

---

## ขั้นตอนที่ 5: ทดสอบ

1. รัน `npm run dev`
2. ไปที่ `/login`
3. คลิก **เข้าสู่ระบบด้วย Google**
4. เลือกบัญชี `googy0099@gmail.com`
5. ระบบจะสร้างบัญชี OWNER ให้อัตโนมัติ

---

## หมายเหตุ

- หากไม่ต้องการใช้ Google OAuth สามารถเข้าใช้งานด้วย:
  - Email: `admin@diceshop.com`
  - Password: `Password1234!`
- ปุ่ม Google ใน `/login` จะใช้งานไม่ได้จนกว่าจะกรอก `GOOGLE_CLIENT_ID` และ `GOOGLE_CLIENT_SECRET`

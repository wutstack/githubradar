# GitHub Radar

คลัง repo บน GitHub ที่เก็บไว้ ค้นด้วยคำที่จำได้ ไม่ต้องจำชื่อ

เว็บ: https://wutstack.github.io/githubradar/

## ติดตั้งครั้งแรก

1. สร้าง repo ชื่อ `githubradar` ใน account `wutstack` (Public)
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น branch `main` (รวมโฟลเดอร์ `.github`)
3. ไปที่ **Settings → Pages → Build and deployment → Source** เลือก **GitHub Actions**
4. ไปที่แท็บ **Actions** กด workflow **Build & deploy** → **Run workflow** (หรือรอ push ครั้งถัดไป)

ประมาณ 1 นาทีเว็บจะขึ้นที่ลิงก์ด้านบน

## เพิ่ม repo

แก้ `data/repos.json` เพิ่ม object แบบนี้:

```json
{
  "repo": "owner/name",
  "summary": "สรุปภาษาไทยหนึ่งประโยคว่าใช้ทำอะไร",
  "tags": ["AI", "Flutter"],
  "keywords": ["คำที่อาจใช้ค้น", "ทั้งไทย", "and english"],
  "note": "ทำไมถึงสนใจ (ไม่ใส่ก็ได้)",
  "added": "2026-11-11",
  "source": "ลิงก์โพสต์ Facebook ที่เจอ (ไม่ใส่ก็ได้)"
}
```

- `summary`, `keywords`, `note` คือสิ่งที่ช่องค้นหาใช้ ยิ่งเขียนคำที่ตัวเองจะนึกถึงตอนค้น ยิ่งหาเจอง่าย
- จำนวนดาว ภาษา และวันอัปเดตล่าสุด ไม่ต้องใส่เอง Action ดึงให้ทุกครั้งที่ push และทุกเช้า
- `added` กำหนดตำแหน่งบนเรดาร์ ยิ่งใหม่ยิ่งใกล้ศูนย์กลาง
- ถ้าไฟล์ผิดรูปแบบ (repo ซ้ำ, วันที่ผิด) Action จะ fail และบอกแถวที่ผิด

## ใช้งาน

- พิมพ์ `/` เพื่อไปที่ช่องค้นหา
- ลิงก์ค้นหาแชร์ได้ เช่น `?q=ocr`
- ปุ่ม "สุ่มขุดของเก่า" สุ่มจาก repo ที่เก็บไว้เกิน 60 วัน

## โครงสร้าง

```
index.html  style.css  app.js     หน้าเว็บ (static ล้วน)
data/repos.json                    ข้อมูลที่เขียนเอง
data/meta.json                     สร้างอัตโนมัติตอน deploy (ไม่ต้อง commit)
scripts/fetch-meta.mjs             ตรวจ repos.json + ดึงข้อมูลจาก GitHub API
.github/workflows/deploy.yml       build และ deploy ไป GitHub Pages
```

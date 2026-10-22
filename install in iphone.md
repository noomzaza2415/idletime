# ติดตั้งแอป Idle Time บน iPhone

> สถานะ ณ 2026-10-21: **โค้ดพร้อมแล้ว** เหลือขั้นที่ต้องใช้บัญชี Apple Developer
> แอป Android ที่ใช้งานอยู่ไม่ถูกแตะ ไม่ต้อง build APK ใหม่

---

## สิ่งที่ต้องเตรียมให้พรุ่งนี้

### ต้องมี (ขาดข้อไหนจะเริ่มไม่ได้)

- [ ] **1. บัญชี Apple Developer สถานะ Active**
  - หลังจ่ายเงิน Apple อาจใช้เวลาอนุมัติ 1–2 วัน ถ้าสมัครในนามบริษัท (ต้องมี D-U-N-S) อาจนานกว่านั้น
  - ดูสถานะที่ <https://developer.apple.com/account> → Membership details
- [ ] **2. Team ID** (ตัวอักษร 10 ตัว เช่น `A1B2C3D4E5`)
  - อยู่ที่ <https://developer.apple.com/account> → Membership details → Team ID
- [ ] **3. ไฟล์กุญแจแจ้งเตือน `AuthKey_XXXXXXXXXX.p8` พร้อม Key ID**
  - <https://developer.apple.com/account/resources/authkeys/list> → ปุ่ม **+**
  - ตั้งชื่อ เช่น `idletime-push` แล้วติ๊ก **Apple Push Notifications service (APNs)**
  - กด Configure → Environment เลือก **Sandbox & Production**
  - กด Continue → Register → **Download** (ดาวน์โหลดได้ครั้งเดียว ต้องเก็บสำรองไว้)
  - Key ID เป็นตัวอักษร 10 ตัว แสดงบนหน้านั้น และอยู่ในชื่อไฟล์ด้วย
- [ ] **4. iPhone ทดสอบ 1 เครื่องอยู่กับตัว**
  - ต่อ wifi โรงงานได้ และแจ้งรุ่น iOS มาด้วย (Settings → General → About)
  - ต้องอยู่ในมือ เพราะต้องเปิดลิงก์ลงทะเบียนเครื่อง และเปิด Developer Mode บนเครื่องนั้น
- [ ] **5. ช่วงเวลาที่อยู่หน้าเครื่องตอน build ครั้งแรก (ราว 10 นาที)**
  - EAS จะถาม Apple ID, รหัสผ่าน และรหัส 2FA ที่เด้งขึ้น iPhone หรือ Mac ของเจ้าของบัญชี
  - **ห้ามส่งรหัสผ่าน Apple ID มาทางแชท** ให้พิมพ์ลงเครื่องเอง
- [ ] **6. สิทธิ์เข้าเครื่อง 192.168.2.222** เพื่อวางไฟล์ `.p8`, แก้ `.env` และ deploy `.tar` ตัวใหม่

### ขอคำตอบ (มีค่า default ให้แล้ว ถ้าไม่ตอบจะใช้ค่านี้)

- [ ] **7. Bundle ID** ค่าตอนนี้คือ `com.noomzaza.idletime` (**เปลี่ยนไม่ได้หลังแจกแล้ว**)
- [ ] **8. ชื่อแอปบนหน้าจอ iPhone** ค่าตอนนี้คือ `idletime` จะเปลี่ยนเป็น `Idle Time` หรือชื่ออื่นไหม
- [ ] **9. จำนวน iPhone ของลีดเดอร์ทั้งหมด**
  - แบบ Ad Hoc ต้องลงทะเบียนเครื่องก่อน build เพิ่มเครื่องทีหลังต้อง build ใหม่หนึ่งรอบ
  - ถ้ารวบรวมเครื่องได้ครบพร้อมกันจะ build รอบเดียวจบ

### ไม่ต้องเตรียม

- `GoogleService-Info.plist` และการอัปโหลด `.p8` เข้า Firebase **ไม่ต้องทำ** เพราะ notify-server ส่งเข้า iPhone ผ่าน APNs ของ Apple โดยตรง
- Mac ไม่ต้องมี เพราะ build บน cloud ของ Expo (EAS) และบัญชี Expo `noomzaza` ล็อกอินไว้บนเครื่องนี้แล้ว

---

## สิ่งที่ทำเสร็จแล้ว

| ส่วน | สิ่งที่ทำ | ทดสอบแล้ว |
| --- | --- | --- |
| notify-server | เพิ่ม `src/apns.js` ส่งแจ้งเตือนเข้า iPhone ผ่าน APNs โดยตรง ส่วน Android ใช้ FCM เหมือนเดิม | เทสต์ 18/18 ผ่าน, ต่อ APNs ของ Apple จริงได้ (ด้วยกุญแจปลอม Apple ตอบ `InvalidProviderToken` ตามคาด และไม่ปิดเครื่องทิ้ง) |
| notify-server | ไม่ตั้งค่า APNs บริการก็เริ่มได้ Android ทำงานตามปกติ | ทดสอบทั้งแบบมีและไม่มีกุญแจ |
| notify-server | compose ทั้ง 3 ไฟล์ mount `./apns` แบบอ่านอย่างเดียว และเพิ่มค่า `APNS_*` ใน `.env.example` | container อ่านกุญแจได้ |
| notify-server | `idletime-notify.tar` ตัวใหม่ (ตัวที่ deploy เมื่อบ่ายเก็บไว้เป็น `idletime-notify-20261021.tar`) | — |
| แอป | `app.json` ส่วน `ios`: bundle ID, อนุญาตเครือข่ายโรงงาน (`http://192.168.x.x`), ข้อความขอสิทธิ์ Local Network ภาษาไทย, ไม่ต้องตอบคำถามเรื่องการเข้ารหัส | ตรวจผล Info.plist ด้วย `expo config --type introspect` แล้ว |
| เครื่องนี้ | ติดตั้ง EAS CLI 25.3.0 ล็อกอิน Expo `noomzaza` แล้ว | — |

ยังไม่ได้ทดสอบบน iPhone จริง เพราะต้องรอบัญชี Apple

---

## ขั้นตอนพรุ่งนี้ (เรียงตามลำดับ)

### ขั้นที่ 1 — deploy notify-server ตัวใหม่ (เครื่อง 222)

ทำก่อน build ได้เลย ถ้ายังไม่ใส่กุญแจ Android ก็ยังได้แจ้งเตือนตามปกติ

1. ก๊อป `notify-server/idletime-notify.tar` ตัวใหม่ไปทับไฟล์เดิมใน `D:\idletime\frontend\notify-server`
2. ก๊อป `docker-compose.deploy-share.yml` ตัวใหม่ไปทับด้วย (เพิ่มบรรทัด mount `./apns`)
3. สร้างโฟลเดอร์ `D:\idletime\frontend\notify-server\apns` แล้ววางไฟล์ `.p8` โดย **เปลี่ยนชื่อเป็น `AuthKey.p8`**
4. เปิด `.env` แล้วเติมบรรทัดเหล่านี้ต่อท้าย อย่าลบของเดิม

   ```sh
   APNS_KEY_ID=Key ID จากข้อ 3
   APNS_TEAM_ID=Team ID จากข้อ 2
   APNS_BUNDLE_ID=com.noomzaza.idletime
   APNS_PRODUCTION=true
   ```

5. โหลดแล้วเริ่มใหม่

   ```powershell
   cd D:\idletime\frontend\notify-server
   docker load -i idletime-notify.tar
   docker compose -f docker-compose.deploy-share.yml up -d
   docker compose -f docker-compose.deploy-share.yml logs --tail 20
   curl.exe http://localhost:8090/health
   ```

6. ตรวจว่า log มีบรรทัด `ส่งแจ้งเตือน iPhone ผ่าน APNs (production)` และ `/health` แสดง `"apns":{"enabled":true,"production":true}`
   - ถ้าเห็น `เปิดใช้ APNs ไม่ได้ อ่านกุญแจ...` ให้ตรวจชื่อไฟล์และตำแหน่งในข้อ 3

### ขั้นที่ 2 — ลงทะเบียน iPhone (บนเครื่องนี้)

```sh
eas device:create
```

- เลือก Apple Team แล้วเลือกแบบ **Website** จะได้ลิงก์และ QR
- เปิดลิงก์บน iPhone ด้วย Safari แล้วติดตั้ง profile ตามที่เครื่องบอก (Settings → General → VPN & Device Management)
- ทำซ้ำกับ iPhone ทุกเครื่องที่จะใช้ **ก่อน** ขั้นที่ 3

### ขั้นที่ 3 — build แอป (บนเครื่องนี้)

```sh
eas build -p ios --profile preview
```

- ครั้งแรก EAS จะถาม Apple ID, รหัสผ่าน และรหัส 2FA (ข้อ 5) แล้วสร้าง certificate กับ provisioning profile ให้เอง
- ถ้าถามว่า **ตั้งค่า Push Notifications ให้ไหม ตอบ No** เพราะเราใช้กุญแจของเราเองบน notify-server ไม่ได้ใช้บริการ push ของ Expo
- ใช้เวลา build บน cloud ราว 15–30 นาที เสร็จแล้วจะได้ลิงก์และ QR สำหรับติดตั้ง

### ขั้นที่ 4 — ติดตั้งบน iPhone

1. เปิดลิงก์จากขั้นที่ 3 บน iPhone ด้วย Safari แล้วกด Install
2. iOS 16 ขึ้นไปต้องเปิด **Developer Mode** ก่อน: Settings → Privacy & Security → Developer Mode → เปิด → เครื่อง restart → กด Turn On
3. เปิดแอปครั้งแรก ต้องกด **อนุญาต** ทั้งสองคำถาม
   - **เครือข่ายภายใน (Local Network)** ถ้าไม่อนุญาต แอปจะดึงข้อมูลไม่ได้เลย
   - **การแจ้งเตือน** ถ้าไม่อนุญาตจะไม่มีแจ้งเตือนเข้า

### ขั้นที่ 5 — ทดสอบก่อนแจก

- [ ] ต่อ wifi โรงงานแล้วล็อกอินและเห็นรายการ
- [ ] บนเครื่อง 222 รัน `curl.exe "http://localhost:8090/health?detail=1"` แล้ว `firestore.active` ต้องเพิ่มขึ้น 1
- [ ] มีรายการหยุดใหม่แล้วแจ้งเตือนเข้า ทั้งตอนเปิดแอปและตอนปิดแอป
- [ ] แตะแจ้งเตือนแล้วเปิดหน้ากรอกสาเหตุของรายการนั้น
- [ ] ถ่ายรูปและเลือกรูปจากคลังแล้วแนบได้
- [ ] กรอกสาเหตุและบันทึกได้
- [ ] ออกจากระบบแล้วไม่มีแจ้งเตือนเข้าเครื่องนั้นอีก
- [ ] Android ที่ใช้อยู่ยังได้แจ้งเตือนตามปกติ

---

## เพิ่ม iPhone ทีหลัง

1. `eas device:create` แล้วเปิดลิงก์บน iPhone เครื่องใหม่
2. `eas build -p ios --profile preview` อีกรอบ (EAS ถามว่าจะใส่เครื่องใหม่ใน provisioning profile ไหม ให้ตอบ Yes)
3. ส่งลิงก์ใหม่ให้**ทุกเครื่อง**ติดตั้งทับ (เครื่องเดิมยังใช้ตัวเก่าได้ แต่ควรใช้ build เดียวกัน)

ลงทะเบียนได้สูงสุด 100 iPhone ต่อปีต่อบัญชี

---

## ปัญหาที่อาจเจอ

ดู log บนเครื่อง 222 ด้วย `docker compose -f docker-compose.deploy-share.yml logs --tail 50` แล้วหาบรรทัด `APNs ส่งไม่สำเร็จ`

| อาการ / ข้อความใน log | สาเหตุ | แก้ |
| --- | --- | --- |
| `403 InvalidProviderToken` | Key ID, Team ID หรือไฟล์ `.p8` ไม่ตรงกัน | ตรวจ `APNS_KEY_ID`, `APNS_TEAM_ID` และไฟล์ `apns/AuthKey.p8` |
| `400 BadDeviceToken` ทุกเครื่อง | `APNS_PRODUCTION` ไม่ตรงกับแบบ build | build จาก profile `preview` ต้องเป็น `true` |
| `400 DeviceTokenNotForTopic` | `APNS_BUNDLE_ID` ไม่ตรงกับ `ios.bundleIdentifier` ใน `app.json` | แก้ให้ตรงกัน |
| `ข้าม iPhone N เครื่อง เพราะยังไม่ได้เปิดใช้ APNs` | ยังไม่ได้ตั้ง `APNS_KEY_ID` / `APNS_TEAM_ID` | ทำขั้นที่ 1 ข้อ 4 |
| แอปเปิดได้แต่ไม่มีรายการ / เชื่อมต่อไม่ได้ | ไม่ได้อนุญาต Local Network หรือไม่ได้ต่อ wifi โรงงาน | Settings → Privacy & Security → Local Network → เปิดให้ idletime |
| ติดตั้งไม่ได้ / แอปเปิดไม่ขึ้น | เครื่องไม่ได้ลงทะเบียนก่อน build หรือยังไม่เปิด Developer Mode | ทำขั้นที่ 2 แล้ว build ใหม่ หรือเปิด Developer Mode |

server จะไม่ปิดเครื่อง iPhone ทิ้งเพราะ error ที่เกิดจากการตั้งค่า (`BadDeviceToken`, `InvalidProviderToken`) แก้ค่าแล้วเริ่มบริการใหม่ เครื่องเดิมจะได้แจ้งเตือนต่อเลย
จะปิดทิ้งเฉพาะเมื่อ Apple ตอบ `410` ซึ่งแปลว่าเครื่องถอนแอปไปแล้ว

---

## สิ่งที่ต้องเก็บสำรอง

| ของ | ทำไม |
| --- | --- |
| บัญชี Apple Developer (อีเมล, รหัสผ่าน, อุปกรณ์รับ 2FA) | ใช้ทุกครั้งที่ build และต้องต่ออายุทุกปี ถ้าบัญชีหมดอายุ แอปที่แจกแบบ Ad Hoc จะเปิดไม่ได้ |
| ไฟล์ `.p8` + Key ID + Team ID | ดาวน์โหลดซ้ำไม่ได้ ถ้าหายต้องสร้างใหม่แล้วแก้ `.env` บนเครื่อง 222 |
| ตำแหน่งไฟล์บนเครื่อง 222: `D:\idletime\frontend\notify-server\apns\AuthKey.p8` | ถ้าย้ายเครื่องต้องก๊อปไปด้วย |

## ทางเลือกอื่นที่ไม่ได้เลือก

- **ลง Firebase SDK ในแอป (`@react-native-firebase/messaging`)** ไม่เลือก เพราะเป็น native module ที่ต้อง build Android ใหม่ และชนกับตัวรับ FCM ของ `expo-notifications` บน Android ได้
- **บริการ push ของ Expo** ไม่เลือก เพราะเพิ่มบริการภายนอกที่ข้อความแจ้งเตือน (ชื่อไลน์, WO) ต้องผ่าน และต้องแก้ทั้งแอปและ server
- **TestFlight** ใช้ได้ถ้าภายหลังมี iPhone เกิน 100 เครื่องหรืออยากอัปเดตง่ายขึ้น แต่แต่ละ build ใช้ได้ 90 วัน

# AI_CHANGELOG.md

> Append-only · entry ใหม่อยู่บนสุด · Grep ด้วยชื่อ Feature/ไฟล์ ไม่ต้องอ่านทั้งไฟล์
> เมื่อเกิน 50 entry ให้ย้ายของเก่าไป `AI_CHANGELOG_ARCHIVE.md` และสรุปการตัดสินใจที่ยังมีผลไว้ใน "Active Decisions"
> ประวัติ commit ดูจาก `git log` ไม่ต้องคัดลอกมา

Format:

```text
## YYYY-MM-DD — <Feature / Area>

- Change: <แก้อะไร>
- Files: <ไฟล์ที่แก้>
- Reason: <ทำไม>
- Do-not-revert: <สิ่งที่ห้ามย้อนกลับ ถ้ามี>
```

## Active Decisions

- **Idle Rules**: `BREAK_RULES`/`getBreakRuleType` ต้องเหมือนเว็บ dashboard ทุกค่า เงื่อนไขคือ `durationMins >= rule.minDuration` (หยุดนานในช่วงพักจึงถูกซ่อน) — ผู้ใช้เคยสั่งกลับทิศแล้วย้อนคืนสองครั้ง ต้องยืนยันด้วยตัวอย่างก่อนแก้ทุกครั้ง — `src/api/idle-rules.ts`, `notify-server/src/idle-rules.js`
- **Record Edit Form**: `SHOW_BUTTON` เป็นเคสกำกวม ให้พนักงานเลือก Break Time / No Break เองเหมือนเว็บ — `src/app/(app)/record/[id].tsx`
- **Backend**: backend หลัก (`192.168.2.5`) เป็นของทีมอื่น ห้ามเสนอวิธีที่ต้องแก้ backend
- **Network**: ใช้งานเฉพาะ wifi โรงงาน ไม่เปิด server ออกอินเทอร์เน็ต/port forward
- **Deploy**: รูปเก็บที่เครื่อง `192.168.2.188` (โฟลเดอร์แชร์) notify-server รันที่ `192.168.2.222` — `notify-server/docker-compose.deploy-share.yml`
- **Dev loop**: ระหว่างพัฒนาใช้ Metro + debug build, build release เฉพาะตอนแจก APK — `RELEASE.md`
- **Error messages**: ชั้น network/service โยน `AppError` (รหัส + endpoint + ข้อความ server) หน้าจอแสดงผ่าน `showErrorAlert(title, e, t)` (มีปุ่มคัดลอก) หรือ `describeError(e, t)` เท่านั้น ห้ามแสดง `e.message` ดิบ — `src/api/app-error.ts`, `src/components/error-alert.ts`

## 2026-10-22 — Photo Upload: second photo missing until reopen

- Change: `uploadRecordPhoto` คืนรูปทั้งหมดที่ server ตอบกลับ (เดิมหยิบ `photos[0]`) และ `markSaved` รวมทุกใบ; `reconcileUploader` ล้างรูปใน `saved` ที่ server ไม่มีแล้ว (เฉพาะใบที่รู้ว่าอยู่บน server ก่อนเริ่มขอรายการ)
- Files: `src/api/photo-store.ts`, `src/api/photo-uploader.ts`, `src/hooks/use-record-photos.ts`
- Reason: server ตอบรายการเต็มเรียงเก่า→ใหม่ ส่งใบที่สองแล้วได้ใบแรกซ้ำ จอเห็นรูปเดียวจนเปิดหน้าใหม่ / รูปที่ถูกลบจากเครื่องอื่นค้างบนจอจนปิดแอป
- Do-not-revert: ห้ามกลับไปหยิบรูปใบเดียวจากผลอัปโหลด — ทดสอบบน emulator แล้ว (ถ่าย 2 รูปไม่กดบันทึก เห็น 2/2 และดูเต็มจอได้ 2 / 2)

## 2026-10-22 — Release 1.1.0

- Change: ขึ้นเวอร์ชัน 1.1.0 (android versionCode 2, ios buildNumber 2); `npx expo install --fix` อัปเดตแพ็กเกจ Expo ให้ตรง SDK 57 (รุ่นย่อยเท่านั้น RN ไม่เปลี่ยน) และเพิ่ม config plugin `expo-image`, `expo-web-browser` ใน app.json
- Files: `app.json`, `package.json`, `package-lock.json`, `RELEASE.md`
- Reason: แจก APK รอบใหม่ที่มีงานทั้งหมดของวันนี้
- Do-not-revert: `runtimeVersion` ใช้ policy `appVersion` — OTA update ที่ publish ให้ 1.0.0 จะไม่ลงเครื่อง 1.1.0 (ตั้งใจ เพราะมี native module ใหม่)

## 2026-10-22 — Error Messages

- Change: เพิ่ม `AppError` + `describeError` แสดง error เป็น "เนื่องจาก <สาเหตุ> / <ต้องทำอะไร> / ข้อมูลสำหรับแจ้ง IT (รหัส, ปลายทาง, ข้อความ server, เวลา)" ใช้ทุกจุด: โหลดรายการ, โหลดรายการเดียว, บันทึก, ลบรูป, เข้าสู่ระบบ
- Files: `src/api/app-error.ts`, `src/api/http.ts`, `src/api/idle-time-service.ts`, `src/api/photo-store.ts`, `src/constants/i18n.ts` (`err*`), `src/app/(app)/index.tsx`, `src/app/(app)/record/[id].tsx`, `src/app/sign-in.tsx`
- Reason: เจ้าของโปรเจกต์ต้องการอ่านแล้วรู้ว่าพังเพราะอะไร เพื่อแก้ได้เร็ว เดิมแสดงข้อความดิบเช่น `API error 500: ...`
- Do-not-revert: `PhotoUploadError` (อัปโหลดรูปเบื้องหลัง) ยังแยกต่างหาก เพราะมีธง retry/rejected ที่ตัวส่งรูปใช้ตัดสินใจ
- Follow-up: เพิ่มปุ่ม "คัดลอก" ในกล่อง error และแตะแถบ error หน้ารายการเพื่อคัดลอก ใช้ `expo-clipboard` (native module ใหม่ — APK ที่แจกไปแล้วต้อง build ใหม่)

## 2026-10-22 — App Icon / Splash / Logo

- Change: ใช้ `assets/images/logo-idletime.png` (คือ `logo.jpg` ที่สลับตัว e/l ให้สะกด "idletime" ถูก) เป็นต้นฉบับของโลโก้หน้า sign-in, ไอคอนแอป (iOS + Android adaptive/monochrome) และ splash; พื้น splash เปลี่ยนจาก `#208AEF` เป็น `#FFFFFF`, `imageWidth` 76 → 190
- Files: `src/constants/logo.ts`, `assets/images/icon.png`, `assets/images/android-icon-foreground.png`, `assets/images/android-icon-background.png`, `assets/images/android-icon-monochrome.png`, `assets/images/splash-icon.png`, `app.json`
- Reason: เจ้าของโปรเจกต์สั่งให้ใช้โลโก้ใหม่ทั้งก่อนและหลังเปิดแอป; `logo.jpg` มีพื้นขาว จึงใช้พื้นขาวทั้ง adaptive icon และ splash
- Do-not-revert: เนื้อโลโก้ใน foreground ต้องอยู่ใน safe zone (รัศมี ≤ ~313px ที่ 1024) และใน splash ต้องอยู่ในวงกลม 192dp ไม่งั้น Android ตัดตัวอักษร · เปลี่ยน icon/splash แล้วต้อง `npx expo prebuild --platform android` (ล้าง `android/` ทั้งโฟลเดอร์) ก่อน build

## 2026-10-22 — AI Context System

- Change: จัดระบบ context ใหม่เป็น 3 ไฟล์ตามแม่แบบ (กฎ / แผนที่ไฟล์ / changelog) และเพิ่มบรรทัดชี้ไฟล์ใน `AGENTS.md`
- Files: `AI_CONTEXT.md`, `AI_INDEX.md`, `AI_CHANGELOG.md`, `AGENTS.md`
- Reason: ลดการอ่านไฟล์ที่ไม่จำเป็นและลดการแก้ผิดไฟล์
- Do-not-revert: —

## 2026-10-21 — Push Notifications (iPhone)

- Change: notify-server ส่งไป iPhone ผ่าน APNs ตรง แยกเครื่องตาม `platform`; ปิด token iPhone เฉพาะเมื่อ Apple ตอบ 410
- Files: `notify-server/src/apns.js`, `notify-server/src/server.js`, `app.json` (`ios`), `install in iphone.md`
- Reason: ไม่ต้องลง `@react-native-firebase/messaging` ซึ่งจะแตะ native Android และชนกับ `expo-notifications`
- Do-not-revert: ห้ามเปลี่ยนไปใช้ Firebase messaging ฝั่งแอป

## 2026-10-21 — Push Notifications (App)

- Change: เอาสวิตช์ปิดแจ้งเตือนออกจากเมนู แจ้งเตือนเปิดเสมอระหว่างล็อกอิน (ยังปิดที่ต้นทางตอน logout); เครื่องที่เคยปิดจะกลับมาเปิดเมื่อเปิดแอป
- Files: `src/app/(app)/_layout.tsx`, `src/hooks/use-new-record-alert.ts`, `src/api/notification-preference.ts`
- Reason: เจ้าของโปรเจกต์สั่ง
- Do-not-revert: ห้ามเพิ่มสวิตช์ปิดแจ้งเตือนกลับมาโดยไม่ได้รับคำสั่ง

## 2026-10-21 — Idle Rules (Threshold)

- Change: ลดเกณฑ์ขั้นต่ำจาก 2 เป็น 1 นาที (หยุด **เกิน** 1 นาทีจึงแสดงและแจ้งเตือน, 1.00 พอดีไม่นับ)
- Files: `src/api/idle-rules.ts` (`MIN_VISIBLE_MINS`), `notify-server/src/idle-rules.js` (`MIN_NOTIFY_MINS`)
- Reason: เจ้าของโปรเจกต์สั่ง
- Do-not-revert: สองค่านี้ต้องเท่ากันเสมอ

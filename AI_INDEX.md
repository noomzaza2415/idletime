# AI_INDEX.md

แผนที่ Feature → ไฟล์ · Grep ด้วย Keyword แล้วอ่านเฉพาะหัวข้อที่ตรง · กฎอยู่ใน `AI_CONTEXT.md`

## App Shell / Navigation

- Keywords: layout, provider, header, เมนู, route, นำทาง, หน้าหลัก
- Entry: `src/app/_layout.tsx`
- Files: `src/app/_layout.tsx` → ครอบ `AuthProvider`/`LanguageProvider`/`ThemeProvider` · `src/app/(app)/_layout.tsx` → header, เมนู, ออกจากระบบ, กันหน้าที่ต้องล็อกอิน
- Types: —
- Tests: —

## Sign-in / Auth

- Keywords: login, ล็อกอิน, เข้าสู่ระบบ, logout, ออกจากระบบ, token, session
- Entry: `src/app/sign-in.tsx`
- Files: `src/app/sign-in.tsx` → ฟอร์มล็อกอิน (การ์ดโปร่งแสงให้ลายน้ำทะลุ) · `src/components/logo-watermark.tsx` → ลายน้ำโลโก้ทุกหน้า วางครั้งเดียวที่ `src/app/_layout.tsx` ทับเนื้อหา (ไฟล์ `assets/images/dongjin-watermark.png` แปลงพื้นขาวของ `public/icons/โลโก้ดองจิน (1).jpg` เป็นโปร่งใส; ขนาด `WATERMARK_SCALE` × ด้านสั้นของจอ คิดเป็นพิกเซลเพราะ width % เกิน 100 ถูกจำกัด; โหมดมืดย้อมขาวเพราะสีน้ำเงินกลืนพื้น) · `src/context/auth-context.tsx` → state + AsyncStorage · `src/api/idle-time-service.ts` → `login` · `src/api/config.ts` → `AUTH_BASE_URL`, `AUTH_ENDPOINTS`, `USE_MOCK_AUTH`
- Types: `AuthLoginResult`, `AuthEnvelope` (`src/types/index.ts`)
- Tests: —

## Shift Record List

- Keywords: รายการ, list, กะ, shift, ไลน์หยุด, idle time, วันที่, รีเฟรช, Work Order, WO, Model, ค้นหา, search, แท็บไลน์
- Entry: `src/app/(app)/index.tsx`
- Files: `src/app/(app)/index.tsx` → เลือกวัน/ไลน์, ตัวกรอง ทั้งหมด/ระบุแล้ว/รอระบุ, ค้นหา, จัดกลุ่ม, แถวรายการ (`RecordRow`/`GroupRow`/`TimeBlock`) · `src/api/idle-time-service.ts` → `fetchShiftData`, `fetchRecords`, `selectVisible` · `src/components/line-picker.tsx` → dropdown เลือกไลน์ + `OptionSheet` · `src/components/icons.tsx` → ไอคอน Lucide ของแถบวัน/ไลน์ · `src/components/search-field.tsx` → ช่องค้นหา · `src/components/month-calendar.tsx` → เลือกวัน · `src/api/config.ts` → `toCdEquip`
- Types: `IdleTimeRecord`, `ApiIdleTimeRecord`, `ApiEnvelope`
- Tests: —

## Idle Rules (Break / Threshold / Shift Time)

- Keywords: ช่วงพัก, break, เบรก, ซ่อน, HIDDEN, SHOW_BUTTON, นาทีขั้นต่ำ, MIN_VISIBLE_MINS, MIN_NOTIFY_MINS, เวลากะ, 08:00
- Entry: `src/api/idle-rules.ts`
- Files: `src/api/idle-rules.ts` → `BREAK_RULES`, `getBreakRuleType`, `getShiftWindow`, จัดรูปแบบวันเวลา · `notify-server/src/idle-rules.js` → สำเนาฝั่ง server (ต้องตรงกัน)
- Types: `BreakRuleType`
- Tests: `notify-server/test/idle-rules-sync.test.js`

## Record Edit Form

- Keywords: กรอกสาเหตุ, แก้รายการ, ฟอร์ม, บันทึก, save, conflict, ร่าง, draft, Break Time, No Break, ค่าแรง, labour cost
- Entry: `src/app/(app)/record/[id].tsx`
- Files: `src/app/(app)/record/[id].tsx` → ฟอร์มทั้งหมด · `src/api/idle-time-service.ts` → `updateRecord`, `fetchRecordById`, `diffEditable`, `EDITABLE_KEYS`, `RecordConflictError`, `computeLabourCost` · `src/api/record-draft.ts` → ร่างฟอร์ม + pending photo marker
- Types: `IdleTimeRecord`, `EditableKey`, `IDLE_ISSUE_OPTIONS`, `TYPE_OPTIONS`, `JUDGE_OPTIONS`, `DEPT_OPTIONS`, `VENDOR_OPTIONS`, `BREAK_TIME_VALUE`
- Tests: `notify-server/test/idle-rules-sync.test.js` (ตรวจปุ่ม `SHOW_BUTTON` ในหน้านี้)

## Record Edit Lock (กำลังกรอกอยู่)

- Keywords: ล็อก, lock, presence, มีคนกำลังกรอก, กรอกพร้อมกัน, ดูอย่างเดียว
- Entry: `src/hooks/use-record-lock.ts`
- Files: `src/hooks/use-record-lock.ts` → จอง/ต่ออายุ/ปล่อยล็อกในหน้ากรอก · `src/api/presence.ts` → เรียก notify-server, `getDeviceId` · `src/app/(app)/record/[id].tsx` → ป้ายเหลือง + ฟอร์มล็อก · `src/app/(app)/index.tsx` → ป้าย "กำลังกรอก" บนแถว (`EditingLabel`, poll 15 วิเฉพาะตอนหน้าอยู่บนจอ) · `notify-server/src/presence.js` → `PresenceStore` (ในหน่วยความจำ, TTL 90 วิ) · `notify-server/src/server.js` → route `/api/v1/Presence` + WebSocket `/api/v1/Presence/ws` (`subscribePresence` ใน `src/api/presence.ts`)
- Tests: `notify-server/test/presence.test.js`

## Photo Attachments

- Keywords: รูป, photo, แนบรูป, ถ่ายรูป, กล้อง, upload, อัปโหลด, คิว, queue, ลบรูป, ดูรูป
- Entry: `src/components/photo-upload-card.tsx`
- Files: `src/components/photo-upload-card.tsx` → UI เลือก/แสดง/ลบ · `src/components/photo-viewer.tsx` → ดูเต็มจอ · `src/hooks/use-record-photos.ts` → รวมรูปจาก server + คิว · `src/api/photo-uploader.ts` → ตัวส่งระดับแอป · `src/api/photo-queue.ts` → คิวไฟล์ในเครื่อง · `src/api/photo-queue-files.ts` / `.web.ts` → ที่เก็บไฟล์ในคิว (มือถือ: document dir, เว็บ: data URL) · `src/api/photo-store.ts` → ย่อรูป, เรียก API รูป · `notify-server/src/photo-routes.js` → route `/api/v1/IdleTime/Photos` · `notify-server/src/photo-store.js` → เก็บไฟล์, จำกัดจำนวน/ขนาด
- Types: `RecordPhoto`, `PickedPhoto`, `QueuedPhoto`, `UploaderState`, `PhotoListStatus`, `PhotoTarget`
- Tests: `notify-server/test/photo-store.test.js`

## Line Status Timeline

- Keywords: timeline, ไทม์ไลน์, สถานะไลน์, กราฟ, เต็มจอ, fullscreen, zoom
- Entry: `src/components/line-status-timeline.tsx`
- Files: `src/api/line-timeline.ts` → `buildLineTimeline`, `viewTimeline`, `rangeLimit` · `src/components/line-status-timeline.tsx` → แสดงในหน้ารายการ · `src/components/line-status-fullscreen.tsx` → เต็มจอ + pinch zoom
- Types: `TimelineEvent`, `LineTimeline`, `TimelineSegment`, `TimelineView`, `SegmentKind`, `RangeHours`
- Tests: —

## Push Notifications (App)

- Keywords: แจ้งเตือน, notification, push, token, ลงทะเบียนเครื่อง, register device, แบนเนอร์ข้อมูลใหม่, new data, poll
- Entry: `src/hooks/use-new-record-alert.ts`
- Files: `src/hooks/use-new-record-alert.ts` → ขอ token, ลงทะเบียน, poll 30 วินาที, เปิดรายการจากแจ้งเตือน · `src/api/push-notifications.ts` → permission + token · `src/api/register-device.ts` → ลงทะเบียน/ยกเลิกที่ notify-server · `src/api/firestore-device.ts` → บันทึก token ลง Firestore · `src/api/notification-preference.ts` → ปิดต้นทางตอน logout + retry · `src/components/new-data-banner.tsx` → แบนเนอร์
- Types: `NotificationTarget`
- Tests: —

## Notify Server

- Keywords: server, notify-server, watcher, FCM, APNs, iPhone, Android, docker, deploy, health, env
- Entry: `notify-server/src/server.js`
- Files: `notify-server/src/server.js` → env, route `/health`, `RegisterDevice`, `UnregisterDevice`, `Notify` · `notify-server/src/watcher.js` → poll API เลือกรายการที่ต้องแจ้ง · `notify-server/src/fcm.js` → ส่ง Android · `notify-server/src/apns.js` → ส่ง iPhone, `splitDevices` · `notify-server/src/store.js` → token ในไฟล์ JSON · `notify-server/src/firestore-store.js` → token จาก Firestore · `notify-server/.env.example` → รายการ env · `notify-server/Dockerfile`, `notify-server/docker-compose.yml`, `notify-server/docker-compose.deploy.yml`, `notify-server/docker-compose.deploy-share.yml` → deploy · `notify-server/DEPLOY.md`, `notify-server/README.md` → คู่มือ · `notify-server/firestore.rules` → สิทธิ์ Firestore
- Types: — (JavaScript)
- Tests: `notify-server/test/watcher.test.js`, `notify-server/test/apns.test.js`

## Language / Theme

- Keywords: ภาษา, language, TH, EN, KR, เกาหลี, แปล, i18n, ธีม, theme, dark mode, โหมดมืด, สี
- Entry: `src/context/language-context.tsx`, `src/context/theme-context.tsx`
- Files: `src/constants/i18n.ts` → ข้อความ `th`/`en`/`ko`, `LANGUAGES`, `LANGUAGE_NAME` · `src/context/language-context.tsx` → `useT` · `src/components/language-button.tsx` → เปิดแผ่นเลือกภาษา · `src/components/line-picker.tsx` → `OptionSheet` (แผ่นตัวเลือกที่ใช้ร่วมกัน) · `src/constants/theme.ts` → `PALETTES`, `spacing`, `radius`, `font`, `elevation` · `src/context/theme-context.tsx` → `useColors` · `src/components/theme-button.tsx`
- Types: `Language`, `TranslationKey`, `ThemeMode`, `ThemeColors`
- Tests: —

## Build / Release

- Keywords: build, release, APK, signing, iOS, iPhone install, EAS, gradle
- Entry: `RELEASE.md`
- Files: `app.json` → config แอป, permission, plugin · `eas.json` → profile · `plugins/withReleaseSigning.js` → sign release · `plugins/withGradleDaemonJvm.js` → Gradle JVM · `RELEASE.md` → ขั้นตอน APK · `install in iphone.md` → ขั้นตอน iPhone
- Types: —
- Tests: —

## Shared

- `src/api/http.ts` → `fetchWithTimeout`, `fetchRead`, ข้อความ timeout/offline
- `src/api/config.ts` → URL, endpoint, mock flag, `toCdEquip`
- `src/api/mock-data.ts` → `MOCK_RECORDS` ใช้เมื่อ `USE_MOCK_DATA`
- `src/types/index.ts` → record contract + ตัวเลือก dropdown
- `src/api/idle-rules.ts` → วันที่/เวลา/กะ ที่ทุกส่วนใช้
- `src/constants/i18n.ts`, `src/constants/theme.ts` → ข้อความ, สี, ขนาด
- `src/components/soft-blob.tsx` → พื้นหลังตกแต่ง · `src/constants/logo.ts` → โลโก้ data URI (ไม่ต้องอ่าน)
- `src/global.css` → stylesheet ระดับแอป

## Where to Add New Code

| ถ้าจะเพิ่ม | ไปที่ |
| --- | --- |
| หน้าจอใหม่ที่ต้องล็อกอิน | `src/app/(app)/` |
| ชิ้นส่วน UI ใช้ซ้ำ | `src/components/` (kebab-case, default export) |
| hook ผูก service กับหน้าจอ | `src/hooks/use-*.ts` |
| เรียก API ใหม่ | `src/api/` + endpoint ใน `src/api/config.ts` ผ่าน `src/api/http.ts` |
| กติกาธุรกิจ pure | `src/api/idle-rules.ts` (ถ้า server ใช้ด้วย → สำเนา `notify-server/src/idle-rules.js`) |
| เก็บข้อมูลในเครื่อง | `src/api/` แบบเดียวกับ `record-draft.ts` / `photo-queue.ts` |
| state ข้ามหน้าจอ | `src/context/` |
| ข้อความใหม่ | `src/constants/i18n.ts` (ทั้ง `th`, `en`, `ko`) |
| สี/ระยะ | `src/constants/theme.ts` |
| field / ตัวเลือก dropdown | `src/types/index.ts` |
| route/ส่วนใหม่ของ server | `notify-server/src/` + ต่อใน `server.js` |
| env ใหม่ของ server | `notify-server/src/server.js` + `notify-server/.env.example` |
| test ของ server | `notify-server/test/*.test.js` |

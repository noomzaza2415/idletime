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

## 2026-11-10 — List Screen Polish (Gradient Header, Tabs, Sort)

- Change: หัวจอ (app) ไล่สีน้ำเงิน `headerGradStart/End` ตัวอักษร/ปุ่มขาว (`ThemeButton/LanguageButton onDark`, StatusBar light); กลุ่มวันที่เป็นการ์ดลอย; การ์ดสถานะไลน์และแท็บกรองใช้เงาบางแทนเส้นขอบ; แท็บที่เลือกพื้นน้ำเงินทึบ แต่ละแท็บมีไอคอน (chart-column / circle-check / circle-x); ปุ่มเรียงลำดับข้างช่องค้นหา (ล่าสุดก่อน / เก่าสุดก่อน / หยุดนานสุดก่อน / รอระบุก่อน)
- Files: `src/app/(app)/_layout.tsx`, `src/app/(app)/index.tsx`, `src/components/theme-button.tsx`, `src/components/language-button.tsx`, `src/components/line-status-timeline.tsx`, `src/components/icons.tsx`, `src/constants/theme.ts`, `src/constants/i18n.ts`
- Reason: ผู้ใช้ส่งภาพตัวอย่างดีไซน์ใหม่
- Do-not-revert: แถวรายการคงแบบแถวเต็มจอ (ผู้ใช้เลือก ไม่เอาการ์ด); หน่วยคงเป็น "นาที" ไม่ใช่ "บาท/ชิ้น" ตามภาพตัวอย่าง เพราะค่าคือนาทีที่หยุด; ปุ่มข้างค้นหาเป็นเรียงลำดับ ไม่ใช่ตัวกรอง (ผู้ใช้เลือก)

## 2026-11-10 — Group Header Contrast

- Change: หัวกลุ่ม Work Order ตอนกางใช้ `groupHeaderBg` (ฟ้า #DBEAFE) + เส้นน้ำเงินใต้หัว 2px; รายการย่อยใช้ `groupChildBg` (เทา #F1F5F9)
- Files: `src/constants/theme.ts`, `src/app/(app)/index.tsx`
- Reason: ผู้ใช้บอกสีจางจนแยกหัวกลุ่มกับรายการย่อยไม่ออก

## 2026-11-10 — Fullscreen Timeline Redesign

- Change: หน้ากราฟเต็มจอสไตล์ Modern Industrial + iOS: พื้นขาวนวล `#F8FAFC`, การ์ดไม่มีเส้นขอบใช้เงานุ่ม (`softCard`), การ์ดสรุปมีไอคอนในวงสี (circle-play / circle-stop / coffee) + แถบสีด้านบน + ตัวเลข 42; ปุ่มเลือกไลน์พื้นทึบสีหลัก (`LinePicker prominent`); ปุ่มช่วงเวลา/ซูมเป็น segmented แบบ iOS (รางเทา เม็ดขาวมีเงา); ปุ่มปิดวงกลม; คำอธิบายสีใต้กราฟ พร้อมหมายเหตุช่องหยุด (ย้ายจากหัวการ์ด)
- Files: `src/components/line-status-fullscreen.tsx`, `src/components/line-picker.tsx`, `src/components/icons.tsx`
- Reason: ผู้ใช้ขอออกแบบใหม่
- Do-not-revert: ใช้ `boxShadow` ไม่ใช้ `shadow*`/`elevation` เพราะบน Android วาดเป็นกรอบเทาเหลี่ยมรอบการ์ดมุมมน; โหมดมืดใช้เส้นขอบบางแทนเงาเพราะเงามองไม่เห็นบนพื้นเข้ม

## 2026-11-10 — Top Bar Lucide Icons

- Change: แถบวัน/ไลน์ใช้ไอคอน Lucide แทนตัวอักษร ◀ ▶ ▼: chevron-left/right (เปลี่ยนวัน), calendar-days (หน้าวันที่), calendar-check (กะวันนี้ / ปุ่มกลับมาวันนี้), factory + chevron-down (dropdown ไลน์ รวมในหน้าเต็มจอ); สีไอคอนตามโทนที่ผู้ใช้แนะนำ `iconBlue` #2563EB, `iconGreen` #16A34A, `iconGray` #64748B
- Files: `src/components/icons.tsx` (ใหม่), `src/constants/theme.ts`, `src/app/(app)/index.tsx`, `src/components/line-picker.tsx`
- Reason: ผู้ใช้กำหนดไอคอนและโทนสี

## 2026-11-10 — Fullscreen Landscape Bar Height

- Change: กราฟเต็มจอแนวนอน แถบสูงคงที่ `LANDSCAPE_BAR_HEIGHT` (150 รวมแถวป้ายเวลา) แทนการยืดเต็มความสูงที่เหลือ
- Files: `src/components/line-status-fullscreen.tsx`
- Reason: ผู้ใช้บอกแถบสูงเกินดูไม่สวย
- Do-not-revert: แนวตั้งยังใช้กล่องสูง 280 เหมือนเดิม

## 2026-11-10 — Vivid Break Yellow

- Change: โหมดสว่าง `statusBreakFill` → `#FBBF24`, `breakAccent` → `#EAB308` (แถบซ้าย ตัวเลขนาที และตัวอักษร "ช่วงพัก" เป็นเหลืองสด ไม่มีพื้น); ป้ายสถานะเครื่อง BREAK มีพื้นเหลือง (`machineBreak*`) แบบเดียวกับ RUNNING
- Files: `src/constants/theme.ts`, `src/components/machine-status-badge.tsx`, `src/app/(app)/index.tsx`
- Reason: ผู้ใช้ขอ สีเดิมอมน้ำตาล
- Do-not-revert: ป้าย "ช่วงพัก" ในแถวไม่มีพื้น (ผู้ใช้กำหนด); สี BREAK ของป้ายสถานะไม่มีในเว็บ เพิ่มเองในแอป

## 2026-11-10 — Watermark On Every Screen

- Change: ลายน้ำโลโก้ย้ายไปวางที่ `src/app/_layout.tsx` จุดเดียว ทับทุกหน้า (login, รายการ, กรอก) เล็กลง (1.3 เท่าด้านสั้นของจอ) และจางลง (สว่าง 4.5%, มืด 3.5% ย้อมขาว)
- Files: `src/app/_layout.tsx`, `src/components/logo-watermark.tsx`, `src/app/sign-in.tsx`, `src/app/(app)/index.tsx`
- Reason: ผู้ใช้ขอให้ทุกหน้ามีลายน้ำ เล็กลงและจางลง
- Do-not-revert: วางทับเนื้อหา ไม่ใช่หลัง เพราะแถวรายการ/การ์ดพื้นทึบ; ต้อง `pointerEvents="none"` ไม่งั้นแตะอะไรไม่ได้ทั้งแอป; อย่าเพิ่มลายน้ำซ้ำในแต่ละหน้า

## 2026-11-10 — Realtime Edit Lock (WebSocket)

- Change: notify-server มีท่อ WebSocket `/api/v1/Presence/ws` (แพ็กเกจ `ws`) ส่งรายการล็อกของวันนั้นทุกครั้งที่ผู้ถือล็อกเปลี่ยน (จอง/ปล่อย/หมดอายุ) ล้างล็อกหมดอายุทุก 5 วินาที ping ท่อทุก 30 วินาที; แอปใช้ `subscribePresence` ในหน้ารายการ (ป้ายขึ้น/หายภายในไม่ถึงวินาที) และในหน้ากรอกที่ถูกล็อก (จองทันทีเมื่ออีกคนออก)
- Files: `notify-server/src/presence.js`, `notify-server/src/server.js`, `notify-server/package.json`, `notify-server/test/presence.test.js`, `src/api/presence.ts`, `src/app/(app)/index.tsx`, `src/hooks/use-record-lock.ts`
- Reason: ผู้ใช้ขอให้ป้าย "กำลังกรอก" เป็นเรียลไทม์ แทนรอรอบถาม 15 วินาที
- Do-not-revert: ยังถามแบบเดิมทุก 15 วินาทีเป็นตัวสำรองตอนท่อหลุด/server รุ่นเก่า; ไม่ broadcast ตอนต่ออายุ (ไม่งั้นทุกเครื่องได้ข้อความทุก 15 วินาทีต่อคนที่กรอก); ต่อท่อใหม่แบบหน่วงเพิ่มเป็นเท่า 1–15 วินาที

## 2026-11-10 — Record Edit Lock

- Change: คนแรกที่เปิดหน้ากรอกสาเหตุได้ล็อกรายการ คนที่เปิดตามมาเห็นป้าย "{name} กำลังกรอกรายการนี้อยู่" ฟอร์มแตะไม่ได้และบันทึกไม่ได้ ปลดเองเมื่อคนแรกออก; หน้ารายการขึ้นป้าย "🔒 {name} กำลังกรอก" บนแถว/หัวกลุ่ม
- Files: `notify-server/src/presence.js`, `notify-server/src/server.js`, `notify-server/test/presence.test.js`, `src/api/presence.ts`, `src/hooks/use-record-lock.ts`, `src/api/config.ts`, `src/app/(app)/record/[id].tsx`, `src/app/(app)/index.tsx`, `src/constants/i18n.ts`
- Reason: ผู้ใช้ขอให้รู้ว่ามีคนกำลังกรอกอยู่ และเลือกแบบล็อกห้ามแก้ (ไม่ใช่แค่เตือน)
- Do-not-revert: ล็อกอยู่ที่ notify-server เพราะแก้ backend หลักไม่ได้; ล้มแบบเปิด (server ไม่ตอบ = แก้ได้) เพราะการบันทึกสำคัญกว่า; ตัวตนผู้ถือล็อกคือ deviceId ไม่ใช่ชื่อผู้ใช้; ไม่ปล่อยล็อกตอนแอปไปเบื้องหลัง (เปิดกล้องถ่ายรูป) TTL จึงเป็น 90 วิ; หน้ารายการหยุดถามตอนไม่อยู่บนจอ

## 2026-11-10 — Timeline Vivid Colors (Light)

- Change: แถบสถานะไลน์ในโหมดสว่างใช้สีสดชุดเดียวกับโหมดมืด (`VIVID` ใน `line-status-timeline.tsx`)
- Files: `src/components/line-status-timeline.tsx`
- Reason: ผู้ใช้ขอ สีเดิม (`status*Fill` ของธีมสว่าง) เข้มทึบ
- Do-not-revert: ไม่แก้ในธีม เพราะ `status*Fill` สีเข้มยังจำเป็นกับปุ่มที่มีตัวอักษรขาว

## 2026-11-10 — Shift Today Refresh

- Change: ค่า "วันนี้" (กะปัจจุบัน) ในหน้ารายการอัปเดตเองทุก 1 นาทีและทุกครั้งที่กลับเข้าแอป ถ้ากำลังดูกะปัจจุบันอยู่จะเลื่อนไปกะใหม่ให้ ถ้าดูวันย้อนหลังไม่เปลี่ยน
- Files: `src/app/(app)/index.tsx`
- Reason: เดิม `useState(getShiftDateString)` คำนวณครั้งเดียว เปิดแอปค้างไว้ตั้งแต่ก่อน 08:00 แล้วเลือกวันที่ 10 ไม่ได้ (ลูกศรและปฏิทินยังจำกัดที่วันที่ 9)
- Do-not-revert: ห้ามกลับไปคำนวณ today ครั้งเดียว เครื่องในโรงงานเปิดแอปค้างข้ามกะเป็นปกติ

## 2026-11-10 — Login Watermark & Shine

- Change: หน้าล็อกอินเพิ่มลายน้ำโลโก้ดองจินขนาดใหญ่หลังการ์ด, เอาก้อนแสงเรือง (SoftBlob) ในการ์ดออก, เพิ่มแถบแสงเอียงวิ่งผ่านการ์ดทุก ~5 วินาที, การ์ดโปร่งแสง, กรอบโลโก้สองชั้น
- Files: `src/app/sign-in.tsx`, `assets/images/dongjin-watermark.png`
- Reason: ผู้ใช้ขอ (ลายน้ำใหญ่ขึ้น, เอาแสงคลื่นออก, เพิ่มแสงยาววิ่งผ่าน card)
- Do-not-revert: ขนาดลายน้ำคิดเป็นพิกเซล (`WATERMARK_SCALE` × ด้านสั้นของจอ) เพราะ width % เกิน 100 ถูกจำกัดที่ความกว้างจอ; โหมดมืดย้อมลายน้ำเป็นขาว (`tintColor`) เพราะสามเหลี่ยมน้ำเงินกลืนพื้นกรมท่า; การ์ดไม่มี `elevation` เพราะการ์ดโปร่งแสงทำให้เงา Android ทะลุเป็นกรอบซ้อน; แถบแสงไม่แสดงเมื่อเครื่องตั้งลดการเคลื่อนไหว (`useReducedMotion`)

## 2026-11-09 — Idle Issue Picker

- Change: ช่อง Idle Time Issue เปลี่ยนจากพิมพ์เองเป็นเลือกจาก 13 สาเหตุ (`IDLE_ISSUE_OPTIONS` ใน `src/types/index.ts`) ผ่าน `OptionSheet`; ช่อง Remark ย้ายออกจาก "ข้อมูลเพิ่มเติม" มาไว้ใต้ Action ใช้พิมพ์รายละเอียดหรือสาเหตุที่ไม่มีในรายการ
- Files: `src/types/index.ts`, `src/app/(app)/record/[id].tsx`, `src/constants/i18n.ts`, `src/components/line-picker.tsx`
- Reason: ผู้ใช้ส่งตารางสาเหตุมาตรฐานมาให้ ต้องการให้เลือกแทนพิมพ์ และพิมพ์อิสระได้ที่ Remark
- Do-not-revert: ค่าที่บันทึกตามภาษาที่เลือก (ผู้ใช้กำหนด) — ไทยบันทึกชื่อไทย, อังกฤษ/เกาหลีบันทึกชื่ออังกฤษ (ตารางไม่มีชื่อเกาหลี); จับคู่ค่าเดิมได้ทั้งชื่อไทยและอังกฤษ; ค่าเดิมที่ไม่อยู่ในรายการ (รวม Break Time) แสดงเป็นตัวเลือกบนสุดไม่ให้หายเงียบ; ตัวสะกดอังกฤษคงตามตาราง (Trainning, Planed, cercuit); ไม่แสดงสีของตารางเพราะสีในแอปใช้บอกสถานะอยู่แล้ว

## 2026-11-09 — List Screen Redesign

- Change: หน้ารายการเปลี่ยนเป็นแบบแถว (ทดลองใน preview แล้วผู้ใช้สั่งใช้จริง) — แถบบนแถวเดียว (วันที่แบบย่อ + dropdown ไลน์), การ์ดสถานะไลน์ ตัวกรอง และช่องค้นหาเลื่อนไปกับรายการ, ตัวกรอง ทั้งหมด/ระบุแล้ว/รอระบุ (เริ่มที่ทั้งหมด), แถวมีเวลาเริ่ม/จบพร้อมไอคอนนาฬิกา+ลูกศร, ปุ่มกางกลุ่มมุมขวาล่าง; การ์ดสถานะมีไอคอนขยาย; หน้าเต็มจอแนวนอนรวมไลน์/ชื่อ/ช่วงเวลา/ซูม/ปิด ไว้แถวเดียวเหนือกราฟ และตัดคำแนะนำวิธีใช้ออก
- Files: `src/app/(app)/index.tsx`, `src/app/(app)/_layout.tsx`, `src/components/line-status-timeline.tsx`, `src/components/line-status-fullscreen.tsx`, `src/components/line-picker.tsx`, `src/constants/i18n.ts`; ลบ `src/app/(app)/preview.tsx`, `record-card.tsx`, `work-order-group.tsx`, `line-tabs.tsx`
- Reason: หน้าเดิมเห็นรายการราว 2.5 ใบต่อจอ และทุกใบแดงทั้งใบจนแยกไม่ออก; dropdown รองรับไลน์เพิ่มในอนาคต
- Do-not-revert: ยังคงพฤติกรรมเดิม — poll รายการใหม่ + แถบแจ้ง (อยู่นอกรายการ ไม่เลื่อนหาย), กลับหน้ากรอกสาเหตุเมื่อแอปถูกปิดระหว่างถ่ายรูป, กางกลุ่มแล้วเลื่อนขึ้นบนสุด, ไม่ใช้ removeClippedSubviews; ตัวเลขบนตัวกรองนับทั้งกะไม่ขึ้นกับคำค้นหา

## 2026-11-09 — Korean Language

- Change: เพิ่มภาษาเกาหลี (`ko`, ป้าย `KR`) ครบทุกข้อความ ปุ่มภาษาเปลี่ยนจากแตะสลับ TH/EN เป็นเปิดแผ่นเลือกภาษา (ชื่อภาษาเขียนเป็นภาษานั้นเอง) ปฏิทินมีชื่อเดือน/วันเกาหลีและเรียงปีขึ้นก่อน
- Files: `src/constants/i18n.ts`, `src/context/language-context.tsx`, `src/components/language-button.tsx`, `src/components/line-picker.tsx` (แยก `OptionSheet`), `src/components/month-calendar.tsx`, `src/app/(app)/preview.tsx`
- Reason: ผู้ใช้ขอเพิ่ม KR; สามภาษาแตะวนทีละภาษาต้องกดหลายครั้งและเดาไม่ได้ว่าได้ภาษาไหน ผู้ใช้เลือกแบบแผ่นเลือก
- Do-not-revert: ชุด `ko` แปลโดย AI ยังไม่ผ่านเจ้าของภาษา ชื่อช่องที่ `th` เก็บเป็นอังกฤษ (Man Power, Dept, Judge, Lot size, Break Time) คงเป็นอังกฤษให้ตรงกับเว็บ; ข้อความ push จาก notify-server ยังไม่แยกภาษา

## 2026-11-04 — Web Version

- Change: เปิดแอปผ่าน browser ได้จากโค้ดชุดเดียวกัน — `web.output` เป็น `single`; ที่เก็บไฟล์ในคิวรูปแยกเป็น `photo-queue-files.ts` (native) / `.web.ts` (data URL ใน localStorage); อัปโหลดบนเว็บส่งเป็น Blob; push คืน null บนเว็บ; notify-server ตอบ CORS เฉพาะเส้นรูป และเสิร์ฟ `dist` เมื่อตั้ง `WEB_DIR`
- Files: `app.json`, `src/api/photo-queue.ts`, `src/api/photo-queue-files.ts`, `src/api/photo-queue-files.web.ts`, `src/api/photo-store.ts`, `src/api/push-notifications.ts`, `notify-server/src/server.js`, `notify-server/docker-compose.deploy-share.yml`, `notify-server/DEPLOY.md`
- Reason: หัวหน้าต้องการเปิดในเว็บ backend หลักตอบ CORS `*` อยู่แล้ว (เช็ก 2026-11-04) จึงไม่ต้องทำ proxy และไม่ต้องแยกโปรเจกต์
- Do-not-revert: ห้ามเปิด CORS ให้ `/Notify` · บนเว็บห้ามเก็บแค่ blob: URL ในคิว (หายเมื่อรีเฟรช)
- Follow-up: react-native-web ทำ `Alert.alert` เป็นฟังก์ชันว่าง กดบันทึกแล้วเงียบ (ไม่มีกล่องสำเร็จ/ไม่ย้อนกลับ/ไม่เห็น error) แก้ด้วย `src/components/alert-polyfill.web.ts` (import ใน `src/app/_layout.tsx`) แปลงเป็น `window.alert`/`confirm` ปุ่ม destructive ถามท้ายสุด
- Follow-up: หน้าเว็บประกาศ `lang="en"` ทั้งที่ UI ไทย Chrome ชวนแปลอัตโนมัติซึ่งเขียน DOM ทับจน React พัง — `app.json` `web.lang: th`, `public/index.html` ใส่ `translate="no"` + `meta google notranslate`, `language-context.tsx` ตั้ง `document.documentElement.lang` ตามภาษาที่เลือก
- Follow-up: error ของรูปในคิวเก็บเป็น key `photoErr*` แล้วแปลตอนแสดง (`photo-upload-card.tsx`) ข้อความจาก server แสดงตามที่ได้รับ · คำนำหน้าจุดหยุด `จุดที่` แปลตอนแสดงด้วย `stopPointPrefix` (`STATION_MAP` ยังเป็นไทยให้ตรงเว็บ)
- Follow-up: ปุ่มถ่ายรูปบนเว็บเปิดหน้าเลือกไฟล์ เพราะ picker ใส่ `capture="camera"` (ไม่ใช่ค่ามาตรฐาน) — ส่ง `cameraType: back` ให้ได้ `capture="environment"` ทดสอบบน emulator แล้วเปิดกล้องตรง
- Follow-up: เพิ่มลงหน้าจอหลักได้ — `public/manifest.json` + `public/icons/*-v3.png` (สร้างจาก `assets/images/icon.png` ย่อโลโก้เหลือรัศมี ≤320/1024 เพราะ launcher ตัดวงกลมราว 66%) + tag iOS ใน `public/index.html` · เปลี่ยนรูปไอคอนต้องเปลี่ยนชื่อไฟล์ (`-v4`) ไม่งั้น Chrome ใช้รูปที่ cache ไว้ · เป็น http จึง Install เป็น PWA ไม่ได้ ได้แค่ shortcut ที่เปิดใน Chrome
- Follow-up: จอเล็ก (ทดสอบ 320/360px ผ่าน CDP) — `COMPACT_WIDTH=380` ใน theme.ts: ปุ่มภาษาซ่อนรูปโลก, ปุ่มถ่ายรูป/คลังภาพกว้างเท่ากัน · คอลัมน์เวลาในหน้ากรอกกว้าง 1.4 + บรรทัดเดียว · เว็บ: หัวเรื่องตัด … และเว้นขอบปุ่ม header (`(app)/_layout.tsx`), Picker ใส่พื้นธีม (เดิมขาวบนขาว), เปิด `/record/x` ตรงหรือรีเฟรชมีปุ่มกลับหน้ารายการ และหลังบันทึก `replace('/')` เมื่อย้อนไม่ได้
- Follow-up: timeline เต็มจอบนเว็บ — `line-status-fullscreen.tsx` ขอ Fullscreen แล้ว `screen.orientation.lock('landscape')` (Chrome Android หมุนเองได้ ทดสอบแล้ว) · หมุนไม่ได้ (iPhone/Safari) ใช้ layout แนวตั้ง: header 2 แถว, การ์ดเรียงลง, กล่องแถบสูง 280 + `timelineRotateHint` · ห้ามใช้ `flex: 0` คู่ `height` บนเว็บ (flex-basis 0% ชนะ height) ให้ใส่ flex เฉพาะ layout ที่ต้องยืด
- Follow-up: แถบ browser เป็นสีขาว (Safari แถบล่าง, Android แถบนำทาง/แถบบน) — `_layout.tsx` ตั้งสีพื้น html/body = `colors.bg` และ `meta theme-color` = `colors.surface` ตามธีม · ค่าเริ่มต้นใน `public/index.html`/`manifest.json` เป็นสีธีมมืด (ค่าเริ่มต้นของแอป)
- Follow-up: ให้แถบ browser ดูโปร่ง — `viewport-fit=cover` (แอปขยายใต้แถบกระจก Safari/แถบนำทาง Android, ระยะขอบมาจาก safe area ที่ index/record ใช้อยู่แล้ว) + `apple-mobile-web-app-status-bar-style: black-translucent` (เปิดจากไอคอน iPhone) · ตัวแถบของ browser เองสั่งโปร่งใสจากเว็บไม่ได้

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

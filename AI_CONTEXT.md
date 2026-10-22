# AI_CONTEXT.md

> อ่านไฟล์นี้ก่อนทุกงาน · ฟีเจอร์ → ไฟล์: `AI_INDEX.md` · การตัดสินใจที่ห้ามย้อน: `AI_CHANGELOG.md`

## Project Purpose

- แอปมือถือให้ลีดเดอร์ไลน์ผลิตดูรายการ "ไลน์หยุด" (idle time) ของกะ กรอกสาเหตุ แนบรูป และรับแจ้งเตือนรายการใหม่
- รีโปมีสองส่วน: แอป (`src/`) กับบริการแจ้งเตือน + เก็บรูป (`notify-server/`)
- backend หลัก (`192.168.2.5:5053`, auth `:8081` ใน `src/api/config.ts`) เป็นของทีมอื่น **แก้ไม่ได้**
- ใช้งานเฉพาะ wifi โรงงาน ไม่เปิด server ออกอินเทอร์เน็ต

## Tech Stack

| สิ่งที่ตรวจพบ | หลักฐาน |
| --- | --- |
| TypeScript (strict, alias `@/*` → `src/*`) | `tsconfig.json` |
| Expo SDK 57, React Native 0.86, React 19.2, file-based router | `package.json`, `app.json` |
| เก็บค่าในเครื่อง: AsyncStorage, ไฟล์ใน document dir | `package.json`, `src/api/photo-queue.ts` |
| Push: `expo-notifications` (แอป), FCM ผ่าน `firebase-admin` + APNs ผ่าน `node:http2` (server) | `notify-server/src/fcm.js`, `apns.js` |
| Server: Node ESM, Express 4, multer | `notify-server/package.json` |
| Test: `node:test` (เฉพาะ server) | `notify-server/test/*.test.js` |
| Deploy server: Docker (`node:22-alpine`) | `notify-server/Dockerfile`, `docker-compose*.yml` |
| Build: EAS profiles, config plugin Android | `eas.json`, `plugins/` |

- กฎของโปรเจกต์: ต้องอ่านเอกสาร Expo v57 ก่อนเขียนโค้ด (`AGENTS.md`)

## Commands

| งาน | แอป (root) | notify-server (`cd notify-server`) |
| --- | --- | --- |
| install | `npm install` | `npm install` |
| dev | `npm start`, `npm run android`, `npm run ios`, `npm run web` | `npm run dev` |
| start | — | `npm start` |
| test | **ไม่มี** | `npm test` |
| lint | `npm run lint` (`expo lint`) — UNVERIFIED: ไม่พบ ESLint config/package ครั้งแรกอาจขอติดตั้งเพิ่ม | ไม่มี |
| typecheck | ไม่มี script · ใช้ `npx tsc --noEmit` (TypeScript อยู่ใน devDependencies) | ไม่มี (JS) |
| build release | ไม่มี script · ขั้นตอนอยู่ใน `RELEASE.md` | `docker build` ตาม `notify-server/DEPLOY.md` |

- **ห้ามรัน** `npm run reset-project` — ย้าย/ลบ `src/` (`scripts/reset-project.js` เป็นสคริปต์ template)

## Project Structure

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `src/app/` | หน้าจอ ชื่อไฟล์ = route; `(app)/` = หน้าที่ต้องล็อกอิน |
| `src/components/` | UI ที่ใช้ซ้ำ รับข้อมูลทาง props |
| `src/hooks/` | ผูก service เข้ากับ lifecycle ของหน้าจอ |
| `src/context/` | state ข้ามหน้าจอ: auth, ภาษา, ธีม |
| `src/api/` | network, กติกาธุรกิจ (pure), การเก็บข้อมูลในเครื่อง, config |
| `src/constants/` | ข้อความสองภาษา, สี/ระยะ/ฟอนต์, โลโก้ (data URI) |
| `src/types/` | data contract ของ record และตัวเลือก dropdown |
| `notify-server/src/` | poll API → ส่ง push, เก็บ token, API รูป |
| `notify-server/test/` | เทสต์ server + เทสต์เทียบกติกากับไฟล์ของแอป |
| `plugins/` | config plugin ตอน build Android |
| `android/` | native project ที่ generate (gitignored) ไม่ต้องอ่าน/แก้ |

## Architecture

- **UI**: หน้าจอใน `src/app/`, ชิ้นส่วนใน `src/components/`
- **State**: React Context 3 ตัว (`src/context/`) + state ในหน้าจอ/hook — ไม่มี global store library
- **Business Logic (pure, ไม่มี I/O)**: `src/api/idle-rules.ts`, `src/api/line-timeline.ts`, ฟังก์ชัน `selectVisible`/`computeLabourCost`/`diffEditable` ใน `idle-time-service.ts`
- **API / Network**: service ใน `src/api/` ทุกตัวยิงผ่าน `src/api/http.ts`
- **Durable local data**: ร่างฟอร์ม, คิวรูปที่ยังไม่ส่ง, สถานะการปิดแจ้งเตือนที่ค้าง (`src/api/`)
- **Auth**: `src/context/auth-context.tsx` เรียก `login` แล้วเก็บ token/วันหมดอายุใน AsyncStorage; Idle Time API ไม่ต้องแนบ token (`IDLE_TIME_API_REQUIRES_TOKEN = false`)
- **Config**: แอป `src/api/config.ts` (URL, endpoint, mock flag ที่ throw ถ้าเปิดค้างใน release) · server อ่าน `process.env` เฉพาะใน `server.js`
- **Server**: `server.js` ประกอบทุกส่วน → `watcher.js` (เลือกรายการ) → `fcm.js`/`apns.js` (แยกตาม `platform`) → token จาก `store.js` (JSON) + `firestore-store.js` · รูปผ่าน `photo-routes.js` → `photo-store.js`

## Core Data Flow

- **ดูรายการ**: หน้ารายการ → `fetchShiftData` → Idle Time API → `selectVisible` (กะ 08:00–07:59, `MIN_VISIBLE_MINS`, ช่วงพัก `HIDDEN`) → การ์ดจัดกลุ่มตาม Work Order
- **บันทึก**: หน้ารายการ → `record/[id]` → ร่างใน AsyncStorage → `updateRecord` (PUT ทั้ง record, ตรวจ conflict) → API
- **รูป**: เลือก/ถ่าย → คิวในเครื่อง (`photo-queue`) → ตัวส่งระดับแอป (`photo-uploader`) → notify-server `/api/v1/IdleTime/Photos` → ลบออกจากคิวเมื่อ server ยืนยัน
- **แจ้งเตือน**: `watcher.js` poll API → กรองด้วยกติกาสำเนาฝั่ง server → FCM/APNs → แตะ → `use-new-record-alert.ts` เปิด `/record/[id]`; ในแอปมี poll 30 วินาทีแสดงแบนเนอร์

## Conventions

- **ชื่อไฟล์**: kebab-case (`photo-upload-card.tsx`, `idle-time-service.ts`); hook ขึ้นต้น `use-`; route ใช้ `[id]`, `(group)`
- **ชื่อในโค้ด**: component/class PascalCase, ฟังก์ชัน camelCase, ค่าคงที่ UPPER_SNAKE (`MIN_VISIBLE_MINS`, `NETWORK_TIMEOUT_MS`)
- **Import**: ใช้ alias `@/...` ในแอป; server ใช้ relative `./x.js` (ESM ต้องมี `.js`); ใช้ `import type` เมื่อต้องการแค่ type
- **Component**: `export default function`, สไตล์ด้วย `StyleSheet.create` ที่สร้างจากสีของธีม
- **ข้อความ**: ผ่าน `useT()` + key ใน `src/constants/i18n.ts` (`TranslationKey` จาก `th`)
- **สี/ระยะ**: `useColors()` + `spacing`/`radius`/`font`/`elevation` จาก `src/constants/theme.ts`
- **Network**: `fetchRead` (ลองซ้ำ) เฉพาะคำสั่งอ่าน, `fetchWithTimeout` สำหรับบันทึก/ลบ (ห้ามลองซ้ำ)
- **Error**: service throw `Error` ที่ข้อความอ่านเข้าใจได้ หรือ class เฉพาะ (`RecordConflictError`, `PhotoUploadError`); หน้าจอ catch แล้วแสดงข้อความ/`Alert` ไม่กลืน error เงียบ
- **Comment**: ภาษาไทย อธิบาย "ทำไม" (ดู `src/api/http.ts`); ไฟล์สำคัญมี JSDoc หัวไฟล์
- **Test (server)**: `node:test` + `assert/strict`, ตั้ง `TZ=Asia/Bangkok` ต้นไฟล์, ใช้ temp dir และ HTTP server จำลอง

## File Responsibilities

| ประเภท | ทำ | ไม่ควรทำ |
| --- | --- | --- |
| Screen `src/app` | ประกอบหน้า, navigation, state ของหน้า, เรียก service/hook | ใส่กติกาธุรกิจที่ใช้ซ้ำได้, ยิง `fetch` ตรง |
| Component | แสดงผล, รับ interaction ผ่าน props | เรียก service ที่ทำ network |
| Hook | ผูก service กับ lifecycle, subscribe store | render UI |
| Service `src/api` | network ผ่าน `http.ts`, แปลง `ApiIdleTimeRecord` ↔ `IdleTimeRecord` | import จาก `src/app`/`src/components`/`src/hooks` |
| Rules (pure) | คำนวณ/กรอง/จัดรูปแบบวันเวลา | I/O ใด ๆ |
| Persistence | AsyncStorage/ไฟล์ในเครื่อง | ลบข้อมูลก่อนได้รับการยืนยันจาก server |
| Context | state ข้ามหน้าจอที่ต้องจำค่า | logic เฉพาะหน้าจอ |
| Constants / Types | ข้อความ, สี, contract | logic, import โค้ดที่มี side effect |
| Server module | หนึ่งหน้าที่ต่อไฟล์, รับ dependency ผ่าน constructor | อ่าน `process.env` นอก `server.js` |

## Dependency Rules

```text
src/app ──→ src/components ──→ src/context, src/constants
   │
   └──→ src/hooks ──→ src/api (services) ──→ src/api/http.ts ──→ ภายนอก
                         └──→ src/api (pure rules) ──→ src/types
```

- component import ได้: ฟังก์ชัน pure จาก `idle-rules.ts`/`line-timeline.ts` และ `import type` จาก `src/api`/`src/hooks`
- `src/types/index.ts` import ได้แค่ `type BreakRuleType` ห้ามเพิ่ม import ที่มีโค้ดจริง
- `src/api` ห้าม import จาก `src/app`, `src/components`, `src/hooks`
- notify-server ไม่ import โค้ดแอป ยกเว้น `test/idle-rules-sync.test.js` ที่อ่าน `src/api/idle-rules.ts` และ `record/[id].tsx` มาเทียบ

## Rules

1. แก้เฉพาะไฟล์ที่เกี่ยวข้อง
2. ห้ามเปลี่ยน API contract โดยไม่จำเป็น — backend หลักแก้ไม่ได้ ให้แก้ในแอปหรือ notify-server
3. ห้ามสร้างโค้ดซ้ำ ถ้ามี implementation อยู่แล้ว (fetch → `http.ts`, วัน/เวลา/กะ → `idle-rules.ts`)
4. ใช้ Type/Interface ที่มีอยู่ก่อนสร้างใหม่ (`src/types/index.ts`, type ที่ export จาก `src/api/*`)
5. แยก UI, Business Logic, API ตามโครงสร้างเดิม
6. รักษา Behavior เดิมของส่วนที่ไม่เกี่ยวข้อง
7. ก่อนสร้างไฟล์ใหม่ ตรวจใน `AI_INDEX.md` ว่ามีไฟล์เดิมที่ใช้ได้หรือไม่
8. ห้าม Refactor โค้ดที่ไม่เกี่ยวกับปัญหา
9. ห้ามเปลี่ยนชื่อไฟล์หรือโครงสร้างโดยไม่มีเหตุผล (ชื่อไฟล์ใน `src/app` คือ route)
10. ห้ามแก้หลายไฟล์ ถ้าแก้ได้ด้วยไฟล์เดียว
11. ห้ามเพิ่ม Dependency/Library ใหม่โดยไม่ได้รับอนุญาต
12. ทำตาม Conventions ของโปรเจกต์ แม้จะไม่ใช่วิธีที่ AI ชอบ
13. ถ้าข้อมูลใน Context ขัดกับโค้ดจริง ให้เชื่อโค้ด แล้วแจ้งผู้ใช้
14. **กติกาสองสำเนาต้องแก้คู่กัน**: `src/api/idle-rules.ts` ↔ `notify-server/src/idle-rules.js` (`BREAK_RULES`, `getBreakRuleType`, `MIN_VISIBLE_MINS` = `MIN_NOTIFY_MINS`, เวลากะ) แล้วรัน `npm test` ใน `notify-server`
15. `BREAK_RULES` ต้องตรงกับเว็บ dashboard ทุกค่า — ยืนยันด้วยตัวอย่างรูปธรรมกับผู้ใช้ก่อนแก้ (ดู `AI_CHANGELOG.md`)
16. ข้อความที่ผู้ใช้เห็นต้องเพิ่มใน `i18n.ts` ทั้ง `th` และ `en`
17. ห้ามทำให้ข้อมูลหาย: รูปอยู่ในคิวจนกว่า server ยืนยัน; โหลดไม่สำเร็จต้องแสดง error ไม่ใช่รายการว่าง
18. `USE_MOCK_DATA`/`USE_MOCK_AUTH` ต้องเป็น `false` ก่อน build release
19. field ที่ผู้ใช้แก้ได้ต้องอยู่ใน `EDITABLE_KEYS` (`idle-time-service.ts`)
20. env ใหม่ของ server → เพิ่มใน `server.js` และ `notify-server/.env.example`

## Modification Strategy

| ประเภทปัญหา | Layer → ที่ไปดู |
| --- | --- |
| หน้าตาชิ้นส่วน (การ์ด, แท็บ, ค้นหา, ปฏิทิน, timeline) | UI → `src/components/` |
| พฤติกรรมหน้าจอ, navigation | UI → `src/app/` |
| รายการไหนแสดง/ซ่อน, ช่วงพัก, เวลากะ | Business Logic → `src/api/idle-rules.ts` + สำเนา server (Rule 14) |
| ดึง/บันทึกข้อมูล, conflict, login | API → `src/api/idle-time-service.ts` |
| timeout, ข้อความ offline | API → `src/api/http.ts` |
| รูปแนบ | API + Persistence → `src/api/photo-*`, `src/hooks/use-record-photos.ts`; server `photo-*.js` |
| แจ้งเตือน | แอป `src/api/` + `src/hooks/use-new-record-alert.ts`; server `watcher.js`, `fcm.js`, `apns.js` |
| ล็อกอิน/ภาษา/ธีมค้างค่า | State → `src/context/` |
| ข้อความ, สี, ขนาด | Constants → `src/constants/` |
| field ของ record, ตัวเลือก dropdown | Types → `src/types/index.ts` |
| URL, endpoint | Config → `src/api/config.ts`; server env ใน `server.js` |
| build/signing | `app.json`, `eas.json`, `plugins/`, `RELEASE.md` |

## AI Reading Strategy

1. อ่าน `AI_CONTEXT.md` ทุกครั้ง
2. วิเคราะห์ปัญหา และระบุ Layer
3. ค้นหาใน `AI_INDEX.md` เฉพาะ Feature ที่เกี่ยวข้อง (Grep ด้วย Keyword ไม่อ่านทั้งไฟล์)
4. ค้นหาใน `AI_CHANGELOG.md` เฉพาะ entry ของ Feature/ไฟล์ที่จะแก้
5. เปิดเฉพาะไฟล์ที่ INDEX ชี้ไป — ไฟล์ยาว (>400 บรรทัด ดู Known Risks) ให้ Grep หาฟังก์ชันแล้วอ่านเฉพาะช่วง
6. อ่าน Dependency เฉพาะที่จำเป็น
7. ห้ามอ่านทั้ง Project — ข้าม `android/`, `node_modules/`, `assets/`, `src/constants/logo.ts`, lock files, `*.tar`, `*.apk`
8. ถ้าแก้ได้ไฟล์เดียว ให้แก้ไฟล์เดียว
9. ถ้าต้องแก้หลายไฟล์ ให้ระบุเหตุผลรายไฟล์

## Change Boundary

ก่อนแก้ให้ระบุ:

- **Problem**
- **Root Cause**
- **Files Required**
- **Files Not Required**
- **Expected Change**
- **Risk / Side Effect** (ผลกระทบกับส่วนอื่น — เจ้าของโปรเจกต์ขอทุกครั้ง)
- **Index/Changelog Update**: ต้องอัปเดตหรือไม่ เพราะอะไร

ถ้าต้องแก้เกิน 3 ไฟล์ หรือกระทบ API contract / Data structure ให้เสนอแผนและรอการยืนยันก่อนแก้

## Expected AI Behavior

1. อ่าน `AI_CONTEXT.md`
2. วิเคราะห์ Root Cause (ไม่แก้แค่อาการ)
3. ระบุไฟล์ที่เกี่ยวข้อง
4. อ่านเฉพาะไฟล์ที่จำเป็น
5. แก้เฉพาะจุด (Minimal diff)
6. ไม่ Refactor ส่วนที่ไม่เกี่ยวข้อง
7. ตรวจผลกระทบต่อไฟล์ที่เรียกใช้ส่วนที่แก้ (Grep ชื่อ export)
8. รัน Verification ที่มี
9. อัปเดต `AI_INDEX.md` / `AI_CHANGELOG.md` ตาม Maintenance Rules
10. สรุปไฟล์ที่แก้ และอธิบายสั้น ๆ ว่าแก้อะไร เพราะอะไร

## Verification

- แก้แอป → `npx tsc --noEmit` (ต้องไม่มี error)
- แก้ notify-server หรือ `src/api/idle-rules.ts` หรือ `record/[id].tsx` (ส่วน `SHOW_BUTTON`) → `cd notify-server && npm test`
- แอปไม่มี automated test → อธิบายขั้นตอนตรวจด้วยมือ: เปิดหน้าที่แก้ผ่าน Metro + debug build (`npm run android`), ลองทั้งตอนมีเน็ตและตัด wifi, ทั้งภาษา TH/EN และธีมสว่าง/มืด
- `npm run lint` ใช้ได้เมื่อมีการตั้ง ESLint แล้วเท่านั้น (ดู Commands)

## Maintenance Rules

- สร้าง/ย้าย/ลบ/เปลี่ยนชื่อไฟล์ → อัปเดต `AI_INDEX.md`
- เปลี่ยน Behavior, API contract, Data structure หรือตัดสินใจเชิงออกแบบ → เพิ่ม entry ใน `AI_CHANGELOG.md`
- แก้ typo/style/bug เล็กที่ไม่เปลี่ยน Behavior → ไม่ต้องบันทึก
- แก้ `AI_CONTEXT.md` เฉพาะเมื่อ Architecture เปลี่ยนจริง หรือผู้ใช้สั่ง

## Known Risks

- **ไม่มี test ฝั่งแอป** — ทุกอย่างใน `src/` ตรวจได้แค่ typecheck + มือ
- **ไฟล์ใหญ่**: `src/app/(app)/record/[id].tsx` (~800), `src/components/line-status-timeline.tsx` (~570), `src/app/(app)/index.tsx` (~510), `src/components/photo-upload-card.tsx` (~500), `src/api/idle-time-service.ts` (~470), `notify-server/src/server.js` (~400)
- **ถูกเรียกจากหลายที่**: `src/api/idle-rules.ts`, `src/api/http.ts`, `src/constants/i18n.ts`, `src/constants/theme.ts`, `src/types/index.ts`
- **กติกาซ้ำสองที่** (Rule 14) — กันด้วย `idle-rules-sync.test.js` เท่านั้น
- **URL/IP ฝังในโค้ด** `src/api/config.ts` — เปลี่ยนเครื่อง server ต้อง build แอปใหม่
- เส้นลงทะเบียนเครื่องและรูปบน notify-server ไม่มีการยืนยันตัวตน (`notify-server/.env.example`) — พึ่งการจำกัดวง LAN
- UNVERIFIED: `engines.node >=20` แต่เทสต์ sync import ไฟล์ `.ts` ตรง ซึ่งต้องใช้ Node ที่รองรับ type stripping (ผ่านบน Node 26 ในเครื่อง dev; Docker ใช้ Node 22 แต่ไม่ได้รันเทสต์)
- ไม่พบ TODO/FIXME/HACK ใน `src/`, `notify-server/`, `plugins/`, `scripts/`

## File-Level Context Standard

ไฟล์สำคัญมี JSDoc หัวไฟล์ภาษาไทยอยู่แล้ว เมื่อแก้ไฟล์นั้นครั้งถัดไปให้เพิ่มแท็กเหล่านี้ไว้ในคอมเมนต์เดิม (ไม่ลบคำอธิบายเดิม):

```ts
/**
 * @purpose        หน้าที่หลักของไฟล์
 * @input          ข้อมูลที่รับเข้า
 * @output         สิ่งที่ส่งออกหรือแสดงผล
 * @behavior       พฤติกรรมสำคัญ
 * @dependency     Dependency สำคัญ
 * @edit           จุดที่ควรแก้เมื่อเกิดปัญหา
 * @do-not-change  สิ่งที่ห้ามเปลี่ยน
 */
```

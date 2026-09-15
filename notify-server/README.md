# Idle Time — บริการแจ้งเตือน (Firebase Cloud Messaging)

บริการเดี่ยวสำหรับยิง push notification เข้าแอป Idle Time Tracker แยกจาก backend หลัก
รันได้ด้วยตัวเอง ไม่ต้องพึ่งฐานข้อมูลหรือ .NET runtime

## สิ่งที่ต้องเตรียมก่อน

**1. โปรเจกต์ Firebase** — สร้างที่ https://console.firebase.google.com

**2. ไฟล์สองไฟล์จาก Firebase Console** (ผมสร้างให้ไม่ได้ เป็นข้อมูลลับของบัญชีคุณ)

| ไฟล์ | เอามาจากไหน | เอาไปวางที่ไหน |
|---|---|---|
| `google-services.json` | Project settings → Your apps → Android app<br>ใส่ package name `com.noomzaza.idletime` | รากโปรเจกต์แอป (ข้าง `app.json`) |
| service account key | Project settings → Service accounts → Generate new private key | `notify-server/firebase-service-account.json` |

**3. ที่อยู่สาธารณะ** — มือถือที่ใช้เน็ตตัวเอง (ไม่ได้ต่อ WiFi โรงงาน) ต้องเข้าถึง server ได้
ต้องมีอย่างใดอย่างหนึ่ง: public IP + port forward, domain, หรือ tunnel เช่น Cloudflare Tunnel

## ติดตั้งบน server

```sh
tar -xf idletime-notify-server.tar
cd notify-server

cp .env.example .env
nano .env                      # ใส่ NOTIFY_API_KEY ที่สุ่มมา
# วางไฟล์ firebase-service-account.json ไว้ในโฟลเดอร์นี้

npm install --omit=dev
npm start
```

หรือใช้ Docker:

```sh
docker build -t idletime-notify .
docker run -d --name idletime-notify \
  -p 8090:8090 \
  -e NOTIFY_API_KEY=คีย์ที่สุ่มมา \
  -v "$PWD/data:/app/data" \
  -v "$PWD/firebase-service-account.json:/app/firebase-service-account.json:ro" \
  --restart unless-stopped \
  idletime-notify
```

## ส่งขึ้น server ด้วยไฟล์ .tar (แบบเดียวกับบริการอื่นของทีม)

เครื่องปลายทางไม่ต้องมี source code และไม่ต้องรัน npm install ทำ image ที่เครื่องตัวเอง
แล้วส่งไปเป็นไฟล์เดียว วิธีนี้ตรงกับ `mes-pcbinspection.tar` และ `solar-push-notifications.tar`
ที่ทีมใช้อยู่

ที่เครื่องตัวเอง (ต้องเปิด Docker Desktop ก่อน):

```sh
cd notify-server
docker build -t idletime-notify:latest .
docker save -o idletime-notify.tar idletime-notify:latest
```

ก๊อป `idletime-notify.tar` กับ `docker-compose.deploy.yml` ไปวางบนเครื่อง server แล้ว:

```sh
docker load -i idletime-notify.tar
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.deploy.yml logs --tail 20
```

ไฟล์ที่ต้องมีอยู่บนเครื่องปลายทางแล้วคือ `.env` กับ `firebase-service-account.json`
และโฟลเดอร์ `data` ซึ่งเก็บทั้ง token และรูปแนบ ทั้งสามอย่างไม่ได้อยู่ใน image
การอัปเดตเวอร์ชันใหม่จึงไม่แตะข้อมูลเดิม

ตรวจว่าเวอร์ชันใหม่ขึ้นแล้วด้วย `curl -s http://localhost:8090/health` ถ้าผลลัพธ์มีคำว่า
`photos` แปลว่าเส้นรูปแนบพร้อมใช้งาน

### เก็บรูปไว้บนเครื่องอื่นผ่านโฟลเดอร์แชร์

ถ้าต้องการให้ไฟล์รูปไปกองอยู่ที่เครื่อง 192.168.2.188 แทนเครื่องที่รันบริการ ใช้
[`docker-compose.deploy-share.yml`](docker-compose.deploy-share.yml) แทนไฟล์ deploy ปกติ

ขั้นตอนแบบละเอียดทีละคำสั่งของทั้งสองเครื่องอยู่ใน [`DEPLOY.md`](DEPLOY.md) ย่อไว้ที่นี่คือ

ที่เครื่อง 188 สร้างโฟลเดอร์แล้วแชร์ให้บัญชีที่บริการจะใช้เขียนได้:

```powershell
New-Item -ItemType Directory -Force "D:\IdleTimePhotos"
New-SmbShare -Name "IdleTimePhotos" -Path "D:\IdleTimePhotos" `
  -FullAccess "DOMAIN\svc_idletime" -ReadAccess "Everyone"
```

ที่เครื่องที่รันบริการ ใส่บัญชีนั้นลง `.env`:

```sh
SHARE_USER=svc_idletime
SHARE_PASSWORD=รหัสผ่าน
```

```sh
docker compose -f docker-compose.deploy-share.yml up -d
```

token กับ `photos.json` ยังอยู่บนเครื่องที่รันบริการ ย้ายเฉพาะไฟล์รูปออกไป แยกแบบนี้
เพื่อว่าถ้าเครื่องปลายทางล่ม ข้อมูลอ้างอิงว่ารูปไหนของรายการไหนจะไม่หายตามไปด้วย
แต่ระหว่างที่ล่มจะอัปโหลดรูปใหม่ไม่ได้ และรูปเก่าก็เปิดดูไม่ได้จนกว่าเครื่องนั้นจะกลับมา

ให้รันค้างหลัง reboot ด้วย systemd:

```ini
# /etc/systemd/system/idletime-notify.service
[Unit]
Description=Idle Time notify server
After=network.target

[Service]
WorkingDirectory=/opt/notify-server
ExecStart=/usr/bin/node src/server.js
EnvironmentFile=/opt/notify-server/.env
Restart=always
User=nodeapp

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl enable --now idletime-notify
```

## API

### `GET /health`

ตรวจว่าบริการยังอยู่ และดูว่ามีกี่เครื่องลงทะเบียนไว้ ไม่ต้องใช้กุญแจ

```json
{ "isSuccess": true, "result": { "status": "ok", "total": 12, "active": 11 } }
```

### `POST /api/v1/Notification/RegisterDevice`

แอปเรียกเองตอนเปิดใช้งาน ไม่ต้องใช้กุญแจ เพราะมือถือต้องเรียกได้ตรง

```json
{ "token": "FCM token", "platform": "android", "userName": "somchai@example.com" }
```

### `POST /api/v1/Notification/Notify`

ระบบหลังเรียกมาเพื่อยิงแจ้งเตือนเข้าทุกเครื่อง **ต้องใส่ header `x-api-key`**

```sh
curl -X POST http://<server>:8090/api/v1/Notification/Notify \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOTIFY_API_KEY" \
  -d '{
    "title": "มีรายการหยุดไลน์ใหม่",
    "body": "มี 3 รายการรอกรอกสาเหตุ",
    "target": { "recordId": "12345", "date": "2026-09-07" }
  }'
```

`target` ทำให้ผู้ใช้กดแจ้งเตือนแล้วเด้งเข้าหน้ากรอกสาเหตุของรายการนั้นทันที ถ้าไม่ส่งมา
แอปจะเปิดที่หน้ารายการตามปกติ

ให้ backend หลักเรียก endpoint นี้ตรงจุดที่สร้างรายการ idle time ใหม่

### รูปแนบของรายการ

API หลักที่พอร์ต 5053 ยังไม่มี field สำหรับรูป บริการนี้จึงรับหน้าที่เก็บรูปแทน

ไฟล์อยู่ใต้ `data/photos/<ปี-เดือน>/` ซึ่ง compose mount ออกมานอก container อยู่แล้ว
รูปจึงไม่หายเมื่อ build ใหม่ โดยไม่ต้องเพิ่ม volume ส่วนข้อมูลว่ารูปไหนของรายการไหน
อยู่ในไฟล์ `data/photos.json`

ชื่อไฟล์เป็น `20260909_142530_1024_a1b2.jpg` คือ ปีเดือนวัน _ เวลา _ id รายการ _ ตัวสุ่ม
ตัวสุ่มมีไว้กันชื่อชนกันเมื่อถ่ายรัวสองใบในวินาทีเดียว

โฟลเดอร์เดือนยึด **วันที่ของกะ** ไม่ใช่วันที่ตามนาฬิกา รูปที่ถ่ายตอนตีหนึ่งของวันที่ 1 กันยา
เป็นงานของกะวันที่ 31 สิงหา จึงไปอยู่ในโฟลเดอร์ `2026-08` ให้ตรงกับรายงานฝั่งเว็บ

```sh
# อัปโหลด (ส่งได้สูงสุด 10 ไฟล์ต่อครั้ง field ต้องชื่อ files)
curl -F "files=@photo.jpg" -F "userName=somchai"   http://<server>:8090/api/v1/IdleTime/Photos/1024

# รายการรูปของรายการหนึ่ง
curl http://<server>:8090/api/v1/IdleTime/Photos/1024

# ดูรูป (url ที่สองเส้นบนตอบกลับมา ใช้ต่อท้ายที่อยู่ server ได้เลย)
curl http://<server>:8090/api/v1/IdleTime/Photos/file/20260909_142530_1024_a1b2.jpg

# ลบรูป
curl -X DELETE   http://<server>:8090/api/v1/IdleTime/Photos/1024/20260909_142530_1024_a1b2.jpg
```

ข้อจำกัดที่บังคับไว้คือรับเฉพาะ jpg และ png ไฟล์ละไม่เกิน 10MB และรายการหนึ่งแนบได้ไม่เกิน 20 รูป

## ตั้งค่าฝั่งแอปหลังบริการพร้อม

แก้ [`src/api/config.ts`](../src/api/config.ts):

```ts
export const PUSH_TOKEN_REGISTRATION_ENABLED = true;
export const NOTIFY_SERVER_URL = 'http://<ที่อยู่สาธารณะของ server>:8090';
```

แล้ว build แอปใหม่ (ต้อง build ไม่ใช่แค่ reload เพราะ `google-services.json` ถูกฝังตอน compile)

## สิ่งที่ออกแบบไว้แล้ว ไม่ต้องทำเพิ่ม

**ยิงรอบเดียว ไม่มีเตือนซ้ำ** — หนึ่งเหตุการณ์เท่ากับหนึ่งแจ้งเตือน ทั้งฝั่ง server และฝั่งแอป
ทำให้ server ไม่ต้องจำสถานะว่าเคยส่งอะไรไปแล้ว และผู้ใช้ไม่ถูกเด้งซ้ำด้วยเนื้อหาเดิม

**token ตายถูกปิดอัตโนมัติ** — เมื่อ FCM ตอบว่า token ใช้ไม่ได้ (ถอนแอป/ปิดแจ้งเตือน)
บริการจะตั้ง `active: false` ให้เอง ไม่ต้องมีใครไปตามลบ

**ส่งทีละ 500** — FCM จำกัด 500 token ต่อ request โค้ดแบ่ง batch ให้แล้ว

**เก็บเป็นไฟล์ JSON ไม่ใช้ฐานข้อมูล** — ข้อมูลมีแค่รายการ token เท่าจำนวนเครื่องในโรงงาน
การลงฐานข้อมูลเพิ่มเพียงเพื่อเท่านี้ทำให้ deploy ยากขึ้นโดยไม่ได้อะไรกลับมา
เขียนแบบ atomic กันไฟล์พังถ้าไฟดับกลางคัน

## ข้อควรระวังเรื่องความปลอดภัย

`/Notify` ป้องกันด้วย API key แต่ `/RegisterDevice` เปิดให้เรียกได้ตรง เพราะมือถือต้องลงทะเบียนเองได้
คนนอกที่รู้ URL จึงยัด token ปลอมเข้ามาได้ ผลเสียจำกัดแค่มี token ตายในไฟล์ (FCM จะปฏิเสธเอง
แล้วบริการจะปิดให้อัตโนมัติ) ถ้ากังวลกว่านี้ ควรใส่การตรวจ token ผู้ใช้ที่ล็อกอินเพิ่ม

เส้นรูปแนบก็เปิดให้เรียกตรงด้วยเหตุผลเดียวกัน คือแอปในมือพนักงานต้องอัปโหลดได้เอง
สิ่งที่กันการใช้ผิดคือจำกัดชนิดไฟล์ ขนาดไฟล์ และจำนวนรูปต่อรายการ ชื่อไฟล์ที่รับจากผู้เรียก
ถูกตรวจด้วย regex ทุกครั้งก่อนเอาไปต่อเป็น path จึงอ่านหรือลบไฟล์นอกโฟลเดอร์รูปไม่ได้

แนะนำให้วางหลัง reverse proxy ที่มี HTTPS (Caddy หรือ nginx) ไม่ควรเปิดพอร์ตตรงสู่อินเทอร์เน็ต
เพราะตอนนี้ยังเป็น HTTP ล้วน token จะวิ่งแบบไม่เข้ารหัส

# ขั้นตอนติดตั้ง — เก็บรูปไว้บนเครื่อง 188

เอกสารนี้ใช้กับกรณีที่บริการ notify-server รันอยู่บนเครื่อง **192.168.2.222**
แต่ต้องการให้ไฟล์รูปแนบไปเก็บไว้บนเครื่อง **192.168.2.188** ผ่านโฟลเดอร์แชร์

ทำตามลำดับ ส่วนที่ 1 ให้จบก่อนค่อยขึ้นส่วนที่ 2 เพราะส่วนที่ 2 ต้องใช้โฟลเดอร์แชร์ที่สร้างในส่วนแรก

## ผลกระทบต่อระบบอื่นบนเครื่องเดียวกัน

เครื่อง 222 รัน container ของระบบอื่นอยู่ราวสามสิบตัว และเครื่อง 188 รัน IIS อยู่
ขั้นตอนในเอกสารนี้ไม่แตะระบบเหล่านั้น เหตุผลรายข้อ

- `docker compose -f ... down` หยุดเฉพาะ service ที่นิยามในไฟล์ที่ระบุ ซึ่งมีตัวเดียวคือ
  `idletime-notify` container อื่นไม่เกี่ยวเพราะอยู่คนละ compose project
- `docker load` เพียงเพิ่ม image ชื่อ `idletime-notify:latest` เข้าเครื่อง
  ไม่ทับ image ของใครเพราะไม่มีระบบอื่นใช้ชื่อนี้
- พอร์ต 8090 เป็นของบริการนี้อยู่แล้ว ไม่ได้ไปแย่งพอร์ตใคร
- `icacls /grant` เป็นการเพิ่มสิทธิ์ ไม่ได้ลบสิทธิ์เดิมของใคร
- `New-LocalUser` และ `New-SmbShare` เป็นการสร้างของใหม่ ถ้าชื่อซ้ำคำสั่งจะฟ้อง error
  แล้วหยุด ไม่เขียนทับของเดิม
- `robocopy` ในเอกสารนี้ไม่มี `/MIR` จึงก๊อปอย่างเดียว ไม่ลบไฟล์ปลายทาง
- ไม่มีขั้นตอนไหนแตะ IIS พอร์ต 80 หรือ site ที่รันบนเครื่อง 188

ข้อเดียวที่เปลี่ยนค่าระดับเครื่องคือการเปิด firewall ในข้อ 1.5 ซึ่งเปิดเฉพาะ SMB ขาเข้า
สองกฎ ไม่ได้เปิดทั้งกลุ่ม ถ้าองค์กรมีนโยบายเรื่อง SMB ควรถามฝ่าย IT ก่อนทำข้อนั้น

## สิ่งที่ต้องมีก่อนเริ่ม

- สิทธิ์ Administrator บนทั้งสองเครื่อง
- เครื่อง 222 มี Docker และมีโฟลเดอร์ `D:\idletime\frontend\notify-server` ที่ deploy ไว้แล้ว
- ไฟล์ `idletime-notify.tar` และ `docker-compose.deploy-share.yml` จากโปรเจกต์นี้
- ตั้งรหัสผ่านที่จะใช้กับบัญชีบริการไว้ล่วงหน้า เอกสารนี้เรียกบัญชีนั้นว่า `svc_idletime`

---

## ส่วนที่ 1 — เครื่อง 192.168.2.188 (ที่เก็บรูป)

เปิด PowerShell แบบ Run as Administrator แล้วทำตามลำดับ

### 1.1 สร้างโฟลเดอร์

```powershell
New-Item -ItemType Directory -Force "D:\IdleTimePhotos"
```

ถ้าเครื่องนี้ไม่มีไดรฟ์ D ให้เปลี่ยนเป็นไดรฟ์ที่มีพื้นที่เหลือมากที่สุด แล้วใช้ path นั้นแทนตลอดทั้งเอกสาร

### 1.2 สร้างบัญชีเฉพาะงาน

อย่าใช้บัญชี Administrator เพราะรหัสผ่านของบัญชีนี้ต้องไปเก็บเป็นข้อความธรรมดาในไฟล์ตั้งค่าบนเครื่อง 222

```powershell
$pw = Read-Host -AsSecureString "ตั้งรหัสผ่านของ svc_idletime"
New-LocalUser -Name "svc_idletime" -Password $pw `
  -FullName "Idle Time photo service" `
  -Description "บัญชีสำหรับ notify-server เขียนไฟล์รูป" `
  -PasswordNeverExpires
```

ถ้ารหัสผ่านหมดอายุเมื่อไร บริการจะเขียนรูปไม่ได้ทันทีโดยไม่มีสัญญาณเตือน จึงตั้ง `-PasswordNeverExpires` ไว้

### 1.3 ให้สิทธิ์ NTFS กับโฟลเดอร์

```powershell
icacls "D:\IdleTimePhotos" /grant "svc_idletime:(OI)(CI)M"
```

`M` คือสิทธิ์ Modify ซึ่งพอสำหรับสร้างโฟลเดอร์รายเดือน เขียนไฟล์ และลบไฟล์
`(OI)(CI)` ทำให้สิทธิ์นี้ตกทอดไปยังโฟลเดอร์ย่อยที่บริการสร้างขึ้นเองในภายหลัง

### 1.4 สร้างโฟลเดอร์แชร์

```powershell
New-SmbShare -Name "IdleTimePhotos" -Path "D:\IdleTimePhotos" `
  -FullAccess "svc_idletime" -ReadAccess "Everyone"
```

บัญชีบริการเขียนได้ คนอื่นในวงเปิดดูได้อย่างเดียว ตั้งใจไม่ให้คนอื่นลบไฟล์ผ่านโฟลเดอร์แชร์
เพราะไฟล์ `photos.json` ที่จำว่ารูปไหนของรายการไหนอยู่บนเครื่อง 222 ถ้าลบไฟล์ตรง ๆ
รายการจะยังอยู่แต่รูปเปิดไม่ขึ้น การลบรูปต้องทำผ่านแอปเท่านั้น

### 1.5 เปิด firewall เฉพาะ SMB

```powershell
Get-NetFirewallRule -Name "FPS-SMB-In-TCP","FPS-SMB-In-TCP-NoScope" `
  -ErrorAction SilentlyContinue | Enable-NetFirewallRule
```

ตั้งใจเปิดเฉพาะกฎ SMB ขาเข้าสองข้อ ไม่เปิดทั้งกลุ่ม File and Printer Sharing
เพราะทั้งกลุ่มมีกฎอื่นติดมาด้วย เช่น NetBIOS เครื่องพิมพ์ และ ICMP ซึ่งงานนี้ไม่ได้ใช้

ตรวจผลด้วย

```powershell
Get-NetFirewallRule -DisplayGroup "File and Printer Sharing" |
  Where-Object { $_.Name -like "*SMB-In*" } |
  Select-Object Name, Enabled, Profile
```

### 1.6 ตรวจว่าแชร์ขึ้นจริง

```powershell
Get-SmbShare -Name "IdleTimePhotos"
Get-SmbShareAccess -Name "IdleTimePhotos"
```

คำสั่งที่สองสำคัญกว่า ต้องเห็นสองแถวคือ `svc_idletime` ได้ Full และ `Everyone` ได้ Read
ถ้าสิทธิ์ไม่ครบ ตอน mount จากเครื่องที่รันบริการจะขึ้น error ว่าเขียนไฟล์ไม่ได้

---

## ส่วนที่ 2 — เครื่อง 192.168.2.222 (ที่รันบริการ)

### 2.1 ทดสอบว่าเข้าถึงโฟลเดอร์แชร์ได้ก่อน

ทำขั้นนี้ก่อนเสมอ ถ้าขั้นนี้ไม่ผ่าน Docker ก็จะ mount ไม่ได้เหมือนกัน

```powershell
net use \\192.168.2.188\IdleTimePhotos /user:svc_idletime
dir \\192.168.2.188\IdleTimePhotos
net use \\192.168.2.188\IdleTimePhotos /delete
```

ถ้าขึ้น error ให้ย้อนกลับไปแก้ที่ส่วนที่ 1 ก่อน อย่าทำขั้นต่อไป

### 2.2 ก๊อปไฟล์เข้าโฟลเดอร์บริการ

วางสองไฟล์นี้ใน `D:\idletime\frontend\notify-server`

```
idletime-notify.tar
docker-compose.deploy-share.yml
```

### 2.3 โหลด image เวอร์ชันใหม่

```powershell
cd D:\idletime\frontend\notify-server
docker load -i idletime-notify.tar
```

### 2.4 เพิ่มค่าลงไฟล์ .env

เปิด `.env` ที่มีอยู่แล้ว เติมสามบรรทัดนี้ต่อท้าย อย่าลบของเดิม

```sh
SHARE_USER=svc_idletime
SHARE_PASSWORD=รหัสผ่านที่ตั้งไว้ในข้อ 1.2
PHOTO_DIR=/app/photos
```

### 2.5 ย้ายรูปเดิมขึ้นเครื่อง 188

ข้ามขั้นนี้ได้ถ้ายังไม่เคยมีใครแนบรูป ตรวจก่อนด้วย `dir data\photos`

```powershell
net use \\192.168.2.188\IdleTimePhotos /user:svc_idletime
robocopy "D:\idletime\frontend\notify-server\data\photos" `
         "\\192.168.2.188\IdleTimePhotos" /E
net use \\192.168.2.188\IdleTimePhotos /delete
```

`/E` ก๊อปโฟลเดอร์รายเดือนไปทั้งโครงสร้าง ยังไม่ต้องลบของเดิมบนเครื่อง 222
เก็บไว้เป็นสำเนาสำรองจนกว่าจะแน่ใจว่าระบบใหม่ทำงานดี

### 2.6 สลับมาใช้ compose ตัวใหม่

```powershell
docker compose -f docker-compose.deploy.yml down
docker compose -f docker-compose.deploy-share.yml up -d
```

ต้องสั่ง `down` ก่อนเพราะทั้งสองไฟล์ใช้ชื่อ container เดียวกันคือ `idletime-notify`

### 2.7 ตรวจว่าขึ้นแล้ว

```powershell
docker compose -f docker-compose.deploy-share.yml logs --tail 20
curl -i http://127.0.0.1:8090/health
```

ต้องเห็นบรรทัด `บริการแจ้งเตือนพร้อมใช้งานที่พอร์ต 8090` ใน log และผลลัพธ์ของ health
ต้องมีคำว่า `photos`

ใช้ `127.0.0.1` ไม่ใช่ `localhost` เพราะ `localhost` บน Windows Server ชี้ไป IPv6 ก่อน
แต่ Docker เปิดพอร์ตไว้บน IPv4 ทำให้ curl เงียบไปเฉย ๆ

### 2.8 ทดสอบเขียนไฟล์จริง

ใช้ไฟล์ jpg หรือ png อะไรก็ได้ที่มีอยู่ในเครื่อง แทน path ข้างล่างด้วยไฟล์จริง

```powershell
curl -F "files=@D:\ทดสอบ.jpg" `
  http://127.0.0.1:8090/api/v1/IdleTime/Photos/999999
```

ผลลัพธ์จะบอกชื่อไฟล์ที่ได้ จากนั้นไปดูว่าไฟล์โผล่บนเครื่อง 188 จริงไหม

```powershell
dir \\192.168.2.188\IdleTimePhotos
```

แล้วลบรายการทดสอบทิ้ง โดยแทน `<ชื่อไฟล์>` ด้วยชื่อที่ได้จากคำสั่งบน

```powershell
curl -X DELETE http://127.0.0.1:8090/api/v1/IdleTime/Photos/999999/<ชื่อไฟล์>
```

---

## ส่วนที่ 3 — แอปบนมือถือ

ลง `idletime-release.apk` ทับตัวเดิมได้เลย ไม่ต้องถอนก่อนเพราะเซ็นด้วยกุญแจเดียวกัน
แล้วเปิดรายการใดรายการหนึ่ง กดถ่ายรูป ถ้าไม่มีกล่อง error ขึ้นและเห็นภาพย่อ แปลว่าครบวงจรแล้ว

รูปที่พนักงานเคยถ่ายไว้ในแอปเวอร์ชันเก่าจะไม่ถูกย้ายขึ้น server ให้ ของเก่าถือว่าหายไป
เพราะเวอร์ชันเก่าเก็บไว้ในโฟลเดอร์ cache ของแอปเท่านั้น

---

## ถ้ามีปัญหา

**container ขึ้นแล้วดับทันที** ดู log ด้วย `docker compose -f docker-compose.deploy-share.yml logs`
ถ้าเป็นเรื่อง mount จะฟ้องตั้งแต่ตอน `up` เลย

**mount ไม่ผ่าน** ลองไล่ตามนี้ทีละข้อ

1. เวอร์ชัน SMB ไม่ตรง แก้ `vers=3.0` ใน `docker-compose.deploy-share.yml` เป็น `2.1`
2. บัญชีเป็น local account ของเครื่อง 188 ซึ่งมีชื่อเครื่องว่า `NS1`
   (ดูได้จากผลของ `Get-SmbShareAccess` ที่ขึ้นเป็น `NS1\svc_idletime`)
   บางครั้งต้องระบุชื่อเครื่องด้วย เติม `domain=NS1` ต่อท้ายบรรทัด `o:` ในไฟล์เดียวกัน
   อย่าเขียนเป็น `username=NS1\svc_idletime` เพราะ backslash จะทำให้ค่าถูกตีความผิด
3. รหัสผ่านมีอักขระพิเศษอย่าง `,` หรือ `=` ซึ่งชนกับตัวคั่นของ mount option
   เปลี่ยนรหัสผ่านให้เหลือแค่ตัวอักษรกับตัวเลขจะง่ายกว่า

**อัปโหลดแล้วขึ้นว่าเขียนไม่ได้** แปลว่า mount ผ่านแต่สิทธิ์ไม่พอ กลับไปตรวจข้อ 1.3 และ 1.4
ว่าให้ `svc_idletime` เป็น FullAccess บนแชร์และ Modify บน NTFS ครบทั้งสองชั้น

**อยากย้อนกลับไปเก็บรูปที่เครื่อง 222 เหมือนเดิม**

```powershell
docker compose -f docker-compose.deploy-share.yml down
docker compose -f docker-compose.deploy.yml up -d
```

รูปที่อัปโหลดไประหว่างนั้นจะค้างอยู่บนเครื่อง 188 ต้องก๊อปกลับมาที่ `data\photos` เอง

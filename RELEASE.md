# การ build APK สำหรับแจกจริง

ระหว่างพัฒนาให้ใช้ debug build คู่กับ Metro ตามปกติ ขั้นตอนในไฟล์นี้ใช้เฉพาะตอนจะแจก APK ให้ลีดเดอร์

## Branch, tag และเลขเวอร์ชัน

- `main` = โค้ดของรุ่นล่าสุดที่แจกแล้วเสมอ ไม่ commit งานที่ยังไม่เสร็จลง `main` ตรง ๆ
- ทำงานใน branch แยก ตั้งชื่อตามเนื้องาน เช่น `release-1.3.0` หรือ `fix-photo-upload`
  เสร็จแล้วรวมเข้า `main` (fast-forward ถ้าทำได้) แล้วลบ branch นั้นทิ้งทั้งในเครื่องและบน GitHub
- ทุกรุ่นที่แจก APK ต้องติด tag `v<version>` ที่ commit ที่ใช้ build จริง เช่น `git tag -a v1.2.1 -m "Release 1.2.1" <sha>`
  แล้ว `git push origin v1.2.1` ย้อนดูโค้ดของรุ่นที่อยู่ในมือถือเครื่องไหนก็ได้ด้วย `git checkout v1.2.1`
- เลขเวอร์ชัน: แก้บั๊กอย่างเดียวขึ้นหลักสุดท้าย (1.2.0 → 1.2.1) มีฟีเจอร์ใหม่ขึ้นหลักกลาง (1.2.1 → 1.3.0)
  `android.versionCode` +1 ทุกรุ่นเสมอ
- **repo นี้เป็น public** ห้าม commit ไฟล์ลับ (`firebase-service-account.json`, `.env`, กุญแจ `.jks`, รหัสผ่าน)
  และไม่แนบ APK ไว้ใน GitHub Release แบบ public เว้นแต่ตั้งใจให้ใครก็โหลดได้

ลำดับเมื่อออกรุ่นใหม่ (ต่อจากหัวข้อ "ก่อนแจกทุกครั้ง" ด้านล่าง)

1. commit งานทั้งหมดใน branch ของรุ่น แล้ว build APK จาก commit นั้น
2. รวม branch เข้า `main` แล้ว push: `git checkout main && git merge --ff-only <branch> && git push origin main`
3. ติด tag ที่ commit ที่ build แล้ว push tag
4. ลบ branch: `git branch -d <branch> && git push origin --delete <branch>`
5. deploy notify-server และเว็บตาม `notify-server/DEPLOY.md` (ชุดไฟล์ไว้ใน `notify-server/deploy-YYYYMMDD/` ซึ่งไม่ขึ้น git)
6. เพิ่มแถวในตารางรุ่นด้านล่าง

## กุญแจ sign แอป (Release signing)

APK ที่แจกต้อง sign ด้วยกุญแจของโปรเจกต์เอง ไม่ใช่ `debug.keystore` ที่มากับ template
เพราะ debug.keystore เป็นกุญแจสาธารณะ ใครก็สร้าง APK ที่ติดตั้งทับแอปนี้ได้

**กุญแจเปลี่ยนภายหลังไม่ได้** ถ้ากุญแจหาย จะออกเวอร์ชันใหม่ให้ติดตั้งทับเครื่องที่มีแอปอยู่แล้วไม่ได้
ทุกเครื่องต้องถอนแอปแล้วติดตั้งใหม่ ข้อมูลที่ค้างในเครื่องจะหายทั้งหมด

### ของที่ต้องมีบนเครื่องที่ build

| ของ | อยู่ที่ |
|---|---|
| ไฟล์กุญแจ | `%USERPROFILE%\.idletime-keys\idletime-release.jks` |
| รหัสผ่านและตำแหน่งกุญแจ | `%USERPROFILE%\.gradle\gradle.properties` (ค่าที่ขึ้นต้นด้วย `IDLETIME_UPLOAD_`) |

ทั้งสองอย่างอยู่นอก repo โดยตั้งใจ เพราะ repo นี้อยู่บน GitHub

**สำรองทั้งสองไฟล์ไว้ด้วยกันนอกเครื่องนี้** เช่น password manager หรือ USB ที่เก็บในที่ปลอดภัย
ไฟล์ `.jks` อย่างเดียวใช้ไม่ได้ถ้าไม่มีรหัสผ่าน

### ตั้งค่าบนเครื่องใหม่

ก๊อปไฟล์ `.jks` ที่สำรองไว้มาวาง แล้วเพิ่มบรรทัดเหล่านี้ใน `~/.gradle/gradle.properties`

```properties
IDLETIME_UPLOAD_STORE_FILE=C:/Users/<ชื่อผู้ใช้>/.idletime-keys/idletime-release.jks
IDLETIME_UPLOAD_STORE_PASSWORD=<รหัสผ่านที่สำรองไว้>
IDLETIME_UPLOAD_KEY_ALIAS=idletime
IDLETIME_UPLOAD_KEY_PASSWORD=<รหัสผ่านที่สำรองไว้>
```

ถ้าไม่ได้ตั้งค่า release build จะหยุดพร้อมข้อความ `Release signing key not configured`
แทนการแอบ sign ด้วย debug.keystore ส่วน debug build ใช้ได้ตามปกติ

การตั้งค่านี้ใส่ลง `android/app/build.gradle` ผ่าน [plugins/withReleaseSigning.js](plugins/withReleaseSigning.js)
เพราะโฟลเดอร์ `android/` ถูกสร้างใหม่ทุกครั้งที่ prebuild ห้ามแก้ build.gradle ด้วยมือ

### ตรวจว่า release ใช้กุญแจถูกตัว

```sh
cd android
./gradlew :app:signingReport
```

ดูที่ `Variant: release` ต้องเป็น `idletime-release.jks` และ SHA1 ต้องเป็น
`51:A3:93:D1:BB:F2:AC:9D:90:12:2D:66:91:4D:88:66:BB:2D:61:5A`

SHA1 นี้ใช้จำกัด Firebase API key ใน Google Cloud Console ด้วย
(APIs & Services → Credentials → เลือก Android key → Application restrictions → Android apps
ใส่ package `com.noomzaza.idletime` คู่กับ SHA1 นี้)

## ก่อนแจกทุกครั้ง

1. `USE_MOCK_AUTH` และ `USE_MOCK_DATA` ใน [src/api/config.ts](src/api/config.ts) ต้องเป็น `false`
   (release build จะล้มตั้งแต่เปิดแอปถ้าลืม)
2. รัน test ของกติกาช่วงพักและ notify-server: `cd notify-server && npm test`
3. ขึ้นเลขใน `app.json`: `version` (เช่น 1.1.0 → 1.2.0) และ `android.versionCode` +1 ทุกครั้ง
   แล้วรัน `npx expo prebuild --platform android` ให้เลขลงไปที่ `android/app/build.gradle`
   (Android ไม่ยอมติดตั้งทับถ้า versionCode ต่ำกว่าตัวที่อยู่ในเครื่อง และใช้เลขนี้บอกว่าเครื่องไหนลงรุ่นไหน)
4. `cd android && ./gradlew assembleRelease` → ได้ไฟล์ `android/app/build/outputs/apk/release/app-release.apk`
   แล้วคัดลอกออกมาที่ root ของโปรเจกต์เป็น `idletime-<version>.apk` (เช่น `idletime-1.1.0.apk`) ก่อนส่งเข้ามือถือ
   ชื่อไฟล์ต้องมีเลขเวอร์ชัน เคยส่ง `idletime-release.apk` รุ่นเก่าเข้าเครื่องแทนรุ่นใหม่เพราะชื่อเหมือนกันทุกรุ่น
5. เครื่องที่เคยติดตั้ง APK ที่ sign ด้วย debug.keystore ต้องถอนแอปก่อนหนึ่งครั้ง

| รุ่น | versionCode | วันที่ | หมายเหตุ |
| --- | --- | --- | --- |
| 1.0.0 | 1 | — | รุ่นแรกที่แจก |
| 1.1.0 | 2 | 2026-10-22 | error อ่านง่าย + ปุ่มคัดลอก (expo-clipboard), หน้ากรอกแบบใหม่, ภาษาไทยเป็นค่าเริ่มต้น, Expo SDK 57 ล่าสุด |
| 1.1.1 | 3 | 2026-10-22 | แก้รูปที่ 2 ไม่ขึ้นจนกว่าจะกดบันทึก และรูปที่ถูกลบจากเครื่องอื่นค้างบนจอ |
| 1.2.0 | 4 | 2026-11-10 | (เครื่องทดสอบเท่านั้น ไม่มี tag เพราะ build จากโค้ดที่ยังไม่ได้ commit) หน้ารายการแบบแถว + dropdown ไลน์, ภาษาเกาหลี, เลือกสาเหตุจากรายการ, ล็อก "กำลังกรอก", ลายน้ำโลโก้, หัวจอไล่สี, ปุ่มเรียงลำดับ, หน้ากราฟเต็มจอใหม่ |
| 1.2.1 | 5 | 2026-11-10 | ป้าย "กำลังกรอก" แบบเรียลไทม์ผ่าน WebSocket (ต้องใช้ notify-server รุ่นที่มี /api/v1/Presence/ws) |

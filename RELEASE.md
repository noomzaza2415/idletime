# การ build APK สำหรับแจกจริง

ระหว่างพัฒนาให้ใช้ debug build คู่กับ Metro ตามปกติ ขั้นตอนในไฟล์นี้ใช้เฉพาะตอนจะแจก APK ให้ลีดเดอร์

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
3. `cd android && ./gradlew assembleRelease`
4. เครื่องที่เคยติดตั้ง APK ที่ sign ด้วย debug.keystore ต้องถอนแอปก่อนหนึ่งครั้ง

const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * ให้ release build ใช้กุญแจของโปรเจกต์เอง ไม่ใช่ debug.keystore
 *
 * template ของ Expo ตั้ง release ให้ sign ด้วย debug.keystore ซึ่งเป็นกุญแจสาธารณะ
 * ที่ทุกโปรเจกต์ React Native ใช้ร่วมกัน ใครก็สร้าง APK ที่ติดตั้งทับแอปนี้ได้
 * และกุญแจเปลี่ยนภายหลังไม่ได้ ถ้าแจก APK ไปแล้วค่อยเปลี่ยน ทุกเครื่องต้องถอนแอปก่อน
 *
 * ค่ากุญแจอ่านจาก ~/.gradle/gradle.properties ไม่ใส่ใน repo เพราะ repo นี้ขึ้น GitHub
 * android/ ถูก gitignore และสร้างใหม่ทุกครั้งที่ prebuild จึงต้องแก้ผ่าน plugin นี้
 * ไม่แก้ build.gradle ด้วยมือ
 *
 * ถ้าไม่มีค่ากุญแจ release build จะหยุดพร้อมบอกเหตุผล ดีกว่าปล่อยให้ได้ APK
 * ที่ sign ผิดกุญแจแล้วแจกออกไปโดยไม่รู้ตัว ส่วน debug build ไม่กระทบ
 */

const MARKER = '// withReleaseSigning';

const SIGNING_BLOCK = `
        release { ${MARKER}
            if (project.hasProperty('IDLETIME_UPLOAD_STORE_FILE')) {
                storeFile file(IDLETIME_UPLOAD_STORE_FILE)
                storePassword IDLETIME_UPLOAD_STORE_PASSWORD
                keyAlias IDLETIME_UPLOAD_KEY_ALIAS
                keyPassword IDLETIME_UPLOAD_KEY_PASSWORD
            }
        }`;

// ข้อความที่ฝังลง build.gradle ใช้ ASCII ล้วน เพราะ Groovy บน Windows อาจอ่านไฟล์ด้วย codepage เครื่อง
const GUARD_BLOCK = `
${MARKER}: fail release builds without the project key instead of silently using debug.keystore
gradle.taskGraph.whenReady { graph ->
    def wantsRelease = graph.allTasks.any { it.project == project && it.name ==~ /(assemble|bundle|package|install)Release/ }
    if (wantsRelease && !project.hasProperty('IDLETIME_UPLOAD_STORE_FILE')) {
        throw new GradleException("Release signing key not configured: set IDLETIME_UPLOAD_* in ~/.gradle/gradle.properties (see RELEASE.md)")
    }
}
`;

/** แยกออกมาเพื่อทดสอบกับไฟล์ build.gradle จริงได้โดยไม่ต้องรัน prebuild */
function applyReleaseSigning(contents) {
  if (contents.includes(MARKER)) return contents;

  const withConfig = contents.replace(
    /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\n\s*\})/,
    `$1${SIGNING_BLOCK}`
  );

  const withRelease = withConfig.replace(
    /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );

  if (withConfig === contents || withRelease === withConfig) {
    throw new Error(
      'withReleaseSigning: หาโครง signingConfigs/buildTypes.release ใน app/build.gradle ไม่เจอ template อาจเปลี่ยนไป'
    );
  }

  return `${withRelease}${GUARD_BLOCK}`;
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (config) => {
    config.modResults.contents = applyReleaseSigning(config.modResults.contents);
    return config;
  });

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;

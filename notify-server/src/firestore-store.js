import admin from 'firebase-admin';

/**
 * อ่านรายการเครื่องจาก Firestore
 *
 * เหตุที่ต้องมีนอกเหนือจากไฟล์ JSON ในเครื่อง — แอปเขียน token ลง Firestore ได้โดยตรง
 * ผ่านเน็ตอะไรก็ได้ ไม่ต้องเข้าถึง server ในโรงงาน ทำให้มือถือที่อยู่นอกวง
 * ลงทะเบียนครั้งแรกหรือต่ออายุ token ที่หมดอายุได้
 *
 * ไฟล์ JSON ยังใช้อยู่ควบคู่กัน เครื่องที่เคยลงทะเบียนไว้แล้วจึงไม่ต้องทำอะไรใหม่
 */
export class FirestoreStore {
  /** ชื่อ collection ที่แอปเขียน token เข้ามา */
  static COLLECTION = 'devices';

  constructor(app) {
    this.db = admin.firestore(app);
  }

  /**
   * เครื่องทั้งหมดที่ยังใช้งานได้ พร้อม platform เพราะ iPhone ต้องส่งผ่าน APNs ไม่ใช่ FCM
   * @returns {Promise<{token: string, platform: string}[]>}
   */
  async activeDevices() {
    const snapshot = await this.db
      .collection(FirestoreStore.COLLECTION)
      .where('active', '==', true)
      .get();

    return snapshot.docs
      .map((doc) => ({ token: doc.get('token'), platform: doc.get('platform') ?? 'unknown' }))
      .filter((device) => device.token);
  }

  /**
   * ปิดเครื่องที่ FCM บอกว่าใช้ไม่ได้แล้ว
   * ไม่ลบทิ้งเพื่อให้ตรวจย้อนหลังได้ว่าเครื่องไหนเคยลงทะเบียน
   */
  async deactivate(tokens) {
    if (tokens.length === 0) return 0;

    let changed = 0;
    // Firestore จำกัด where-in ไม่เกิน 30 ค่าต่อ query
    for (let i = 0; i < tokens.length; i += 30) {
      const chunk = tokens.slice(i, i + 30);
      const snapshot = await this.db
        .collection(FirestoreStore.COLLECTION)
        .where('token', 'in', chunk)
        .get();

      if (snapshot.empty) continue;

      const batch = this.db.batch();
      snapshot.docs.forEach((doc) => batch.update(doc.ref, { active: false }));
      await batch.commit();
      changed += snapshot.size;
    }
    return changed;
  }

  async stats() {
    const snapshot = await this.db.collection(FirestoreStore.COLLECTION).get();
    const active = snapshot.docs.filter((d) => d.get('active') === true).length;
    return { total: snapshot.size, active };
  }
}

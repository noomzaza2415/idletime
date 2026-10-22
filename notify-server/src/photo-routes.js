import { createReadStream } from 'node:fs';

import express from 'express';
import multer from 'multer';

import {
  isValidFileName,
  isValidRecordId,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_RECORD,
  PhotoStore,
} from './photo-store.js';

/** path ที่ router นี้ถูก mount ไว้ ใช้ประกอบ url ที่ส่งกลับให้แอป */
export const PHOTO_ROUTE = '/api/v1/IdleTime/Photos';

/** จำนวนรูปสูงสุดต่อการอัปโหลดหนึ่งครั้ง เลือกได้หลายรูปจากคลังภาพในทีเดียว */
const MAX_FILES_PER_REQUEST = 10;

/**
 * เก็บไฟล์ไว้ในหน่วยความจำก่อนแล้วค่อยเขียนเอง ไม่ใช้ diskStorage ของ multer
 * เพราะถ้าไฟล์ใหญ่เกินโควตา diskStorage จะทิ้งไฟล์ที่เขียนค้างไว้บนดิสก์
 * ขนาดถูกจำกัดไว้ 10MB ต่อไฟล์อยู่แล้ว การถือไว้ในหน่วยความจำจึงไม่หนัก
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_FILES_PER_REQUEST },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') return cb(null, true);
    cb(new Error(`รับเฉพาะไฟล์ jpg และ png (ได้รับ ${file.mimetype})`));
  },
});

function fail(res, status, message) {
  return res.status(status).json({ isSuccess: false, errorMessages: [message] });
}

/** แปลงรายการในคลังให้เป็นรูปแบบที่แอปใช้ได้ทันที คือมี url ให้เอาไปแสดงเลย */
function toDto(photo) {
  return { fileName: photo.fileName, url: `${PHOTO_ROUTE}/file/${photo.fileName}` };
}

/** รูปแบบผลลัพธ์เดียวกันสำหรับการอ่านและอัปโหลดรูปของหนึ่งรายการ */
function toRecordDto(recordId, photos) {
  const cdEquip = photos.find((photo) => photo.cdEquip)?.cdEquip ?? null;
  return {
    recordId: /^\d+$/.test(recordId) ? Number(recordId) : recordId,
    cdEquip,
    photos: photos.map(toDto),
  };
}

/**
 * เส้น API สำหรับรูปแนบของรายการ idle time
 *
 * ไม่ได้บังคับ API key เหมือนเส้นยิงแจ้งเตือน เพราะแอปในมือพนักงานต้องเรียกได้ตรง
 * เหมือนกับเส้นลงทะเบียนเครื่อง สิ่งที่กันการใช้ผิดคือจำกัดชนิดไฟล์ ขนาดไฟล์
 * และจำนวนรูปต่อรายการแทน ถ้าวันหนึ่งบริการนี้เปิดออกอินเทอร์เน็ตจริง
 * ควรเปลี่ยนมาใช้ token ของผู้ใช้ที่ล็อกอินแล้ว
 *
 * @param {PhotoStore} store
 */
export function createPhotoRouter(store) {
  const router = express.Router();

  /**
   * ส่งไฟล์รูปกลับ
   *
   * ต้องประกาศก่อนเส้น "/:idleTimeId" ไม่งั้น express จะจับ "file" เป็น id รายการ
   */
  router.get('/file/:fileName', (req, res) => {
    const { fileName } = req.params;
    if (!isValidFileName(fileName)) return fail(res, 400, 'ชื่อไฟล์ไม่ถูกต้อง');
    if (!store.exists(fileName)) return fail(res, 404, 'ไม่พบไฟล์รูป');

    res.setHeader('Content-Type', PhotoStore.mimeOf(fileName));
    // ชื่อไฟล์ไม่ซ้ำและเนื้อในไม่มีวันเปลี่ยน ให้เครื่องลูกข่ายเก็บ cache ยาวได้เลย
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(store.pathOf(fileName)).pipe(res);
  });

  /** รายการรูปของรายการหนึ่ง */
  router.get('/:idleTimeId', (req, res) => {
    const { idleTimeId } = req.params;
    if (!isValidRecordId(idleTimeId)) return fail(res, 400, 'id รายการไม่ถูกต้อง');
    res.json({ isSuccess: true, result: toRecordDto(idleTimeId, store.list(idleTimeId)) });
  });

  /** อัปโหลดรูปเข้ารายการหนึ่ง ส่งได้หลายไฟล์ในครั้งเดียวผ่าน field ชื่อ files */
  router.post('/:idleTimeId', upload.array('files', MAX_FILES_PER_REQUEST), (req, res) => {
    const { idleTimeId } = req.params;
    if (!isValidRecordId(idleTimeId)) return fail(res, 400, 'id รายการไม่ถูกต้อง');

    const files = req.files ?? [];
    if (files.length === 0) return fail(res, 400, 'ไม่พบไฟล์ที่ส่งมา (field ต้องชื่อ files)');

    const already = store.list(idleTimeId).length;
    if (already + files.length > MAX_PHOTOS_PER_RECORD) {
      return fail(res, 409, `รายการนี้แนบรูปได้ไม่เกิน ${MAX_PHOTOS_PER_RECORD} รูป`);
    }

    const userName = typeof req.body?.userName === 'string' ? req.body.userName : null;
    const cdEquip = typeof req.body?.cdEquip === 'string' ? req.body.cdEquip.slice(0, 100) : null;
    files.forEach((f) => store.add(idleTimeId, f.buffer, f.mimetype, userName, cdEquip));
    console.log(`รับรูป ${files.length} ใบ ของรายการ ${idleTimeId} จาก ${userName ?? '-'}`);

    res.json({ isSuccess: true, result: toRecordDto(idleTimeId, store.list(idleTimeId)) });
  });

  /**
   * ลบรูปหนึ่งใบออกจากรายการ — ย้ายไป _trash ไม่ได้ลบจริง (ดู PhotoStore.remove)
   * body: { userName } ใช้จดว่าใครลบ ไม่ได้ใช้ยืนยันตัวตน
   */
  router.delete('/:idleTimeId/:fileName', (req, res) => {
    const { idleTimeId, fileName } = req.params;
    if (!isValidRecordId(idleTimeId)) return fail(res, 400, 'id รายการไม่ถูกต้อง');
    if (!isValidFileName(fileName)) return fail(res, 400, 'ชื่อไฟล์ไม่ถูกต้อง');

    const userName = typeof req.body?.userName === 'string' ? req.body.userName.slice(0, 200) : null;
    if (!store.remove(idleTimeId, fileName, userName)) return fail(res, 404, 'ไม่พบรูปนี้ในรายการ');

    console.log(`ลบรูป ${fileName} ของรายการ ${idleTimeId} โดย ${userName ?? '-'}`);
    res.json({ isSuccess: true, result: 'deleted' });
  });

  /**
   * ดักข้อผิดพลาดจาก multer ให้ตอบเป็นรูปแบบเดียวกับเส้นอื่น
   * ถ้าไม่ดัก express จะตอบเป็นหน้า HTML ซึ่งแอปอ่านไม่ออก
   */
  router.use((err, _req, res, _next) => {
    const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
    const message = tooLarge
      ? `ไฟล์ใหญ่เกิน ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)}MB`
      : err.message;
    console.error('อัปโหลดรูปไม่สำเร็จ:', message);
    return fail(res, 400, message);
  });

  return router;
}

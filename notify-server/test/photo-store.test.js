process.env.TZ = 'Asia/Bangkok';

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import express from 'express';

import { createPhotoRouter } from '../src/photo-routes.js';
import { isValidFileName, PhotoStore } from '../src/photo-store.js';

const dir = mkdtempSync(join(tmpdir(), 'photo-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

test('ลบรูปแล้วไฟล์ถูกย้ายไป _trash และจดว่าใครลบ ไม่ได้หายถาวร', () => {
  const store = new PhotoStore(join(dir, 'photos'), join(dir, 'photos.json'));
  const takenAt = new Date('2026-09-15T14:25:30');
  const entry = store.add('1024', Buffer.from('fake-jpeg'), 'image/jpeg', 'leader-a', takenAt);
  const livePath = store.pathOf(entry.fileName);
  assert.ok(existsSync(livePath));

  assert.equal(store.remove('1024', entry.fileName, 'leader-b'), true);

  assert.equal(existsSync(livePath), false);
  assert.ok(existsSync(store.trashPathOf(entry.fileName)));
  assert.deepEqual(store.list('1024'), []);

  const log = readFileSync(join(dir, 'photo-deletions.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(log.length, 1);
  assert.equal(log[0].deletedBy, 'leader-b');
  assert.equal(log[0].recordId, '1024');
  assert.equal(log[0].fileName, entry.fileName);

  // ลบซ้ำต้องตอบว่าไม่พบ ไม่ใช่ล้ม
  assert.equal(store.remove('1024', entry.fileName, 'leader-b'), false);
});

test('รูปที่ถ่ายก่อน 08:00 อยู่ในโฟลเดอร์เดือนของกะก่อนหน้า ทั้งตอนเก็บและตอนย้ายไป _trash', () => {
  const store = new PhotoStore(join(dir, 'photos'), join(dir, 'photos.json'));
  const entry = store.add('77', Buffer.from('x'), 'image/png', null, new Date('2026-10-01T03:00:00'));
  assert.match(store.pathOf(entry.fileName), /2026-09/);
  assert.match(store.trashPathOf(entry.fileName), /_trash[\\/]2026-09/);
});

test('เก็บ cdEquip ไว้กับรูปเพื่อใช้ตอบ Photo API', () => {
  const store = new PhotoStore(join(dir, 'photos'), join(dir, 'photos.json'));
  store.add('1024', Buffer.from('x'), 'image/jpeg', 'leader-a', 'line1');
  assert.equal(store.list('1024')[0].cdEquip, 'line1');
});

test('Photo API ตอบ recordId, cdEquip และ photos ตามสัญญาใหม่', async () => {
  const store = new PhotoStore(join(dir, 'photos-contract'), join(dir, 'photos-contract.json'));
  const photo = store.add('1024', Buffer.from('x'), 'image/jpeg', 'leader-a', 'line1');
  const app = express();
  app.use('/api/v1/IdleTime/Photos', createPhotoRouter(store));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/IdleTime/Photos/1024`);
    assert.deepEqual(await response.json(), {
      isSuccess: true,
      result: {
        recordId: 1024,
        cdEquip: 'line1',
        photos: [
          {
            fileName: photo.fileName,
            url: `/api/v1/IdleTime/Photos/file/${photo.fileName}`,
          },
        ],
      },
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('ชื่อไฟล์ที่พยายามออกนอกโฟลเดอร์รูปถูกปฏิเสธ', () => {
  for (const bad of ['../../.env', '..%2F..%2F.env', '20260909_142530_1024_a1b2.jpg/../x', 'photos.json']) {
    assert.equal(isValidFileName(bad), false, bad);
  }
  assert.equal(isValidFileName('20260909_142530_1024_a1b2.jpg'), true);
});

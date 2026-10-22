import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http2';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { ApnsSender, splitDevices } from '../src/apns.js';

/**
 * APNs จำลอง ตอบตาม token ที่ส่งมา
 *   "dead..."  -> 410 Unregistered (ถอนแอปแล้ว)
 *   "bad..."   -> 400 BadDeviceToken (อาจเกิดจากตั้ง production/sandbox ผิด)
 *   อื่น ๆ      -> 200
 */
const received = [];
let server;
let origin;
let dir;
let keyFile;
let publicKey;

before(async () => {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  publicKey = pair.publicKey;
  dir = mkdtempSync(join(tmpdir(), 'apns-test-'));
  keyFile = join(dir, 'AuthKey.p8');
  writeFileSync(keyFile, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));

  server = createServer();
  server.on('stream', (stream, headers) => {
    let raw = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      raw += chunk;
    });
    stream.on('end', () => {
      const token = headers[':path'].split('/').at(-1);
      received.push({ headers, payload: JSON.parse(raw), token });

      if (token.startsWith('dead')) {
        stream.respond({ ':status': 410 });
        return stream.end(JSON.stringify({ reason: 'Unregistered' }));
      }
      if (token.startsWith('bad')) {
        stream.respond({ ':status': 400 });
        return stream.end(JSON.stringify({ reason: 'BadDeviceToken' }));
      }
      stream.respond({ ':status': 200 });
      stream.end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

function createSender() {
  return new ApnsSender({
    keyFile,
    keyId: 'KEY1234567',
    teamId: 'TEAM123456',
    bundleId: 'com.noomzaza.idletime',
    origin,
  });
}

test('ส่งถึงทุกเครื่อง พร้อม header และ payload ที่แอปอ่านได้', async () => {
  received.length = 0;
  const sender = createSender();
  const result = await sender.send(['tokenA', 'tokenB'], {
    title: 'Line1 หยุด 5 นาที',
    body: 'รอระบุสาเหตุ',
    target: { recordId: 1024, date: '2026-10-21' },
  });
  sender.close();

  assert.deepEqual(result, { sent: 2, failed: 0, deadTokens: [] });
  assert.equal(received.length, 2);

  const { headers, payload } = received[0];
  assert.equal(headers[':method'], 'POST');
  assert.match(headers[':path'], /^\/3\/device\/token[AB]$/);
  assert.equal(headers['apns-topic'], 'com.noomzaza.idletime');
  assert.equal(headers['apns-push-type'], 'alert');

  assert.deepEqual(payload.aps.alert, { title: 'Line1 หยุด 5 นาที', body: 'รอระบุสาเหตุ' });
  // expo-notifications อ่าน content.data จากคีย์ body และค่าต้องเป็น string
  assert.deepEqual(payload.body, { recordId: '1024', date: '2026-10-21' });
});

test('JWT ลงลายมือชื่อด้วยกุญแจที่ให้มา และระบุ Key ID กับ Team ID ถูกต้อง', async () => {
  received.length = 0;
  const sender = createSender();
  await sender.send(['tokenA'], { title: 't', body: 'b' });
  sender.close();

  const jwt = received[0].headers.authorization.replace(/^bearer /, '');
  const [header, claims, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'ES256', kid: 'KEY1234567' });
  assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).iss, 'TEAM123456');

  const valid = verify(
    'sha256',
    Buffer.from(`${header}.${claims}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signature, 'base64url')
  );
  assert.equal(valid, true);
});

test('ใช้ JWT ตัวเดิมซ้ำ ไม่สร้างใหม่ทุกครั้ง (Apple ห้ามสร้างถี่)', async () => {
  received.length = 0;
  const sender = createSender();
  await sender.send(['tokenA'], { title: 't', body: 'b' });
  await sender.send(['tokenB'], { title: 't', body: 'b' });
  sender.close();

  assert.equal(received[0].headers.authorization, received[1].headers.authorization);
});

test('ปิดเฉพาะ token ที่ Apple ตอบ 410 ส่วน BadDeviceToken ไม่ปิด', async () => {
  const sender = createSender();
  const result = await sender.send(['tokenA', 'deadToken', 'badToken'], { title: 't', body: 'b' });
  sender.close();

  assert.equal(result.sent, 1);
  assert.equal(result.failed, 2);
  // BadDeviceToken เกิดจากตั้งค่า server ผิดได้ ถ้าปิดทิ้ง iPhone ทั้งโรงงานจะเงียบไปพร้อมกัน
  assert.deepEqual(result.deadTokens, ['deadToken']);
});

test('ไม่มีเครื่องก็ไม่ต้องต่อ APNs', async () => {
  received.length = 0;
  const sender = createSender();
  assert.deepEqual(await sender.send([], { title: 't', body: 'b' }), {
    sent: 0,
    failed: 0,
    deadTokens: [],
  });
  assert.equal(received.length, 0);
});

test('splitDevices: iPhone ไป APNs ที่เหลือไป FCM เหมือนเดิม และตัด token ซ้ำ', () => {
  const result = splitDevices([
    { token: 'android1', platform: 'android' },
    { token: 'iphone1', platform: 'ios' },
    { token: 'old1', platform: 'unknown' },
    { token: 'old2' },
    { token: 'android1', platform: 'android' },
    { token: 'iphone1', platform: 'ios' },
    { token: '', platform: 'ios' },
  ]);

  assert.deepEqual(result.fcm, ['android1', 'old1', 'old2']);
  assert.deepEqual(result.apns, ['iphone1']);
});

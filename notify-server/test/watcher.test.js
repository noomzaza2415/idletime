process.env.TZ = 'Asia/Bangkok';

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { getShiftDateString, getShiftWindow } from '../src/idle-rules.js';
import { IdleTimeWatcher } from '../src/watcher.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** API จำลอง ปรับรายการและสั่งให้ล่มได้ระหว่าง test */
const api = { records: [], fail: false };
let server;
let baseUrl;
let dir;

before(async () => {
  server = createServer((_req, res) => {
    if (api.fail) {
      res.statusCode = 500;
      return res.end();
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ isSuccess: true, result: api.records }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  dir = mkdtempSync(join(tmpdir(), 'watcher-test-'));
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

/** รายการหยุดไลน์ 5 นาทีตอน 09:00 ของกะปัจจุบัน ไม่ตรงช่วงพักใด ๆ และยังไม่มีสาเหตุ */
function stop(id) {
  const { start } = getShiftWindow(getShiftDateString());
  const at = new Date(start.getTime() + 60 * 60_000);
  const local = new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 19);
  return { id, dateTime: local, timestartOff: local, totaltimeoffMins: 5, lineName: 'Line1', idletimeIss: null };
}

function watch(stateFile, notified) {
  return new IdleTimeWatcher({
    apiBaseUrl: baseUrl,
    recordsPath: '/records',
    intervalMs: 50,
    stateFile,
    onNewRecords: (records) => notified.push(records.map((r) => r.id)),
  });
}

test('restart กลางกะแล้วยังแจ้งรายการที่เข้ามาช่วงบริการดับ', async () => {
  const stateFile = join(dir, 'restart.json');
  api.fail = false;
  api.records = [stop(1)];

  const first = [];
  let w = watch(stateFile, first);
  w.start();
  await wait(200);
  api.records = [stop(1), stop(2)];
  await wait(200);
  w.stop();
  // รายการที่มีอยู่ตอนติดตั้งครั้งแรกไม่ถูกแจ้ง มีแค่รายการที่เข้ามาทีหลัง
  assert.deepEqual(first, [[2]]);

  api.records = [stop(1), stop(2), stop(3)];
  const second = [];
  w = watch(stateFile, second);
  w.start();
  await wait(200);
  w.stop();
  assert.deepEqual(second, [[3]]);
});

test('status รายงานไม่ปกติเมื่อดึงข้อมูลไม่สำเร็จนานเกินกำหนด', async () => {
  api.fail = true;
  const w = watch(join(dir, 'stale.json'), []);
  w.start();
  await wait(150);
  w.stop();

  // เพิ่งเริ่ม ยังไม่นับว่าผิดปกติ
  assert.equal(w.status(60_000).healthy, true);
  // เกินกำหนดแล้วต้องฟ้อง พร้อมบอกเหตุผล
  const stale = w.status(10);
  assert.equal(stale.healthy, false);
  assert.match(stale.lastError, /500/);
});

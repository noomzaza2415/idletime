import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanField, PresenceStore } from '../src/presence.js';

function makeStore(opts = {}) {
  let t = 1_000_000;
  const store = new PresenceStore({ ttlMs: 90_000, now: () => t, ...opts });
  return { store, advance: (ms) => (t += ms) };
}

test('คนแรกได้ล็อก คนที่สองถูกบอกว่าใครถืออยู่', () => {
  const { store } = makeStore();
  assert.equal(store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai').granted, true);
  const second = store.heartbeat('2026-11-10', 'r1', 'devB', 'Malee');
  assert.equal(second.granted, false);
  assert.equal(second.holder.userName, 'Somchai');
});

test('เครื่องเดิมต่ออายุล็อกได้ และเวลาเริ่มไม่เปลี่ยน', () => {
  const { store, advance } = makeStore();
  const first = store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  advance(60_000);
  const again = store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  assert.equal(again.granted, true);
  assert.equal(again.holder.since, first.holder.since);
  advance(60_000);
  // ยังไม่หมดอายุ เพราะต่ออายุไปเมื่อ 60 วินาทีก่อน
  assert.equal(store.heartbeat('2026-11-10', 'r1', 'devB', 'Malee').granted, false);
});

test('ไม่ส่ง heartbeat เกิน TTL ล็อกหลุด คนอื่นจองต่อได้', () => {
  const { store, advance } = makeStore();
  store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  advance(90_001);
  assert.equal(store.heartbeat('2026-11-10', 'r1', 'devB', 'Malee').granted, true);
  assert.equal(store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai').granted, false);
});

test('ปล่อยล็อกได้เฉพาะเครื่องที่ถืออยู่', () => {
  const { store } = makeStore();
  store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  assert.equal(store.release('2026-11-10', 'r1', 'devB'), false);
  assert.equal(store.heartbeat('2026-11-10', 'r1', 'devB', 'Malee').granted, false);
  assert.equal(store.release('2026-11-10', 'r1', 'devA'), true);
  assert.equal(store.heartbeat('2026-11-10', 'r1', 'devB', 'Malee').granted, true);
});

test('รายการคนละวันหรือคนละ id ไม่ล็อกกัน และ list แยกตามวัน', () => {
  const { store } = makeStore();
  store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  assert.equal(store.heartbeat('2026-11-10', 'r2', 'devB', 'Malee').granted, true);
  assert.equal(store.heartbeat('2026-11-09', 'r1', 'devB', 'Malee').granted, true);
  assert.deepEqual(
    store.list('2026-11-10').map((l) => l.recordId).sort(),
    ['r1', 'r2']
  );
  assert.equal(store.list('2026-11-09').length, 1);
});

test('store เต็มแล้วไม่ล็อกใคร (ปล่อยให้แก้ได้ ดีกว่าล็อกผิดคน)', () => {
  const { store } = makeStore({ maxEntries: 1 });
  store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  const res = store.heartbeat('2026-11-10', 'r2', 'devB', 'Malee');
  assert.equal(res.granted, true);
  assert.equal(res.holder, null);
});

test('cleanField รับเฉพาะข้อความสั้นที่ไม่ว่าง', () => {
  assert.equal(cleanField(' abc '), 'abc');
  assert.equal(cleanField(42), '42');
  assert.equal(cleanField(''), null);
  assert.equal(cleanField(null), null);
  assert.equal(cleanField({}), null);
  assert.equal(cleanField('x'.repeat(201)), null);
});

test('onChange แจ้งเมื่อผู้ถือล็อกเปลี่ยน ไม่แจ้งตอนต่ออายุ', () => {
  const events = [];
  const { store, advance } = makeStore({ onChange: (d) => events.push(d) });
  store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  assert.deepEqual(events, ['2026-11-10']);
  store.heartbeat('2026-11-10', 'r1', 'devA', 'Somchai');
  store.heartbeat('2026-11-10', 'r1', 'devB', 'Malee');
  assert.equal(events.length, 1, 'ต่ออายุหรือถูกปฏิเสธไม่ต้องแจ้ง');
  store.release('2026-11-10', 'r1', 'devA');
  assert.equal(events.length, 2);
  store.heartbeat('2026-11-09', 'r2', 'devA', 'Somchai');
  advance(90_001);
  store.prune();
  assert.deepEqual(events, ['2026-11-10', '2026-11-10', '2026-11-09', '2026-11-09']);
});

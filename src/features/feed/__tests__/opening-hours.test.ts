import assert from 'node:assert/strict';
import { isOpenNow } from '../feed-filters';

process.env.TZ = 'Europe/Berlin';

const checks: [string | null, string, boolean][] = [
  ['Sa 22:00-02:00', '2026-10-03T23:00:00+02:00', true],
  ['Sa 22:00-02:00', '2026-10-04T01:00:00+02:00', true],
  ['Sa 22:00-02:00', '2026-10-03T01:00:00+02:00', false],
  ['Sa 22:00-02:00', '2026-10-04T02:00:00+02:00', false],
  ['Mo 09:00-12:00,13:00-18:00', '2026-10-05T14:00:00+02:00', true],
  ['Mo 09:00-12:00,13:00-18:00', '2026-10-05T12:30:00+02:00', false],
  ['Mo-Fr 09:00-18:00; Sa 10:00-14:00', '2026-10-03T11:00:00+02:00', true],
  ['Mo-Fr 09:00-18:00; Sa 10:00-14:00', '2026-10-04T11:00:00+02:00', false],
  ['Fr-Mo 22:00-02:00', '2026-10-06T01:00:00+02:00', true],
  ['Mo,We,Fr 09:00-18:00', '2026-10-06T14:00:00+02:00', false],
  ['Mo,We,Fr 09:00-18:00', '2026-10-07T14:00:00+02:00', true],
  ['09:00-18:00', '2026-10-06T09:00:00+02:00', true],
  ['09:00-18:00', '2026-10-06T18:00:00+02:00', false],
  ['00:00-24:00', '2026-10-06T23:59:00+02:00', true],
  ['Sa 22:00-02:00', '2026-03-29T01:30:00+01:00', true],
  ['Sa 22:00-03:00', '2026-10-25T02:30:00+01:00', true],
  ['24/7', '2026-10-06T14:00:00+02:00', true],
  ['Mo 28:90-29:00', '2026-10-05T14:00:00+02:00', false],
  ['off', '2026-10-06T14:00:00+02:00', false],
  [null, '2026-10-06T14:00:00+02:00', false],
];
for (const [hours, time, expected] of checks) {
  assert.equal(isOpenNow(hours, new Date(time)), expected, `${hours} at ${time}`);
}
console.log(`Opening hours: ${checks.length} deterministic checks passed`);

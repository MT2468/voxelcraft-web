import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededNoise } from '../src/noise.js';

test('same seed and coordinates are deterministic', () => {
  const a = new SeededNoise(2468);
  const b = new SeededNoise(2468);
  const samplesA = [
    a.hash2(12, -7, 3),
    a.hash3(2, 11, -9, 8),
    a.value2(10.25, 99.4, 0.04, 1),
    a.value3(3.3, 5.1, 7.9, 0.08, 2),
    a.fbm2(42, -13, 0.025, 4, 11)
  ];
  const samplesB = [
    b.hash2(12, -7, 3),
    b.hash3(2, 11, -9, 8),
    b.value2(10.25, 99.4, 0.04, 1),
    b.value3(3.3, 5.1, 7.9, 0.08, 2),
    b.fbm2(42, -13, 0.025, 4, 11)
  ];
  assert.deepEqual(samplesA, samplesB);
});

test('different seeds alter generated values', () => {
  const a = new SeededNoise(100);
  const b = new SeededNoise(101);
  assert.notEqual(a.value3(12.3, 8.4, -4.5, 0.07, 9), b.value3(12.3, 8.4, -4.5, 0.07, 9));
});

test('noise outputs remain normalized', () => {
  const noise = new SeededNoise(999);
  for (let x = -10; x <= 10; x += 2) {
    for (let z = -10; z <= 10; z += 2) {
      const values = [
        noise.hash2(x, z, 1),
        noise.hash3(x, 6, z, 2),
        noise.value2(x + 0.3, z - 0.8, 0.12, 3),
        noise.value3(x + 0.3, 6.2, z - 0.8, 0.12, 4),
        noise.fbm2(x, z, 0.03, 5, 5)
      ];
      for (const value of values) {
        assert.ok(Number.isFinite(value));
        assert.ok(value >= 0 && value <= 1, `out of range: ${value}`);
      }
    }
  }
});

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

export class SeededNoise {
  constructor(seed = 1) {
    this.seed = seed | 0;
  }

  hash2(x, z, salt = 0) {
    let n = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul((this.seed + salt) | 0, 1442695041)) | 0;
    n ^= n >>> 13;
    n = Math.imul(n, 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967295;
  }

  hash3(x, y, z, salt = 0) {
    let n = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791) ^ Math.imul((this.seed + salt) | 0, 2654435761);
    n ^= n >>> 15;
    n = Math.imul(n, 2246822519);
    n ^= n >>> 13;
    return (n >>> 0) / 4294967295;
  }

  value2(x, z, scale = 1, salt = 0) {
    const fx = x * scale;
    const fz = z * scale;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = smooth(fx - x0);
    const tz = smooth(fz - z0);
    const a = this.hash2(x0, z0, salt);
    const b = this.hash2(x0 + 1, z0, salt);
    const c = this.hash2(x0, z0 + 1, salt);
    const d = this.hash2(x0 + 1, z0 + 1, salt);
    return mix(mix(a, b, tx), mix(c, d, tx), tz);
  }

  value3(x, y, z, scale = 1, salt = 0) {
    const fx = x * scale;
    const fy = y * scale;
    const fz = z * scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const z0 = Math.floor(fz);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const tz = smooth(fz - z0);
    const n000 = this.hash3(x0, y0, z0, salt);
    const n100 = this.hash3(x0 + 1, y0, z0, salt);
    const n010 = this.hash3(x0, y0 + 1, z0, salt);
    const n110 = this.hash3(x0 + 1, y0 + 1, z0, salt);
    const n001 = this.hash3(x0, y0, z0 + 1, salt);
    const n101 = this.hash3(x0 + 1, y0, z0 + 1, salt);
    const n011 = this.hash3(x0, y0 + 1, z0 + 1, salt);
    const n111 = this.hash3(x0 + 1, y0 + 1, z0 + 1, salt);
    const x00 = mix(n000, n100, tx);
    const x10 = mix(n010, n110, tx);
    const x01 = mix(n001, n101, tx);
    const x11 = mix(n011, n111, tx);
    return mix(mix(x00, x10, ty), mix(x01, x11, ty), tz);
  }

  fbm2(x, z, scale, octaves = 4, salt = 0) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.value2(x, z, scale * frequency, salt + i * 101) * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total ? value / total : 0;
  }
}

#!/usr/bin/env node
// make-icons.mjs — render the IKOS mark (the loader-thumbnail SVG: gold core +
// three rotated ellipse rings on slate) into the PWA icon PNGs, dependency-free.
// Output: icons/icon-{192,512}.png · icon-maskable-{192,512}.png · icon-180.png (apple)
// Rerun only if the mark or palette changes: node scripts/make-icons.mjs

import fs from 'fs';
import zlib from 'zlib';

const BG = [0x0c, 0x0f, 0x14], GOLD = [0xd4, 0xb1, 0x5f];
// logo geometry in the SVG's viewBox-100 units, origin at centre
const CORE_R = 9, RX = 26, RY = 11, STROKE = 2, ROTS = [0, 60, 120].map(d => d * Math.PI / 180);

// --- PNG encoder (8-bit RGBA, filter 0) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(S, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA8
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- render: signed-distance shapes with 1px analytic anti-aliasing ---
function render(S, contentScale) {
  const k = (S / 100) * contentScale; // logo units → pixels
  const px = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const lx = (x + 0.5 - S / 2) / k, ly = (y + 0.5 - S / 2) / k;
    let cov = Math.max(0, Math.min(1, 0.5 - (Math.hypot(lx, ly) - CORE_R) * k)); // filled core
    for (const th of ROTS) { // ellipse outlines, gradient-normalised implicit distance
      const qx = lx * Math.cos(th) + ly * Math.sin(th), qy = -lx * Math.sin(th) + ly * Math.cos(th);
      const e = Math.hypot(qx / RX, qy / RY) - 1;
      const g = Math.hypot(qx / (RX * RX), qy / (RY * RY)) || 1e-9;
      const d = Math.abs(e / g) - STROKE / 2;
      cov = Math.max(cov, Math.max(0, Math.min(1, 0.5 - d * k)));
    }
    const i = (y * S + x) * 4;
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] + (GOLD[c] - BG[c]) * cov);
    px[i + 3] = 255;
  }
  return encodePNG(S, px);
}

fs.mkdirSync('icons', { recursive: true });
const out = {
  'icon-192.png': render(192, 1.35), 'icon-512.png': render(512, 1.35), // roomy, platforms don't mask these
  'icon-maskable-192.png': render(192, 1.1), 'icon-maskable-512.png': render(512, 1.1), // mark inside the 80% safe zone
  'icon-180.png': render(180, 1.35), // apple-touch-icon
};
for (const [name, buf] of Object.entries(out)) { fs.writeFileSync('icons/' + name, buf); console.log('✓ icons/' + name + '  (' + buf.length.toLocaleString() + ' bytes)'); }

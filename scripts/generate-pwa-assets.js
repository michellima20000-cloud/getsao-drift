import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// CRC32 helper for PNG
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function generatePng(width, height, isMaskable = false) {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.38 : 0.44);

  // Background colors: #070D1E
  const bgR = 7, bgG = 13, bgB = 30;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background
      let r = bgR, g = bgG, b = bgB, a = 255;

      // Glow circle in center
      if (dist < radius * 1.05) {
        const glowFactor = Math.max(0, 1 - dist / radius);
        r = Math.min(255, Math.round(bgR + glowFactor * 20));
        g = Math.min(255, Math.round(bgG + glowFactor * 80));
        b = Math.min(255, Math.round(bgB + glowFactor * 140));
      }

      // Outer speed arc (between 0.82 * radius and 0.94 * radius)
      // Arc angle: exclude bottom 70 degrees (roughly from angle 45 to 135 deg where y > cy)
      const angle = Math.atan2(dy, dx); // -PI to PI
      const isBottomGap = dy > 0 && Math.abs(dx) < radius * 0.45;

      if (!isBottomGap && dist >= radius * 0.78 && dist <= radius * 0.92) {
        // Cyan arc gradient
        const t = (angle + Math.PI) / (2 * Math.PI);
        r = Math.round(0 * (1 - t) + 72 * t);
        g = Math.round(180 * (1 - t) + 240 * t);
        b = 255;
      }

      // Dial needle from center (cx, cy + radius*0.1) pointing towards top-right
      const needleOriginY = cy + radius * 0.1;
      const ndx = x - cx;
      const ndy = y - needleOriginY;
      // Needle direction vector: angle approx -35 degrees (towards upper right)
      const needleAngle = -0.65; // radians
      const projDist = ndx * Math.cos(needleAngle) + ndy * Math.sin(needleAngle);
      const perpDist = Math.abs(-ndx * Math.sin(needleAngle) + ndy * Math.cos(needleAngle));

      if (projDist > 0 && projDist < radius * 0.75 && perpDist < width * 0.02) {
        r = 0; g = 240; b = 255; a = 255;
      }

      // Center pivot circle
      const pivotDist = Math.sqrt(ndx * ndx + ndy * ndy);
      if (pivotDist < radius * 0.18) {
        if (pivotDist < radius * 0.08) {
          r = 0; g = 240; b = 255; // bright cyan center
        } else {
          r = 11; g = 19; b = 43; // dark pivot
        }
      }

      // Outer border circle (only if not maskable)
      if (!isMaskable && dist >= radius * 0.96 && dist <= radius * 0.99) {
        r = 0; g = 180; b = 216; a = 180;
      }

      scanlines[pixelOffset] = r;
      scanlines[pixelOffset + 1] = g;
      scanlines[pixelOffset + 2] = b;
      scanlines[pixelOffset + 3] = a;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bit depth
  header[9] = 6; // Color type RGBA
  header[10] = 0; // Compression
  header[11] = 0; // Filter
  header[12] = 0; // Interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = createPngChunk('IHDR', header);
  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = createPngChunk('IDAT', compressed);
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate files
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.png'), generatePng(64, 64, false));

// Generate icon.svg
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <rect width="100" height="100" fill="#070D1E" rx="20"/>
  <defs>
    <linearGradient id="cyanNeonGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00B4D8"/>
      <stop offset="50%" stop-color="#48CAE4"/>
      <stop offset="100%" stop-color="#00F0FF"/>
    </linearGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <path d="M 18 72 A 38 38 0 1 1 82 72" fill="none" stroke="url(#cyanNeonGrad)" stroke-width="4.5" stroke-linecap="round" filter="url(#neonGlow)"/>
  <path d="M 28 67 A 28 28 0 1 1 72 67" fill="none" stroke="rgba(72, 202, 228, 0.35)" stroke-width="1.5" stroke-dasharray="2 4"/>
  <line x1="22" y1="64" x2="28" y2="60" stroke="#00F0FF" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="28" y1="38" x2="33" y2="42" stroke="#48CAE4" stroke-width="2" stroke-linecap="round"/>
  <line x1="50" y1="20" x2="50" y2="27" stroke="#00F0FF" stroke-width="3" stroke-linecap="round"/>
  <line x1="72" y1="38" x2="67" y2="42" stroke="#48CAE4" stroke-width="2" stroke-linecap="round"/>
  <line x1="78" y1="64" x2="72" y2="60" stroke="#00F0FF" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="50" y1="54" x2="69" y2="37" stroke="url(#cyanNeonGrad)" stroke-width="3.5" stroke-linecap="round" filter="url(#neonGlow)"/>
  <circle cx="50" cy="54" r="6.5" fill="#0B132B" stroke="#00F0FF" stroke-width="3" filter="url(#neonGlow)"/>
  <circle cx="50" cy="54" r="2.5" fill="#00F0FF"/>
  <path d="M 40 76 L 60 76" stroke="#00B4D8" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg, 'utf-8');
console.log('✅ PWA icon assets generated successfully in /public');

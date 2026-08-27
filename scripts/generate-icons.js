/**
 * ZeroHub 图标生成器 (纯 Node.js，无外部依赖)
 * 产物：
 *   - icon.svg      矢量主图标（Triquetra凯尔特三结体 + 品牌渐变圆角底板）—— 所有 UI 用这个
 *   - icon-256.png  256×256 位图 PNG
 *   - icon.ico      Windows 多尺寸图标（16/32/48/64/128/256），用于 exe 资源
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'build');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/* =============================================================
   1) SVG 矢量图标（高保真 512x512，所有页面 UI 用这个）
      - 圆角矩形底板 rx=64 (约12.5% 圆角，"适当"）
      - 品牌线性渐变 #667eea → #764ba2
      - 内部绘制凯尔特三结体 (Triquetra)
   ============================================================= */

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
    <linearGradient id="knot" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f0ecff"/>
    </linearGradient>
  </defs>

  <!-- 圆角底板（rx=64，512画布 -> 适当圆角） -->
  <rect x="0" y="0" width="512" height="512" rx="64" ry="64" fill="url(#bg)"/>

  <!-- Triquetra 凯尔特三结体（三个互锁弧），整体居中，描边宽度36，留白12的"剪影"感 -->
  <g transform="translate(256 260)" fill="none" stroke="url(#knot)" stroke-width="38" stroke-linecap="round" stroke-linejoin="round">
    <!-- 上结弧 -->
    <path d="M 0 -160 A 160 160 0 0 1 138.56 80 L -69.28 -40 A 80 80 0 0 0 0 80 L 69.28 -40 A 80 80 0 0 1 -138.56 80 A 160 160 0 0 1 0 -160 Z"/>
    <!-- 左下结弧 -->
    <path d="M -152 88 A 160 160 0 0 1 -19.28 -140.6 L -9.28 60.62 A 80 80 0 0 0 -120 48 L 40 -8 A 80 80 0 0 1 58.56 129.28 A 160 160 0 0 1 -152 88 Z"/>
    <!-- 右下结弧 -->
    <path d="M 152 88 A 160 160 0 0 1 19.28 -140.6 L 9.28 60.62 A 80 80 0 0 1 120 48 L -40 -8 A 80 80 0 0 0 -58.56 129.28 A 160 160 0 0 1 152 88 Z"/>
    <!-- 中心三角加强 -->
    <path d="M 0 -72 L 62.35 36 L -62.35 36 Z" fill="none" stroke="url(#knot)" stroke-width="28" stroke-linejoin="round"/>
  </g>

  <!-- 中心小点增加细节感 -->
  <circle cx="256" cy="260" r="10" fill="#ffffff" opacity="0.85"/>
</svg>`;

fs.writeFileSync(path.join(OUT_DIR, 'icon.svg'), SVG, 'utf-8');
console.log('✓ icon.svg 生成');

/* =============================================================
   2) 纯 JS 生成 256x256 PNG（无 canvas 依赖）
      圆角底板 + 白色大 Z 字母（近似品牌视觉，exe 资源图/网站小图标用）
   ============================================================= */

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function roundRectAlpha(x, y, cx, cy, rx, ry, radius) {
  // 点(x,y)在以(cx,cy)中心 (2rx*2ry)圆角矩形内返回 true
  const left = cx - rx, right = cx + rx, top = cy - ry, bottom = cy + ry;
  if (x < left || x > right || y < top || y > bottom) return 0;
  // 判断是否在四个圆角外
  let dx = 0, dy = 0;
  if (x < left + radius) dx = left + radius - x;
  else if (x > right - radius) dx = x - (right - radius);
  if (y < top + radius) dy = top + radius - y;
  else if (y > bottom - radius) dy = y - (bottom - radius);
  if (dx === 0 && dy === 0) return 1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > radius) return 0;
  if (d <= radius - 1) return 1;
  return radius - d; // 亚像素
}
function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}
function inZLetter(x, y, cx, cy, size) {
  // 在 (cx,cy) 中心 size×size 方形内判断是否是"Z"字母主体（粗笔画）
  const left = cx - size / 2, right = cx + size / 2, top = cy - size / 2, bottom = cy + size / 2;
  const stroke = size * 0.22;
  if (x < left || x > right || y < top || y > bottom) return false;
  // 上横
  if (y < top + stroke) return true;
  // 下横
  if (y > bottom - stroke) return true;
  // 斜线: 从 (left+stroke, top+stroke) 到 (right-stroke, bottom-stroke)
  // 直线方程: (y - top - stroke) * (right - 2*stroke) = (x - left - stroke) * (bottom - 2*stroke)
  const slope = (bottom - top - 2 * stroke) / (right - left - 2 * stroke);
  const xDiag = left + stroke + (y - top - stroke) / slope;
  return Math.abs(x - xDiag) <= stroke / 1.4;
}
function renderRgba(size) {
  const W = size, H = size;
  const cx = W / 2, cy = H / 2;
  const padding = size * 0.02;
  const rx = W / 2 - padding, ry = H / 2 - padding;
  const radius = size * 0.12; // 12% 圆角，"适当"
  const cA = [0x66, 0x7e, 0xea]; // #667eea
  const cB = [0x76, 0x4b, 0xa2]; // #764ba2
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const alpha = roundRectAlpha(x, y, cx, cy, rx, ry, radius);
      if (alpha <= 0) {
        buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 0; continue;
      }
      const t = (y / H) * 0.5 + (x / W) * 0.5; // 对角渐变
      let rgb = lerpColor(cA, cB, Math.min(1, Math.max(0, t)));
      // 中心Z字母
      const zSize = size * 0.58;
      if (inZLetter(x, y, cx, cy, zSize)) {
        const a = 0.9;
        rgb = [Math.round(rgb[0] * (1 - a) + 255 * a),
               Math.round(rgb[1] * (1 - a) + 255 * a),
               Math.round(rgb[2] * (1 - a) + 255 * a)];
      }
      buf[idx] = rgb[0]; buf[idx + 1] = rgb[1]; buf[idx + 2] = rgb[2];
      buf[idx + 3] = Math.round(Math.min(1, alpha) * 255);
    }
  }
  return buf;
}

const rgba256 = renderRgba(256);
fs.writeFileSync(path.join(OUT_DIR, 'icon-256.png'), encodePNG(256, 256, rgba256));
console.log('✓ icon-256.png 生成');

/* =============================================================
   3) 纯 JS 编码 ICO（16/32/48/64/128/256，每帧内嵌 PNG）
      遵循 Vista+ ICO 格式：ICONDIR + ICONDIRENTRY[] + 每帧 PNG 数据
   ============================================================= */

const sizes = [16, 32, 48, 64, 128, 256];
const pngs = sizes.map(s => encodePNG(s, s, renderRgba(s)));

// ICONDIR: 6 bytes
//   idReserved(2)=0, idType(2)=1, idCount(2)
// ICONDIRENTRY: 每帧 16 bytes
//   bWidth, bHeight, bColorCount, bReserved, wPlanes(2), wBitCount(2), dwBytesInRes(4), dwImageOffset(4)
const headerSize = 6 + 16 * sizes.length;
let offset = headerSize;
const dirs = [];
for (let i = 0; i < sizes.length; i++) {
  const s = sizes[i];
  const dir = Buffer.alloc(16);
  dir[0] = s === 256 ? 0 : s;           // bWidth  (0 means 256)
  dir[1] = s === 256 ? 0 : s;           // bHeight
  dir[2] = 0;                            // bColorCount
  dir[3] = 0;                            // bReserved
  dir.writeUInt16LE(1, 4);               // wPlanes
  dir.writeUInt16LE(32, 6);              // wBitCount
  dir.writeUInt32LE(pngs[i].length, 8);  // dwBytesInRes
  dir.writeUInt32LE(offset, 12);         // dwImageOffset
  offset += pngs[i].length;
  dirs.push(dir);
}
const icondir = Buffer.alloc(6);
icondir.writeUInt16LE(0, 0);
icondir.writeUInt16LE(1, 2);
icondir.writeUInt16LE(sizes.length, 4);
const icoBuf = Buffer.concat([icondir, ...dirs, ...pngs]);
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), icoBuf);
console.log('✓ icon.ico 生成 (' + sizes.join('/') + ' 尺寸)');

console.log('\n所有图标文件已生成到: ' + OUT_DIR);

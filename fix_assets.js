const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const combined = Buffer.concat([typeBuffer, data]);
  const crcVal = crc32(combined);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuffer, data, crcBuffer]);
}

function createPNG(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  // Build raw scanlines: filter byte (0) + RGB pixels per row
  const rowBytes = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    const offset = y * rowBytes;
    rawData[offset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      rawData[offset + 1 + x * 3]     = r;
      rawData[offset + 1 + x * 3 + 1] = g;
      rawData[offset + 1 + x * 3 + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 1 });

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const assets = [
  ['assets/icon.png',          1024, 1024, 30,  30, 120],
  ['assets/adaptive-icon.png', 1024, 1024, 30,  30, 120],
  ['assets/splash.png',        1284, 2778, 255, 255, 255],
  ['assets/favicon.png',         64,   64, 30,  30, 120],
];

for (const [file, w, h, r, g, b] of assets) {
  process.stdout.write(`Creating ${file} (${w}x${h})... `);
  fs.writeFileSync(file, createPNG(w, h, r, g, b));
  console.log(`done (${fs.statSync(file).size} bytes)`);
}
console.log('All assets replaced successfully.');

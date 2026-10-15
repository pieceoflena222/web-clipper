import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(size, primaryColor, accentColor) {
  // Simple uncompressed/deflated raw RGBA PNG writer
  const width = size;
  const height = size;
  
  // Create raw image data (height rows, each row has 1 filter byte + width*4 bytes)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  
  const radius = Math.floor(size * 0.22);
  const cx = size / 2;
  const cy = size / 2;
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      // Rounded square background
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const half = size / 2 - 1;
      const cornerR = radius;
      
      let inside = false;
      if (dx <= half - cornerR || dy <= half - cornerR) {
        inside = true;
      } else {
        const cornerDx = dx - (half - cornerR);
        const cornerDy = dy - (half - cornerR);
        if (cornerDx * cornerDx + cornerDy * cornerDy <= cornerR * cornerR) {
          inside = true;
        }
      }
      
      if (inside) {
        // Gradient from primary to accent
        const t = (x + y) / (width + height);
        const r = Math.round(primaryColor[0] * (1 - t) + accentColor[0] * t);
        const g = Math.round(primaryColor[1] * (1 - t) + accentColor[1] * t);
        const b = Math.round(primaryColor[2] * (1 - t) + accentColor[2] * t);
        
        // Draw a neat clip / page symbol in the center
        // Normalized coordinates in [-1, 1]
        const nx = (x - cx) / (size * 0.45);
        const ny = (y - cy) / (size * 0.45);
        
        // Let's draw a paperclip path or bookmark in white
        // A stylish paperclip or bookmark ribbon:
        // A folded bookmark / clip shape
        let isClip = false;
        
        // Bookmark body: rectangle with inverted triangle at bottom
        if (nx >= -0.45 && nx <= 0.45 && ny >= -0.65 && ny <= 0.55) {
          // Notch at bottom
          if (ny > 0.2 && Math.abs(nx) < (0.55 - ny) * 0.8) {
            isClip = false;
          } else {
            isClip = true;
          }
        }
        
        // Inner clip loop
        if (nx >= -0.22 && nx <= 0.22 && ny >= -0.45 && ny <= 0.05) {
          // Hollow cut out inside
          isClip = false;
        }
        
        if (isClip) {
          // White symbol
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
          rawData[pixelOffset + 3] = 255;
        } else {
          // Background color
          rawData[pixelOffset] = r;
          rawData[pixelOffset + 1] = g;
          rawData[pixelOffset + 2] = b;
          rawData[pixelOffset + 3] = 255;
        }
      } else {
        // Transparent
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }
  
  // Deflate
  const compressed = zlib.deflateSync(rawData);
  
  // Build PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit depth
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  // Calculate CRC
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 implementation
let crcTable = null;
function makeCrcTable() {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

function crc32(buf) {
  if (!crcTable) crcTable = makeCrcTable();
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

const outDir = path.resolve('web-clipper-extension/icons');
fs.mkdirSync(outDir, { recursive: true });

// Also put into public/icons so Vite can serve them directly if needed
const publicDir = path.resolve('public/extension-icons');
fs.mkdirSync(publicDir, { recursive: true });

const primary = [37, 99, 235]; // Modern Royal Indigo Blue #2563eb
const accent = [79, 70, 229];  // Violet-indigo #4f46e5

[16, 48, 128].forEach(size => {
  const png = createPNG(size, primary, accent);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  fs.writeFileSync(path.join(publicDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
});

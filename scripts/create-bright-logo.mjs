<<<<<<< HEAD
/**
 * Create public/allincenter-logo-bright.png — transparent, bright hub + wordmark for light m3-page.
 * Source: public/allincenter-logo.png (keeps hub/headphones sketch geometry).
 */
import sharp from "sharp";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "allincenter-logo.png");
const outPath = join(root, "public", "allincenter-logo-bright.png");
const iconOutPath = join(root, "public", "allincenter-icon-bright.png");
const fontPath = join(__dirname, "fonts", "Poppins-ExtraBold.ttf");

GlobalFonts.registerFromPath(fontPath, "PoppinsBrand");

const WIDTH = 1536;
const HEIGHT = 1024;
/** Hub + headphones — left crop aligned with BrandLogo.jsx */
const HUB_END_X = Math.round(WIDTH * 0.38);
const WORD_X = Math.floor(WIDTH * 0.34);

const CYAN = [34, 211, 238];
const VIOLET = [139, 92, 246];
const TEAL = [45, 212, 191];
const PINK = [232, 121, 249];
const WHITE = [248, 250, 252];

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isInk(r, g, b, a = 255) {
  if (a < 128) return false;
  return lum(r, g, b) < 245;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function brightHubColor(r, g, b, x, y, ymin, ymax) {
  const tY = ymax > ymin ? (y - ymin) / (ymax - ymin) : 0.5;
  const tX = HUB_END_X > 0 ? x / HUB_END_X : 0;
  const ink = lum(r, g, b);
  const strength = Math.min(1, (245 - ink) / 120);
  const base = mixColor(
    mixColor(CYAN, VIOLET, tX * 0.55 + tY * 0.2),
    mixColor(VIOLET, PINK, 0.4 + tY * 0.35),
    0.35 + strength * 0.25,
  );
  const glow = mixColor(base, WHITE, 0.22 + strength * 0.35);
  return glow;
}

const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const hub = Buffer.alloc(width * height * 4);

let ymin = height;
let ymax = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < HUB_END_X; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4;
    hub[o + 3] = 0;
    if (x >= HUB_END_X) continue;
    const i = (y * width + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isInk(r, g, b, data[i + 3])) continue;
    const [br, bg, bb] = brightHubColor(r, g, b, x, y, ymin, ymax);
    hub[o] = br;
    hub[o + 1] = bg;
    hub[o + 2] = bb;
    hub[o + 3] = Math.min(255, Math.round(180 + (245 - lum(r, g, b)) * 0.55));
  }
}

// Soft glow pass on hub
const glow = Buffer.from(hub);
for (let pass = 0; pass < 2; pass++) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < HUB_END_X - 1; x++) {
      const o = (y * width + x) * 4;
      if (glow[o + 3] > 0) continue;
      let n = 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          if (glow[ni + 3] > 40) {
            n++;
            sr += glow[ni];
            sg += glow[ni + 1];
            sb += glow[ni + 2];
          }
        }
      }
      if (n >= 4) {
        hub[o] = Math.round(sr / n);
        hub[o + 1] = Math.round(sg / n);
        hub[o + 2] = Math.round(sb / n);
        hub[o + 3] = Math.min(90, Math.round(28 * n));
      }
    }
  }
}

// Word band bounds from source ink (right of hub)
let wYmin = height;
let wYmax = 0;
for (let y = 0; y < height; y++) {
  for (let x = WORD_X; x < width; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      wYmin = Math.min(wYmin, y);
      wYmax = Math.max(wYmax, y);
    }
  }
}

const textH = wYmax - wYmin + 1;
const fontSize = Math.round(textH * 0.88);
const accentScale = 1.32;

const segments = [
  { text: "A", accent: true },
  { text: "ll", accent: false },
  { text: "I", accent: false },
  { text: "n", accent: false },
  { text: "C", accent: true },
  { text: "enter", accent: false },
];

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");
ctx.clearRect(0, 0, WIDTH, HEIGHT);

const accentGrad = ctx.createLinearGradient(WORD_X, wYmin, WORD_X + 700, wYmax);
accentGrad.addColorStop(0, `rgb(${CYAN.join(",")})`);
accentGrad.addColorStop(0.45, `rgb(${VIOLET.join(",")})`);
accentGrad.addColorStop(1, `rgb(${PINK.join(",")})`);

const bodyGrad = ctx.createLinearGradient(WORD_X, wYmin, width - 80, wYmax);
bodyGrad.addColorStop(0, `rgb(${VIOLET.join(",")})`);
bodyGrad.addColorStop(1, `rgb(${TEAL.join(",")})`);

ctx.textBaseline = "middle";
ctx.textAlign = "left";

let cursorX = WORD_X + 8;
const midY = (wYmin + wYmax) / 2 + textH * 0.02;

for (const seg of segments) {
  const size = seg.accent ? Math.round(fontSize * accentScale) : fontSize;
  ctx.font = `${size}px PoppinsBrand`;
  ctx.fillStyle = seg.accent ? accentGrad : bodyGrad;
  const w = ctx.measureText(seg.text).width;
  const yOffset = seg.accent ? textH * 0.04 : 0;
  ctx.fillText(seg.text, cursorX, midY + yOffset);
  cursorX += w - (seg.accent ? size * 0.06 : size * 0.02);
}

const wordBuffer = canvas.toBuffer("image/png");

const hubPng = await sharp(hub, { raw: { width, height, channels: 4 } }).png().toBuffer();

const result = await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: hubPng, left: 0, top: 0 },
    { input: wordBuffer, left: 0, top: 0 },
  ])
  .png()
  .toBuffer();

writeFileSync(outPath, result);

const icon = await sharp(result).extract({ left: 0, top: 0, width: HUB_END_X, height }).png().toBuffer();
writeFileSync(iconOutPath, icon);

console.log(
  JSON.stringify(
    {
      outPath,
      iconOutPath,
      hubBand: { ymin, ymax },
      wordBand: { wYmin, wYmax, fontSize },
      bytes: result.length,
    },
    null,
    2,
  ),
);
=======
/**
 * Create public/allincenter-logo-bright.png — transparent, bright hub + wordmark for light m3-page.
 * Source: public/allincenter-logo.png (keeps hub/headphones sketch geometry).
 */
import sharp from "sharp";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "allincenter-logo.png");
const outPath = join(root, "public", "allincenter-logo-bright.png");
const iconOutPath = join(root, "public", "allincenter-icon-bright.png");
const fontPath = join(__dirname, "fonts", "Poppins-ExtraBold.ttf");

GlobalFonts.registerFromPath(fontPath, "PoppinsBrand");

const WIDTH = 1536;
const HEIGHT = 1024;
/** Hub + headphones — left crop aligned with BrandLogo.jsx */
const HUB_END_X = Math.round(WIDTH * 0.38);
const WORD_X = Math.floor(WIDTH * 0.34);

const CYAN = [34, 211, 238];
const VIOLET = [139, 92, 246];
const TEAL = [45, 212, 191];
const PINK = [232, 121, 249];
const WHITE = [248, 250, 252];

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isInk(r, g, b, a = 255) {
  if (a < 128) return false;
  return lum(r, g, b) < 245;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function brightHubColor(r, g, b, x, y, ymin, ymax) {
  const tY = ymax > ymin ? (y - ymin) / (ymax - ymin) : 0.5;
  const tX = HUB_END_X > 0 ? x / HUB_END_X : 0;
  const ink = lum(r, g, b);
  const strength = Math.min(1, (245 - ink) / 120);
  const base = mixColor(
    mixColor(CYAN, VIOLET, tX * 0.55 + tY * 0.2),
    mixColor(VIOLET, PINK, 0.4 + tY * 0.35),
    0.35 + strength * 0.25,
  );
  const glow = mixColor(base, WHITE, 0.22 + strength * 0.35);
  return glow;
}

const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const hub = Buffer.alloc(width * height * 4);

let ymin = height;
let ymax = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < HUB_END_X; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4;
    hub[o + 3] = 0;
    if (x >= HUB_END_X) continue;
    const i = (y * width + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isInk(r, g, b, data[i + 3])) continue;
    const [br, bg, bb] = brightHubColor(r, g, b, x, y, ymin, ymax);
    hub[o] = br;
    hub[o + 1] = bg;
    hub[o + 2] = bb;
    hub[o + 3] = Math.min(255, Math.round(180 + (245 - lum(r, g, b)) * 0.55));
  }
}

// Soft glow pass on hub
const glow = Buffer.from(hub);
for (let pass = 0; pass < 2; pass++) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < HUB_END_X - 1; x++) {
      const o = (y * width + x) * 4;
      if (glow[o + 3] > 0) continue;
      let n = 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          if (glow[ni + 3] > 40) {
            n++;
            sr += glow[ni];
            sg += glow[ni + 1];
            sb += glow[ni + 2];
          }
        }
      }
      if (n >= 4) {
        hub[o] = Math.round(sr / n);
        hub[o + 1] = Math.round(sg / n);
        hub[o + 2] = Math.round(sb / n);
        hub[o + 3] = Math.min(90, Math.round(28 * n));
      }
    }
  }
}

// Word band bounds from source ink (right of hub)
let wYmin = height;
let wYmax = 0;
for (let y = 0; y < height; y++) {
  for (let x = WORD_X; x < width; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      wYmin = Math.min(wYmin, y);
      wYmax = Math.max(wYmax, y);
    }
  }
}

const textH = wYmax - wYmin + 1;
const fontSize = Math.round(textH * 0.88);
const accentScale = 1.32;

const segments = [
  { text: "A", accent: true },
  { text: "ll", accent: false },
  { text: "I", accent: false },
  { text: "n", accent: false },
  { text: "C", accent: true },
  { text: "enter", accent: false },
];

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");
ctx.clearRect(0, 0, WIDTH, HEIGHT);

const accentGrad = ctx.createLinearGradient(WORD_X, wYmin, WORD_X + 700, wYmax);
accentGrad.addColorStop(0, `rgb(${CYAN.join(",")})`);
accentGrad.addColorStop(0.45, `rgb(${VIOLET.join(",")})`);
accentGrad.addColorStop(1, `rgb(${PINK.join(",")})`);

const bodyGrad = ctx.createLinearGradient(WORD_X, wYmin, width - 80, wYmax);
bodyGrad.addColorStop(0, `rgb(${VIOLET.join(",")})`);
bodyGrad.addColorStop(1, `rgb(${TEAL.join(",")})`);

ctx.textBaseline = "middle";
ctx.textAlign = "left";

let cursorX = WORD_X + 8;
const midY = (wYmin + wYmax) / 2 + textH * 0.02;

for (const seg of segments) {
  const size = seg.accent ? Math.round(fontSize * accentScale) : fontSize;
  ctx.font = `${size}px PoppinsBrand`;
  ctx.fillStyle = seg.accent ? accentGrad : bodyGrad;
  const w = ctx.measureText(seg.text).width;
  const yOffset = seg.accent ? textH * 0.04 : 0;
  ctx.fillText(seg.text, cursorX, midY + yOffset);
  cursorX += w - (seg.accent ? size * 0.06 : size * 0.02);
}

const wordBuffer = canvas.toBuffer("image/png");

const hubPng = await sharp(hub, { raw: { width, height, channels: 4 } }).png().toBuffer();

const result = await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: hubPng, left: 0, top: 0 },
    { input: wordBuffer, left: 0, top: 0 },
  ])
  .png()
  .toBuffer();

writeFileSync(outPath, result);

const icon = await sharp(result).extract({ left: 0, top: 0, width: HUB_END_X, height }).png().toBuffer();
writeFileSync(iconOutPath, icon);

console.log(
  JSON.stringify(
    {
      outPath,
      iconOutPath,
      hubBand: { ymin, ymax },
      wordBand: { wYmin, wYmax, fontSize },
      bytes: result.length,
    },
    null,
    2,
  ),
);
>>>>>>> 842dd9e (Initial commit)

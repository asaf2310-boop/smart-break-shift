<<<<<<< HEAD
/**
 * Create public/brand-snapshots/allincenter-logo-cap-a.png — DEPRECATED.
 * Patches legacy snapshot; superseded by scripts/render-allicenter-logo.mjs.
 */
import sharp from "sharp";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "allincenter-logo.png");
const outPath = join(root, "public", "brand-snapshots", "allincenter-logo-cap-a.png");
const fontPath = join(__dirname, "fonts", "Poppins-ExtraBold.ttf");

GlobalFonts.registerFromPath(fontPath, "PoppinsCap");

const ICON_END_RATIO = 352 / 1024;

const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const out = Buffer.from(data);

function isInk(r, g, b, a) {
  if (a < 128) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 245;
}

function setWhite(x, y) {
  const i = (y * width + x) * channels;
  out[i] = 255;
  out[i + 1] = 255;
  out[i + 2] = 255;
  out[i + 3] = 255;
}

let ymin = height;
let ymax = 0;
for (let y = 0; y < height; y++) {
  for (let x = Math.floor(width * ICON_END_RATIO); x < width; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
}

const textH = ymax - ymin + 1;
const wordStart = Math.floor(width * ICON_END_RATIO);

const densities = [];
for (let x = wordStart; x < Math.floor(width * 0.5); x++) {
  let colInk = 0;
  for (let y = ymin; y <= ymax; y++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) colInk++;
  }
  densities.push({ x, d: colInk / textH });
}

let colMin = 0;
let colMax = 0;
let started = false;
for (const { x, d } of densities) {
  if (!started && d > 0.55) {
    colMin = x;
    started = true;
    colMax = x;
  } else if (started) {
    if (d < 0.18) break;
    colMax = x;
  }
}

let letterYmin = height;
let letterYmax = 0;
for (let y = 0; y < height; y++) {
  for (let x = colMin; x <= colMax; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      letterYmin = Math.min(letterYmin, y);
      letterYmax = Math.max(letterYmax, y);
    }
  }
}

const eraseLeft = colMin - 3;
const eraseRight = colMax + 3;
const eraseTop = letterYmin - 3;
const eraseBottom = letterYmax + 3;
const letterH = letterYmax - letterYmin + 1;
const letterW = eraseRight - eraseLeft + 1;

for (let y = eraseTop; y <= eraseBottom; y++) {
  for (let x = eraseLeft; x <= eraseRight; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) setWhite(x, y);
  }
}

let sampleR = 99,
  sampleG = 49,
  sampleB = 178;
let sampleR2 = sampleR,
  sampleG2 = sampleG,
  sampleB2 = sampleB;
for (let x = colMin; x <= colMax; x++) {
  const i = (Math.round((letterYmin + letterYmax) / 2) * width + x) * channels;
  const r = data[i],
    g = data[i + 1],
    b = data[i + 2];
  if (isInk(r, g, b, data[i + 3])) {
    sampleR2 = r;
    sampleG2 = g;
    sampleB2 = b;
  }
  const i2 = (letterYmin * width + x) * channels;
  const r2 = data[i2],
    g2 = data[i2 + 1],
    b2 = data[i2 + 2];
  if (isInk(r2, g2, b2, data[i2 + 3])) {
    sampleR = r2;
    sampleG = g2;
    sampleB = b2;
  }
}

const capW = Math.round(letterW * 1.5);
const capH = Math.round(textH * 1.02);
const fontSize = Math.round(textH * 0.92);

const canvas = createCanvas(capW, capH);
const ctx = canvas.getContext("2d");
const grad = ctx.createLinearGradient(0, 0, capW, 0);
grad.addColorStop(
  0,
  `rgb(${sampleR},${sampleG},${sampleB})`,
);
grad.addColorStop(
  1,
  `rgb(${sampleR2},${sampleG2},${sampleB2})`,
);
ctx.font = `${fontSize}px PoppinsCap`;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillStyle = grad;
ctx.fillText("A", capW / 2, capH * 0.54);

const capABuffer = canvas.toBuffer("image/png");
const leftA = eraseLeft + Math.round((letterW - capW) / 2);
const topA = ymin - Math.round(textH * 0.02);

const erasedBase = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();

const result = await sharp(erasedBase)
  .composite([{ input: capABuffer, left: leftA, top: topA }])
  .png()
  .toBuffer();

writeFileSync(outPath, result);

console.log(JSON.stringify({ colMin, colMax, letterH, fontSize, leftA, topA }, null, 2));
=======
/**
 * Create public/brand-snapshots/allincenter-logo-cap-a.png — DEPRECATED.
 * Patches legacy snapshot; superseded by scripts/render-allicenter-logo.mjs.
 */
import sharp from "sharp";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "allincenter-logo.png");
const outPath = join(root, "public", "brand-snapshots", "allincenter-logo-cap-a.png");
const fontPath = join(__dirname, "fonts", "Poppins-ExtraBold.ttf");

GlobalFonts.registerFromPath(fontPath, "PoppinsCap");

const ICON_END_RATIO = 352 / 1024;

const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const out = Buffer.from(data);

function isInk(r, g, b, a) {
  if (a < 128) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 245;
}

function setWhite(x, y) {
  const i = (y * width + x) * channels;
  out[i] = 255;
  out[i + 1] = 255;
  out[i + 2] = 255;
  out[i + 3] = 255;
}

let ymin = height;
let ymax = 0;
for (let y = 0; y < height; y++) {
  for (let x = Math.floor(width * ICON_END_RATIO); x < width; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
}

const textH = ymax - ymin + 1;
const wordStart = Math.floor(width * ICON_END_RATIO);

const densities = [];
for (let x = wordStart; x < Math.floor(width * 0.5); x++) {
  let colInk = 0;
  for (let y = ymin; y <= ymax; y++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) colInk++;
  }
  densities.push({ x, d: colInk / textH });
}

let colMin = 0;
let colMax = 0;
let started = false;
for (const { x, d } of densities) {
  if (!started && d > 0.55) {
    colMin = x;
    started = true;
    colMax = x;
  } else if (started) {
    if (d < 0.18) break;
    colMax = x;
  }
}

let letterYmin = height;
let letterYmax = 0;
for (let y = 0; y < height; y++) {
  for (let x = colMin; x <= colMax; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      letterYmin = Math.min(letterYmin, y);
      letterYmax = Math.max(letterYmax, y);
    }
  }
}

const eraseLeft = colMin - 3;
const eraseRight = colMax + 3;
const eraseTop = letterYmin - 3;
const eraseBottom = letterYmax + 3;
const letterH = letterYmax - letterYmin + 1;
const letterW = eraseRight - eraseLeft + 1;

for (let y = eraseTop; y <= eraseBottom; y++) {
  for (let x = eraseLeft; x <= eraseRight; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) setWhite(x, y);
  }
}

let sampleR = 99,
  sampleG = 49,
  sampleB = 178;
let sampleR2 = sampleR,
  sampleG2 = sampleG,
  sampleB2 = sampleB;
for (let x = colMin; x <= colMax; x++) {
  const i = (Math.round((letterYmin + letterYmax) / 2) * width + x) * channels;
  const r = data[i],
    g = data[i + 1],
    b = data[i + 2];
  if (isInk(r, g, b, data[i + 3])) {
    sampleR2 = r;
    sampleG2 = g;
    sampleB2 = b;
  }
  const i2 = (letterYmin * width + x) * channels;
  const r2 = data[i2],
    g2 = data[i2 + 1],
    b2 = data[i2 + 2];
  if (isInk(r2, g2, b2, data[i2 + 3])) {
    sampleR = r2;
    sampleG = g2;
    sampleB = b2;
  }
}

const capW = Math.round(letterW * 1.5);
const capH = Math.round(textH * 1.02);
const fontSize = Math.round(textH * 0.92);

const canvas = createCanvas(capW, capH);
const ctx = canvas.getContext("2d");
const grad = ctx.createLinearGradient(0, 0, capW, 0);
grad.addColorStop(
  0,
  `rgb(${sampleR},${sampleG},${sampleB})`,
);
grad.addColorStop(
  1,
  `rgb(${sampleR2},${sampleG2},${sampleB2})`,
);
ctx.font = `${fontSize}px PoppinsCap`;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillStyle = grad;
ctx.fillText("A", capW / 2, capH * 0.54);

const capABuffer = canvas.toBuffer("image/png");
const leftA = eraseLeft + Math.round((letterW - capW) / 2);
const topA = ymin - Math.round(textH * 0.02);

const erasedBase = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();

const result = await sharp(erasedBase)
  .composite([{ input: capABuffer, left: leftA, top: topA }])
  .png()
  .toBuffer();

writeFileSync(outPath, result);

console.log(JSON.stringify({ colMin, colMax, letterH, fontSize, leftA, topA }, null, 2));
>>>>>>> 842dd9e (Initial commit)

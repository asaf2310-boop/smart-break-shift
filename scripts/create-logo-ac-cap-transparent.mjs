/**
 * Create public/brand-snapshots/allincenter-logo-hero-ac.png — DEPRECATED.
 * Patches legacy allincenter-logo.png; superseded by scripts/render-allicenter-logo.mjs.
 * Source: public/allincenter-logo.png (login-hero-full-v1 snapshot).
 * Hub artwork unchanged; wordmark first "a" and "c" → larger capitals with sampled gradient.
 */
import sharp from "sharp";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "allincenter-logo.png");
const outPath = join(root, "public", "brand-snapshots", "allincenter-logo-hero-ac.png");
const fontPath = join(__dirname, "fonts", "Poppins-ExtraBold.ttf");

GlobalFonts.registerFromPath(fontPath, "PoppinsHeroAC");

const ICON_END_RATIO = 352 / 1024;
const WHITE_LUM = 245;
const LETTER_DENSITY = 0.35;
const LETTER_GAP_COLS = 3;
/** Indices in detected wordmark letters for "allincenter" → a=0, c=5 */
const CAP_LETTER_INDICES = [0, 5];
const CAP_CHARS = ["A", "C"];
const CAP_SCALE_W = 1.48;
const CAP_SCALE_H = 1.02;
const FONT_SIZE_RATIO = 0.92;

const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const out = Buffer.from(data);

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isInk(r, g, b, a) {
  if (a < 128) return false;
  return lum(r, g, b) < WHITE_LUM;
}

function isNearWhite(r, g, b, a) {
  if (a < 128) return true;
  return lum(r, g, b) >= WHITE_LUM;
}

/** Transparent background — keep colored/sketch ink only. */
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    if (isNearWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      out[i + 3] = 0;
    }
  }
}

function setTransparent(x, y) {
  const i = (y * width + x) * channels;
  out[i + 3] = 0;
}

const wordStart = Math.floor(width * ICON_END_RATIO);

let ymin = height;
let ymax = 0;
for (let y = 0; y < height; y++) {
  for (let x = wordStart; x < width; x++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
}

const textH = ymax - ymin + 1;
const densities = [];
for (let x = wordStart; x < width; x++) {
  let colInk = 0;
  for (let y = ymin; y <= ymax; y++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) colInk++;
  }
  densities.push({ x, d: colInk / textH });
}

function findWordLetters() {
  const letters = [];
  let inLetter = false;
  let start = 0;
  let gap = 0;

  for (const { x, d } of densities) {
    if (d > LETTER_DENSITY) {
      gap = 0;
      if (!inLetter) {
        start = x;
        inLetter = true;
      }
    } else if (inLetter) {
      gap++;
      if (gap >= LETTER_GAP_COLS || d < 0.08) {
        letters.push({ start, end: x - gap });
        inLetter = false;
        gap = 0;
      }
    }
  }
  if (inLetter) {
    letters.push({ start, end: densities[densities.length - 1].x });
  }
  return letters;
}

const letters = findWordLetters();

function letterBounds(colMin, colMax) {
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
  return { letterYmin, letterYmax };
}

function sampleGradient(colMin, colMax, letterYmin, letterYmax) {
  let sampleR = 99;
  let sampleG = 49;
  let sampleB = 178;
  let sampleR2 = sampleR;
  let sampleG2 = sampleG;
  let sampleB2 = sampleB;

  for (let x = colMin; x <= colMax; x++) {
    const midY = Math.round((letterYmin + letterYmax) / 2);
    const i = (midY * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      sampleR2 = data[i];
      sampleG2 = data[i + 1];
      sampleB2 = data[i + 2];
    }
    const i2 = (letterYmin * width + x) * channels;
    if (isInk(data[i2], data[i2 + 1], data[i2 + 2], data[i2 + 3])) {
      sampleR = data[i2];
      sampleG = data[i2 + 1];
      sampleB = data[i2 + 2];
    }
  }
  return { sampleR, sampleG, sampleB, sampleR2, sampleG2, sampleB2 };
}

function drawCapital(char, letterW, colors) {
  const capW = Math.round(letterW * CAP_SCALE_W);
  const capH = Math.round(textH * CAP_SCALE_H);
  const fontSize = Math.round(textH * FONT_SIZE_RATIO);

  const canvas = createCanvas(capW, capH);
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, capW, 0);
  grad.addColorStop(0, `rgb(${colors.sampleR},${colors.sampleG},${colors.sampleB})`);
  grad.addColorStop(1, `rgb(${colors.sampleR2},${colors.sampleG2},${colors.sampleB2})`);
  ctx.font = `${fontSize}px PoppinsHeroAC`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = grad;
  ctx.fillText(char, capW / 2, capH * 0.54);

  return { buffer: canvas.toBuffer("image/png"), capW, capH };
}

const composites = [];
const meta = [];

for (let li = 0; li < CAP_LETTER_INDICES.length; li++) {
  const idx = CAP_LETTER_INDICES[li];
  const letter = letters[idx];
  if (!letter) {
    console.warn(`Letter index ${idx} not found (${letters.length} segments)`);
    continue;
  }

  const colMin = letter.start;
  const colMax = letter.end;
  const { letterYmin, letterYmax } = letterBounds(colMin, colMax);
  const eraseLeft = colMin - 3;
  const eraseRight = colMax + 3;
  const eraseTop = letterYmin - 3;
  const eraseBottom = letterYmax + 3;
  const letterW = eraseRight - eraseLeft + 1;

  for (let y = eraseTop; y <= eraseBottom; y++) {
    for (let x = eraseLeft; x <= eraseRight; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = (y * width + x) * channels;
      if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) setTransparent(x, y);
    }
  }

  const colors = sampleGradient(colMin, colMax, letterYmin, letterYmax);
  const { buffer, capW, capH } = drawCapital(CAP_CHARS[li], letterW, colors);
  const left = eraseLeft + Math.round((letterW - capW) / 2);
  const top = ymin - Math.round(textH * 0.02);

  composites.push({ input: buffer, left, top });
  meta.push({ char: CAP_CHARS[li], idx, colMin, colMax, left, top, capW, capH });
}

const basePng = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();

const result = await sharp(basePng)
  .composite(composites)
  .png()
  .toBuffer();

writeFileSync(outPath, result);

console.log(
  JSON.stringify(
    {
      outPath,
      lettersFound: letters.length,
      letters: letters.map((l, i) => ({ i, ...l, w: l.end - l.start + 1 })),
      caps: meta,
      wordBand: { ymin, ymax, textH },
      bytes: result.length,
    },
    null,
    2,
  ),
);

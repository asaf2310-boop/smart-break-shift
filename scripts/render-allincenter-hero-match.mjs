<<<<<<< HEAD
/**
 * Render public/allincenter-logo-allincenter-hero.png — HERO-faithful lockup.
 * Hub: left ~38% crop from login-hero-full-v1.png (unchanged pixels, white → transparent).
 * Wordmark: "AllinCenter" — original sketch letter bitmaps; a/c scaled up (no SVG hub, no Poppins).
 * Source of truth: public/brand-snapshots/login-hero-full-v1.png
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "brand-snapshots", "login-hero-full-v1.png");
const outPath = join(root, "public", "allincenter-logo-allincenter-hero.png");

const HUB_END_RATIO = 0.38;
const WHITE_LUM = 245;
const LETTER_DENSITY = 0.35;
const LETTER_GAP_COLS = 3;
/** "allincenter" → indices 0 (a) and 5 (c) become capitals for AllinCenter */
const CAP_LETTER_INDICES = [0, 5];
const CAP_SCALE_W = 1.48;
const CAP_SCALE_H = 1.02;

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

/** Transparent background — keep colored sketch ink only. */
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

const hubEndX = Math.round(width * HUB_END_RATIO);
const wordStart = hubEndX;

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

function sampleLetterColors(colMin, colMax, letterYmin, letterYmax) {
  const rs = [];
  const gs = [];
  const bs = [];
  for (let x = colMin; x <= colMax; x++) {
    for (let y = letterYmin; y <= letterYmax; y++) {
      const i = (y * width + x) * channels;
      if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  }
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { r: avg(rs), g: avg(gs), b: avg(bs) };
}

function extractLetterPatch(colMin, colMax, letterYmin, letterYmax) {
  const patchW = colMax - colMin + 1;
  const patchH = letterYmax - letterYmin + 1;
  const patch = Buffer.alloc(patchW * patchH * 4);

  for (let py = 0; py < patchH; py++) {
    for (let px = 0; px < patchW; px++) {
      const sx = colMin + px;
      const sy = letterYmin + py;
      const si = (sy * width + sx) * channels;
      const oi = (py * patchW + px) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      const a = data[si + 3];
      if (isInk(r, g, b, a)) {
        patch[oi] = r;
        patch[oi + 1] = g;
        patch[oi + 2] = b;
        patch[oi + 3] = a;
      } else {
        patch[oi + 3] = 0;
      }
    }
  }
  return { patch, patchW, patchH };
}

async function scaleLetterPatch(patch, patchW, patchH) {
  const capW = Math.round(patchW * CAP_SCALE_W);
  const capH = Math.round(patchH * CAP_SCALE_H);
  return {
    buffer: await sharp(patch, { raw: { width: patchW, height: patchH, channels: 4 } })
      .resize(capW, capH, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer(),
    capW,
    capH,
  };
}

const composites = [];
const meta = [];
const colorSamples = [];

for (const idx of CAP_LETTER_INDICES) {
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

  const colors = sampleLetterColors(colMin, colMax, letterYmin, letterYmax);
  colorSamples.push({ idx, char: idx === 0 ? "A" : "C", ...colors });

  const { patch, patchW, patchH } = extractLetterPatch(colMin, colMax, letterYmin, letterYmax);
  const { buffer, capW, capH } = await scaleLetterPatch(patch, patchW, patchH);
  const left = eraseLeft + Math.round((letterW - capW) / 2);
  const top = ymin - Math.round(textH * 0.02);

  composites.push({ input: buffer, left, top });
  meta.push({ idx, char: idx === 0 ? "A" : "C", colMin, colMax, left, top, capW, capH, colors });
}

const basePng = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
const result = await sharp(basePng).composite(composites).png().toBuffer();

writeFileSync(outPath, result);

console.log(
  JSON.stringify(
    {
      outPath,
      source: srcPath,
      hubCrop: { hubEndX, ratio: HUB_END_RATIO, note: "unchanged pixels from HERO PNG left crop" },
      wordmark: "AllinCenter",
      lettersFound: letters.length,
      capitals: meta,
      colorSamplesFromHero: colorSamples,
      wordBand: { ymin, ymax, textH, wordStart },
      bytes: result.length,
    },
    null,
    2,
  ),
);
=======
/**
 * Render public/allincenter-logo-allincenter-hero.png — HERO-faithful lockup.
 * Hub: left ~38% crop from login-hero-full-v1.png (unchanged pixels, white → transparent).
 * Wordmark: "AllinCenter" — original sketch letter bitmaps; a/c scaled up (no SVG hub, no Poppins).
 * Source of truth: public/brand-snapshots/login-hero-full-v1.png
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "public", "brand-snapshots", "login-hero-full-v1.png");
const outPath = join(root, "public", "allincenter-logo-allincenter-hero.png");

const HUB_END_RATIO = 0.38;
const WHITE_LUM = 245;
const LETTER_DENSITY = 0.35;
const LETTER_GAP_COLS = 3;
/** "allincenter" → indices 0 (a) and 5 (c) become capitals for AllinCenter */
const CAP_LETTER_INDICES = [0, 5];
const CAP_SCALE_W = 1.48;
const CAP_SCALE_H = 1.02;

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

/** Transparent background — keep colored sketch ink only. */
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

const hubEndX = Math.round(width * HUB_END_RATIO);
const wordStart = hubEndX;

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

function sampleLetterColors(colMin, colMax, letterYmin, letterYmax) {
  const rs = [];
  const gs = [];
  const bs = [];
  for (let x = colMin; x <= colMax; x++) {
    for (let y = letterYmin; y <= letterYmax; y++) {
      const i = (y * width + x) * channels;
      if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  }
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { r: avg(rs), g: avg(gs), b: avg(bs) };
}

function extractLetterPatch(colMin, colMax, letterYmin, letterYmax) {
  const patchW = colMax - colMin + 1;
  const patchH = letterYmax - letterYmin + 1;
  const patch = Buffer.alloc(patchW * patchH * 4);

  for (let py = 0; py < patchH; py++) {
    for (let px = 0; px < patchW; px++) {
      const sx = colMin + px;
      const sy = letterYmin + py;
      const si = (sy * width + sx) * channels;
      const oi = (py * patchW + px) * 4;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      const a = data[si + 3];
      if (isInk(r, g, b, a)) {
        patch[oi] = r;
        patch[oi + 1] = g;
        patch[oi + 2] = b;
        patch[oi + 3] = a;
      } else {
        patch[oi + 3] = 0;
      }
    }
  }
  return { patch, patchW, patchH };
}

async function scaleLetterPatch(patch, patchW, patchH) {
  const capW = Math.round(patchW * CAP_SCALE_W);
  const capH = Math.round(patchH * CAP_SCALE_H);
  return {
    buffer: await sharp(patch, { raw: { width: patchW, height: patchH, channels: 4 } })
      .resize(capW, capH, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer(),
    capW,
    capH,
  };
}

const composites = [];
const meta = [];
const colorSamples = [];

for (const idx of CAP_LETTER_INDICES) {
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

  const colors = sampleLetterColors(colMin, colMax, letterYmin, letterYmax);
  colorSamples.push({ idx, char: idx === 0 ? "A" : "C", ...colors });

  const { patch, patchW, patchH } = extractLetterPatch(colMin, colMax, letterYmin, letterYmax);
  const { buffer, capW, capH } = await scaleLetterPatch(patch, patchW, patchH);
  const left = eraseLeft + Math.round((letterW - capW) / 2);
  const top = ymin - Math.round(textH * 0.02);

  composites.push({ input: buffer, left, top });
  meta.push({ idx, char: idx === 0 ? "A" : "C", colMin, colMax, left, top, capW, capH, colors });
}

const basePng = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
const result = await sharp(basePng).composite(composites).png().toBuffer();

writeFileSync(outPath, result);

console.log(
  JSON.stringify(
    {
      outPath,
      source: srcPath,
      hubCrop: { hubEndX, ratio: HUB_END_RATIO, note: "unchanged pixels from HERO PNG left crop" },
      wordmark: "AllinCenter",
      lettersFound: letters.length,
      capitals: meta,
      colorSamplesFromHero: colorSamples,
      wordBand: { ymin, ymax, textH, wordStart },
      bytes: result.length,
    },
    null,
    2,
  ),
);
>>>>>>> 842dd9e (Initial commit)

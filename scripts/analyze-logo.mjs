<<<<<<< HEAD
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "allincenter-logo.png");
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

function isInk(r, g, b, a) {
  if (a < 128) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 245;
}

const ymin = 427,
  ymax = 582;
const row = [];
for (let x = 0; x < width; x++) {
  let n = 0;
  for (let y = ymin; y <= ymax; y++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) n++;
  }
  row.push(n);
}

// print ranges where density changes
let max = 0,
  maxX = 0;
for (let x = 0; x < width; x++) {
  if (row[x] > max) {
    max = row[x];
    maxX = x;
  }
}

const peaks = [];
for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.45); x++) {
  if (row[x] > 80) peaks.push({ x, n: row[x], pct: ((x / width) * 100).toFixed(1) });
}
console.log("max ink col", maxX, max, "of", ymax - ymin + 1);
console.log("peaks 30-45% width:", peaks);
for (let x = 540; x < 650; x++) {
  if (row[x] > 50) console.log(x, row[x]);
}
=======
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "allincenter-logo.png");
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

function isInk(r, g, b, a) {
  if (a < 128) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 245;
}

const ymin = 427,
  ymax = 582;
const row = [];
for (let x = 0; x < width; x++) {
  let n = 0;
  for (let y = ymin; y <= ymax; y++) {
    const i = (y * width + x) * channels;
    if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) n++;
  }
  row.push(n);
}

// print ranges where density changes
let max = 0,
  maxX = 0;
for (let x = 0; x < width; x++) {
  if (row[x] > max) {
    max = row[x];
    maxX = x;
  }
}

const peaks = [];
for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.45); x++) {
  if (row[x] > 80) peaks.push({ x, n: row[x], pct: ((x / width) * 100).toFixed(1) });
}
console.log("max ink col", maxX, max, "of", ymax - ymin + 1);
console.log("peaks 30-45% width:", peaks);
for (let x = 540; x < 650; x++) {
  if (row[x] > 50) console.log(x, row[x]);
}
>>>>>>> 842dd9e (Initial commit)

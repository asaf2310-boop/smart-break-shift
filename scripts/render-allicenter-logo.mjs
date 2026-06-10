<<<<<<< HEAD
/**
 * Render public/allincenter-logo-allicenter.png from scratch (hub SVG paths + canvas wordmark).
 * Text: AlliCenter — capital A and C accent; transparent background.
 * Does not read or patch legacy allincenter-logo.png / hero-ac assets.
 */
import { createCanvas, GlobalFonts, Path2D } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "public", "allincenter-logo-allicenter.png");
const fontPath = join(__dirname, "fonts", "Poppins-ExtraBold.ttf");

GlobalFonts.registerFromPath(fontPath, "PoppinsAlliCenter");

const WIDTH = 1536;
const HEIGHT = 1024;
const HUB_END_X = Math.round(WIDTH * 0.38);
const WORD_X = Math.floor(WIDTH * 0.36);

const CYAN = "#22D3EE";
const VIOLET = "#8B5CF6";
const TEAL = "#2DD4BF";
const PINK = "#E879F9";
const LAVENDER = "#A78BFA";

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");
ctx.clearRect(0, 0, WIDTH, HEIGHT);

/** Hub + headset — same geometry as public/brand/allincenter-mark.svg */
function drawHubMark() {
  const hubSize = Math.round(HEIGHT * 0.52);
  const scale = hubSize / 96;
  const tx = Math.round(HUB_END_X * 0.5 - (48 * scale));
  const ty = Math.round(HEIGHT * 0.5 - (48 * scale));

  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.25;

  const grad = ctx.createLinearGradient(12, 12, 84, 84);
  grad.addColorStop(0, CYAN);
  grad.addColorStop(0.45, LAVENDER);
  grad.addColorStop(1, PINK);
  ctx.strokeStyle = grad;
  ctx.shadowColor = "rgba(167, 139, 250, 0.45)";
  ctx.shadowBlur = 4;

  const strokePath = (d) => ctx.stroke(new Path2D(d));

  ctx.beginPath();
  ctx.arc(48, 48, 5.5, 0, Math.PI * 2);
  ctx.stroke();

  strokePath("M48 48V22M48 48l24 13.9M48 48L24 61.9M48 48v26M48 48L24 34.1M48 48l24-13.9");
  strokePath("M26 40c0-12 9.8-20 22-20s22 8 22 20");
  strokePath("M28 44v14a6 6 0 0 0 12 0V44M56 44v14a6 6 0 0 0 12 0V44");
  strokePath("M34 58h6M56 58h6");
  ctx.restore();
}

drawHubMark();

const fontSize = Math.round(HEIGHT * 0.19);
const accentScale = 1.32;
const midY = HEIGHT * 0.52;

const accentGrad = ctx.createLinearGradient(WORD_X, midY - fontSize, WORD_X + 720, midY + fontSize);
accentGrad.addColorStop(0, CYAN);
accentGrad.addColorStop(0.45, LAVENDER);
accentGrad.addColorStop(1, PINK);

const bodyGrad = ctx.createLinearGradient(WORD_X, midY - fontSize, WIDTH - 60, midY + fontSize);
bodyGrad.addColorStop(0, VIOLET);
bodyGrad.addColorStop(1, TEAL);

/** AlliCenter — A/C accent; no capital I (Alli + Center) */
const segments = [
  { text: "A", accent: true },
  { text: "lli", accent: false },
  { text: "C", accent: true },
  { text: "enter", accent: false },
];

ctx.textBaseline = "middle";
ctx.textAlign = "left";
let cursorX = WORD_X + 12;

for (const seg of segments) {
  const size = seg.accent ? Math.round(fontSize * accentScale) : fontSize;
  ctx.font = `${size}px PoppinsAlliCenter`;
  ctx.fillStyle = seg.accent ? accentGrad : bodyGrad;
  const w = ctx.measureText(seg.text).width;
  const yOffset = seg.accent ? fontSize * 0.05 : 0;
  ctx.fillText(seg.text, cursorX, midY + yOffset);
  cursorX += w - (seg.accent ? size * 0.06 : size * 0.02);
}

writeFileSync(outPath, canvas.toBuffer("image/png"));
console.log(JSON.stringify({ outPath, bytes: canvas.toBuffer("image/png").length, size: [WIDTH, HEIGHT] }, null, 2));
=======
/**
 * Render public/allincenter-logo-allicenter.png from scratch (hub SVG paths + canvas wordmark).
 * Text: AlliCenter — capital A and C accent; transparent background.
 * Does not read or patch legacy allincenter-logo.png / hero-ac assets.
 */
import { createCanvas, GlobalFonts, Path2D } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "public", "allincenter-logo-allicenter.png");
const fontPath = join(__dirname, "fonts", "Poppins-ExtraBold.ttf");

GlobalFonts.registerFromPath(fontPath, "PoppinsAlliCenter");

const WIDTH = 1536;
const HEIGHT = 1024;
const HUB_END_X = Math.round(WIDTH * 0.38);
const WORD_X = Math.floor(WIDTH * 0.36);

const CYAN = "#22D3EE";
const VIOLET = "#8B5CF6";
const TEAL = "#2DD4BF";
const PINK = "#E879F9";
const LAVENDER = "#A78BFA";

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");
ctx.clearRect(0, 0, WIDTH, HEIGHT);

/** Hub + headset — same geometry as public/brand/allincenter-mark.svg */
function drawHubMark() {
  const hubSize = Math.round(HEIGHT * 0.52);
  const scale = hubSize / 96;
  const tx = Math.round(HUB_END_X * 0.5 - (48 * scale));
  const ty = Math.round(HEIGHT * 0.5 - (48 * scale));

  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.25;

  const grad = ctx.createLinearGradient(12, 12, 84, 84);
  grad.addColorStop(0, CYAN);
  grad.addColorStop(0.45, LAVENDER);
  grad.addColorStop(1, PINK);
  ctx.strokeStyle = grad;
  ctx.shadowColor = "rgba(167, 139, 250, 0.45)";
  ctx.shadowBlur = 4;

  const strokePath = (d) => ctx.stroke(new Path2D(d));

  ctx.beginPath();
  ctx.arc(48, 48, 5.5, 0, Math.PI * 2);
  ctx.stroke();

  strokePath("M48 48V22M48 48l24 13.9M48 48L24 61.9M48 48v26M48 48L24 34.1M48 48l24-13.9");
  strokePath("M26 40c0-12 9.8-20 22-20s22 8 22 20");
  strokePath("M28 44v14a6 6 0 0 0 12 0V44M56 44v14a6 6 0 0 0 12 0V44");
  strokePath("M34 58h6M56 58h6");
  ctx.restore();
}

drawHubMark();

const fontSize = Math.round(HEIGHT * 0.19);
const accentScale = 1.32;
const midY = HEIGHT * 0.52;

const accentGrad = ctx.createLinearGradient(WORD_X, midY - fontSize, WORD_X + 720, midY + fontSize);
accentGrad.addColorStop(0, CYAN);
accentGrad.addColorStop(0.45, LAVENDER);
accentGrad.addColorStop(1, PINK);

const bodyGrad = ctx.createLinearGradient(WORD_X, midY - fontSize, WIDTH - 60, midY + fontSize);
bodyGrad.addColorStop(0, VIOLET);
bodyGrad.addColorStop(1, TEAL);

/** AlliCenter — A/C accent; no capital I (Alli + Center) */
const segments = [
  { text: "A", accent: true },
  { text: "lli", accent: false },
  { text: "C", accent: true },
  { text: "enter", accent: false },
];

ctx.textBaseline = "middle";
ctx.textAlign = "left";
let cursorX = WORD_X + 12;

for (const seg of segments) {
  const size = seg.accent ? Math.round(fontSize * accentScale) : fontSize;
  ctx.font = `${size}px PoppinsAlliCenter`;
  ctx.fillStyle = seg.accent ? accentGrad : bodyGrad;
  const w = ctx.measureText(seg.text).width;
  const yOffset = seg.accent ? fontSize * 0.05 : 0;
  ctx.fillText(seg.text, cursorX, midY + yOffset);
  cursorX += w - (seg.accent ? size * 0.06 : size * 0.02);
}

writeFileSync(outPath, canvas.toBuffer("image/png"));
console.log(JSON.stringify({ outPath, bytes: canvas.toBuffer("image/png").length, size: [WIDTH, HEIGHT] }, null, 2));
>>>>>>> 842dd9e (Initial commit)

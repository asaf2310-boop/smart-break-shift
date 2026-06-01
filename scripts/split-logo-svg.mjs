/**
 * Split login hero logo into mark (left crop) + editable wordmark SVG.
 *
 * Usage:
 *   node scripts/split-logo-svg.mjs
 *   node scripts/split-logo-svg.mjs <source.png> [--mark-ratio=0.38]
 *
 * Outputs:
 *   public/brand/allincenter-mark-split.svg  — hub + headphones (raster-in-SVG)
 *   public/brand/allincenter-wordmark-editable.svg — <text>/<tspan> (regenerated shell; edit in Figma)
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const defaultSources = [
  join(root, "public", "brand-snapshots", "login-hero-full-v1.png"),
  join(root, "public", "allincenter-logo.png"),
];

const MARK_OUT = join(root, "public", "brand", "allincenter-mark-split.svg");
const WORDMARK_OUT = join(root, "public", "brand", "allincenter-wordmark-editable.svg");

const args = process.argv.slice(2);
let markRatio = 0.38;
let inputPath = null;

for (const arg of args) {
  if (arg.startsWith("--mark-ratio=")) {
    markRatio = Number.parseFloat(arg.split("=")[1]);
  } else if (!arg.startsWith("-")) {
    inputPath = arg.startsWith("/") || /^[A-Za-z]:/.test(arg) ? arg : join(process.cwd(), arg);
  }
}

if (!inputPath) {
  inputPath = defaultSources.find((p) => existsSync(p));
  if (!inputPath) {
    console.error("No source PNG found. Pass path or add login-hero-full-v1.png / allincenter-logo.png");
    process.exit(1);
  }
}

const meta = await sharp(inputPath).metadata();
const fullW = meta.width;
const fullH = meta.height;
const markW = Math.round(fullW * markRatio);

const markPng = await sharp(inputPath)
  .extract({ left: 0, top: 0, width: markW, height: fullH })
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();

const markB64 = markPng.toString("base64");

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  allincenter-mark-split.svg — logomark only (hub + headphones), no wordmark.
  Raster crop from left ${(markRatio * 100).toFixed(0)}% of source PNG (matches BrandLogo BRAND_HUB_SRC_WIDTH).
  Type: embedded PNG in SVG (Figma: Place → ungroup image; for pure vectors use allincenter-mark.svg).

  Source: ${inputPath.replace(/\\/g, "/")}
  Regenerate: node scripts/split-logo-svg.mjs
-->
<svg xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="0 0 ${markW} ${fullH}"
  width="${markW}"
  height="${fullH}"
  role="img"
  aria-label="AllInCenter mark">
  <defs>
    <clipPath id="mark-bounds">
      <rect width="${markW}" height="${fullH}" />
    </clipPath>
  </defs>
  <g clip-path="url(#mark-bounds)">
    <image
      width="${markW}"
      height="${fullH}"
      preserveAspectRatio="xMinYMid meet"
      href="data:image/png;base64,${markB64}" />
  </g>
</svg>
`;

mkdirSync(dirname(MARK_OUT), { recursive: true });
writeFileSync(MARK_OUT, markSvg, "utf8");

// Wordmark is hand-maintained as real <text>; optional --refresh-wordmark overwrites template
if (process.argv.includes("--refresh-wordmark")) {
  writeFileSync(WORDMARK_OUT, buildWordmarkSvg(), "utf8");
  console.log(`Wrote ${WORDMARK_OUT} (editable text template)`);
}

const markKb = markPng.length / 1024;
const svgKb = Buffer.byteLength(markSvg, "utf8") / 1024;

console.log(`Wrote ${MARK_OUT}`);
console.log(`  crop: 0,0 → ${markW}×${fullH} from ${fullW}×${fullH}`);
console.log(`  mark raster: ${markKb.toFixed(1)} KiB | SVG: ${svgKb.toFixed(1)} KiB`);

function buildWordmarkSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  allincenter-wordmark-editable.svg — "AllInCenter" as live SVG text (Figma: edit characters / outline).
  No hub image. Gradients match BrandWordmark.jsx tokens.

  Font: Poppins Bold (link below). Install locally or use Google Fonts when previewing outside Figma.
-->
<svg xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="0 0 520 72"
  fill="none"
  role="img"
  aria-label="AllInCenter"
  data-theme="on-dark">
  <defs>
    <style type="text/css"><![CDATA[
      @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap");
    ]]></style>
    <linearGradient id="wm-body-on-dark" x1="0" y1="36" x2="520" y2="36" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#2DD4BF"/>
    </linearGradient>
    <linearGradient id="wm-accent-on-dark" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22D3EE"/>
      <stop offset="50%" stop-color="#A78BFA"/>
      <stop offset="100%" stop-color="#E879F9"/>
    </linearGradient>
    <linearGradient id="wm-body-on-light" x1="0" y1="36" x2="520" y2="36" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#2DD4BF"/>
    </linearGradient>
    <linearGradient id="wm-accent-on-light" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22D3EE"/>
      <stop offset="50%" stop-color="#A78BFA"/>
      <stop offset="100%" stop-color="#E879F9"/>
    </linearGradient>
  </defs>
  <style>
    .wm-text {
      font-family: Poppins, "Segoe UI", system-ui, -apple-system, sans-serif;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .wm-body { font-size: 48px; }
    .wm-accent { font-size: 63px; dominant-baseline: alphabetic; }
    svg[data-theme="on-dark"] .wm-theme-light { display: none; }
    svg[data-theme="on-light"] .wm-theme-dark { display: none; }
  </style>

  <g class="wm-theme-dark wm-text">
    <text x="0" y="54" direction="ltr" unicode-bidi="isolate" xml:space="preserve">
      <tspan class="wm-accent" fill="url(#wm-accent-on-dark)">A</tspan>
      <tspan class="wm-body" fill="url(#wm-body-on-dark)" dx="2">ll</tspan>
      <tspan class="wm-accent" fill="url(#wm-accent-on-dark)" dx="1">I</tspan>
      <tspan class="wm-body" fill="url(#wm-body-on-dark)" dx="2">n</tspan>
      <tspan class="wm-accent" fill="url(#wm-accent-on-dark)" dx="1">C</tspan>
      <tspan class="wm-body" fill="url(#wm-body-on-dark)" dx="2">enter</tspan>
    </text>
  </g>

  <g class="wm-theme-light wm-text">
    <text x="0" y="54" direction="ltr" unicode-bidi="isolate" xml:space="preserve">
      <tspan class="wm-accent" fill="url(#wm-accent-on-light)">A</tspan>
      <tspan class="wm-body" fill="url(#wm-body-on-light)" dx="2">ll</tspan>
      <tspan class="wm-accent" fill="url(#wm-accent-on-light)" dx="1">I</tspan>
      <tspan class="wm-body" fill="url(#wm-body-on-light)" dx="2">n</tspan>
      <tspan class="wm-accent" fill="url(#wm-accent-on-light)" dx="1">C</tspan>
      <tspan class="wm-body" fill="url(#wm-body-on-light)" dx="2">enter</tspan>
    </text>
  </g>
</svg>
`;
}

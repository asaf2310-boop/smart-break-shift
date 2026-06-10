/**
 * Wrap a brand PNG in an SVG container with embedded base64 raster (1:1 visual fidelity).
 *
 * Usage:
 *   node scripts/png-to-brand-svg.mjs
 *   node scripts/png-to-brand-svg.mjs <input.png> <output.svg>
 *   node scripts/png-to-brand-svg.mjs --snapshot   # also copy SVG to public/brand-snapshots/
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync, copyFileSync } from "fs";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const defaultInput = join(root, "public", "brand-snapshots", "login-hero-full-v1.png");
const defaultOutput = join(root, "public", "brand", "login-hero-full-v1.svg");
const defaultSnapshotCopy = join(root, "public", "brand-snapshots", "login-hero-full-v1.svg");

const args = process.argv.slice(2).filter((a) => a !== "--snapshot");
const copySnapshot = process.argv.includes("--snapshot");

const inputPath = args[0] ? resolvePath(args[0]) : defaultInput;
const outputPath = args[1] ? resolvePath(args[1]) : defaultOutput;

function resolvePath(p) {
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return p;
  return join(process.cwd(), p);
}

function labelFromPath(p) {
  return basename(p, ".svg").replace(/-/g, " ");
}

const meta = await sharp(inputPath).metadata();
const width = meta.width;
const height = meta.height;

const pngBuffer = await sharp(inputPath)
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();

const base64 = pngBuffer.toString("base64");
const label = labelFromPath(outputPath);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ${basename(outputPath)} — embedded PNG raster for 1:1 fidelity (Figma / design handoff).
  Source: ${inputPath.replace(/\\/g, "/")}
  Regenerate: node scripts/png-to-brand-svg.mjs
-->
<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 ${width} ${height}"
  width="${width}"
  height="${height}"
  role="img"
  aria-label="${label}">
  <image
    width="${width}"
    height="${height}"
    preserveAspectRatio="xMidYMid meet"
    href="data:image/png;base64,${base64}" />
</svg>
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, svg, "utf8");

const inputKb = (await sharp(inputPath).toBuffer()).length / 1024;
const svgKb = Buffer.byteLength(svg, "utf8") / 1024;
const pngOptKb = pngBuffer.length / 1024;

console.log(`Wrote ${outputPath}`);
console.log(`  viewBox: 0 0 ${width} ${height}`);
console.log(`  embedded raster: image/png (base64)`);
console.log(`  PNG optimized: ${pngOptKb.toFixed(1)} KiB (source file ~${inputKb.toFixed(1)} KiB)`);
console.log(`  SVG total: ${svgKb.toFixed(1)} KiB`);

if (copySnapshot || outputPath === defaultOutput) {
  mkdirSync(dirname(defaultSnapshotCopy), { recursive: true });
  copyFileSync(outputPath, defaultSnapshotCopy);
  console.log(`  copied → ${defaultSnapshotCopy}`);
}

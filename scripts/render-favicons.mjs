import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(repoRoot, "static", "favicon.svg");

const svg = readFileSync(src, "utf8");

const pngs = {};
for (const [name, size] of [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
]) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  pngs[name] = resvg.render().asPng();
}

const ico = buildIco([pngs["favicon-16x16.png"], pngs["favicon-32x32.png"]]);

const outputs = new Map();
outputs.set(join(repoRoot, "static", "favicon.ico"), ico);
for (const [name, buf] of Object.entries(pngs)) {
  outputs.set(join(repoRoot, "static", name), buf);
}
outputs.set(join(repoRoot, "static", "images", "salusa.svg"), Buffer.from(svg));

let changed = 0;
for (const [path, buf] of outputs) {
  const label = relative(process.cwd(), path);
  if (fileEquals(path, buf)) {
    console.log(`unchanged ${label}`);
  } else {
    writeFileSync(path, buf);
    console.log(`updated  ${label}`);
    changed++;
  }
}
console.log(changed ? `${changed} file(s) regenerated from ${relative(process.cwd(), src)}` : "all assets up to date");

function fileEquals(path, buf) {
  try {
    const existing = readFileSync(path);
    return existing.length === buf.length && existing.equals(buf);
  } catch {
    return false;
  }
}

function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + 16 * pngs.length;
  const entries = [];
  const blobs = [];
  for (const buf of pngs) {
    const size = widthFromPng(buf);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // bytes in resource
    entry.writeUInt32LE(offset, 12); // image offset
    offset += buf.length;
    entries.push(entry);
    blobs.push(buf);
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

function widthFromPng(buf) {
  return buf.readUInt32BE(16);
}
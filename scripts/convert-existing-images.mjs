import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const apply = process.argv.includes("--apply");
const photoExtensions = new Set([".jpg", ".jpeg", ".png"]);
const textExtensions = new Set([".js", ".jsx", ".css", ".html", ".json", ".md"]);

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

const publicFiles = await walk(publicDir);
const photos = publicFiles.filter(file => photoExtensions.has(path.extname(file).toLowerCase()) && path.basename(file).toLowerCase() !== "logo.png");
const conversions = photos.map(source => {
  const extension = path.extname(source);
  const destination = source.slice(0, -extension.length) + ".webp";
  return {
    source,
    destination,
    oldUrl: `/${path.relative(publicDir, source).split(path.sep).join("/")}`,
    newUrl: `/${path.relative(publicDir, destination).split(path.sep).join("/")}`,
  };
});

const destinations = conversions.map(item => item.destination);
if (new Set(destinations).size !== destinations.length) throw new Error("Two source images would produce the same WebP filename.");

if (!apply) {
  console.log(`Dry run: ${conversions.length} photographs will be converted. Run with --apply to continue.`);
  process.exit(0);
}

for (const item of conversions) {
  await sharp(item.source)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(item.destination);
}

const textFiles = [
  ...(await walk(path.join(root, "src"))),
  ...(await walk(path.join(root, "data"))),
  path.join(root, "index.html"),
  path.join(root, "README.md"),
].filter(file => textExtensions.has(path.extname(file).toLowerCase()));

for (const file of textFiles) {
  let content = await fs.readFile(file, "utf8");
  const original = content;
  for (const item of conversions) content = content.replaceAll(item.oldUrl, item.newUrl);
  if (content !== original) await fs.writeFile(file, content);
}

for (const item of conversions) await fs.unlink(item.source);

console.log(`Converted ${conversions.length} photographs to WebP and updated all local references.`);

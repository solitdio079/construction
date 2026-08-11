import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const contentPath = path.join(root, "data", "content.json");
const outputDir = path.join(root, "public", "imported");
const content = JSON.parse(await fs.readFile(contentPath, "utf8"));
await fs.mkdir(outputDir, { recursive: true });

const safe = (value) => value.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "").toLowerCase();

async function localize(url, prefix) {
  if (!url?.startsWith("http")) return url;
  const pathname = new URL(url).pathname;
  const extension = path.extname(pathname).toLowerCase() || ".jpg";
  const filename = `${safe(prefix)}${extension}`;
  let response = await fetch(url);
  if (!response.ok && url.includes("kuzeykaleinsaat.com/tema/")) response = await fetch(url.replace("kuzeykaleinsaat.com/tema/", "kuzeykaleinsaat.com//tema/"));
  if (!response.ok) { console.warn(`Skipped ${response.status}: ${url}`); return url; }
  await fs.writeFile(path.join(outputDir, filename), Buffer.from(await response.arrayBuffer()));
  return `/imported/${filename}`;
}

await Promise.all((content.team || []).map(async (person, index) => {
  person.image = await localize(person.image, `team-${index + 1}-${person.id}`);
}));

await Promise.all((content.projects || []).map(async project => {
  project.cover = await localize(project.cover, `project-${project.slug}-cover`);
  project.gallery = await Promise.all((project.gallery || []).map((url, index) => localize(url, `project-${project.slug}-${index + 1}`)));
}));

await fs.writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`);
console.log(`Localized ${(content.team || []).length} team photos and ${(content.projects || []).length} project galleries.`);

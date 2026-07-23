import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourcePath = resolve(projectRoot, "app/(auth)/auth-brand.css");
const outputPath = resolve(projectRoot, "public/hntrip-login-hero.jpg");

const css = await readFile(sourcePath, "utf8");
const match = css.match(/data:image\/jpeg;base64,([^)"']+)/s);

if (!match) {
  throw new Error("Embedded H&NTrip login photograph was not found in auth-brand.css");
}

const payload = match[1].replace(/\s+/g, "");
const bytes = Buffer.from(payload, "base64");
const hasJpegStart = bytes[0] === 0xff && bytes[1] === 0xd8;
const hasJpegEnd = bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;

if (bytes.length < 10_000 || !hasJpegStart || !hasJpegEnd) {
  throw new Error(`Embedded H&NTrip login photograph is not a complete JPEG payload (${bytes.length} bytes)`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
console.log(`Materialized login hero: ${bytes.length} bytes -> public/hntrip-login-hero.jpg`);

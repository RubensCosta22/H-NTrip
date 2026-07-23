import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourcePath = resolve(projectRoot, "app/(auth)/auth-brand.css");
const outputPath = resolve(projectRoot, "public/hntrip-login-hero.jpg");

const css = await readFile(sourcePath, "utf8");
const match = css.match(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/);

if (!match) {
  throw new Error("Embedded H&NTrip login photograph was not found in auth-brand.css");
}

const bytes = Buffer.from(match[1], "base64");
if (bytes.length < 10_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
  throw new Error("Embedded H&NTrip login photograph is not a valid JPEG payload");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
console.log(`Materialized login hero: ${bytes.length} bytes -> public/hntrip-login-hero.jpg`);

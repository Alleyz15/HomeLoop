// Mechanical extraction/optimisation only. No pixel painting or background removal.
// Run: node design/plans/prepare-adviser.mjs <generated-parts.png> [generated-closed-head.png]
import { createRequire } from "node:module";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const sharp = require("sharp");
const output = path.join(root, "apps/web/public/plans/adviser");
await mkdir(output, { recursive: true });
if (process.argv[2]) {
  const sourceDestination = path.join(here, "adviser-parts-source.png");
  if (path.resolve(process.argv[2]) !== sourceDestination) await copyFile(process.argv[2], sourceDestination);
  for (const [name, region] of Object.entries({
    head: { left: 88, top: 23, width: 612, height: 628 },
    torso: { left: 836, top: 94, width: 704, height: 620 },
    arm: { left: 1548, top: 157, width: 576, height: 500 },
  })) {
    await sharp(process.argv[2]).extract(region).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(output, `${name}.webp`));
    if (name === "head") await sharp(process.argv[2]).extract(region).png().toFile(path.join(here, "adviser-head-source.png"));
  }
}
if (process.argv[3]) {
  const sourceDestination = path.join(here, "adviser-blink-source.png");
  if (path.resolve(process.argv[3]) !== sourceDestination) await copyFile(process.argv[3], sourceDestination);
  const original = await sharp(path.join(here, "adviser-head-source.png")).metadata();
  // Both frames share registration. Only the eye region is used by the blink layer.
  await sharp(process.argv[3]).resize(original.width, original.height, { fit: "fill" }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(output, "head-blink.webp"));
}

import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(projectRoot, "dist", "hostinger-source");

const rootItems = [
  "src",
  "public",
  "scripts",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "next-env.d.ts",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "docker-compose.yml",
  "render.yaml",
  ".gitignore",
];

const excludedScriptItems = [
  "scripts/capture-instagram-profile-tranches.mjs",
  "scripts/download-instagram-post-images.mjs",
  "scripts/download-instagram-unique-srcs.mjs",
  "scripts/export-instagram-profile-html.mjs",
  "scripts/instagram-image-robot.mjs",
  "scripts/instagram-image-robot-batches.mjs",
  "scripts/rename-img-new-2-by-ocr.mjs",
  "scripts/rename-img-new-2-rescue.mjs",
  "scripts/rename-instagram-images.mjs",
];

async function copyItem(item) {
  const source = path.join(projectRoot, item);
  const target = path.join(packageRoot, item);
  await cp(source, target, { recursive: true, dereference: true });
}

async function main() {
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });

  for (const item of rootItems) {
    await copyItem(item);
  }

  for (const item of excludedScriptItems) {
    await rm(path.join(packageRoot, item), { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

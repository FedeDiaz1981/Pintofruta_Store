import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(projectRoot, "dist", "hostinger-lite");

const items = [
  "src",
  "public",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "next-env.d.ts",
];

async function main() {
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });

  for (const item of items) {
    await cp(path.join(projectRoot, item), path.join(packageRoot, item), {
      recursive: true,
      dereference: true,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

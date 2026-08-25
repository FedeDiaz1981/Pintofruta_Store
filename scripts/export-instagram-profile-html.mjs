import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const DEFAULT_PROFILE_URL = "https://www.instagram.com/distribuidora_pintofruta/";
const DEFAULT_OUTPUT_DIR = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new";
const DEFAULT_OUTPUT_FILE = "instagram-profile-full.html";
const DEFAULT_SCROLL_DELAY_MS = 2000;
const DEFAULT_MAX_SCROLLS = 80;

function parseArgs(argv) {
  return argv.reduce(
    (acc, rawArg) => {
      if (rawArg === "--help" || rawArg === "-h") {
        acc.help = true;
        return acc;
      }

      if (rawArg === "--headed") {
        acc.headed = true;
        return acc;
      }

      const [key, ...rest] = rawArg.replace(/^--/, "").split("=");
      const value = rest.length > 0 ? rest.join("=") : "true";

      if (key === "profile-url") {
        acc.profileUrl = value;
      } else if (key === "output-dir") {
        acc.outputDir = value;
      } else if (key === "output-file") {
        acc.outputFile = value;
      } else if (key === "scroll-delay-ms") {
        acc.scrollDelayMs = Number(value);
      } else if (key === "max-scrolls") {
        acc.maxScrolls = Number(value);
      }

      return acc;
    },
    {
      help: false,
      headed: false,
      profileUrl: DEFAULT_PROFILE_URL,
      outputDir: DEFAULT_OUTPUT_DIR,
      outputFile: DEFAULT_OUTPUT_FILE,
      scrollDelayMs: DEFAULT_SCROLL_DELAY_MS,
      maxScrolls: DEFAULT_MAX_SCROLLS,
    },
  );
}

async function scrollToLoadAllPosts(page, maxScrolls, scrollDelayMs) {
  const collected = new Set();
  let stableRounds = 0;

  for (let round = 0; round < maxScrolls && stableRounds < 3; round += 1) {
    const snapshot = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')).map((anchor) => anchor.getAttribute("href") || ""),
    );

    const before = collected.size;
    for (const href of snapshot) {
      if (href) {
        collected.add(href);
      }
    }

    if (collected.size === before) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
    }

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(scrollDelayMs);
  }

  return collected.size;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage:
  node scripts/export-instagram-profile-html.mjs [--headed] [--profile-url=URL] [--output-dir=PATH] [--output-file=NAME]

Options:
  --headed              Open a visible browser while scrolling the profile.
  --profile-url=URL     Instagram profile URL.
  --output-dir=PATH     Folder where the HTML file will be saved.
  --output-file=NAME    HTML file name to write.
  --max-scrolls=N      Maximum scroll rounds.
  --scroll-delay-ms=N   Delay between scroll rounds.
`);
    return;
  }

  await mkdir(args.outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: !args.headed });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1600 },
  });

  try {
    await page.goto(args.profileUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    const loaded = await scrollToLoadAllPosts(page, args.maxScrolls, args.scrollDelayMs);
    const html = await page.content();
    const outPath = path.join(args.outputDir, args.outputFile);

    await writeFile(outPath, html, "utf8");

    console.log(`Publicaciones detectadas con scroll: ${loaded}`);
    console.log(`HTML guardado en: ${outPath}`);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

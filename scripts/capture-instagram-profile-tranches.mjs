import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const DEFAULT_PROFILE_URL = "https://www.instagram.com/distribuidora_pintofruta/";
const DEFAULT_OUTPUT_DIR = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new";
const DEFAULT_CHUNK_DIR = "instagram-profile-chunks";
const DEFAULT_SCROLL_DELAY_MS = 2500;
const DEFAULT_MAX_SCROLLS = 100;
const DEFAULT_EXPECTED_POSTS = 217;

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
      } else if (key === "chunk-dir") {
        acc.chunkDir = value;
      } else if (key === "scroll-delay-ms") {
        acc.scrollDelayMs = Number(value);
      } else if (key === "max-scrolls") {
        acc.maxScrolls = Number(value);
      } else if (key === "expected-posts") {
        acc.expectedPosts = Number(value);
      }

      return acc;
    },
    {
      help: false,
      headed: false,
      profileUrl: DEFAULT_PROFILE_URL,
      outputDir: DEFAULT_OUTPUT_DIR,
      chunkDir: DEFAULT_CHUNK_DIR,
      scrollDelayMs: DEFAULT_SCROLL_DELAY_MS,
      maxScrolls: DEFAULT_MAX_SCROLLS,
      expectedPosts: DEFAULT_EXPECTED_POSTS,
    },
  );
}

function extractSrcs(html) {
  const srcs = [];
  const patterns = [
    /<img[^>]+src="([^"]+)"/g,
    /"display_url":"([^"]+)"/g,
    /"image_versions2":\{"candidates":\[\{"url":"([^"]+)"/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = String(match[1] || "");
      const src = raw
        .replace(/\\u0025/g, "%")
        .replace(/\\u0026/g, "&")
        .replace(/\\u003D/g, "=")
        .replace(/\\u003F/g, "?")
        .replace(/\\\//g, "/");
      if (src) {
        srcs.push(src);
      }
    }
  }

  return [...new Set(srcs)];
}

async function scrollAndCapture(page, maxScrolls, scrollDelayMs, chunkDirPath) {
  const htmlChunks = [];
  const seenPosts = new Map();
  let stableRounds = 0;

  for (let round = 0; round < maxScrolls && stableRounds < 3; round += 1) {
    const snapshot = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')).map((anchor) => anchor.getAttribute("href") || ""),
    );

    const before = seenPosts.size;
    for (const href of snapshot) {
      if (href) {
        const absolute = new URL(href, page.url()).toString();
        if (!seenPosts.has(absolute)) {
          seenPosts.set(absolute, absolute);
        }
      }
    }

    const html = await page.content();
    const fileName = `chunk-${String(round + 1).padStart(3, "0")}.html`;
    await writeFile(path.join(chunkDirPath, fileName), html, "utf8");
    htmlChunks.push({
      round: round + 1,
      postsSeen: seenPosts.size,
      htmlFile: fileName,
      srcCount: extractSrcs(html).length,
    });

    if (seenPosts.size === before) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
    }

    await page.evaluate(() => {
      window.scrollBy(0, Math.max(window.innerHeight * 0.85, 1000));
    });
    await page.waitForTimeout(scrollDelayMs);
  }

  return { htmlChunks, totalPosts: seenPosts.size };
}

function decodeInstagramUrl(value) {
  return String(value || "")
    .replace(/\\u0025/g, "%")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\u003F/g, "?")
    .replace(/\\\//g, "/");
}

async function collectPostImageSrcs(page, postUrl) {
  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);

  const html = await page.content();
  const srcs = new Set();
  const carouselMatch = html.match(/"carousel_media_count":(\d+)/);
  const carouselCount = Number.parseInt(carouselMatch?.[1] || "1", 10) || 1;

  for (const match of html.matchAll(/"image_versions2":\{"candidates":\[\{"url":"([^"]+)"/g)) {
    srcs.add(decodeInstagramUrl(match[1]));
  }

  for (const match of html.matchAll(/"display_url":"([^"]+)"/g)) {
    srcs.add(decodeInstagramUrl(match[1]));
  }

  const domImages = await page.evaluate(() =>
    Array.from(document.querySelectorAll("img"))
      .map((img) => ({
        src: img.getAttribute("src") || "",
        alt: String(img.getAttribute("alt") || ""),
        width: Number(img.naturalWidth || 0),
        height: Number(img.naturalHeight || 0),
      }))
      .filter((img) => {
        const alt = img.alt.toLowerCase();
        const looksLikeUi = alt.includes("profile picture") || alt.includes("avatar") || alt.includes("story");
        return !looksLikeUi && img.src && (img.width >= 180 || img.height >= 180 || alt.startsWith("photo by") || alt.startsWith("foto"));
      }),
  );

  for (const image of domImages) {
    srcs.add(image.src);
  }

  return {
    postUrl,
    carouselCount,
    htmlSrcs: [...srcs],
    domImages,
    html,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage:
  node scripts/capture-instagram-profile-tranches.mjs [--headed] [--profile-url=URL] [--output-dir=PATH]

Options:
  --headed              Open a visible browser while scrolling the profile.
  --profile-url=URL     Instagram profile URL.
  --output-dir=PATH     Folder where HTML chunks and reports will be saved.
  --chunk-dir=NAME      Subfolder name for HTML chunks.
  --max-scrolls=N      Maximum scroll rounds.
  --expected-posts=N    Stop scrolling when this many posts are detected.
  --scroll-delay-ms=N   Delay between scroll rounds.
`);
    return;
  }

  const chunkDirPath = path.join(args.outputDir, args.chunkDir);
  await mkdir(chunkDirPath, { recursive: true });

  const browser = await chromium.launch({ headless: !args.headed });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

  try {
    await page.goto(args.profileUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);

    const { htmlChunks, totalPosts } = await scrollAndCapture(page, args.maxScrolls, args.scrollDelayMs, chunkDirPath);
    const combinedHtml = await page.content();
    const combinedSrcs = extractSrcs(combinedHtml);
    const allSrcs = new Set(combinedSrcs);
    const postUrls = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
        .map((anchor) => anchor.getAttribute("href") || "")
        .filter(Boolean),
    );
    const uniquePostUrls = [...new Set(postUrls.map((href) => new URL(href, args.profileUrl).toString()))];

    const postReports = [];
    for (let i = 0; i < uniquePostUrls.length; i += 1) {
      const postUrl = uniquePostUrls[i];
      const result = await collectPostImageSrcs(page, postUrl);
      for (const src of result.htmlSrcs) {
        allSrcs.add(src);
      }
      postReports.push({
        postUrl,
        carouselCount: result.carouselCount,
        imageSrcs: result.htmlSrcs.length,
      });
    }

    const dedupedSrcs = [...allSrcs];
    const report = {
      profileUrl: args.profileUrl,
      capturedAt: new Date().toISOString(),
      totalScrollChunks: htmlChunks.length,
      totalPostsDetected: totalPosts,
      totalPostUrlsProcessed: uniquePostUrls.length,
      expectedPosts: args.expectedPosts,
      totalUniqueImageSrcs: dedupedSrcs.length,
      htmlChunks,
      postReports,
    };

    await writeFile(path.join(args.outputDir, "instagram-profile-tranche-report.json"), JSON.stringify(report, null, 2), "utf8");
    await writeFile(path.join(args.outputDir, "instagram-profile-unique-srcs.json"), JSON.stringify(dedupedSrcs, null, 2), "utf8");
    await writeFile(path.join(args.outputDir, "instagram-profile-full-combined.html"), combinedHtml, "utf8");

    console.log(`Tramos capturados: ${htmlChunks.length}`);
    console.log(`Publicaciones detectadas: ${totalPosts}`);
    console.log(`Imagenes únicas deduplicadas: ${dedupedSrcs.length}`);
    console.log(`Reporte: ${path.join(args.outputDir, "instagram-profile-tranche-report.json")}`);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

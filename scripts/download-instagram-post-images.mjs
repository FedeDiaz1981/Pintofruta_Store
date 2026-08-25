import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const INDEX_PATH =
  "C:\\FD\\WBI\\Maxi\\Proyectos\\En curso\\NATIER\\PintoFruta_Store\\reports\\instagram-index-2026-08-23T02-45-56-537Z.json";
const OUTPUT_DIR = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img";
const VIEWPORT = { width: 1440, height: 2200 };
const TOP_BLOCK_MAX_Y = 900;
const MIN_MEDIA_SIZE = 250;

function safeSlug(value) {
  return String(value || "post")
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "post";
}

function parseArgs(argv) {
  return argv.reduce(
    (acc, rawArg) => {
      if (rawArg === "--headed") {
        acc.headed = true;
        return acc;
      }

      if (rawArg === "--help" || rawArg === "-h") {
        acc.help = true;
        return acc;
      }

      const [key, ...rest] = rawArg.replace(/^--/, "").split("=");
      const value = rest.length > 0 ? rest.join("=") : "true";

      if (key === "profile-url") {
        acc.profileUrl = value;
      } else if (key === "output-dir") {
        acc.outputDir = value;
      } else if (key === "index-path") {
        acc.indexPath = value;
      } else if (key === "top-block-max-y") {
        acc.topBlockMaxY = Number(value);
      } else if (key === "min-media-size") {
        acc.minMediaSize = Number(value);
      }

      return acc;
    },
    {
      help: false,
      headed: false,
      profileUrl: "https://www.instagram.com/distribuidora_pintofruta/",
      outputDir: OUTPUT_DIR,
      indexPath: INDEX_PATH,
      topBlockMaxY: TOP_BLOCK_MAX_Y,
      minMediaSize: MIN_MEDIA_SIZE,
    },
  );
}

function hashText(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 10);
}

function toArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

async function fetchBinary(url) {
  const response = await fetch(url, {
    headers: {
      referer: "https://www.instagram.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo bajar ${url} (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
}

function extensionFromContentType(contentType, fallbackUrl = "") {
  const type = String(contentType || "").toLowerCase();

  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";

  try {
    const ext = path.extname(new URL(fallbackUrl).pathname).replace(".", "");
    if (ext && ext.length <= 5) return ext.toLowerCase();
  } catch {}

  return "jpg";
}

async function extractCurrentPostImages(page) {
  return await page.evaluate(
    ({ topBlockMaxY, minMediaSize }) => {
      const items = Array.from(document.querySelectorAll("img"))
        .map((img) => {
          const rect = img.getBoundingClientRect();
          return {
            alt: String(img.getAttribute("alt") || ""),
            src: String(img.getAttribute("src") || ""),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          };
        })
        .filter((img) => {
          const alt = img.alt.toLowerCase();
          const looksLikePostMedia =
            alt.startsWith("photo by") ||
            alt.startsWith("foto by") ||
            alt.startsWith("photo of") ||
            alt.startsWith("photo from");

          return (
            looksLikePostMedia &&
            img.src &&
            img.y >= 0 &&
            img.y < topBlockMaxY &&
            img.w >= minMediaSize &&
            img.h >= minMediaSize
          );
        });

      const unique = [];
      const seen = new Set();
      for (const item of items.sort((a, b) => a.x - b.x || a.y - b.y)) {
        if (seen.has(item.src)) continue;
        seen.add(item.src);
        unique.push(item);
      }

      return unique;
    },
    { topBlockMaxY: TOP_BLOCK_MAX_Y, minMediaSize: MIN_MEDIA_SIZE },
  );
}

async function getMainPostImage(page) {
  const images = await extractCurrentPostImages(page);
  if (images.length === 0) {
    return null;
  }

  return images.sort((left, right) => right.w * right.h - left.w * left.h)[0] || null;
}

async function collectCarouselImages(page, postUrl) {
  const html = await page.content();
  const parts = new URL(postUrl).pathname.split("/").filter(Boolean);
  const codeIndex = parts.indexOf("p");
  const code = codeIndex >= 0 ? parts[codeIndex + 1] || "" : "";
  if (!code) {
    return [];
  }

  const htmlCodeIndex = html.indexOf(`"code":"${code}"`);
  if (htmlCodeIndex < 0) {
    return [];
  }

  const slice = html.slice(htmlCodeIndex, htmlCodeIndex + 160000);
  const expectedCount = Number.parseInt((slice.match(/"carousel_media_count":(\d+)/) || [])[1] || "1", 10) || 1;
  const urls = [];

  for (const match of slice.matchAll(/"image_versions2":\{"candidates":\[\{"url":"([^"]+)"/g)) {
    const rawUrl = match[1]
      .replace(/\\u0025/g, "%")
      .replace(/\\u0026/g, "&")
      .replace(/\\u003D/g, "=")
      .replace(/\\u003F/g, "?")
      .replace(/\\\//g, "/");
    urls.push(rawUrl);
  }

  const uniqueUrls = [...new Set(urls)].slice(0, expectedCount);

  return uniqueUrls.map((src, index) => ({
    src,
    alt: `Photo ${index + 1} by Pintófruta on ${code}`,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage:
  node scripts/download-instagram-post-images.mjs [--headed]

Options:
  --headed               Open a visible browser while visiting each publication.
  --profile-url=URL      Instagram profile to read.
  --output-dir=PATH      Destination folder for downloaded images.
  --index-path=PATH      Index file with post URLs.
`);
    return;
  }

  const raw = await readFile(args.indexPath, "utf8");
  const parsed = JSON.parse(raw);
  const posts = toArray(parsed.instagramIndex);

  await rm(args.outputDir, { recursive: true, force: true });
  await mkdir(args.outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: !args.headed });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const manifest = [];
  const seenContent = new Set();

  try {
    for (const post of posts) {
      await page.goto(post.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(5000);

      const images = await collectCarouselImages(page, post.url);
      if (images.length === 0) {
        continue;
      }

      const postSlug = safeSlug(post.url);
      let slideIndex = 0;

      for (const image of images) {
        slideIndex += 1;
        const contentKey = hashText(image.src);
        const contentPrefix = `${postSlug}-${String(slideIndex).padStart(2, "0")}-${contentKey}`;
        if (seenContent.has(contentKey)) {
          console.log(`Repetida, se omite: ${contentPrefix}`);
          continue;
        }

        const { buffer, contentType } = await fetchBinary(image.src);
        const ext = extensionFromContentType(contentType, image.src);
        const fileName = `${contentPrefix}.${ext}`;
        const filePath = path.join(args.outputDir, fileName);

        await writeFile(filePath, buffer);
        seenContent.add(contentKey);

        manifest.push({
          postUrl: post.url,
          slide: slideIndex,
          fileName,
          imageUrl: image.src,
          alt: image.alt,
          x: image.x,
          y: image.y,
          width: image.w,
          height: image.h,
        });

        console.log(`Guardada: ${fileName}`);
      }
    }
  } finally {
    await browser.close();
  }

  await writeFile(
    path.join(args.outputDir, "manifest.json"),
    JSON.stringify(
      {
        profileUrl: args.profileUrl,
        source: args.indexPath,
        extractedAt: new Date().toISOString(),
        totalFiles: manifest.length,
        items: manifest,
      },
      null,
      2,
    ),
  );

  console.log(`Total archivos: ${manifest.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_SOURCES_PATH =
  "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new\\instagram-profile-unique-srcs.json";
const DEFAULT_OUTPUT_DIR = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new_2";

function parseArgs(argv) {
  return argv.reduce(
    (acc, rawArg) => {
      if (rawArg === "--help" || rawArg === "-h") {
        acc.help = true;
        return acc;
      }

      const [key, ...rest] = rawArg.replace(/^--/, "").split("=");
      const value = rest.length > 0 ? rest.join("=") : "true";

      if (key === "sources") {
        acc.sources = value;
      } else if (key === "output-dir") {
        acc.outputDir = value;
      }

      return acc;
    },
    {
      help: false,
      sources: DEFAULT_SOURCES_PATH,
      outputDir: DEFAULT_OUTPUT_DIR,
    },
  );
}

function hashText(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 10);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extensionFromContentType(contentType, fallbackUrl = "") {
  const type = String(contentType || "").toLowerCase();

  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";

  try {
    const ext = path.extname(new URL(fallbackUrl).pathname).replace(".", "");
    if (ext && ext.length <= 5) {
      return ext.toLowerCase();
    }
  } catch {}

  return "jpg";
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage:
  node scripts/download-instagram-unique-srcs.mjs [--sources=PATH] [--output-dir=PATH]

Options:
  --sources=PATH      JSON file with the unique Instagram image URLs.
  --output-dir=PATH   Folder where downloaded images will be stored.
`);
    return;
  }

  const raw = await readFile(args.sources, "utf8");
  const sources = JSON.parse(raw);
  const urls = Array.isArray(sources) ? sources : Array.isArray(sources.items) ? sources.items : [];

  await rm(args.outputDir, { recursive: true, force: true });
  await mkdir(args.outputDir, { recursive: true });

  const manifest = [];
  const seen = new Set();

  for (let i = 0; i < urls.length; i += 1) {
    const src = decodeHtmlEntities(String(urls[i] || "").trim());
    if (!src) {
      continue;
    }

    const key = hashText(src);
    if (seen.has(key)) {
      continue;
    }

    const { buffer, contentType } = await fetchBinary(src);
    const ext = extensionFromContentType(contentType, src);
    const fileName = `${String(manifest.length + 1).padStart(3, "0")}-${key}.${ext}`;
    const filePath = path.join(args.outputDir, fileName);

    await writeFile(filePath, buffer);
    seen.add(key);
    manifest.push({
      index: manifest.length + 1,
      src,
      fileName,
      contentType,
    });

    console.log(`${manifest.length}/${urls.length} -> ${fileName}`);
  }

  await writeFile(
    path.join(args.outputDir, "manifest.json"),
    JSON.stringify(
      {
        source: args.sources,
        downloadedAt: new Date().toISOString(),
        total: manifest.length,
        items: manifest,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Total descargadas: ${manifest.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { Pool } from "pg";
import { chromium } from "playwright";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const DEFAULT_BASE_URL = "https://pintofruta.com";
const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/distribuidora_pintofruta/";
const DEFAULT_MAX_SCROLLS = 18;
const DEFAULT_SCROLL_DELAY_MS = 1300;
const DEFAULT_MIN_SCORE = 10;
const DEFAULT_AUTO_ACCEPT_SCORE = 28;
const DEFAULT_REVIEW_SCORE = 14;
const DEFAULT_CANDIDATES = 8;

const STOP_WORDS = new Set([
  "a",
  "ac",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "e",
  "la",
  "las",
  "los",
  "y",
  "o",
  "por",
  "para",
  "sin",
  "un",
  "una",
  "unos",
  "unas",
  "cc",
  "gr",
  "g",
  "kg",
  "ml",
  "u",
  "unit",
  "units",
  "caja",
  "pack",
  "promo",
  "promocion",
  "producto",
  "productos",
  "foto",
  "post",
  "publicacion",
]);

function parseArgs(argv) {
  return argv.reduce(
    (acc, rawArg) => {
      if (rawArg === "--dry-run") {
        acc.dryRun = true;
        return acc;
      }

      if (rawArg === "--help" || rawArg === "-h") {
        acc.help = true;
        return acc;
      }

      const [key, ...rest] = rawArg.replace(/^--/, "").split("=");
      const value = rest.length > 0 ? rest.join("=") : "true";

      if (key === "product-id") {
        acc.productId = value;
      } else if (key === "limit") {
        acc.limit = Number(value);
      } else if (key === "after-id") {
        acc.afterId = Number(value);
      } else if (key === "min-score") {
        acc.minScore = Number(value);
      } else if (key === "instagram-url") {
        acc.instagramUrl = value;
      } else if (key === "base-url") {
        acc.baseUrl = value;
      } else if (key === "max-scrolls") {
        acc.maxScrolls = Number(value);
      } else if (key === "scroll-delay-ms") {
        acc.scrollDelayMs = Number(value);
      } else if (key === "search") {
        acc.search = value;
      } else if (key === "recent-posts") {
        acc.recentPosts = Number(value);
      } else if (key === "index-only") {
        acc.indexOnly = value !== "false";
      } else if (key === "use-index-file") {
        acc.useIndexFile = value;
      } else if (key === "index-output") {
        acc.indexOutput = value;
      } else if (key === "auto-score") {
        acc.autoScore = Number(value);
      } else if (key === "review-score") {
        acc.reviewScore = Number(value);
      }

      return acc;
    },
    {
      dryRun: false,
      help: false,
      productId: "",
      limit: Infinity,
      afterId: 0,
      minScore: DEFAULT_MIN_SCORE,
      instagramUrl: DEFAULT_INSTAGRAM_URL,
      baseUrl: DEFAULT_BASE_URL,
      maxScrolls: DEFAULT_MAX_SCROLLS,
      scrollDelayMs: DEFAULT_SCROLL_DELAY_MS,
      search: "",
      recentPosts: 0,
      indexOnly: false,
      useIndexFile: "",
      indexOutput: "",
      autoScore: DEFAULT_AUTO_ACCEPT_SCORE,
      reviewScore: DEFAULT_REVIEW_SCORE,
    },
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function safeJsonParse(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function bufferToDataUrl(buffer, contentType = "image/jpeg") {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function buildSearchProfile(product) {
  const sources = [product.brand, product.name, product.detail, product.presentation, product.sku];
  const tokens = uniq(sources.flatMap((value) => tokenize(value)));
  const brandTokens = tokenize(product.brand);
  const nameTokens = tokenize(product.name);

  return {
    brand: normalizeText(product.brand),
    name: normalizeText(product.name),
    detail: normalizeText(product.detail),
    presentation: normalizeText(product.presentation),
    headline: normalizeText([product.brand, product.name].filter(Boolean).join(" ")),
    tokens,
    strongTokens: tokens.filter((token) => token.length >= 4),
    brandTokens,
    nameTokens,
  };
}

function scoreTextForProduct(profile, textInput) {
  const text = normalizeText(textInput);

  if (!text) {
    return 0;
  }

  let score = 0;

  if (profile.brand && text.includes(profile.brand)) {
    score += 10;
  }

  if (profile.headline && text.includes(profile.headline)) {
    score += 8;
  } else if (profile.name && text.includes(profile.name)) {
    score += 6;
  } else {
    const headlineTokens = profile.headline.split(" ").filter(Boolean).slice(0, 4);
    score += headlineTokens.filter((token) => text.includes(token)).length * 2;
  }

  for (const token of profile.strongTokens) {
    if (text.includes(token)) {
      score += token.length >= 8 ? 3 : 2;
    }
  }

  if (profile.presentation && profile.presentation.length >= 4 && text.includes(profile.presentation)) {
    score += 2;
  }

  if (profile.detail && profile.detail.length >= 8 && text.includes(profile.detail.slice(0, 48))) {
    score += 2;
  }

  if (text.includes("cacao") && (text.includes("70") || text.includes("70%"))) {
    score += 8;
  }

  if (text.includes("chocolate") && text.includes("70")) {
    score += 5;
  }

  if (text.includes("chocolate") && text.includes("organico")) {
    score += 2;
  }

  if (text.includes("sin azucar") || text.includes("sin azucar agregada") || text.includes("sin azucar con stevia")) {
    score += 3;
  }

  score += Math.min(profile.strongTokens.filter((token) => text.includes(token)).length, 6);

  return score;
}

function scorePostForProduct(product, post, extraText = "") {
  const profile = buildSearchProfile(product);
  const captionText = [post.alt, post.caption, post.title, post.text].filter(Boolean).join(" ");
  const ocrText = normalizeText(extraText);

  if (!ocrText) {
    return Number.NEGATIVE_INFINITY;
  }

  if (profile.brand && !ocrText.includes(profile.brand)) {
    return Number.NEGATIVE_INFINITY;
  }

  const matchedNameTokens = profile.nameTokens.filter((token) => ocrText.includes(token));
  const requiredNameMatches = Math.max(2, Math.min(3, Math.ceil(profile.nameTokens.length * 0.3)));

  if (matchedNameTokens.length < requiredNameMatches) {
    return Number.NEGATIVE_INFINITY;
  }

  const captionScore = scoreTextForProduct(profile, captionText);
  const ocrScore = scoreTextForProduct(profile, ocrText);

  let score = captionScore + ocrScore * 2;

  if (profile.brand && ocrText && ocrText.includes(profile.brand)) {
    score += 12;
  }

  if (profile.brandTokens.length > 0 && profile.brandTokens.every((token) => ocrText.includes(token))) {
    score += 8;
  }

  if (profile.nameTokens.length > 0) {
    score += matchedNameTokens.length * 4;
    score += Math.min(matchedNameTokens.length, 4);
  }

  if (profile.name.includes("70") && ocrText.includes("70")) {
    score += 6;
  }

  if (profile.name.includes("70") && !ocrText.includes("70")) {
    return Number.NEGATIVE_INFINITY;
  }

  if (ocrText.includes("get real")) {
    score -= 20;
  }

  return score;
}

async function fetchRemoteImageBuffer(imageUrl) {
  const response = await fetch(imageUrl, {
    headers: {
      referer: "https://www.instagram.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

async function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no esta configurada.");
  }

  return new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === "disable" ? undefined : { rejectUnauthorized: false },
  });
}

async function fetchMissingProducts(pool, productId, limit, search = "", afterId = 0) {
  const params = [];
  const conditions = ["deleted_at is null", "status = 'published'"];

  if (!productId) {
    conditions.push("(image is null or btrim(image) = '' or lower(image) like '%no-image%')");
  }

  if (productId) {
    params.push(Number(productId));
    conditions.push(`id = $${params.length}`);
  }

  if (!productId && Number.isFinite(afterId) && afterId > 0) {
    params.push(Number(afterId));
    conditions.push(`id > $${params.length}`);
  }

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(
      `(lower(coalesce(name, '')) like $${params.length} or lower(coalesce(brand, '')) like $${params.length} or lower(coalesce(sku, '')) like $${params.length})`,
    );
  }

  const query = `
    select id, sku, name, brand, detail, presentation, image
    from products
    where ${conditions.join(" and ")}
    order by id asc
    ${Number.isFinite(limit) ? `limit ${Math.max(0, Math.floor(limit))}` : ""}
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

async function collectInstagramPosts(page, instagramUrl, maxScrolls, scrollDelayMs, limitPosts = Infinity) {
  await page.goto(instagramUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);

  const loginWallText = await page.evaluate(() => document.body?.innerText || "");
  if (/log into instagram|mobile number, username or email|password/i.test(loginWallText)) {
    throw new Error("Instagram devolvio pantalla de login y no se pudieron leer publicaciones publicas.");
  }

  const collected = new Map();
  let stableRounds = 0;

  for (let round = 0; round < maxScrolls && stableRounds < 2; round += 1) {
    const snapshot = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));

      return anchors.map((anchor) => {
        const image = anchor.querySelector("img");

        return {
          href: anchor.getAttribute("href") || "",
          text: (anchor.textContent || "").trim(),
          alt: image?.getAttribute("alt") || "",
          src: image?.getAttribute("src") || "",
        };
      });
    });

    const before = collected.size;

    for (const item of snapshot) {
      if (!item.href) {
        continue;
      }

      const absoluteUrl = new URL(item.href, instagramUrl).toString();
      if (!collected.has(absoluteUrl)) {
        collected.set(absoluteUrl, {
          url: absoluteUrl,
          text: item.text,
          alt: item.alt,
          imageUrl: item.src || "",
        });
      }
    }

    if (collected.size >= limitPosts) {
      break;
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

  return [...collected.values()];
}

async function enrichInstagramPosts(page, posts, limitPosts = 10) {
  const enriched = [];
  const slice = posts.slice(0, Math.max(0, limitPosts));

  for (const post of slice) {
    await page.goto(post.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    const details = await page.evaluate(() => {
      const bodyText = document.body?.innerText || "";
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => ({
          src: img.getAttribute("src") || "",
          alt: String(img.getAttribute("alt") || ""),
          width: Number(img.naturalWidth || 0),
          height: Number(img.naturalHeight || 0),
        }))
        .filter((img) => img.src);

      const contentImages = images.filter((img) => {
        const alt = img.alt.toLowerCase();
        const isUiImage = alt.includes("profile picture") || alt.includes("story") || alt.includes("avatar");
        const looksLikePostImage =
          alt.startsWith("photo by") ||
          alt.startsWith("foto de") ||
          alt.startsWith("photo of") ||
          alt.startsWith("photo from") ||
          img.width >= 180 ||
          img.height >= 180;

        return !isUiImage && looksLikePostImage;
      });

      const uniqueImageUrls = [...new Set(contentImages.map((img) => img.src))].slice(0, 4);
      const mainImage = contentImages[0] || images[1] || images[0] || null;

      return {
        text: bodyText,
        imageUrl: mainImage?.src || "",
        alt: mainImage?.alt || "",
        imageUrls: uniqueImageUrls,
      };
    });

    enriched.push({
      ...post,
      text: details.text || post.text,
      alt: details.alt || post.alt,
      imageUrl: details.imageUrl || post.imageUrl,
      imageUrls: details.imageUrls?.length ? details.imageUrls : post.imageUrl ? [post.imageUrl] : [],
    });
  }

  return enriched;
}

async function loadInstagramIndexFromFile(indexFilePath) {
  const raw = await readFile(indexFilePath, "utf8");
  const parsed = safeJsonParse(raw);

  if (!parsed) {
    throw new Error(`No se pudo leer el indice JSON desde ${indexFilePath}.`);
  }

  const instagramIndex = Array.isArray(parsed.instagramIndex) ? parsed.instagramIndex : Array.isArray(parsed.posts) ? parsed.posts : null;
  if (!instagramIndex) {
    throw new Error(`El archivo ${indexFilePath} no contiene instagramIndex.`);
  }

  return {
    instagramIndex,
    sourcePath: indexFilePath,
  };
}

async function createOcrWorker() {
  const worker = await createWorker("eng");
  return worker;
}

async function preprocessImageForOcr(imageUrl) {
  const { buffer } = await fetchRemoteImageBuffer(imageUrl);
  return sharp(buffer)
    .resize({ width: 1800, withoutEnlargement: true, fit: "inside" })
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

async function extractOcrText(imageUrl, tempRoot, ocrWorker, cache) {
  if (!imageUrl) {
    return "";
  }

  if (cache.has(imageUrl)) {
    return cache.get(imageUrl);
  }

  const processedBuffer = await preprocessImageForOcr(imageUrl);
  const tempPath = path.join(tempRoot, `ocr-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  await writeFile(tempPath, processedBuffer);

  const result = await ocrWorker.recognize(tempPath);
  const text = String(result?.data?.text ?? "").trim();

  cache.set(imageUrl, text);
  return text;
}

async function extractBestOcrText(imageUrls, tempRoot, ocrWorker, cache) {
  const urls = uniq((Array.isArray(imageUrls) ? imageUrls : [imageUrls]).filter(Boolean));
  let bestText = "";

  for (const url of urls.slice(0, 3)) {
    const text = await extractOcrText(url, tempRoot, ocrWorker, cache);
    if (text.length > bestText.length) {
      bestText = text;
    }

    if (bestText.length >= 120) {
      break;
    }
  }

  return bestText;
}

function pickPostSearchText(post) {
  return [post.text, post.alt, post.caption, post.title, post.ocrText].filter(Boolean).join(" ");
}

function scoreCandidateProductForPost(product, post) {
  const profile = buildSearchProfile(product);
  const text = normalizeText(pickPostSearchText(post));

  if (!text) {
    return 0;
  }

  let score = scoreTextForProduct(profile, text);

  const nameMatches = profile.nameTokens.filter((token) => text.includes(token));
  const brandMatches = profile.brandTokens.filter((token) => text.includes(token));

  score += nameMatches.length * 3;
  score += brandMatches.length * 5;

  if (profile.brand && text.includes(profile.brand)) {
    score += 12;
  }

  if (profile.name && text.includes(profile.name)) {
    score += 10;
  }

  if (profile.name.includes("70") && text.includes("70")) {
    score += 6;
  }

  if (profile.name.includes("chocolate") && text.includes("chocolate")) {
    score += 4;
  }

  return score;
}

function selectCandidateProductsForPost(products, post, limit = DEFAULT_CANDIDATES) {
  const postText = normalizeText(pickPostSearchText(post));
  const brandCandidates = products.filter((product) => {
    const brand = normalizeText(product.brand);
    return brand && postText.includes(brand);
  });

  const pool = brandCandidates.length > 0 ? brandCandidates : products;

  return pool
    .map((product) => ({
      ...product,
      heuristicScore: scoreCandidateProductForPost(product, post),
    }))
    .sort((left, right) => right.heuristicScore - left.heuristicScore)
    .slice(0, limit);
}

function selectBestHeuristicCandidate(candidateProducts) {
  const best = candidateProducts[0] || null;

  if (!best) {
    return null;
  }

  return {
    decision: "match",
    product_id: best.id,
    confidence: Math.min(0.72, 0.45 + Math.max(0, best.heuristicScore) / 40),
    reason: "seleccion heuristica local",
    matched_brand: best.brand || "",
    matched_name: best.name || "",
  };
}

function selectBestPostForProduct(product, posts) {
  const scoredPosts = posts
    .map((post) => ({
      ...post,
      heuristicScore: scoreCandidateProductForPost(product, post),
    }))
    .sort((left, right) => right.heuristicScore - left.heuristicScore);

  return scoredPosts[0] || null;
}

async function downloadImageToTemp(imageUrl, product, tempRoot) {
  if (!imageUrl) {
    throw new Error(`La publicacion elegida para ${product.id} no tiene una imagen descargable.`);
  }

  const { buffer, contentType } = await fetchRemoteImageBuffer(imageUrl);
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : "jpg";

  const safeBaseName = normalizeText([product.id, product.sku, product.brand, product.name].filter(Boolean).join(" "))
    .replace(/\s+/g, "-")
    .slice(0, 120);
  const filePath = path.join(tempRoot, `${safeBaseName || `product-${product.id}`}.${extension}`);

  await writeFile(filePath, buffer);
  return filePath;
}

async function loginToAdmin(page, baseUrl) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.PINTOFRUTA_ADMIN_EMAIL || "";
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.PINTOFRUTA_ADMIN_PASSWORD || "";

  if (!adminEmail || !adminPassword) {
    throw new Error("Faltan ADMIN_EMAIL/ADMIN_PASSWORD o PINTOFRUTA_ADMIN_EMAIL/PINTOFRUTA_ADMIN_PASSWORD.");
  }

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByLabel("Cuenta").click({ timeout: 30000 });
  await page.locator("#desktop-login-toggle-email").fill(adminEmail);
  await page.locator("#desktop-login-toggle-password").fill(adminPassword);
  await page.locator("form").filter({ has: page.locator("#desktop-login-toggle-email") }).evaluate((form) => form.requestSubmit());
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
}

async function openProductEditor(page, baseUrl, product) {
  const adminUrl = `${baseUrl}/admin`;

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(adminUrl, { waitUntil: "commit", timeout: 120000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 120000 }).catch(() => undefined);
      await page.getByRole("button", { name: "Productos" }).click({ force: true, timeout: 30000 });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await page.waitForTimeout(2500);
        continue;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  await page.waitForTimeout(1000);

  const searchBox = page.getByPlaceholder("Buscar por SKU, nombre, email o estado");
  await searchBox.fill(String(product.id));
  await page.waitForTimeout(750);

  const row = page
    .locator("tr")
    .filter({ hasText: String(product.id) })
    .filter({ hasText: product.sku })
    .filter({ hasText: product.name })
    .first();

  await row.getByRole("button", { name: "Editar" }).click({ force: true, timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function waitForImagePreview(page) {
  const emptyState = page.getByText("Todavía no se subió una imagen para esta promoción.");
  const loadingState = page.getByText("Subiendo imagen...");

  await loadingState.waitFor({ state: "visible", timeout: 15000 }).catch(() => undefined);
  await emptyState.waitFor({ state: "hidden", timeout: 120000 });
}

async function uploadImageAndSave(page, product, imagePath) {
  await page.locator("#admin-file-input-products-image").setInputFiles(imagePath);
  await waitForImagePreview(page);

  await page.getByRole("button", { name: "Guardar" }).click({ force: true, timeout: 30000 });
  await page.waitForTimeout(2500);

  const editorHeader = page.getByText("Editar registro");
  await editorHeader.waitFor({ state: "hidden", timeout: 12000 }).catch(() => undefined);
}

async function verifyProductImage(pool, productId, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await pool.query("select image from products where id = $1 limit 1", [productId]);
    const image = String(result.rows[0]?.image ?? "").trim();

    if (image) {
      return image;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return null;
}

async function saveRobotReport(report, prefix = "instagram-image-robot") {
  const reportsDir = path.join(process.cwd(), "reports");
  await mkdir(reportsDir, { recursive: true });
  const reportStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportsDir, `${prefix}-${reportStamp}.json`);
  report.finishedAt = new Date().toISOString();
  report.reportPath = reportPath;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/instagram-image-robot.mjs [--dry-run] [--product-id=696] [--limit=20]

Environment:
  DATABASE_URL
  ADMIN_EMAIL or PINTOFRUTA_ADMIN_EMAIL
  ADMIN_PASSWORD or PINTOFRUTA_ADMIN_PASSWORD
  Optional: BASE_URL, INSTAGRAM_URL

Options:
  --dry-run           Find matches and download images, but do not upload or save.
  --product-id=ID     Process one product only.
  --limit=N           Process only the first N missing products.
  --after-id=ID       Skip products with id <= ID when processing in batches.
  --recent-posts=N    Analyze only the N most recent Instagram posts.
  --index-only        Crawl Instagram, enrich posts, and save only the JSON index.
  --use-index-file=F  Skip Instagram crawling and load the JSON index from file F.
  --index-output=F    Write the Instagram index JSON to file F when using --index-only.
  --min-score=N       Minimum Instagram match score.
  --auto-score=N      Minimum score to auto-approve a product/post match.
  --review-score=N    Minimum score to keep a product/post as manual review.
  --instagram-url=U   Override Instagram profile URL.
  --base-url=U        Override the store base URL.
  --max-scrolls=N     Maximum scroll rounds to collect Instagram posts.
  --scroll-delay-ms=N Delay between Instagram scroll rounds.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const pool = await getPool();
  const browserCdpUrl = process.env.BROWSER_CDP_URL || "";
  const browser = browserCdpUrl ? await chromium.connectOverCDP(browserCdpUrl) : await chromium.launch({ headless: true });
  const connectedOverCdp = Boolean(browserCdpUrl);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const tempRoot = await mkdtemp(path.join(tmpdir(), "pintofruta-instagram-"));
  const baseUrl = process.env.BASE_URL || args.baseUrl;
  const instagramUrl = process.env.INSTAGRAM_URL || args.instagramUrl;
  const minScore = Number.isFinite(args.minScore) ? args.minScore : DEFAULT_MIN_SCORE;
  const autoScore = Number.isFinite(args.autoScore) ? args.autoScore : DEFAULT_AUTO_ACCEPT_SCORE;
  const reviewScore = Number.isFinite(args.reviewScore) ? args.reviewScore : DEFAULT_REVIEW_SCORE;
  const recentPostsLimit = Number.isFinite(args.recentPosts) ? Math.max(0, Math.floor(args.recentPosts)) : 0;
  const analysisOnly = recentPostsLimit > 0;
  const indexOnly = Boolean(args.indexOnly);
  const indexFilePath = String(args.useIndexFile || "").trim();
  const indexOutputPath = String(args.indexOutput || "").trim();
  const ocrWorker = await createOcrWorker();
  const ocrCache = new Map();
  const report = {
    startedAt: new Date().toISOString(),
    mode: indexOnly ? "index-only" : indexFilePath ? "match-from-index" : analysisOnly ? "analysis" : args.dryRun ? "dry-run" : "real",
    productsFound: 0,
    instagramPostsAnalyzed: 0,
    selectedProducts: [],
    skippedProducts: [],
    manualReview: [],
    updatedProducts: [],
    postMatches: [],
    instagramIndex: [],
    indexSourcePath: "",
    recentPostsRequested: recentPostsLimit,
    matchThresholds: {
      minScore,
      autoScore,
      reviewScore,
    },
  };

  try {
    const products = await fetchMissingProducts(pool, args.productId, args.limit, args.search, args.afterId);
    report.productsFound = products.length;

    if (products.length === 0) {
      console.log("No hay productos pendientes de imagen.");
      return;
    }

    console.log(`Productos sin imagen detectados: ${products.length}`);
    let recentInstagramPosts = [];

    if (indexFilePath) {
      console.log(`Cargando indice de Instagram desde ${indexFilePath}...`);
      const loadedIndex = await loadInstagramIndexFromFile(indexFilePath);
      recentInstagramPosts = loadedIndex.instagramIndex;
      report.indexSourcePath = loadedIndex.sourcePath;
      report.instagramIndex = recentInstagramPosts;
      report.instagramPostsAnalyzed = recentInstagramPosts.length;
      console.log(`Publicaciones cargadas desde indice: ${recentInstagramPosts.length}`);
      for (const post of recentInstagramPosts) {
        if (!post.ocrText) {
          post.ocrText = await extractBestOcrText(post.imageUrls || [post.imageUrl], tempRoot, ocrWorker, ocrCache);
        }
      }
    } else {
      console.log("Recolectando publicaciones de Instagram...");

      const instagramPosts = await collectInstagramPosts(page, instagramUrl, args.maxScrolls, args.scrollDelayMs, recentPostsLimit || Infinity);
      console.log(`Publicaciones analizadas: ${instagramPosts.length}`);
      report.instagramPostsAnalyzed = instagramPosts.length;

      recentInstagramPosts = await enrichInstagramPosts(
        page,
        instagramPosts,
        recentPostsLimit > 0 ? recentPostsLimit : instagramPosts.length,
      );
      console.log(`Publicaciones enriquecidas: ${recentInstagramPosts.length}`);

      for (const post of recentInstagramPosts) {
        if (!post.ocrText) {
          post.ocrText = await extractBestOcrText(post.imageUrls || [post.imageUrl], tempRoot, ocrWorker, ocrCache);
        }
      }

      report.instagramIndex = recentInstagramPosts.map((post) => ({
        url: post.url,
        text: post.text || "",
        alt: post.alt || "",
        ocrText: post.ocrText || "",
        imageUrls: post.imageUrls || [],
      }));
    }

    if (indexOnly) {
      const reportsDir = path.join(process.cwd(), "reports");
      await mkdir(reportsDir, { recursive: true });
      const reportStamp = new Date().toISOString().replace(/[:.]/g, "-");
      const reportPath = indexOutputPath || path.join(reportsDir, `instagram-index-${reportStamp}.json`);
      report.finishedAt = new Date().toISOString();
      report.reportPath = reportPath;
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log(`Indice guardado en ${reportPath}`);
      return;
    }

    if (analysisOnly) {
      const recentPosts = recentInstagramPosts.slice(0, recentPostsLimit);
      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const post of recentPosts) {
        let bestMatch = null;

        for (const product of products) {
          const score = scorePostForProduct(product, post, post.ocrText);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              productId: product.id,
              sku: product.sku,
              name: product.name,
              brand: product.brand,
              score,
            };
          }
        }

        const postMatch = {
          postUrl: post.url,
          postText: post.text || "",
          postAlt: post.alt || "",
          imageUrl: post.imageUrl || "",
          bestMatch,
          matched: Boolean(bestMatch && Number.isFinite(bestMatch.score) && bestMatch.score >= minScore),
        };

        report.postMatches.push(postMatch);

        if (postMatch.matched && bestMatch) {
          const product = productsById.get(bestMatch.productId);
          console.log(`[post] ${post.url} -> #${bestMatch.productId} ${bestMatch.brand} | ${bestMatch.name} (score ${bestMatch.score})`);
          if (!product) {
            console.log("  producto no encontrado en el lote");
          }
        } else {
          console.log(`[post] ${post.url} -> sin match fuerte`);
        }
      }

      const reportPath = await saveRobotReport(report, "instagram-post-match");
      console.log(`Reporte guardado en ${reportPath}`);
      return;
    }

    const selectedProducts = [];
    const manualReviews = [];
    const usedProductIds = new Set();

    for (const product of products) {
      if (usedProductIds.has(product.id)) {
        continue;
      }

      const bestPost = selectBestPostForProduct(product, recentInstagramPosts);

      if (!bestPost || bestPost.heuristicScore < minScore) {
        const reason = "sin coincidencia heuristica suficiente";
        console.log(`[skip] #${product.id} ${product.sku} - ${reason}.`);
        report.skippedProducts.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          reason,
        });
        continue;
      }

      const score = Number(bestPost.heuristicScore ?? 0);
      const matchDecision = {
        postUrl: bestPost.url,
        postText: bestPost.text || "",
        postAlt: bestPost.alt || "",
        imageUrl: bestPost.imageUrl || "",
        productIdTried: product.id,
        candidateCount: 1,
        score,
        matchedBrand: product.brand || "",
        matchedName: product.name || "",
      };

      if (score < reviewScore) {
        const reason = "sin coincidencia local suficiente";
        console.log(`[skip] #${product.id} ${product.sku} - ${reason}.`);
        report.skippedProducts.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          reason,
        });
        report.postMatches.push({
          ...matchDecision,
          decision: "no_match",
          accepted: false,
          reviewNeeded: false,
          reason,
        });
        continue;
      }

      if (score < autoScore) {
        const reason = "requiere confirmacion manual";
        console.log(`[review] #${product.id} ${product.sku} -> ${bestPost.url} (score ${score})`);
        manualReviews.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          score,
          reason,
          postUrl: bestPost.url,
          postText: bestPost.text || "",
          postAlt: bestPost.alt || "",
          imageUrl: bestPost.imageUrl || "",
        });
        report.manualReview.push({
          ...matchDecision,
          decision: "review",
          accepted: false,
          reviewNeeded: true,
          reason,
        });
        continue;
      }

      const chosenProduct = product;
      usedProductIds.add(chosenProduct.id);
      selectedProducts.push({
        product: chosenProduct,
        post: bestPost,
        score,
      });
      report.selectedProducts.push({
        id: chosenProduct.id,
        sku: chosenProduct.sku,
        name: chosenProduct.name,
        brand: chosenProduct.brand,
        bestUrl: bestPost.url,
        imageUrl: bestPost.imageUrl || "",
        score,
        reason: "coincidencia local fuerte",
      });
      report.postMatches.push({
        ...matchDecision,
        decision: "match",
        accepted: true,
        reviewNeeded: false,
        reason: "coincidencia local fuerte",
      });
      console.log(`[post] #${product.id} ${product.sku} -> #${chosenProduct.id} ${chosenProduct.brand} | ${chosenProduct.name} (score ${score})`);
    }

    console.log(`Coincidencias elegidas: ${selectedProducts.length}`);
    console.log(`Casos para revision manual: ${manualReviews.length}`);

    if (args.dryRun) {
      for (const item of selectedProducts) {
        console.log(`[dry-run] #${item.product.id} ${item.product.sku} -> ${item.post.url} (score ${item.score})`);
      }
      for (const item of manualReviews) {
        console.log(`[review] #${item.id} ${item.sku} -> ${item.postUrl} (score ${item.score})`);
      }
      const reportPath = await saveRobotReport(report, "instagram-image-robot-dry-run");
      console.log(`Reporte guardado en ${reportPath}`);
      return;
    }

    await loginToAdmin(page, baseUrl);

    for (const item of selectedProducts) {
      const { product, post } = item;
      const imageUrl = post.imageUrl || post.imageUrls?.[0] || "";
      console.log(`Procesando #${product.id} ${product.sku} -> ${post.url} (score ${item.score})`);

      const tempFile = await downloadImageToTemp(imageUrl, product, tempRoot);
      console.log(`Imagen descargada en ${tempFile}`);

      await openProductEditor(page, baseUrl, product);
      await uploadImageAndSave(page, product, tempFile);

      const persistedImage = await verifyProductImage(pool, product.id);
      if (!persistedImage) {
        throw new Error(`No se pudo verificar el guardado del producto ${product.id}.`);
      }

      console.log(`[ok] #${product.id} ${product.sku} guardado con imagen ${persistedImage}`);
      report.updatedProducts.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        postUrl: post.url,
        storedImage: persistedImage,
        score: item.score,
      });
    }

    const reportPath = await saveRobotReport(report, "instagram-image-robot");
    console.log(`Reporte guardado en ${reportPath}`);
  } finally {
    if (connectedOverCdp) {
      if (typeof browser.disconnect === "function") {
        browser.disconnect();
      }
    } else {
      await browser.close().catch(() => undefined);
    }
    await ocrWorker.terminate().catch(() => undefined);
    await pool.end().catch(() => undefined);
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});


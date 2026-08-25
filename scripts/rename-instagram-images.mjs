import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { PSM, createWorker } from "tesseract.js";

const DEFAULT_INPUT_DIR = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new";

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

      if (key === "input-dir") {
        acc.inputDir = value;
      } else if (key === "limit") {
        acc.limit = Number(value);
      }

      return acc;
    },
    {
      help: false,
      dryRun: false,
      inputDir: DEFAULT_INPUT_DIR,
      limit: Infinity,
    },
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDisplay(value) {
  let text = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\bgarbonato\b/gi, "carbonato")
    .replace(/\bsulemento\b/gi, "suplemento")
    .replace(/\bietari\b/gi, "dietario")
    .replace(/\bextcacto\b/gi, "extracto")
    .replace(/\bfofiliz(?:ad[oa]s?)?\b/gi, "liofilizado")
    .replace(/\bargndings?\b/gi, "arandanos")
    .replace(/\benerbio\b/gi, "beneficios")
    .replace(/\bbeneneficios\b/gi, "beneficios")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function titleCase(value) {
  const text = normalizeDisplay(value).toLowerCase();
  if (!text) {
    return "";
  }

  return text
    .split(" ")
    .map((word) => {
      if (!word) {
        return word;
      }

      if (/^\d+[a-z%]*$/i.test(word) || /^[a-z]\d+$/i.test(word)) {
        return word.toUpperCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function safeFilePart(value, fallback) {
  const text = normalizeDisplay(value || fallback || "sin_datos");
  return text || fallback || "sin_datos";
}

function slugLike(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9%]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function presentationFromText(text) {
  const patterns = [
    /\b\d+(?:[.,]\d+)?\s?(?:g|gr|kg|ml|l|lt|cc|caps?|cap|unid(?:ades?)?|u|packs?|pack|sobres?|tabs?|tablets?)\b/i,
    /\b(?:caja|pack|paquete)\s*\d+\b/i,
    /\b\d+\s*x\s*\d+\b/i,
    /\b\d+\s?(?:caps|capsulas|comprimidos|tablets?)\b/i,
    /\b\d{1,3}%\s?(?:cacao|cocoa)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return titleCase(match[0]);
    }
  }

  return "";
}

function extractOcrSegments(text) {
  const rawSegments = String(text ?? "")
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (rawSegments.length >= 2) {
    return rawSegments;
  }

  return String(text ?? "")
    .split(/\r?\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function scoreBrandLine(line, index) {
  const norm = normalizeText(line);
  if (!norm) {
    return Number.NEGATIVE_INFINITY;
  }

  const words = norm.split(" ").filter(Boolean);
  const wordCount = words.length;
  const genericWords = new Set(["chocolate", "aceite", "jarabe", "producto", "cacao", "saludable", "natural", "organico"]);

  let score = 0;
  if (wordCount <= 4) {
    score += 4;
  }
  if (wordCount <= 2) {
    score += 3;
  }
  if (index <= 4) {
    score += 3;
  }
  if (/^[a-z0-9%]+(?:\s+[a-z0-9%]+)*$/i.test(line)) {
    score += 2;
  }
  if (/^[A-Z0-9% ]+$/.test(line)) {
    score += 2;
  }
  if (words.some((word) => genericWords.has(word))) {
    score -= 4;
  }
  if (norm.includes("organic") || norm.includes("organico")) {
    score -= 2;
  }
  if (norm.includes("suplemento") || norm.includes("dietario")) {
    score -= 2;
  }

  return score;
}

function extractBrand(segments, text) {
  const knownBrands = [
    "natier",
    "colonial",
    "alkanater",
    "maple crest",
    "get real",
    "goland",
    "bento",
    "benot",
    "sri sri",
    "al natural",
    "maple syrup",
    "natier",
  ];

  for (const brand of knownBrands) {
    if (text.includes(brand)) {
      return titleCase(brand);
    }
  }

  let best = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  segments.slice(0, 8).forEach((line, index) => {
    const score = scoreBrandLine(line, index);
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  });

  return titleCase(best.split(/\n+/)[0] || "");
}

function cleanNameCandidate(value, brand, presentation) {
  let text = normalizeDisplay(value);
  const brandNorm = normalizeText(brand);
  const presentationNorm = normalizeText(presentation);

  if (brandNorm) {
    text = text.replace(new RegExp(`\\b${brandNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), " ");
  }

  if (presentationNorm) {
    text = text.replace(new RegExp(`\\b${presentationNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), " ");
  }

  text = normalizeDisplay(text);
  return text.replace(/\s+/g, " ").trim();
}

function scoreNameLine(line) {
  const norm = normalizeText(line);
  if (!norm) {
    return Number.NEGATIVE_INFINITY;
  }

  const words = norm.split(" ").filter(Boolean);
  if (words.length < 2) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = words.length * 2;
  if (words.length >= 3) {
    score += 3;
  }
  if (words.length >= 5) {
    score += 2;
  }
  if (/(chocolate|cacao|aceite|jarabe|calcio|ghee|tahini|coco|algarroba|pasas|miel|nueces|semillas|granola|suplemento|dietario|medallones|bombones|barras|extracto|jugo|sirope|manteca|clarificada|vegano|organico|natural)/i.test(norm)) {
    score += 6;
  }
  if (/\d/.test(norm)) {
    score -= 2;
  }

  return score;
}

function extractName(segments, brand, presentation, text) {
  const meaningful = [];

  for (const line of segments) {
    const cleaned = cleanNameCandidate(line, brand, presentation);
    const norm = normalizeText(cleaned);
    if (!norm) {
      continue;
    }
    if (presentation && norm === normalizeText(presentation)) {
      continue;
    }
    if (brand && norm === normalizeText(brand)) {
      continue;
    }
    meaningful.push(cleaned);
  }

  let best = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of meaningful) {
    const score = scoreNameLine(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best && meaningful.length > 0) {
    best = meaningful[0];
  }

  if (!best) {
    const fallback = text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .join(" ");
    best = fallback;
  }

  const stopWords = new Set([
    "beneficios",
    "beneficio",
    "naturales",
    "natural",
    "naturales",
    "suplemento",
    "dietario",
    "dietaria",
    "dietarios",
    "saludable",
    "saludables",
    "original",
    "origen",
    "producto",
    "productos",
    "org",
    "organico",
    "organica",
    "sin",
    "gluten",
    "azucar",
    "agregada",
    "vegano",
    "vegana",
  ]);

  const cleanedWords = normalizeText(best)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !stopWords.has(word) && !/^\d+$/.test(word));

  if (cleanedWords.length === 0) {
    return "Sin nombre";
  }

  return titleCase(cleanedWords.slice(0, 7).join(" "));
}

async function preprocessVariants(buffer) {
  const base = sharp(buffer).resize({ width: 1800, withoutEnlargement: true, fit: "inside" });
  return [
    await base.clone().grayscale().normalize().sharpen().png().toBuffer(),
    await base.clone().grayscale().normalize().sharpen().threshold(170).png().toBuffer(),
  ];
}

async function ocrBestText(buffer, worker) {
  const variants = await preprocessVariants(buffer);
  const collected = [];
  const seen = new Set();

  for (const variant of variants) {
    const result = await worker.recognize(variant);
    const text = String(result?.data?.text || "").trim();
    const chunks = text
      .split(/\n{2,}|\r?\n+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    for (const chunk of chunks) {
      const normalized = normalizeDisplay(chunk);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      collected.push(normalized);
    }
  }

  return collected.join("\n\n");
}

function buildBaseName({ brand, name, presentation }) {
  const parts = [brand || "sin_marca", name || "sin_nombre", presentation || "sin_presentacion"].map((part) =>
    safeFilePart(part, "sin_datos"),
  );
  return parts.join(" - ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage:
  node scripts/rename-instagram-images.mjs [--input-dir=PATH] [--limit=N] [--dry-run]

Renames images in the folder using local OCR and the pattern:
  [brand] - [name] - [presentation]
`);
    return;
  }

  const manifestPath = path.join(args.inputDir, "manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const targets = items.slice(0, Number.isFinite(args.limit) ? Math.max(0, Math.floor(args.limit)) : items.length);

  const worker = await createWorker(["eng", "spa"]);
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const renameReport = [];
  const usedNames = new Map();

  try {
    for (let i = 0; i < targets.length; i += 1) {
      const item = targets[i];
      const currentPath = path.join(args.inputDir, item.fileName);
      const fileBuffer = await readFile(currentPath);
      const ocrText = await ocrBestText(fileBuffer, worker);
      const normalized = normalizeText(ocrText);
      const segments = extractOcrSegments(ocrText);

      const presentation = presentationFromText(ocrText);
      const brand = extractBrand(segments, normalized);
      const name = extractName(segments, brand, presentation, ocrText);

      const ext = path.extname(item.fileName) || ".jpg";
      const baseName = buildBaseName({ brand, name, presentation });
      const readableBase = safeFilePart(baseName, `image ${String(i + 1).padStart(3, "0")}`);
      const finalBase = readableBase || `image ${String(i + 1).padStart(3, "0")}`;
      let finalName = `${finalBase}${ext.toLowerCase()}`;

      if (usedNames.has(finalName)) {
        const nextIndex = usedNames.get(finalName) + 1;
        usedNames.set(finalName, nextIndex);
        finalName = `${finalBase} (${nextIndex})${ext.toLowerCase()}`;
      } else {
        usedNames.set(finalName, 1);
      }

      const newPath = path.join(args.inputDir, finalName);

      if (!args.dryRun) {
        await rename(currentPath, newPath);
      }

      renameReport.push({
        index: i + 1,
        oldName: item.fileName,
        newName: finalName,
        brand,
        name,
        presentation,
        ocrText,
      });

      console.log(`${i + 1}/${targets.length} ${item.fileName} -> ${finalName}`);
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  await writeFile(path.join(args.inputDir, "rename-report.json"), JSON.stringify({
    source: manifestPath,
    renamedAt: new Date().toISOString(),
    total: renameReport.length,
    dryRun: args.dryRun,
    items: renameReport,
  }, null, 2));

  console.log(`Total renombradas: ${renameReport.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

import { mkdir, readFile, rename, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { PSM, createWorker } from "tesseract.js";

const DEFAULT_INPUT_DIR = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new_2";
const DEFAULT_REPORT_PATH = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new_2\\rename-ocr-report.json";

const KNOWN_BRANDS = [
  "pintofruta",
  "pinto fruta",
  "natier",
  "colonial",
  "benot",
  "get real",
  "al natural",
  "sri sri",
  "srisri",
  "maple syrup",
  "maple",
  "goland",
  "alkanater",
  "alkanat",
];

const BRAND_ALIASES = new Map([
  ["pinto fruta", "PintoFruta"],
  ["pintofruta", "PintoFruta"],
  ["sri sri", "SriSri"],
  ["srisri", "SriSri"],
  ["get real", "Get-Real"],
  ["maple syrup", "Maple-Syrup"],
  ["maple", "Maple"],
  ["colonial", "Colonial"],
  ["natier", "Natier"],
  ["benot", "Benot"],
  ["al natural", "Al-Natural"],
  ["alkanater", "Alkanater"],
  ["alkanat", "Alkanat"],
]);

const PRODUCT_KEYWORDS = [
  "chocolate",
  "cacao",
  "tahini",
  "ghee",
  "manteca",
  "aceite",
  "jugo",
  "extracto",
  "propoleo",
  "spirulina",
  "granola",
  "cereal",
  "bar",
  "barra",
  "cupcake",
  "alfajor",
  "syrup",
  "sirope",
  "miel",
  "cafe",
  "coco",
  "almendra",
  "nuez",
  "avellana",
  "frutilla",
  "frambuesa",
  "banana",
  "manzana",
  "pera",
  "uva",
  "naranja",
  "limon",
  "lima",
  "mango",
  "maracuya",
  "menta",
  "negro",
  "blanco",
  "natural",
  "organico",
  "vegano",
  "plant",
  "based",
  "granos",
  "vainilla",
];

const VARIETY_KEYWORDS = new Set([
  "chocolate",
  "cacao",
  "tahini",
  "ghee",
  "manteca",
  "aceite",
  "jugo",
  "extracto",
  "propoleo",
  "spirulina",
  "granola",
  "cereal",
  "syrup",
  "sirope",
  "miel",
  "cafe",
  "coco",
  "almendra",
  "nuez",
  "avellana",
  "frutilla",
  "frambuesa",
  "banana",
  "manzana",
  "pera",
  "uva",
  "naranja",
  "limon",
  "lima",
  "mango",
  "maracuya",
  "menta",
  "negro",
  "blanco",
  "natural",
  "organico",
  "vegano",
  "plant",
  "based",
  "granos",
  "vainilla",
]);

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "y",
  "con",
  "para",
  "por",
  "en",
  "sin",
  "a",
  "al",
  "los",
  "las",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "producto",
  "productos",
  "ingredientes",
  "beneficios",
  "natural",
  "naturales",
  "org",
  "organico",
  "organica",
  "vegano",
  "vegana",
  "libre",
  "origen",
  "sabor",
  "saborizado",
  "suplemento",
  "dietario",
  "dietaria",
  "dietarios",
  "presentacion",
  "contenido",
  "neto",
  "peso",
  "pack",
  "caja",
  "promo",
  "foto",
  "imagen",
  "calidad",
  "apto",
  "apta",
  "bajo",
  "alto",
  "nuevo",
  "nueva",
  "nuevos",
  "nuevas",
  "azucar",
  "gluten",
  "lactosa",
  "tacc",
  "light",
  "gr",
  "g",
  "kg",
  "ml",
  "lt",
  "l",
  "cc",
  "u",
  "x",
  "caps",
  "cap",
  "sobres",
  "tab",
  "tabs",
]);

function parseArgs(argv) {
  return argv.reduce(
    (acc, rawArg) => {
      if (rawArg === "--help" || rawArg === "-h") {
        acc.help = true;
        return acc;
      }

      if (rawArg === "--dry-run") {
        acc.dryRun = true;
        return acc;
      }

      const [key, ...rest] = rawArg.replace(/^--/, "").split("=");
      const value = rest.length > 0 ? rest.join("=") : "true";

      if (key === "input-dir") {
        acc.inputDir = value;
      } else if (key === "report") {
        acc.reportPath = value;
      } else if (key === "limit") {
        acc.limit = Number(value);
      }

      return acc;
    },
    {
      help: false,
      dryRun: false,
      inputDir: DEFAULT_INPUT_DIR,
      reportPath: DEFAULT_REPORT_PATH,
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
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCasePart(value) {
  const text = normalizeDisplay(value).toLowerCase();
  if (!text) return "";
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^\d+[a-z%]*$/i.test(word) || /^[a-z]\d+$/i.test(word)) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("-");
}

function slugPart(value) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => token.replace(/[^a-z0-9%]+/g, ""))
    .filter(Boolean)
    .join("-");
}

function compactPresentation(value) {
  const norm = normalizeText(value);
  if (!norm) return "";

  const matchers = [
    /\b\d+(?:[.,]\d+)?\s?(?:g|gr|kg|ml|l|lt|cc|caps?|cap|u|unid(?:ades?)?|pack|packs?|sobres?|tabs?|tablets?)\b/i,
    /\b\d+\s*x\s*\d+\b/i,
    /\b\d{1,3}%\b/i,
  ];

  for (const pattern of matchers) {
    const match = norm.match(pattern);
    if (match) {
      return match[0]
        .replace(/\s+/g, "")
        .replace(/gr$/i, "gr")
        .replace(/caps?$/i, "caps")
        .replace(/tabs?$/i, "tabs")
        .replace(/u$/i, "u")
        .replace(/%$/i, "pct");
    }
  }

  return "";
}

async function preprocessVariants(buffer) {
  const base = sharp(buffer).resize({ width: 2200, withoutEnlargement: true, fit: "inside" });
  return [
    await base.clone().grayscale().normalize().sharpen().png().toBuffer(),
    await base.clone().grayscale().normalize().sharpen().threshold(150).png().toBuffer(),
    await base.clone().grayscale().normalize().sharpen().threshold(180).png().toBuffer(),
    await base.clone().negate().normalize().png().toBuffer(),
  ];
}

function splitLines(text) {
  return String(text ?? "")
    .split(/\r?\n+/)
    .map((line) => normalizeDisplay(line))
    .filter(Boolean);
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => token.length >= 3 || /^\d+[a-z%]*$/i.test(token));
}

function scoreLine(line) {
  const tokens = tokenize(line);
  if (!tokens.length) return Number.NEGATIVE_INFINITY;

  let score = tokens.length * 2;
  if (tokens.length <= 6) score += 2;
  if (tokens.some((token) => PRODUCT_KEYWORDS.includes(token))) score += 5;
  if (tokens.some((token) => /\d/.test(token))) score += 2;
  if (line.length >= 8 && line.length <= 90) score += 1;
  return score;
}

function pickPrimaryLine(text) {
  const lines = splitLines(text);
  if (!lines.length) return "";
  return lines
    .map((line) => ({ line, score: scoreLine(line) }))
    .sort((a, b) => b.score - a.score)[0]?.line || "";
}

async function ocrBestText(buffer, worker) {
  const variants = await preprocessVariants(buffer);
  const seen = new Set();
  const chunks = [];

  for (const variant of variants) {
    const result = await worker.recognize(variant);
    const text = String(result?.data?.text || "");
    const pieces = splitLines(text);

    for (const piece of pieces) {
      const key = piece.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        chunks.push(piece);
      }
    }
  }

  return chunks.join("\n");
}

function isTiny(metadata) {
  return Number(metadata?.width || 0) <= 180 && Number(metadata?.height || 0) <= 180;
}

function detectLogo(text, metadata) {
  const norm = normalizeText(text);
  return isTiny(metadata) && (norm.includes("pinto") || norm.includes("fruta") || norm.includes("pintofruta"));
}

function extractBrand(text) {
  const norm = normalizeText(text);
  if (norm.includes("pinto") && norm.includes("fruta")) return "PintoFruta";
  if (norm.includes("sri") && norm.includes("sri")) return "SriSri";
  if (norm.includes("get") && norm.includes("real")) return "Get-Real";
  if (norm.includes("maple") && norm.includes("syrup")) return "Maple-Syrup";

  for (const brand of KNOWN_BRANDS) {
    if (norm.includes(brand)) {
      return BRAND_ALIASES.get(brand) || titleCasePart(brand);
    }
  }

  const lines = splitLines(text);
  const first = lines[0] || "";
  const firstTokens = tokenize(first);
  if (firstTokens.length >= 1 && firstTokens.length <= 3) {
    const guess = firstTokens.join(" ");
    if (guess && !STOPWORDS.has(firstTokens[0])) {
      return titleCasePart(guess);
    }
  }

  return "";
}

function extractPresentation(text) {
  return compactPresentation(text);
}

function extractNameAndVariety(text, brand, presentation) {
  const tokens = tokenize(text);
  const brandTokens = tokenize(brand);
  const presentationTokens = tokenize(presentation);
  const usable = tokens.filter((token) => !brandTokens.includes(token) && !presentationTokens.includes(token));

  if (!usable.length) {
    return { name: "", variety: "" };
  }

  const firstKeywordIndex = usable.findIndex((token) => PRODUCT_KEYWORDS.includes(token));
  let nameTokens;
  let varietyTokens = [];

  if (firstKeywordIndex >= 0) {
    nameTokens = usable.slice(Math.max(0, firstKeywordIndex - 1), firstKeywordIndex + 1);
    varietyTokens = usable.slice(firstKeywordIndex + 1, firstKeywordIndex + 3).filter((token) => VARIETY_KEYWORDS.has(token));
  } else {
    nameTokens = usable.slice(0, 2);
    varietyTokens = usable.slice(2, 4).filter((token) => VARIETY_KEYWORDS.has(token));
  }

  if (!nameTokens.length) {
    nameTokens = usable.slice(0, 1);
  }

  const name = titleCasePart(nameTokens.join(" "));
  const variety = titleCasePart(varietyTokens.join(" "));
  return { name, variety };
}

function buildFileName({ brand, name, variety, presentation, index, isLogo, ext }) {
  if (isLogo) {
    return `logo-${String(index).padStart(3, "0")}${ext}`;
  }

  const parts = [titleCasePart(brand), titleCasePart(name), slugPart(variety), compactPresentation(presentation)]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  const base = parts.join("-");
  return `${base || `imagen-${String(index).padStart(3, "0")}`}${ext}`;
}

function isWorthRenaming({ brand, name, variety, presentation, primaryLine }) {
  const text = normalizeText(primaryLine);
  const tokens = tokenize(primaryLine);
  const meaningfulHits = tokens.filter((token) => PRODUCT_KEYWORDS.includes(token)).length;
  const hasUsefulSignal = Boolean(brand || name || variety || presentation);

  if (!tokens.length) return false;
  if (detectLogo(primaryLine, { width: 0, height: 0 })) return true;
  if (meaningfulHits >= 1 && hasUsefulSignal) return true;
  if (meaningfulHits >= 2) return true;
  if (text.includes("maple") && text.includes("syrup")) return true;
  if (text.includes("chocolate") && text.includes("plant")) return true;
  if (text.includes("tahini")) return true;
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage:
  node scripts/rename-img-new-2-rescue.mjs [--input-dir=PATH] [--report=PATH] [--dry-run] [--limit=N]

Rescues files currently named imagen-### in img_new_2 and tries to rename them
with OCR using the pattern [marca]-[nombre]-[variedad]-[presentacion].
`);
    return;
  }

  const reportRaw = await readFile(args.reportPath, "utf8");
  const report = JSON.parse(reportRaw);
  const fallbackItems = Array.isArray(report.items)
    ? report.items.filter((item) => String(item?.newName || "").startsWith("imagen-"))
    : [];
  const targets = fallbackItems.slice(0, Number.isFinite(args.limit) ? Math.max(0, Math.floor(args.limit)) : fallbackItems.length);

  const worker = await createWorker(["eng", "spa"]);
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });

  const updated = [];
  const usedNames = new Map();

  try {
    for (let i = 0; i < targets.length; i += 1) {
      const item = targets[i];
      const currentName = item.newName || item.oldName;
      const currentPath = path.join(args.inputDir, currentName);
      const buffer = await readFile(currentPath);
      const metadata = await sharp(buffer).metadata();
      const ocr = await ocrBestText(buffer, worker);
      const primaryLine = pickPrimaryLine(ocr) || ocr;
      const brand = extractBrand(ocr) || extractBrand(primaryLine);
      const presentation = extractPresentation(ocr) || extractPresentation(primaryLine);
      const { name, variety } = extractNameAndVariety(primaryLine, brand, presentation);
      const isLogo = detectLogo(ocr, metadata);
      const shouldRename = isLogo || isWorthRenaming({ brand, name, variety, presentation, primaryLine });
      const ext = path.extname(currentName).toLowerCase() || ".jpg";

      let finalName = currentName;
      if (shouldRename) {
        finalName = buildFileName({
          brand,
          name,
          variety,
          presentation,
          index: Number(String(currentName).match(/\d+/)?.[0] || item.index || i + 1),
          isLogo,
          ext,
        });
      }

      if (usedNames.has(finalName)) {
        const next = usedNames.get(finalName) + 1;
        usedNames.set(finalName, next);
        finalName = finalName.replace(/(\.[^.]+)$/i, ` (${next})$1`);
      } else {
        usedNames.set(finalName, 1);
      }

      updated.push({
        index: item.index || i + 1,
        oldName: currentName,
        newName: finalName,
        brand,
        name,
        variety,
        presentation,
        isLogo,
        primaryLine,
        ocr,
      });

      if (!args.dryRun && finalName !== currentName) {
        await rename(currentPath, path.join(args.inputDir, finalName));
      }

      console.log(`${i + 1}/${targets.length} ${currentName} -> ${finalName}`);
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  const outPath = path.join(args.inputDir, "rename-ocr-rescue-report.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        inputDir: args.inputDir,
        reportPath: args.reportPath,
        renamedAt: new Date().toISOString(),
        total: updated.length,
        dryRun: args.dryRun,
        items: updated,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Total evaluadas: ${updated.length}`);
  console.log(`Reporte: ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

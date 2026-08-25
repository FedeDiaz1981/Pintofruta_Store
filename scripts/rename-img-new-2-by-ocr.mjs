import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { PSM, createWorker } from "tesseract.js";

const DEFAULT_INPUT_DIR = "C:\\FD\\WBI\\Maxi\\Tools\\Carga de productos\\img_new_2";

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
  "sri gri",
  "maple crest",
  "maple syrup",
  "goland",
  "alkanater",
  "alkanat",
];

const VARIETY_KEYWORDS = [
  "vainilla",
  "chocolate",
  "cacao",
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
  "cafe",
  "caramelo",
  "miel",
  "syrup",
  "sirope",
  "ghee",
  "manteca",
  "barra",
  "bar",
  "cupcake",
  "alfajor",
  "aceite",
  "jugo",
  "extracto",
  "propoleo",
  "ginkgo",
  "spirulina",
  "granola",
  "cereal",
  "chocolate",
  "negro",
  "blanco",
  "integral",
  "clasico",
  "clasica",
  "sin",
  "azucar",
  "gluten",
  "lactosa",
  "vegano",
  "organico",
  "natural",
];

const MEANINGFUL_HINTS = new Set([
  ...VARIETY_KEYWORDS,
  "syrup",
  "sirope",
  "ghee",
  "manteca",
  "barra",
  "bar",
  "cupcake",
  "alfajor",
  "aceite",
  "jugo",
  "extracto",
  "propoleo",
  "ginkgo",
  "spirulina",
  "granola",
  "cereal",
  "chocolate",
  "tahini",
  "maple",
  "cafe",
  "cacao",
  "negro",
  "plant",
  "based",
  "granos",
  "sri",
  "srisri",
  "colonial",
  "natier",
  "benot",
  "real",
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
  "promo.",
  "foto",
  "imagen",
  "calidad",
  "apto",
  "apta",
  "bajo",
  "alto",
  "bajos",
  "altos",
  "nuevo",
  "nueva",
  "nuevos",
  "nuevas",
  "sin",
  "azucar",
  "azúcar",
  "gluten",
  "lactosa",
  "tacc",
  "vegano",
  "vegana",
  "light",
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
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseText(value) {
  const text = normalizeDisplay(value).toLowerCase();
  if (!text) {
    return "";
  }

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

function lowerSlug(value) {
  const text = normalizeDisplay(value).toLowerCase();
  if (!text) {
    return "";
  }

  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-z0-9%]+/g, ""))
    .filter(Boolean)
    .join("-");
}

function compactPresentation(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  const normalized = text
    .replace(/\b(\d+)\s?%\b/g, "$1pct")
    .replace(/\b(\d+(?:[.,]\d+)?)\s?(gr|g|kg|ml|l|lt|cc|caps?|cap|u|unid(?:ades?)?|pack|packs?|sobres?|tabs?|tablets?)\b/g, (_, qty, unit) => {
      const normalizedUnit = {
        gr: "gr",
        g: "g",
        kg: "kg",
        ml: "ml",
        l: "l",
        lt: "lt",
        cc: "cc",
        cap: "caps",
        caps: "caps",
        pack: "pack",
        packs: "packs",
        tab: "tabs",
        tabs: "tabs",
        tablet: "tabs",
        tablets: "tabs",
      }[unit] || unit;
      return `${qty}${normalizedUnit}`;
    })
    .replace(/\b(\d+)\s*x\s*(\d+)\b/g, (_, a, b) => `${a}x${b}`)
    .replace(/\b(\d+)\s?(caps?|cap)\b/g, (_, qty) => `${qty}caps`)
    .replace(/\b(\d+)\s?(u|unid|unidades)\b/g, (_, qty) => `${qty}u`)
    .replace(/\b(\d+)\s?(sobres?)\b/g, (_, qty) => `${qty}sobres`)
    .replace(/\b(\d+)\s?(cc)\b/g, (_, qty) => `${qty}cc`);

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
}

async function preprocessVariants(buffer) {
  const base = sharp(buffer).resize({ width: 2000, withoutEnlargement: true, fit: "inside" });
  return [
    await base.clone().grayscale().normalize().sharpen().png().toBuffer(),
    await base.clone().grayscale().normalize().sharpen().threshold(165).png().toBuffer(),
  ];
}

async function ocrText(buffer, worker) {
  const variants = await preprocessVariants(buffer);
  const chunks = [];
  const seen = new Set();

  for (const variant of variants) {
    const result = await worker.recognize(variant);
    const text = String(result?.data?.text || "");
    const pieces = text
      .split(/\n{2,}|\r?\n+/)
      .map((piece) => normalizeDisplay(piece))
      .filter(Boolean);

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

function splitOcrLines(text) {
  return String(text ?? "")
    .split(/\r?\n+/)
    .map((line) => normalizeDisplay(line))
    .filter(Boolean);
}

function scoreLine(line) {
  const norm = normalizeText(line);
  const words = norm.split(" ").filter(Boolean);
  if (!words.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = words.length * 2;
  if (words.length >= 2 && words.length <= 8) score += 4;
  if (words.length <= 4) score += 2;
  if (words.some((word) => VARIETY_KEYWORDS.includes(word))) score += 4;
  if (words.some((word) => KNOWN_BRANDS.some((brand) => brand.includes(word)))) score += 4;
  if (words.some((word) => /^(gr|g|kg|ml|lt|l|cc|u|caps?|x|\d{1,3}%|\d+[a-z%]*)$/.test(word))) score += 3;
  if (line.length >= 10 && line.length <= 90) score += 2;
  if (words.some((word) => word.length === 1)) score -= 4;
  if (words.length > 12) score -= 2;
  return score;
}

function pickPrimaryTextBlock(text) {
  const lines = splitOcrLines(text);
  if (lines.length === 0) {
    return "";
  }

  const scored = lines.map((line, index) => ({
    line,
    score: scoreLine(line) + (index === 0 ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]?.line || "";
  const second = scored[1]?.line || "";
  if (!best) {
    return "";
  }

  if (splitOcrLines(best).length <= 2 && second && scoreLine(second) >= scoreLine(best) - 1) {
    return `${best} ${second}`.trim();
  }

  return best;
}

function extractBrand(text) {
  const norm = normalizeText(text);
  for (const brand of KNOWN_BRANDS) {
    if (norm.includes(brand)) {
      if (brand === "pinto fruta") {
        return "PintoFruta";
      }
      if (brand === "sri gri") {
        return "SriSri";
      }
      if (brand === "srisri") {
        return "SriSri";
      }
      return titleCaseText(brand);
    }
  }

  const lines = splitOcrLines(text);

  let best = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const line of lines.slice(0, 8)) {
    const normLine = normalizeText(line);
    const words = normLine.split(" ").filter(Boolean);
    if (!words.length || words.length > 4) {
      continue;
    }

    if (words.every((word) => word.length < 3 || /^\d+$/.test(word))) {
      continue;
    }

    let score = 0;
    if (/^[A-Z0-9 ]+$/.test(line)) score += 2;
    if (words.length <= 2) score += 2;
    if (line.length <= 20) score += 2;
    if (words.some((word) => STOPWORDS.has(word))) score -= 2;
    if (normLine.includes("pinto") || normLine.includes("fruta")) score += 6;
    if (normLine.includes("natier")) score += 4;
    if (normLine.includes("colonial")) score += 4;
    if (normLine.includes("benot")) score += 4;
    if (normLine.includes("maple")) score += 3;
    if (normLine.includes("ghee")) score += 3;
    if (normLine.includes("syrup")) score += 3;
    if (normLine.includes("chocolate")) score += 3;
    if (normLine.includes("aceite")) score += 3;

    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }

  if (bestScore < 2) {
    return "";
  }

  return best ? titleCaseText(best) : "";
}

function extractPresentation(text) {
  const norm = normalizeText(text);
  const patterns = [
    /\b\d+(?:[.,]\d+)?\s?(?:g|gr|kg|ml|l|lt|cc|caps?|cap|u|unid(?:ades?)?|pack|packs?|sobres?|tabs?|tablets?)\b/i,
    /\b\d+\s*x\s*\d+\b/i,
    /\b\d{1,3}%\b/i,
    /\b\d+\s?caps\b/i,
    /\b\d+\s?u\b/i,
  ];

  for (const pattern of patterns) {
    const match = norm.match(pattern);
    if (match) {
      return compactPresentation(match[0]);
    }
  }

  return "";
}

function tokenizeForNaming(text) {
  return normalizeText(text)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !STOPWORDS.has(word))
    .filter((word) => !/^\d+$/.test(word))
    .filter((word) => word.length >= 3 || /^(gr|g|kg|ml|lt|l|cc|u|x|%)$/i.test(word) || /^\d+[a-z%]*$/i.test(word));
}

function removeBrandAndPresentation(tokens, brand, presentation) {
  const brandTokens = normalizeText(brand).split(" ").filter(Boolean);
  const presentationTokens = normalizeText(presentation).split(" ").filter(Boolean);
  let result = [...tokens];

  if (brandTokens.length) {
    const joined = result.join(" ");
    const brandJoined = brandTokens.join(" ");
    const replaced = joined.replace(new RegExp(`\\b${brandJoined.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
    result = replaced.split(" ").filter(Boolean);
  }

  if (presentationTokens.length) {
    const presJoined = presentationTokens.join(" ");
    const replaced = result.join(" ").replace(new RegExp(`\\b${presJoined.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
    result = replaced.split(" ").filter(Boolean);
  }

  return result.filter((word) => !STOPWORDS.has(word));
}

function extractNameAndVariety(text, brand, presentation) {
  const tokens = removeBrandAndPresentation(tokenizeForNaming(text), brand, presentation);
  if (tokens.length === 0) {
    return { name: "", variety: "" };
  }

  const varietyIndex = tokens.findIndex((token) => VARIETY_KEYWORDS.includes(token));
  if (varietyIndex >= 0) {
    const nameTokens = tokens.slice(0, Math.max(varietyIndex, 1));
    let varietyTokens = tokens.slice(varietyIndex, varietyIndex + 2);

    if (varietyTokens.length === 1 && varietyIndex + 1 < tokens.length) {
      const next = tokens[varietyIndex + 1];
      if (VARIETY_KEYWORDS.includes(next) || /^[0-9%]+$/.test(next)) {
        varietyTokens.push(next);
      }
    }

    return {
      name: nameTokens.join(" "),
      variety: varietyTokens.join(" "),
    };
  }

  if (tokens.length === 1) {
    return { name: tokens[0], variety: "" };
  }

  if (tokens.length === 2) {
    return { name: tokens[0], variety: tokens[1] };
  }

  return {
    name: tokens.slice(0, 2).join(" "),
    variety: tokens.slice(2, 4).join(" "),
  };
}

function buildFileName({ brand, name, variety, presentation, fallbackIndex, isLogo, ext }) {
  if (isLogo) {
    return `logo-${String(fallbackIndex).padStart(3, "0")}${ext}`;
  }

  const parts = [titleCaseText(brand), titleCaseText(name), lowerSlug(variety), compactPresentation(presentation)]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  const base = parts.join("-");
  return `${base || `imagen-${String(fallbackIndex).padStart(3, "0")}`}${ext}`;
}

function isGoodNamingCandidate({ brand, name, variety, presentation, primaryBlock }) {
  const tokens = tokenizeForNaming(primaryBlock);
  if (tokens.length < 2) {
    return false;
  }

  const signalCount = tokens.filter((token) => MEANINGFUL_HINTS.has(token)).length;
  const signalRatio = signalCount / tokens.length;
  const nameTokens = tokenizeForNaming(name);
  const varietyTokens = tokenizeForNaming(variety);
  const contentScore = nameTokens.length + varietyTokens.length + (presentation ? 1 : 0) + (brand ? 1 : 0);

  if (signalCount === 0) {
    return false;
  }

  if (signalRatio < 0.28 && contentScore < 4) {
    return false;
  }

  return contentScore >= 3 || signalRatio >= 0.35;
}

function looksLikePintofrutaLogo(text, metadata) {
  const norm = normalizeText(text);
  const tiny = Number(metadata?.width || 0) <= 180 && Number(metadata?.height || 0) <= 180;
  const logoHits =
    norm.includes("pintofruta") ||
    norm.includes("pinto fruta") ||
    norm.includes("pi of uta") ||
    (norm.includes("pint") && norm.includes("fruta"));

  return tiny && logoHits;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage:
  node scripts/rename-img-new-2-by-ocr.mjs [--input-dir=PATH] [--dry-run] [--limit=N]

Renames images using OCR with the format:
  [marca]-[nombre]-[variedad]-[presentacion]

If the image is the Pintofruta logo, it will be renamed to:
  logo-001.jpg
`);
    return;
  }

  const files = (await (await import("node:fs/promises")).readdir(args.inputDir))
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .sort();
  const targets = files.slice(0, Number.isFinite(args.limit) ? Math.max(0, Math.floor(args.limit)) : files.length);
  const worker = await createWorker(["eng", "spa"]);
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });

  const report = [];
  const takenNames = new Map();

  try {
    for (let i = 0; i < targets.length; i += 1) {
      const fileName = targets[i];
      const currentPath = path.join(args.inputDir, fileName);
      const buffer = await readFile(currentPath);
      const metadata = await sharp(buffer).metadata();
      const ocr = await ocrText(buffer, worker);
      const primaryBlock = pickPrimaryTextBlock(ocr) || ocr;
      const brand = extractBrand(ocr) || extractBrand(primaryBlock);
      const presentation = extractPresentation(ocr);
      const { name, variety } = extractNameAndVariety(primaryBlock, brand, presentation);
      const isLogo = looksLikePintofrutaLogo(ocr, metadata);
      const isGoodCandidate = isLogo || isGoodNamingCandidate({ brand, name, variety, presentation, primaryBlock });
      const ext = path.extname(fileName).toLowerCase() || ".jpg";
      let finalName = isGoodCandidate
        ? buildFileName({
            brand,
            name,
            variety,
            presentation,
            fallbackIndex: i + 1,
            isLogo,
            ext,
          })
        : `imagen-${String(i + 1).padStart(3, "0")}${ext}`;

      if (takenNames.has(finalName)) {
        const nextIndex = takenNames.get(finalName) + 1;
        takenNames.set(finalName, nextIndex);
        finalName = finalName.replace(/(\.[^.]+)$/i, ` (${nextIndex})$1`);
      } else {
        takenNames.set(finalName, 1);
      }

      report.push({
        index: i + 1,
        oldName: fileName,
        newName: finalName,
        brand,
        name,
        variety,
        presentation,
        isLogo,
        width: metadata.width || 0,
        height: metadata.height || 0,
        ocr,
      });

      if (!args.dryRun) {
        await rename(currentPath, path.join(args.inputDir, finalName));
      }

      console.log(`${i + 1}/${targets.length} ${fileName} -> ${finalName}`);
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  await mkdir(path.join(args.inputDir), { recursive: true });
  await writeFile(
    path.join(args.inputDir, "rename-ocr-report.json"),
    JSON.stringify(
      {
        inputDir: args.inputDir,
        renamedAt: new Date().toISOString(),
        total: report.length,
        dryRun: args.dryRun,
        items: report,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Total procesadas: ${report.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

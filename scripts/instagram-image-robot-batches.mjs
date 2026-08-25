import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const DEFAULT_BATCH_SIZE = 10;

function parseArgs(argv) {
  return argv.reduce(
    (acc, rawArg) => {
      if (rawArg === "--help" || rawArg === "-h") {
        acc.help = true;
        return acc;
      }

      const [key, ...rest] = rawArg.replace(/^--/, "").split("=");
      const value = rest.length > 0 ? rest.join("=") : "true";

      if (key === "batch-size") {
        acc.batchSize = Number(value);
      } else if (key === "max-batches") {
        acc.maxBatches = Number(value);
      } else if (key === "product-id") {
        acc.productId = value;
      } else {
        acc.forwardArgs.push(rawArg);
      }

      return acc;
    },
    {
      help: false,
      batchSize: DEFAULT_BATCH_SIZE,
      maxBatches: Infinity,
      productId: "",
      forwardArgs: [],
    },
  );
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

async function fetchBatch(pool, batchSize, afterId = 0) {
  const params = [];
  const conditions = ["deleted_at is null", "status = 'published'", "(image is null or btrim(image) = '' or lower(image) like '%no-image%')"];

  if (afterId > 0) {
    params.push(afterId);
    conditions.push(`id > $${params.length}`);
  }

  params.push(batchSize);

  const query = `
    select id
    from products
    where ${conditions.join(" and ")}
    order by id asc
    limit $${params.length}
  `;

  const result = await pool.query(query, params);
  return result.rows.map((row) => Number(row.id));
}

function printHelp() {
  console.log(`
Usage:
  node scripts/instagram-image-robot-batches.mjs [--batch-size=10] [--max-batches=999] [--dry-run]

This wrapper advances through missing-image products in small batches
and invokes scripts/instagram-image-robot.mjs for each batch.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (args.productId) {
    const scriptPath = fileURLToPath(new URL("./instagram-image-robot.mjs", import.meta.url));
    execFileSync(process.execPath, [scriptPath, ...args.forwardArgs, `--product-id=${args.productId}`], {
      stdio: "inherit",
      env: process.env,
    });
    return;
  }

  const batchSize = Number.isFinite(args.batchSize) && args.batchSize > 0 ? Math.floor(args.batchSize) : DEFAULT_BATCH_SIZE;
  const maxBatches = Number.isFinite(args.maxBatches) && args.maxBatches > 0 ? Math.floor(args.maxBatches) : Infinity;
  const pool = await getPool();
  const scriptPath = fileURLToPath(new URL("./instagram-image-robot.mjs", import.meta.url));

  try {
    let afterId = 0;
    let batchNumber = 0;

    while (batchNumber < maxBatches) {
      const batchStartAfterId = afterId;
      const batchIds = await fetchBatch(pool, batchSize, afterId);

      if (batchIds.length === 0) {
        console.log("No hay productos pendientes de imagen.");
        break;
      }

      batchNumber += 1;
      afterId = batchIds[batchIds.length - 1];

      console.log(`=== Lote ${batchNumber} ===`);
      console.log(`Productos del lote: ${batchIds.join(", ")}`);
      console.log(`Ultimo id del lote: ${afterId}`);

      execFileSync(
        process.execPath,
        [scriptPath, ...args.forwardArgs, `--limit=${batchSize}`, `--after-id=${batchStartAfterId}`],
        {
          stdio: "inherit",
          env: process.env,
        },
      );

      console.log(`=== Fin lote ${batchNumber} ===`);
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

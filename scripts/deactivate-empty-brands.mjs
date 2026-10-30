import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const projectRoot = process.cwd();

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z0-9_]+)=(.*)$/i);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  loadEnv(path.join(projectRoot, ".env.local"));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta configurada.");
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    const [brandResult, productResult] = await Promise.all([
      pool.query("select id, name, active from brands order by name"),
      pool.query("select distinct brand from products where deleted_at is null and lower(coalesce(status, '')) <> 'inactive'"),
    ]);
    const activeProductBrands = new Set(productResult.rows.map((row) => normalize(row.brand)).filter(Boolean));
    const candidates = brandResult.rows.filter(
      (brand) => brand.active !== false && !activeProductBrands.has(normalize(brand.name)),
    );
    const ids = candidates.map((brand) => brand.id);

    await pool.query("begin");
    const updated = ids.length
      ? await pool.query(
          "update brands set active = false, featured = false where id = any($1::text[]) and active = true returning id, name",
          [ids],
        )
      : { rows: [] };
    await pool.query("commit");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportDir = path.join(projectRoot, "reports");
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `marcas-inactivadas-sin-productos-${timestamp}.csv`);
    const csv = ["Resultado,ID,Marca", ...updated.rows.map((row) => `Inactivada,${row.id},${JSON.stringify(row.name)}`)].join("\n");
    fs.writeFileSync(reportPath, `\uFEFF${csv}\n`, "utf8");

    console.log(`Productos activos: ${activeProductBrands.size} marcas con productos activos`);
    console.log(`Marcas sin productos activos: ${candidates.length}`);
    console.log(`Marcas inactivadas: ${updated.rows.length}`);
    for (const row of updated.rows) {
      console.log(`- ${row.name}`);
    }
    console.log(`REPORTE: ${reportPath}`);
  } catch (error) {
    await pool.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

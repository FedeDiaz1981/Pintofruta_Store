import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const projectRoot = process.cwd();
const localDatabaseUrl = "postgresql://postgres@127.0.0.1:5434/pintofruta_store";
const targetTables = [
  "site_content_meta",
  "header_search_scopes",
  "header_sections",
  "header_groups",
  "header_group_items",
  "hero_slides",
  "banners",
  "categories",
  "brands",
  "users",
  "products",
  "promotion_packs",
  "promotion_pack_items",
];

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/i);
    if (!match) {
      continue;
    }

    env[match[1]] = match[2];
  }

  return env;
}

function normalizeValue(value) {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}

async function fetchRows(client, tableName) {
  const orderBy = {
    site_content_meta: "id",
    header_search_scopes: "sort_order, id",
    header_sections: "sort_order, id",
    header_groups: "sort_order, id",
    header_group_items: "sort_order, id",
    hero_slides: "order_index, id",
    banners: "order_index, id",
    categories: "visible desc, id",
    brands: "name, id",
    users: "id",
    products: "id",
    promotion_packs: "order_index, id",
    promotion_pack_items: "order_index, pack_id, product_id",
  }[tableName];

  const query = orderBy
    ? `select * from public."${tableName}" order by ${orderBy}`
    : `select * from public."${tableName}"`;

  const result = await client.query(query);
  return result.rows;
}

async function main() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local no existe en el proyecto.");
  }

  const env = loadEnv(envPath);
  const targetDatabaseUrl = env.DATABASE_URL;
  if (!targetDatabaseUrl) {
    throw new Error("DATABASE_URL no está configurada en .env.local.");
  }

  const localPool = new Pool({ connectionString: localDatabaseUrl });
  const targetPool = new Pool({
    connectionString: targetDatabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const localClient = await localPool.connect();
  const targetClient = await targetPool.connect();

  try {
    const sourceCounts = {};
    const targetCounts = {};

    for (const tableName of targetTables) {
      const sourceResult = await localClient.query(`select count(*)::int as count from public."${tableName}"`);
      const targetResult = await targetClient.query(`select count(*)::int as count from public."${tableName}"`);
      sourceCounts[tableName] = sourceResult.rows[0].count;
      targetCounts[tableName] = targetResult.rows[0].count;
    }

    console.log("Conteos origen:", JSON.stringify(sourceCounts, null, 2));
    console.log("Conteos destino antes:", JSON.stringify(targetCounts, null, 2));

    await targetClient.query("begin");
    await targetClient.query(`truncate table ${targetTables.map((tableName) => `public."${tableName}"`).join(", ")} cascade`);

    for (const tableName of targetTables) {
      const rows = await fetchRows(localClient, tableName);
      if (rows.length === 0) {
        console.log(`- ${tableName}: sin filas`);
        continue;
      }

      let normalizedRows = rows;
      if (tableName === "categories") {
        const seenSlugs = new Set();
        normalizedRows = rows.map((row) => {
          const slug = String(row.slug);
          if (!seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            return row;
          }

          return {
            ...row,
            slug: `${slug}-legacy-${row.id}`,
          };
        });
      }

      const columns = Object.keys(normalizedRows[0]);
      const batchSize = 100;
      let inserted = 0;

      for (let start = 0; start < normalizedRows.length; start += batchSize) {
        const batch = normalizedRows.slice(start, start + batchSize);
        const placeholders = [];
        const values = [];
        let paramIndex = 1;

        for (const row of batch) {
          const rowPlaceholders = [];
          for (const column of columns) {
            rowPlaceholders.push(`$${paramIndex}`);
            values.push(normalizeValue(row[column]));
            paramIndex += 1;
          }
          placeholders.push(`(${rowPlaceholders.join(", ")})`);
        }

        const columnSql = columns.map((column) => `"${column}"`).join(", ");
        const sql = `insert into public."${tableName}" (${columnSql}) values ${placeholders.join(", ")}`;
        await targetClient.query(sql, values);
        inserted += batch.length;
      }

      console.log(`- ${tableName}: ${inserted} filas copiadas`);
    }

    await targetClient.query("commit");

    const finalCounts = {};
    for (const tableName of targetTables) {
      const result = await targetClient.query(`select count(*)::int as count from public."${tableName}"`);
      finalCounts[tableName] = result.rows[0].count;
    }

    console.log("Conteos destino después:", JSON.stringify(finalCounts, null, 2));
  } catch (error) {
    await targetClient.query("rollback").catch(() => {});
    throw error;
  } finally {
    localClient.release();
    targetClient.release();
    await localPool.end();
    await targetPool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

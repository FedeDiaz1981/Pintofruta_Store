import dns from "node:dns";
import { Pool, type PoolConfig } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const isRemotePostgres = Boolean(databaseUrl && /supabase\.co|render\.com/i.test(databaseUrl));

if (isRemotePostgres) {
  dns.setDefaultResultOrder("ipv4first");
}

let poolPromise: Promise<Pool> | null = null;

function buildPoolConfig(url: URL, host: string): PoolConfig {
  const user = decodeURIComponent(url.username || "");
  const password = decodeURIComponent(url.password || "");
  const database = url.pathname.replace(/^\//, "");

  return {
    host,
    port: url.port ? Number(url.port) : 5432,
    user: user || undefined,
    password: password || undefined,
    database: database || undefined,
    ssl: isRemotePostgres
      ? {
          rejectUnauthorized: false,
          servername: url.hostname,
        }
      : undefined,
  };
}

async function getPool() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  if (!poolPromise) {
    const url = new URL(databaseUrl);
    poolPromise = Promise.resolve(new Pool(buildPoolConfig(url, url.hostname)));
  }

  return poolPromise;
}

export const postgresPool: Pool | null = databaseUrl
  ? (new Proxy({} as Pool, {
      get(_target, prop) {
        if (prop === "query") {
          return async (...args: unknown[]) => {
            const pool = await getPool();
            return (pool.query as (...queryArgs: unknown[]) => Promise<unknown>)(...args);
          };
        }

        if (prop === "connect") {
          return async () => {
            const pool = await getPool();
            return pool.connect();
          };
        }

        if (prop === "end") {
          return async () => {
            const pool = await getPool();
            return pool.end();
          };
        }

        return undefined;
      },
    }) as Pool)
  : null;

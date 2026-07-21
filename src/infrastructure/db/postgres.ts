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
    max: 1,
    keepAlive: true,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

async function createPool() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const url = new URL(databaseUrl);
  return new Pool(buildPoolConfig(url, url.hostname));
}

async function getPool() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  if (!poolPromise) {
    poolPromise = createPool();
  }

  return poolPromise;
}

function isTransientConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("connection closed") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("terminating connection") ||
    message.includes("socket hang up") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("enetunreach")
  );
}

async function resetPool() {
  const previous = poolPromise;
  poolPromise = null;

  try {
    const pool = previous ? await previous : null;
    if (pool) {
      await pool.end();
    }
  } catch {
    // Ignorado a propósito: si la conexión ya estaba cerrada, forzamos una recreación limpia.
  }
}

async function withRetry<T>(runner: (pool: Pool) => Promise<T>) {
  try {
    const pool = await getPool();
    return await runner(pool);
  } catch (error) {
    if (!isTransientConnectionError(error)) {
      throw error;
    }

    await resetPool();
    const pool = await getPool();
    return runner(pool);
  }
}

export const postgresPool: Pool | null = databaseUrl
  ? (new Proxy({} as Pool, {
      get(_target, prop) {
        if (prop === "query") {
          return async (...args: unknown[]) =>
            withRetry(async (pool) => (pool.query as (...queryArgs: unknown[]) => Promise<unknown>)(...args));
        }

        if (prop === "connect") {
          return async () => withRetry(async (pool) => pool.connect());
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

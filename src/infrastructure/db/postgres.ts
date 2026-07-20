import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const isRemotePostgres = Boolean(databaseUrl && /supabase\.co|render\.com/i.test(databaseUrl));

export const postgresPool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: isRemotePostgres
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    })
  : null;

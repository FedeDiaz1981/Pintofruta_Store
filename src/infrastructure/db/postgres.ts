import dns from "node:dns";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const isRemotePostgres = Boolean(databaseUrl && /supabase\.co|render\.com/i.test(databaseUrl));

if (isRemotePostgres) {
  dns.setDefaultResultOrder("ipv4first");
}

export const postgresPool = databaseUrl
  ? new Pool(
      {
        connectionString: databaseUrl,
        family: isRemotePostgres ? 4 : undefined,
        ssl: isRemotePostgres
          ? {
              rejectUnauthorized: false,
            }
          : undefined,
      } as never,
    )
  : null;

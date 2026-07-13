import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

export const postgresPool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
    })
  : null;


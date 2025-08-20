import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// In dev, allow running without a database by exporting placeholders.
// Database-backed storage will only be constructed if DATABASE_URL exists.
export const pool: Pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : (null as unknown as Pool);
export const db = process.env.DATABASE_URL
  ? drizzle({ client: pool, schema })
  : (null as any);
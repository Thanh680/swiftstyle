import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Connection {
  db: Db;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
}

/**
 * Avec DATABASE_URL : PostgreSQL réel (Neon, Supabase, ou un Postgres local).
 * Sans : PGlite, un PostgreSQL complet compilé en WebAssembly, stocké dans
 * .data/pglite. Rien à installer pour développer. Un seul processus à la fois
 * peut l'ouvrir : arrêter `npm run dev` avant de relancer `npm run db:setup`.
 */
export async function connect(url = process.env.DATABASE_URL): Promise<Connection> {
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare: false, sinon les poolers en mode transaction (Neon, Supabase) refusent les requêtes.
    const client = postgres(url, { max: 5, prepare: false });
    return { db: drizzle(client, { schema }) as unknown as Db, kind: "postgres", close: () => client.end() };
  }

  const dir = process.env.PGLITE_DIR ?? join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(dir);
  return { db: drizzle(client, { schema }) as unknown as Db, kind: "pglite", close: () => client.close() };
}

// Une seule connexion par processus. En dev, Next recharge les modules à chaque
// modification : sans ce cache, PGlite serait rouvert sur le même dossier.
const cache = globalThis as typeof globalThis & { __swiftstyleDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  cache.__swiftstyleDb ??= connect().then((c) => c.db);
  return cache.__swiftstyleDb;
}

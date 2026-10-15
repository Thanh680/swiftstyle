// npm run db:setup : applique les migrations de ./drizzle puis insère les données
// de démonstration. Idempotent, on peut le relancer sans risque.
import { join } from "node:path";
import { connect } from "./client";
import { seed } from "./seed";

const migrationsFolder = join(process.cwd(), "drizzle");

const conn = await connect();
try {
  if (conn.kind === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(conn.db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(conn.db as never, { migrationsFolder });
  }
  console.log(`Migrations appliquées (${conn.kind === "pglite" ? "PGlite, .data/pglite" : "DATABASE_URL"}).`);
  await seed(conn.db);
} finally {
  await conn.close();
}

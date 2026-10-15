import { defineConfig } from "drizzle-kit";

// `npm run db:generate` écrit une migration SQL dans ./drizzle après chaque
// modification de src/lib/db/schema.ts. `npm run db:setup` les applique.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});

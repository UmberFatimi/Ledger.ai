import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  // Direct (non-pooled) URL: schema-engine needs advisory locks/prepared
  // statements PgBouncer doesn't support. Runtime app uses pooled
  // DATABASE_URL via lib/prisma.ts instead.
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});

-- DropTable
-- Sessions are now stateless signed JWTs (see lib/jwt.ts), not DB rows.
DROP TABLE "Session";

-- AlterTable
-- Temporary default so this doesn't fail against the 7 existing User rows;
-- dropped immediately after. Those rows get wiped and recreated with real
-- hashed passwords by `npx prisma db seed` right after this migration.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

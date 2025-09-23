/*
  Warnings:

  - You are about to drop the column `isLeader` on the `TeamMember` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "teamName" TEXT,
    "teamTricode" TEXT,
    "discordId" TEXT,
    "gameId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "passportId" TEXT,
    "nationalId" TEXT,
    "bankDetails" TEXT,
    "phone" TEXT
);
INSERT INTO "new_TeamMember" ("bankDetails", "createdAt", "discordId", "email", "gameId", "id", "name", "nationalId", "passportId", "phone", "teamName", "teamTricode", "updatedAt") SELECT "bankDetails", "createdAt", "discordId", "email", "gameId", "id", "name", "nationalId", "passportId", "phone", "teamName", "teamTricode", "updatedAt" FROM "TeamMember";
DROP TABLE "TeamMember";
ALTER TABLE "new_TeamMember" RENAME TO "TeamMember";
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

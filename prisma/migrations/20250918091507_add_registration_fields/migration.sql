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
    "discordId" TEXT,
    "gameId" TEXT,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "teamTricode" TEXT,
    "passportId" TEXT,
    "nationalId" TEXT,
    "bankDetails" TEXT,
    "phone" TEXT
);
INSERT INTO "new_TeamMember" ("bankDetails", "createdAt", "discordId", "email", "gameId", "id", "name", "nationalId", "passportId", "phone", "teamName", "updatedAt") SELECT "bankDetails", "createdAt", "discordId", "email", "gameId", "id", "name", "nationalId", "passportId", "phone", "teamName", "updatedAt" FROM "TeamMember";
DROP TABLE "TeamMember";
ALTER TABLE "new_TeamMember" RENAME TO "TeamMember";
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

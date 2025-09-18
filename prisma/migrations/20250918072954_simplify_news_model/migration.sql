/*
  Warnings:

  - You are about to drop the column `body` on the `NewsPost` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `NewsPost` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NewsPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entity" TEXT,
    "link" TEXT,
    "date" DATETIME,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "imageData" BLOB,
    "imageMime" TEXT
);
INSERT INTO "new_NewsPost" ("createdAt", "date", "description", "entity", "id", "imageData", "imageMime", "link", "published", "publishedAt", "title", "updatedAt") SELECT "createdAt", "date", "description", "entity", "id", "imageData", "imageMime", "link", "published", "publishedAt", "title", "updatedAt" FROM "NewsPost";
DROP TABLE "NewsPost";
ALTER TABLE "new_NewsPost" RENAME TO "NewsPost";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

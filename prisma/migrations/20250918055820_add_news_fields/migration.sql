/*
  Warnings:

  - Added the required column `description` to the `NewsPost` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NewsPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "entity" TEXT,
    "link" TEXT,
    "imageData" BLOB,
    "imageMime" TEXT
);
INSERT INTO "new_NewsPost" ("body", "createdAt", "entity", "id", "imageData", "imageMime", "link", "published", "publishedAt", "slug", "title", "updatedAt") SELECT "body", "createdAt", "entity", "id", "imageData", "imageMime", "link", "published", "publishedAt", "slug", "title", "updatedAt" FROM "NewsPost";
DROP TABLE "NewsPost";
ALTER TABLE "new_NewsPost" RENAME TO "NewsPost";
CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

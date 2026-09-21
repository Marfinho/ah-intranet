-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "audienceScopes" TEXT[] DEFAULT ARRAY['global']::TEXT[];

-- AlterTable
ALTER TABLE "WikiArticle" ADD COLUMN     "audienceScopes" TEXT[] DEFAULT ARRAY['global']::TEXT[];

-- CreateIndex
CREATE INDEX "Poll_audienceScopes_idx" ON "Poll" USING GIN ("audienceScopes");

-- CreateIndex
CREATE INDEX "WikiArticle_audienceScopes_idx" ON "WikiArticle" USING GIN ("audienceScopes");

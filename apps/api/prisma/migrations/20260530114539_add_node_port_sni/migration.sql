-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "port" INTEGER NOT NULL DEFAULT 443,
ADD COLUMN     "sni" TEXT NOT NULL DEFAULT 'www.microsoft.com';

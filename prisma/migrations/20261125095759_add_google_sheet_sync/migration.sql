-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "googleSheetId" TEXT,
ADD COLUMN     "sheetSyncError" TEXT,
ADD COLUMN     "sheetSyncedAt" TIMESTAMP(3);

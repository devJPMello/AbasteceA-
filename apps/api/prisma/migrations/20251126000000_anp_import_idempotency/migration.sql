-- ANP rows are re-imported every week: this partial unique index makes the import idempotent
-- (same station + fuel + collection date can only exist once). Prisma cannot express partial
-- indexes, so it lives in raw SQL.
CREATE UNIQUE INDEX "price_reports_anp_unique"
  ON "price_reports" ("station_id", "fuel_type", "reported_at")
  WHERE "source" = 'ANP';

ALTER TABLE "anp_import_runs" ADD COLUMN "rows_skipped" INTEGER NOT NULL DEFAULT 0;

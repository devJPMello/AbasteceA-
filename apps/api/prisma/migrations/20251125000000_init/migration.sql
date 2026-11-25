-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "fuel_type" AS ENUM ('GASOLINE_COMMON', 'GASOLINE_PREMIUM', 'ETHANOL', 'DIESEL_S10');

-- CreateEnum
CREATE TYPE "price_source" AS ENUM ('USER', 'ANP');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "cnpj" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Palmas',
    "location" geography(Point,4326) NOT NULL,
    "source" "price_source" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_reports" (
    "id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "user_id" UUID,
    "fuel_type" "fuel_type" NOT NULL,
    "price_milli" INTEGER NOT NULL,
    "source" "price_source" NOT NULL,
    "status" "report_status" NOT NULL,
    "confirmations_count" INTEGER NOT NULL DEFAULT 0,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_confirmations" (
    "report_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_confirmations_pkey" PRIMARY KEY ("report_id","user_id")
);

-- CreateTable
CREATE TABLE "station_current_prices" (
    "station_id" UUID NOT NULL,
    "fuel_type" "fuel_type" NOT NULL,
    "price_milli" INTEGER NOT NULL,
    "source" "price_source" NOT NULL,
    "report_id" UUID NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_current_prices_pkey" PRIMARY KEY ("station_id","fuel_type")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fuel_type" "fuel_type" NOT NULL,
    "target_price_milli" INTEGER NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "center" geography(Point,4326) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anp_import_runs" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "rows_read" INTEGER NOT NULL DEFAULT 0,
    "rows_imported" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "anp_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_family_id_idx" ON "refresh_tokens"("user_id", "family_id");

-- CreateIndex
CREATE UNIQUE INDEX "stations_cnpj_key" ON "stations"("cnpj");

-- CreateIndex
CREATE INDEX "stations_location_idx" ON "stations" USING GIST ("location");

-- CreateIndex
CREATE INDEX "price_reports_station_id_fuel_type_reported_at_idx" ON "price_reports"("station_id", "fuel_type", "reported_at" DESC);

-- CreateIndex
CREATE INDEX "price_reports_user_id_station_id_fuel_type_reported_at_idx" ON "price_reports"("user_id", "station_id", "fuel_type", "reported_at" DESC);

-- CreateIndex
CREATE INDEX "station_current_prices_fuel_type_price_milli_idx" ON "station_current_prices"("fuel_type", "price_milli");

-- CreateIndex
CREATE INDEX "price_alerts_center_idx" ON "price_alerts" USING GIST ("center");

-- CreateIndex
CREATE INDEX "price_alerts_user_id_idx" ON "price_alerts"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_confirmations" ADD CONSTRAINT "report_confirmations_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "price_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_confirmations" ADD CONSTRAINT "report_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_current_prices" ADD CONSTRAINT "station_current_prices_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


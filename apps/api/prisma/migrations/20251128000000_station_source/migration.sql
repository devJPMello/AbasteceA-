-- A station's origin is not the same thing as a price's origin: add OpenStreetMap as a station
-- source and stop reusing the price_source enum for stations.
CREATE TYPE "station_source" AS ENUM ('USER', 'ANP', 'OSM');

ALTER TABLE "stations" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "stations"
  ALTER COLUMN "source" TYPE "station_source" USING ("source"::text::"station_source");
ALTER TABLE "stations" ALTER COLUMN "source" SET DEFAULT 'USER';

ALTER TABLE "providers" ADD COLUMN "city_id" integer;--> statement-breakpoint
ALTER TABLE "providers" DROP COLUMN "city";--> statement-breakpoint
CREATE INDEX "providers_category_city_idx" ON "providers" ("category_id","city_id");--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_city_id_cities_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id");
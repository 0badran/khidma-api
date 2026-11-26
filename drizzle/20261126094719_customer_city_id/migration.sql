ALTER TABLE "users" ADD COLUMN "city_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id");
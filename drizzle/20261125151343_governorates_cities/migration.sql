CREATE TABLE "cities" (
	"id" serial PRIMARY KEY,
	"governorate_id" integer NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	CONSTRAINT "cities_governorate_name_ar_unique" UNIQUE("governorate_id","name_ar")
);
--> statement-breakpoint
CREATE TABLE "governorates" (
	"id" serial PRIMARY KEY,
	"name_ar" text NOT NULL UNIQUE,
	"name_en" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE INDEX "cities_governorate_idx" ON "cities" ("governorate_id");--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_governorate_id_governorates_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id");
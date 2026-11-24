CREATE TYPE "otp_purpose" AS ENUM('register');--> statement-breakpoint
CREATE TYPE "role" AS ENUM('customer', 'provider', 'admin');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"user_id" integer PRIMARY KEY,
	"category_id" integer NOT NULL,
	"city" text NOT NULL,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY,
	"provider_id" integer NOT NULL,
	"user_id" integer,
	"rater_name" text NOT NULL,
	"rater_phone" text NOT NULL,
	"stars" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_provider_phone_unique" UNIQUE("provider_id","rater_phone"),
	CONSTRAINT "ratings_stars_range" CHECK ("stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"role" "role" NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL UNIQUE,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"birth_date" date,
	"email_verified_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "otp_codes_email_idx" ON "otp_codes" ("email");--> statement-breakpoint
CREATE INDEX "providers_category_city_idx" ON "providers" ("category_id","city");--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_provider_id_providers_user_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY,
	"image_url" text NOT NULL,
	"title_ar" text,
	"title_en" text,
	"link_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);

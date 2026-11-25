import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["customer", "provider", "admin"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["register"]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const governorates = pgTable("governorates", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull().unique(),
  nameEn: text("name_en").notNull().unique(),
});

// One governorate has many cities; each city belongs to exactly one governorate.
export const cities = pgTable(
  "cities",
  {
    id: serial("id").primaryKey(),
    governorateId: integer("governorate_id")
      .notNull()
      .references(() => governorates.id),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
  },
  (t) => [
    unique("cities_governorate_name_ar_unique").on(t.governorateId, t.nameAr),
    index("cities_governorate_idx").on(t.governorateId),
  ],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  role: roleEnum("role").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  birthDate: date("birth_date", { mode: "string" }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  // Set when the user deletes the account; the account is purged after 30 days without login.
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providers = pgTable(
  "providers",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    city: text("city").notNull(),
    photoUrl: text("photo_url"),
    yearsOfExperience: integer("years_of_experience"),
    bio: text("bio"),
    // Admin switch: inactive providers are hidden from browsing.
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("providers_category_city_idx").on(t.categoryId, t.city)],
);

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providers.userId, { onDelete: "cascade" }),
    // Null for guests who rate with a name and phone only.
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    raterName: text("rater_name").notNull(),
    raterPhone: text("rater_phone").notNull(),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("ratings_provider_phone_unique").on(t.providerId, t.raterPhone),
    check("ratings_stars_range", sql`${t.stars} between 1 and 5`),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_codes_email_idx").on(t.email)],
);

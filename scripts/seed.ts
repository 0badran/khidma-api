import { count, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client.js";
import { categories, settings, users } from "../src/db/schema.js";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/security.js";

// Placeholder categories. The final list of 10 is decided by the owner.
const seedCategories = [
  ["سباك", "Plumber"],
  ["كهربائي", "Electrician"],
  ["نجار", "Carpenter"],
  ["نقاش", "Painter"],
  ["فني تكييف", "AC technician"],
  ["فني أجهزة منزلية", "Appliance repair"],
  ["عامل نظافة", "Cleaner"],
  ["نقل أثاث", "Furniture mover"],
  ["بستاني", "Gardener"],
  ["حداد", "Blacksmith"],
] as const;

const [existing] = await db.select({ n: count() }).from(categories);
if (existing && existing.n === 0) {
  await db
    .insert(categories)
    .values(seedCategories.map(([nameAr, nameEn], i) => ({ nameAr, nameEn, sortOrder: i + 1 })));
  console.log("seeded categories");
}

await db
  .insert(settings)
  .values([
    { key: "app_name", value: "khidma" },
    { key: "maintenance_mode", value: "false" },
  ])
  .onConflictDoNothing();

if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, env.ADMIN_EMAIL));
  if (!admin) {
    await db.insert(users).values({
      role: "admin",
      name: "Admin",
      phone: "+000000000",
      email: env.ADMIN_EMAIL,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      emailVerifiedAt: new Date(),
    });
    console.log("created admin");
  }
}

await pool.end();

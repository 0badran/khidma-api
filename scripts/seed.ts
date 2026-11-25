import { count, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client.js";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { categories, cities, governorates, settings, users } from "../src/db/schema.js";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/security.js";

const seedCategories = [
  ["سباك", "Plumber"],
  ["كهربائي", "Electrician"],
  ["نجار", "Carpenter"],
  ["دهان ونقاش", "Painting and decoration"],
  ["تركيب سيراميك ورخام", "Ceramic and marble installation"],
  ["غسيل وصيانة التكييف", "AC cleaning and maintenance"],
  ["صيانة الأجهزة المنزلية (غسالة، ثلاجة، بوتجاز)", "Home appliance repair (washer, fridge, stove)"],
  ["الأجهزة الإلكترونية والمراقبة: رسيفر / كاميرات مراقبة / إنترنت وراوتر", "Electronics and surveillance: receivers, CCTV cameras, internet and routers"],
  ["خدمات النظافة: منزل / خزانات / سجاد وستائر", "Cleaning services: homes, water tanks, carpets and curtains"],
  ["نقل وفك وتركيب الأثاث", "Furniture moving and assembly"],
] as const;

const [existing] = await db.select({ n: count() }).from(categories);
if (existing && existing.n === 0) {
  await db
    .insert(categories)
    .values(seedCategories.map(([nameAr, nameEn], i) => ({ nameAr, nameEn, sortOrder: i + 1 })));
  console.log("seeded categories");
}

type Location = { id: number; nameAr: string; nameEn: string; cities: { id: number; nameAr: string; nameEn: string }[] };
const locations = JSON.parse(
  readFileSync(new URL("../src/data/egypt-locations.json", import.meta.url), "utf8"),
) as Location[];
await db
  .insert(governorates)
  .values(locations.map(({ id, nameAr, nameEn }) => ({ id, nameAr, nameEn })))
  .onConflictDoNothing();
await db
  .insert(cities)
  .values(locations.flatMap((g) => g.cities.map((c) => ({ ...c, governorateId: g.id }))))
  .onConflictDoNothing();
// Rows were inserted with explicit IDs, so move the sequences past them.
await db.execute(sql`select setval(pg_get_serial_sequence('governorates', 'id'), (select max(id) from governorates))`);
await db.execute(sql`select setval(pg_get_serial_sequence('cities', 'id'), (select max(id) from cities))`);
console.log("seeded governorates and cities");

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

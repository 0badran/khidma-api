import { randomBytes } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { db, pool } from "../src/db/client.js";
import { categories, providers, users } from "../src/db/schema.js";
import { hashPassword } from "../src/lib/security.js";

const DEMO_EMAIL_DOMAIN = "@demo.khidma.test";

const names = [
  "محمد السيد",
  "أحمد عبد الله",
  "محمود حسن",
  "إبراهيم علي",
  "مصطفى كمال",
  "عمر خالد",
  "ياسر فتحي",
  "حسام الدين",
  "كريم نبيل",
  "طارق سعيد",
];
const cities = ["المنصورة", "القاهرة", "الإسكندرية", "طنطا", "دمياط"];

if (process.argv.includes("--remove")) {
  const removed = await db.delete(users).where(like(users.email, `%${DEMO_EMAIL_DOMAIN}`)).returning({ id: users.id });
  console.log(`removed ${removed.length} demo accounts`);
  await pool.end();
  process.exit(0);
}

const cats = await db.select().from(categories).orderBy(categories.sortOrder);

let created = 0;
for (const [i, cat] of cats.entries()) {
  const email = `provider${i + 1}${DEMO_EMAIL_DOMAIN}`;
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) continue;
  // Random password nobody knows: demo providers are for browsing, not for signing in.
  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
  const [user] = await db
    .insert(users)
    .values({
      role: "provider",
      name: names[i % names.length],
      phone: `+20100000${String(i + 1).padStart(4, "0")}`,
      email,
      passwordHash,
      birthDate: `${1980 + i}-0${(i % 9) + 1}-15`,
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  await db.insert(providers).values({
    userId: user.id,
    categoryId: cat.id,
    city: cities[i % cities.length],
  });
  created++;
}
console.log(`categories: ${cats.length}, demo providers created: ${created}`);
await pool.end();

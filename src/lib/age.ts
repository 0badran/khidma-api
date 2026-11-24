import { sql } from "drizzle-orm";
import { users } from "../db/schema.js";

// Age in whole years, computed from the stored birth date.
export const ageExpr = sql<number | null>`date_part('year', age(${users.birthDate}))::int`;

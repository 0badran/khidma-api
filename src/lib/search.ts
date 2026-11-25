import { sql, type AnyColumn, type SQL } from "drizzle-orm";

// Escape % and _ so user input is matched literally inside LIKE patterns.
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

// Arabic letter folding: أ إ آ ٱ -> ا, ى -> ي, ة -> ه, and remove tashkeel and tatweel.
const FROM = "أإآٱىة";
const TO = "اااايه";
const MARKS = /[\u064B-\u0652\u0670\u0640]/g;

export function foldArabic(s: string): string {
  let out = s.replace(MARKS, "");
  for (let i = 0; i < FROM.length; i++) out = out.replaceAll(FROM[i], TO[i]);
  return out;
}

// SQL side of foldArabic, for a column.
function foldColumn(col: AnyColumn): SQL {
  return sql`translate(regexp_replace(${col}, '[\u064B-\u0652\u0670\u0640]', '', 'g'), ${FROM}, ${TO})`;
}

// Case-insensitive, Arabic-folded "contains" match.
export function containsFolded(col: AnyColumn, q: string): SQL {
  return sql`${foldColumn(col)} ilike ${`%${escapeLike(foldArabic(q))}%`}`;
}

# khidma-api

Backend for the khidma home-services directory. Node (LTS), Express, TypeScript, PostgreSQL, Drizzle, Zod. Arabic and English.

## Setup

1. Copy `.env.example` to `.env` and fill in values.
2. `npm install`
3. `npm run db:generate` (only after schema changes), then `npm run db:migrate`
4. `npm run seed` (placeholder categories, default settings, admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`)
5. `npm run dev`

## Scripts

`build`, `start`, `dev`, `typecheck`, `lint`, `db:generate`, `db:migrate`, `seed`.

## Notes

- Registration needs an email OTP. In development the code is printed to the server console. Email delivery is not set up yet.
- Deleting an account hides it. A background job removes accounts hidden for 30 days (see `src/jobs`).
- Images (category, provider, logo) are stored as URLs. Upload and storage are not set up yet.
- The language comes from the `Accept-Language` header (`ar` or `en`).

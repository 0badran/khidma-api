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

- Registration needs an email OTP. With the four `GMAIL_*` variables set, the code is sent through the Gmail API. Without them it is printed to the server console.
- Deleting an account hides it. A background job removes accounts hidden for 30 days (see `src/jobs`).
- Images (category, provider, logo) are stored as URLs. Upload goes straight to Cloudinary with a signature from `POST /api/uploads/sign` (needs the three `CLOUDINARY_*` variables).
- API reference: `docs/API.md`.
- The language comes from the `Accept-Language` header (`ar` or `en`).

# khidma-api reference

Base URL (production): `https://khidma-api-vzbw.onrender.com`. All routes are under `/api` except `/health`.
The free Render service sleeps after 15 minutes. The first request after a pause can take about a minute.

## Conventions

- JSON in, JSON out. Send `Content-Type: application/json`. Body limit is 100 KB.
- Language: send `Accept-Language: ar` or `en`. Error and message texts follow it.
- Auth: `Authorization: Bearer <token>`. The token comes from register or login. Roles: `customer`, `provider`, `admin`.
- Errors: `{ "error": { "message": "..." } }`. Validation errors (400) also carry `"fields": { "<field>": ["..."] }`.
- Status codes: 400 invalid input or wrong code, 401 not signed in or wrong credentials, 403 wrong role, 404 not found, 409 already exists, 429 too many requests or attempts, 503 maintenance.
- Maintenance mode: while on, every route returns 503 except `/health`, `POST /api/auth/login`, `GET /api/settings/public` and `/api/admin/*`. Only admins can sign in.
- Phone format: 8 to 15 digits, optional leading `+`. Dates: `YYYY-MM-DD`. Emails are lowercased by the server.
- Image fields are plain URLs for now.

## Health and settings

| Method and path | Auth | Response |
| --- | --- | --- |
| `GET /health` | none | `{ "ok": true }` |
| `GET /api/settings/public` | none | `{ "appName": string, "logoUrl": string or null, "maintenanceMode": boolean }` |
| `GET /api/categories` | none | `{ "categories": [{ "id", "nameAr", "nameEn", "imageUrl", "sortOrder" }] }` |

## Sign up and sign in

### `POST /api/auth/register/request-otp`
Body: `{ "email": string }`. Sends a 6-digit code by email (valid 10 minutes). Response 200: `{ "message": string }`.
Errors: 409 email already registered, 429 asked again within 60 seconds. The mail can land in spam, and the message text tells the user to check there.

### `POST /api/auth/register`
Checks the code and creates the account. Codes work once, with 5 wrong attempts allowed.
Customer body: `{ "role": "customer", "name", "phone", "email", "password", "birthDate", "otp" }`.
Provider body: same plus `"categoryId": number`, `"city": string`, optional `"photoUrl": url`.
Limits: name 2 to 100 characters, password 8 to 128 characters, otp is exactly 6 digits.
Response 201: `{ "token": string, "user": { "id", "role" } }`.
Errors: 400 wrong or expired code or unknown category, 409 phone or email taken, 429 too many wrong codes.

### `POST /api/auth/login`
Body: `{ "identifier": string, "password": string }`. `identifier` is the email or the phone.
Response 200: `{ "token", "user": { "id", "role", "name" }, "message"? }`. `message` appears when a hidden account was restored by signing in.
Errors: 401 wrong credentials, 503 maintenance (non-admin).

### `GET /api/auth/me` (any signed-in user)
Response: `{ "user": { "id", "role", "name", "phone", "email", "birthDate" } }`.

### `DELETE /api/auth/me` (customer or provider)
Hides the account. It is deleted after 30 days without sign-in, and signing in again restores it. Response: `{ "message": string }`. Admin gets 403.

## Providers

### `GET /api/providers`
Public list, best rated first. Query: `categoryId`, `city` (case-insensitive exact), `q` (name contains), `page` (default 1), `limit` (default 20, max 50).
Response: `{ "providers": [Provider], "page", "limit" }`.
Provider item: `{ "id", "name", "age", "city", "photoUrl", "categoryId", "categoryNameAr", "categoryNameEn", "avgRating", "ratingsCount" }`. `avgRating` is null with no ratings.

### `GET /api/providers/:id`
Same fields plus `"phone"`, `"callUrl"` (`tel:...`) and `"whatsappUrl"` (`https://wa.me/...`), inside `{ "provider": {...} }`. 404 if hidden or deactivated.

### `PATCH /api/providers/me` (provider)
Any of `name`, `birthDate`, `city`, `categoryId`, `photoUrl` (url or null). At least one field. Response: `{ "ok": true }`.

### `PATCH /api/customers/me` (customer)
Any of `name`, `birthDate`. At least one field. Response: `{ "ok": true }`.

## Ratings

### `GET /api/providers/:id/ratings`
Response: `{ "ratings": [{ "id", "raterName", "stars", "comment", "createdAt" }] }` (latest 100).

### `POST /api/providers/:id/ratings`
Works signed in or as a guest. Body: `{ "stars": 1-5, "comment"?: string (max 1000), "name"?, "phone"? }`.
Signed-in customers use their own name and phone. Guests must send `name` and `phone`.
One rating per provider per phone number (409 on repeat). Rating your own number gives 400.
Response 201: `{ "id" }`.

## Admin (role `admin`)

Admin signs in with the normal login route.

| Method and path | Body or query | Response |
| --- | --- | --- |
| `POST /api/admin/categories` | `{ nameAr, nameEn, imageUrl?, sortOrder? }` | 201 `{ category }` |
| `PATCH /api/admin/categories/:id` | any of the same fields | `{ category }` |
| `DELETE /api/admin/categories/:id` | none | `{ ok }`. 409 if providers use it |
| `GET /api/admin/providers` | `page`, `limit` (max 100) | `{ providers: [{ id, name, phone, email, age, city, categoryId, photoUrl, isActive, hiddenAt }], page, limit }` |
| `PATCH /api/admin/providers/:id/active` | `{ isActive: boolean }` | `{ ok }` |
| `GET /api/admin/customers` | `page`, `limit` | `{ customers: [{ id, name, phone, email, age, hiddenAt, createdAt }], page, limit }` |
| `GET /api/admin/settings` | none | same as public settings |
| `PUT /api/admin/settings` | any of `{ appName, logoUrl (url or null), maintenanceMode }` | updated settings |

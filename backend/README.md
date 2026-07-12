# Meta Leads CRM API

MongoDB authentication and role-based access API for the Meta Leads CRM prototype.

## Setup

1. Copy `.env.example` to `.env`.
2. Replace `<db_password>` in `MONGODB_URI` with your MongoDB Atlas database password.
3. Fill `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with long random values.
4. Install dependencies:

```bash
npm install
```

5. Create the first Super Admin:

```bash
npm run seed:admin
```

6. Start the API and hosted dashboard:

```bash
npm run dev
```

Open `http://localhost:4000`. On first use, choose **Create a new agency workspace** to create the first Super Admin in MongoDB. Later visits restore the signed-in session from secure HTTP-only cookies.

On macOS, you can also double-click `start-backend.command` in the parent project folder. It installs missing packages, starts the API, and opens the correct URL.

## Vercel environment variables

Use `.env.vercel.example` as the variable checklist in Vercel Project Settings > Environment Variables. Set `APP_ORIGIN` to the final HTTPS Vercel domain, enable `COOKIE_SECURE`, and generate unique JWT secrets. Do not upload `.env` or commit production credentials.

The repository includes `api/index.js`, a root `package.json`, and an explicit `vercel.json` rewrite. Vercel sends every `/api/*` request to the API handler, which restores the original path before passing it to Express. After changing environment variables, redeploy the project and verify `https://YOUR_DOMAIN/api/health` returns JSON before testing signup or login.

## Endpoints

- `GET /api/health`
- `POST /api/auth/register-organization`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `POST /api/users/:id/revoke-sessions`
- `GET /api/leads`
- `POST /api/leads`
- `PATCH /api/leads/:id`
- `GET /api/auth/meta/start`
- `GET /api/auth/meta/callback`
- `GET /api/auth/meta/status`

The production dashboard contains no seeded operational records. After authentication it loads organization-scoped leads from MongoDB. A new workspace therefore starts empty until records are created through `/api/leads` or ingested from a connected Meta source.

Meta Login uses the server-side authorization-code flow. Configure `META_APP_ID`, `META_APP_SECRET`, optional `META_LOGIN_CONFIG_ID`, `META_GRAPH_VERSION`, and `META_TOKEN_ENCRYPTION_KEY` in Vercel. The returned access token is encrypted before storage and is never returned to browser JavaScript.

## Roles

- `super_admin`
- `admin`
- `team_member`
- `client_user`
- `client_viewer`

Client and team roles are forced to `canViewSpend: false` and cannot manage Meta accounts or users.

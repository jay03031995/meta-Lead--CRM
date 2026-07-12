# Meta Leads Command Center

Local interactive SaaS/CRM prototype for an agency managing 10+ client ad accounts and sharing real-time lead access with each client.

## Open

Open `index.html` in a browser. The app is static and does not require a build step.

## What is included

- Agency dashboard with many clients and mapped Meta lead sources.
- Simple welcome page after login with CRM navigation cards.
- Salesforce-inspired but simpler lead CRM interface.
- Client-safe portal roles with masked/restricted data.
- Access screen for client invites, portal users and login status.
- Meta Login connection mock for agency-owned OAuth connection.
- Real-time lead ingestion simulation.
- Lead inbox, detail panel, bucketing, SLA, notes and audit trail.
- One-click WhatsApp, copy phone, call, email, note and follow-up actions.
- Drag-and-drop Kanban pipeline.
- Follow-up management screen.
- Campaign and performance report screens.
- Admin panel for users, roles, permissions, buckets, assignment rules and templates.
- Digest preview and spend/cost-field blocking policy.
- MongoDB SaaS model notes in Settings.
- Backend MongoDB auth API scaffold in `backend/`.

## Production direction

Use Meta Login/OAuth to connect agency Meta Business assets. Do not share Meta passwords with clients. Clients should receive their own dashboard login through email invite, password or magic link, optional MFA, and strict client-level authorization.

Security note:

- Keep `META_APP_SECRET`, access tokens, verify token, Page ID, Business ID and Ad Account ID on the backend only.
- Do not put secrets in frontend JavaScript, screenshots, chat, GitHub, logs or browser storage.
- If a real App Secret or token was shared anywhere, regenerate it in Meta Developers before production use.
- Use `backend-env.example` as a template and store real values in your backend `.env`.

Recommended backend:

- Express/Node API scaffold included in `backend/`
- Node worker for webhooks and retries
- MongoDB Atlas collections: `organizations`, `clients`, `users`, `memberships`, `metaConnections`, `assetMappings`, `leads`, `leadEvents`, `digestRuns`, `auditEvents`
- Socket.IO or Server-Sent Events for real-time client dashboards
- Encrypted OAuth tokens and signed webhook verification
- Server-side allowlisted client DTOs that never include spend, cost, budget, CPM, CPC, CPL, ROAS or billing fields

## Backend API

See [backend/README.md](./backend/README.md).

It includes MongoDB authentication, Super Admin seeding, JWT access/refresh tokens, HTTP-only cookies, RBAC middleware, user management routes, session revocation and audit events.
# meta-Lead--CRM

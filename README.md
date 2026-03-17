# Timeboxer

Timeboxer is a timeboxing app with a separate frontend and backend.

The frontend lives in `frontend/` and serves the UI. The backend lives in
`backend/` and owns auth, API routes, database access, and Outlook
integrations. The frontend proxies `/api/*` requests to the backend, so the
existing browser contract stays intact.

## Apps

- `frontend/`: Next.js UI, components, styling, client-side task state.
- `backend/`: Next.js API app, NextAuth handlers, Drizzle schema, database,
  Outlook integration, and maintenance scripts.

## Local Development

1. Install dependencies at the repo root:

```bash
npm install
```

2. Create a root env file:

```bash
cp .env.example .env.local
```

3. Fill in the backend-related values in `.env.local`:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL=http://localhost:3000`
- `DATABASE_URL=file:./dev.db` or a Turso `libsql://...` URL
- `TURSO_AUTH_TOKEN` when using Turso
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if you want Google sign-in
- `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` for Outlook integration
- `OUTLOOK_REDIRECT_URI=http://localhost:3000/api/auth/outlook/callback`

`BACKEND_URL` is optional for the root scripts. They default the frontend proxy
to `http://localhost:4000`.

4. Push the schema:

```bash
npm run db:push
```

5. Start both apps:

```bash
npm run dev
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:4000`

## Useful Commands

- `npm run dev`: start frontend and backend together
- `npm run dev:frontend`: start only the frontend app
- `npm run dev:backend`: start only the backend app
- `npm run build`: build both apps
- `npm run start:frontend`: start the built frontend on port 3000
- `npm run start:backend`: start the built backend on port 4000
- `npm run typecheck`: run TypeScript checks for both apps
- `npm run db:push`: push the backend schema
- `npm run db:generate`: generate backend migrations

## Project Structure

```text
timeboxer/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
├── backend/
│   ├── app/api/
│   ├── drizzle/
│   ├── lib/
│   ├── scripts/
│   └── types/
└── scripts/
```

## Notes

- The backend still uses Next.js route handlers, but it now runs as its own app.
- The frontend still uses `next-auth/react`, with auth requests proxied to the
  backend app.
- Root helper scripts load `.env.local` once and pass it to whichever app they
  start.

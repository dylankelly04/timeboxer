# Timeboxer

A simple, open-source timeboxing application built with Next.js. Timeboxer helps you manage your tasks by scheduling them on a calendar and tracking your work time.

## Features

- **Task Management**: Create, edit, and organize tasks with time requirements
- **Calendar View**: Drag and drop tasks onto a calendar to schedule them
- **Outlook Integration**: Sync your scheduled tasks with Microsoft Outlook Calendar
- **Recurring Events**: Set up daily recurring events that appear on your calendar
- **Activity Tracking**: Visualize your work activity with a GitHub-style contribution graph
- **Authentication**: Sign in with email/password or Google OAuth
- **Dark Mode**: Built-in theme support

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite (via Drizzle ORM) - supports both local and Turso cloud
- **Authentication**: NextAuth.js v5
- **UI**: React, Tailwind CSS, Radix UI components
- **Calendar**: Custom calendar view with drag-and-drop support

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd timeboxer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your configuration:
- `NEXTAUTH_SECRET`: Generate a random secret (e.g., `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000` for development)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: For Google OAuth (optional)
- `OUTLOOK_CLIENT_ID` and `OUTLOOK_CLIENT_SECRET`: For Outlook integration (optional)
- `DATABASE_URL`: Database connection string
  - For local: `file:./dev.db`
  - For Turso: `libsql://your-database-url`
- `TURSO_AUTH_TOKEN`: Required if using Turso database

4. Set up the database:
```bash
npm run db:push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

Timeboxer supports two database options:

### Local SQLite (Self-hosted)
Set `DATABASE_URL=file:./dev.db` in your `.env.local`. The database file will be created automatically.

### Turso (Cloud)
1. Create a database at [turso.tech](https://turso.tech)
2. Set `DATABASE_URL=libsql://your-database-url`
3. Set `TURSO_AUTH_TOKEN=your-auth-token`

## Project Structure

```
timeboxer/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── ...               # Feature components
├── lib/                   # Utility functions
│   ├── auth.ts           # NextAuth configuration
│   ├── db.ts             # Database connection
│   └── ...               # Other utilities
├── drizzle/              # Database schema and migrations
└── public/               # Static assets
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run db:generate` - Generate database migrations

## License

This project is open source and available under the MIT License.

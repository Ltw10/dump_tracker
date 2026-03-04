# Dump Tracker 2026 🚽

A simple web app to track bathroom visits by location name. Add custom locations and increment visit counts with a clean, minimal interface.

## Features

- **Locations & counts**
  - Simple text-based location names with case-insensitive duplicate detection
  - Quick +1 increment and decrement (removes most recent entry)
  - Locations sorted by highest count; 💩 badge on top-ranked location
- **Dump types** (per log): Classic, Ghost Wipe 👻, Messy 💩, Liquid 💧, Explosive 💣 — chosen when adding or incrementing
- **Calendar** view per location to see history and counts by day
- **Optional location data** (address or GPS) per location when opted in
- **Leaderboard** (opt-in): Total dumps, plus specialty leaderboards (ghost wipes, messy, liquid, explosive)
- **Notifications** (opt-in): Feed of milestones (e.g. first dump at location, 50/100/150… at a location, specialty and total milestones, single-day record) with filters and pagination
- **News** and **Settings** (leaderboard opt-in, location tracking opt-in, name)
- **Auth & security**: Email verification, Supabase Auth, Row Level Security (RLS)
- **PWA**: Add to home screen with custom icon

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the SQL from `db/supabase-schema.sql` to create the tables and set up Row Level Security
4. **Important**: If you're setting up an existing database or need to fix RLS issues, also run the relevant migration(s) from the `db/` folder (e.g. migrations for RLS fixes or user-existence functions).
5. Go to Settings > API to get your project URL and anon key
6. Enable email authentication in Authentication > Providers > Email
7. **Configure Redirect URLs** (Important for email verification):
   - Go to Authentication > URL Configuration
   - Add your site URLs to "Redirect URLs":
     - For local development: `http://localhost:5173` (or your Vite dev port)
     - For production: Your GitHub Pages URL (e.g., `https://username.github.io/repo-name/`)
   - Add the same URLs to "Site URL" if deploying to production
   - The app will automatically use the current origin, but Supabase needs these URLs whitelisted

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials in `.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 4. Database Setup Details

The database uses triggers and functions to automatically handle user creation:
- A trigger automatically creates a `users` record when someone signs up via Supabase Auth
- The `ensure_user_exists()` function can be called to ensure user records exist (useful for existing users)
- All database functions run with `SECURITY DEFINER` to bypass RLS when needed

### 5. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite assigns).

## How It Works

1. **Register/Login**  
   Create an account with email and password. Email verification is required before logging in; password reset is supported via email link.

2. **Dashboard**  
   - **Add location**: Type a name and press Enter or click Add. If it already exists (case-insensitive), you’re prompted to choose a dump type and it increments; otherwise a new location is created.
   - **Increment**: Click +1 next to a location, choose dump type (Classic, Ghost Wipe, Messy, Liquid, Explosive), and confirm.
   - **Decrement**: Removes the most recent dump entry for that location.
   - **Calendar**: Open a location’s calendar to see counts by day.
   - **Location data**: If you’ve opted in (Settings), you can optionally add address or GPS for a location.

3. **Leaderboard** (opt-in in Settings)  
   View top users by total dumps and by specialty (ghost wipes, messy, liquid, explosive). Requires first and last name and leaderboard opt-in.

4. **Notifications** (same opt-in as leaderboard)  
   Feed of milestones (first dump at a location, every 50 dumps at a location, yearly specialty/total milestones, single-day records). Filter by All, Specialty, Total, or Location; 10 per page.

5. **News**  
   In-app news/announcements.

6. **Settings**  
   Set first/last name, leaderboard (and notifications) opt-in, and location tracking opt-in.

## Database Schema

All Dump Tracker objects use the **`dt_`** prefix so the app can share a database with other projects.

- **dt_users** – App user profile (id matches `auth.users`), `leaderboard_opt_in`, `location_tracking_opt_in`, name
- **dt_locations** – One row per user per location: `location_name`, `count`, optional `address` / `latitude` / `longitude`
- **dt_entries** – One row per logged dump: `location_id` → `dt_locations`, flags for `ghost_wipe`, `messy_dump`, `classic_dump`, `liquid_dump`, `explosive_dump`; used for decrement and leaderboards
- **dt_notifications** – Feed rows: `type`, `actor_user_id`, `payload` (JSON), created by triggers on insert into `dt_entries`

RPCs: `dt_ensure_user_exists`, `dt_get_notifications`, `dt_get_leaderboard_*`. See `db/supabase-schema.sql` and `db/migration-dump-tracker-prefix.sql` for existing DBs.

### Key Database Behavior

- **RLS**: Users can only access their own `dumps` and `dump_entries`; notifications are read via RPC for opted-in users.
- **Triggers**: User creation on signup; `dumps.count` synced from `dump_entries`; notifications for first dump at location, every 50 at a location, yearly milestones (e.g. 10th ghost wipe, 100th total), single-day record.
- **RPCs**: e.g. `get_notifications`, `ensure_user_exists`, leaderboard functions for total and each specialty. Schema and migrations live in `db/` (see [AGENTS.md](AGENTS.md) for conventions).

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Progressive Web App (PWA) Icon

The app is configured as a Progressive Web App with a custom toilet emoji (🚽) icon for iOS and other platforms.

### Icon Setup

The app includes:
- **Web App Manifest** (`public/manifest.json`) - Defines the PWA metadata and icons
- **Apple Touch Icon** - Custom icon for iOS home screen
- **Multiple icon sizes** - 180x180, 192x192, and 512x512 pixels

### Generating Icons

If you need to regenerate the icons, run:

```bash
npm run generate-icons
```

This will create PNG icon files in the `public/` directory with the toilet emoji. The icons are automatically included in the build process.

### Adding to Home Screen (iOS)

1. Open the app in Safari on your iPhone
2. Tap the Share button
3. Select "Add to Home Screen"
4. The toilet emoji icon will appear on your home screen

The icons are generated using the `canvas` package and include proper emoji rendering for best compatibility across devices.

## Deploy to GitHub Pages

This app is configured to deploy automatically to GitHub Pages using GitHub Actions.

### Setup Instructions

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/dump_tracker.git
   git push -u origin main
   ```

2. **Configure GitHub Secrets**
   - Go to your repository on GitHub
   - Navigate to Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `VITE_SUPABASE_URL`: Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

3. **Enable GitHub Pages**
   - Go to Settings > Pages
   - Under "Source", select "GitHub Actions"
   - The workflow will automatically deploy on every push to `main`

4. **Update Base Path (if needed)**
   - If your repository name is different from `dump_tracker`, update the `VITE_BASE_PATH` in `.github/workflows/deploy.yml`
   - For user/organization pages (username.github.io), set `VITE_BASE_PATH: '/'`
   - For project pages (username.github.io/repo-name), set `VITE_BASE_PATH: '/repo-name/'`

### Manual Deployment

If you prefer to deploy manually:

```bash
# Build the app
npm run build

# The dist folder contains the static files
# You can deploy the contents of dist/ to any static hosting service
```

**Note**: For GitHub Pages, you'll need to configure the base path correctly in `vite.config.js` to match your repository structure.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Supabase** - Backend (PostgreSQL database + Authentication)
- **CSS3** - Styling with modern CSS features

## Project Structure

```
dump_tracker/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx       # Main dashboard: locations, +1/−1, dump-type modal
│   │   ├── Dashboard.css
│   │   ├── LocationCalendar.jsx # Per-location calendar view
│   │   ├── LocationCalendar.css
│   │   ├── LocationDataModal.jsx # Address/GPS for a location
│   │   ├── LocationDataModal.css
│   │   ├── Leaderboard.jsx      # Leaderboard (total + specialty)
│   │   ├── Leaderboard.css
│   │   ├── Notifications.jsx    # Notifications feed (filters, pagination)
│   │   ├── Notifications.css
│   │   ├── News.jsx
│   │   ├── News.css
│   │   ├── Settings.jsx
│   │   ├── Settings.css
│   │   ├── LoginForm.jsx        # Login, register, password reset
│   │   └── LoginForm.css
│   ├── App.jsx                 # View state (dashboard/settings/leaderboard/news/notifications)
│   ├── App.css
│   ├── supabase.js             # Supabase client
│   ├── main.jsx
│   └── index.css
├── db/
│   ├── supabase-schema.sql     # Full schema (tables, RLS, triggers, RPCs)
│   └── migration-*.sql          # Per-feature migrations (run in Supabase SQL Editor)
├── public/                     # PWA manifest, icons
├── .github/workflows/          # e.g. GitHub Pages deploy
└── package.json
```

## Troubleshooting

### "new row violates row-level security policy" error
- Run the relevant RLS migration from the `db/` folder to set up the user creation trigger

### "foreign key constraint" error when creating dumps
- Run the relevant migration from `db/` that adds the `ensure_user_exists()` function
- The app will automatically call this function, but you can also call it manually via RPC

### Email verification not working
- Check Supabase Authentication settings
- Ensure email provider is enabled
- Check your email spam folder

## Documentation for contributors

- **[AGENTS.md](AGENTS.md)** – Guidelines for agents and contributors: database conventions (`db/` schema and migrations), feature/UI patterns, and when to update the README.


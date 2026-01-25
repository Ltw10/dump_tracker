# Dump Tracker 2026 🚽

A simple web app to track bathroom visits by location name. Add custom locations and increment visit counts with a clean, minimal interface.

## Features

- ✅ Simple text-based location names
- ✅ Automatic duplicate detection (case-insensitive matching)
- ✅ Quick +1 increment buttons
- ✅ Shows total count per location
- ✅ Locations sorted by highest count
- ✅ 💩 Emoji badge on top-ranked location
- ✅ Email verification flow
- ✅ Clean, minimal interface
- ✅ User authentication with Supabase
- ✅ Row Level Security for data privacy

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the SQL from `supabase-schema.sql` to create the tables and set up Row Level Security
4. **Important**: If you're setting up an existing database or need to fix RLS issues, also run:
   - `supabase-migration-fix-rls.sql` - Fixes user registration RLS policy issues
   - `supabase-migration-add-ensure-user.sql` - Adds function to ensure user records exist
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

1. **Register/Login**: 
   - Users can create an account with email and password
   - After registration, users are redirected to login and shown a modal prompting email verification
   - Users must verify their email before they can log in
2. **Add Location**: Type a location name and press Enter or click Add
   - If the location already exists (case-insensitive), it increments the count
   - If it's new, it creates it with count = 1
3. **Increment**: Click the +1 button next to any location to increment its count
4. **View**: 
   - See all your locations sorted by highest count
   - The location with the highest count displays a 💩 emoji badge
   - Locations automatically re-sort when counts change

## Database Schema

- **users**: Stores user account information (linked to `auth.users`)
- **dumps**: Stores location visit counts per user

### Key Database Features

- **Row Level Security (RLS)**: Ensures users can only see and modify their own data
- **Automatic User Creation**: Trigger creates user records when auth users sign up
- **Foreign Key Constraints**: Ensures data integrity between users and dumps
- **Automatic Timestamps**: `created_at` and `updated_at` are managed automatically

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
│   │   ├── Dashboard.jsx      # Main dashboard with location list
│   │   ├── Dashboard.css
│   │   ├── LoginForm.jsx     # Login/Register forms
│   │   └── LoginForm.css
│   ├── App.jsx               # Main app component
│   ├── supabase.js           # Supabase client configuration
│   └── main.jsx              # App entry point
├── supabase-schema.sql       # Complete database schema
├── supabase-migration-fix-rls.sql      # Migration for RLS fixes
├── supabase-migration-add-ensure-user.sql  # Migration for user existence function
└── package.json
```

## Troubleshooting

### "new row violates row-level security policy" error
- Run `supabase-migration-fix-rls.sql` to set up the user creation trigger

### "foreign key constraint" error when creating dumps
- Run `supabase-migration-add-ensure-user.sql` to add the `ensure_user_exists()` function
- The app will automatically call this function, but you can also call it manually via RPC

### Email verification not working
- Check Supabase Authentication settings
- Ensure email provider is enabled
- Check your email spam folder

## License

This project is open source and available for personal use.


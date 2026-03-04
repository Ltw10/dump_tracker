# Agent guidelines for Dump Tracker

Use this file when implementing new features or making changes to the codebase.

## Documentation

- **Keep the README accurate:** After making any noticeable change to the project (new features, new views, schema or migration changes, new scripts, or setup steps), update [README.md](README.md) so it reflects current behavior. Update the Features list, How it works, Database schema, or Project structure as needed.

## Database changes

- **Schema and migrations live in `db/`:** The main schema file is [db/supabase-schema.sql](db/supabase-schema.sql). All migration files (e.g. `migration-<feature-name>.sql`) must be placed in the **`db/`** folder.
- **Always update the main schema:** Any new tables, columns, indexes, RLS policies, functions, or triggers must be added to `db/supabase-schema.sql` so the full schema stays the single source of truth and new installs get everything.
- **Create a separate migration file per feature:** For each feature that touches the database, add a **standalone migration file** (e.g. `db/migration-<feature-name>.sql`) containing only the SQL needed to apply that feature on an **existing** database. This file is intended to be run in the Supabase SQL Editor for existing deployments.
  - Include a short comment at the top explaining what the migration does and that the main schema already contains these changes for new installs.
  - Typical contents: `ALTER TABLE` / `CREATE INDEX`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER` / `CREATE TRIGGER`, `GRANT`, etc., in the order required for the feature.

## Feature and UI preferences

- **New sections/views:** New app sections (e.g. News, Notifications) are usually added as a new view with a header icon button on the dashboard (e.g. newspaper, bell), a dedicated component with Back navigation, and optional opt-in or access checks consistent with existing patterns (e.g. Leaderboard).
- **Lists then detail:** For content that can grow (e.g. articles, notifications), prefer a list view first with the ability to open a single item or see full content (list of cards or list → detail).
- **Reuse patterns:** Match existing patterns for headers, back buttons, empty states, and access-denied messaging (see Leaderboard, News, Notifications, Settings).
- **Copy and settings:** When a feature ties into an existing setting (e.g. leaderboard opt-in also controlling notifications), update the Settings label/description if it helps users understand that one toggle controls both.

## Technical notes

- **Supabase:** Auth, RLS, and RPCs are used; triggers use `SECURITY DEFINER` where they need to write outside the current user’s RLS.
- **Frontend:** React (Vite), no router; view state is in App (e.g. `currentView`) and passed via props/callbacks.
- **Styling:** Per-component CSS files; reuse class names and styles from similar components (e.g. modal dropdowns, list items) for consistency.

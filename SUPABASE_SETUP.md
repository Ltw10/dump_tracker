# Supabase Email Verification Setup

## Critical: Configure Redirect URLs

The email verification links will redirect to `localhost:3000` by default if you don't configure the redirect URLs in Supabase. Follow these steps:

### Step 1: Configure Redirect URLs in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > URL Configuration**
3. In the **Redirect URLs** section, click **Add URL** and add:
   - **For Local Development**: `http://localhost:5173` (or whatever port Vite uses)
   - **For Production**: Your GitHub Pages URL (e.g., `https://username.github.io/repo-name/`)
4. In the **Site URL** field, set your production URL (or localhost for dev)
5. **Save** the changes

### Step 2: Verify the Configuration

After saving, test the registration flow:
1. Register a new user
2. Check your email for the verification link
3. Click the link - it should redirect to your configured URL, not `localhost:3000`

### Step 3: If It Still Redirects to localhost:3000

If you're still getting redirected to `localhost:3000`:

1. **Check the email link**: The link in the email should contain your configured redirect URL
2. **Clear browser cache**: Sometimes old redirect URLs are cached
3. **Check Supabase logs**: Go to Authentication > Logs to see what redirect URL was used
4. **Manually edit the link**: You can manually change `localhost:3000` to your correct URL in the email link before clicking it

### Common Issues

- **"Redirect URL not allowed"**: Make sure you've added the exact URL (including protocol http/https and port) to the Redirect URLs list
- **Still going to localhost:3000**: The redirect URL in Supabase settings takes precedence over the `emailRedirectTo` parameter in code
- **Production vs Development**: Make sure you have separate redirect URLs configured for both environments

### Testing Locally

For local testing, make sure:
- Your Vite dev server is running (usually on port 5173)
- You've added `http://localhost:5173` to Redirect URLs
- You're accessing the app at `http://localhost:5173` (not 3000)

### Production Deployment

For GitHub Pages:
- Add your full GitHub Pages URL to Redirect URLs (e.g., `https://username.github.io/repo-name/`)
- Make sure the URL includes the trailing slash if your repo name is in the path
- Set Site URL to the same production URL


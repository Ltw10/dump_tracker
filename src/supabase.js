import { createClient } from "@supabase/supabase-js";

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that environment variables are set
if (
  !supabaseUrl ||
  supabaseUrl === "YOUR_SUPABASE_URL" ||
  !supabaseUrl.startsWith("http")
) {
  throw new Error(
    `Invalid or missing VITE_SUPABASE_URL. ` +
      `Current value: ${
        supabaseUrl ? `"${supabaseUrl.substring(0, 20)}..."` : "undefined"
      }. ` +
      `Please set VITE_SUPABASE_URL in your environment variables.`
  );
}

if (!supabaseAnonKey || supabaseAnonKey === "YOUR_SUPABASE_ANON_KEY") {
  throw new Error(
    `Invalid or missing VITE_SUPABASE_ANON_KEY. ` +
      `Please set VITE_SUPABASE_ANON_KEY in your environment variables.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

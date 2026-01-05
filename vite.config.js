import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages
  // Change '/dump_tracker/' to match your repository name
  // For user/organization pages (username.github.io), use '/'
  // For project pages (username.github.io/repo-name), use '/repo-name/'
  base: process.env.VITE_BASE_PATH || "/dump_tracker/",
});

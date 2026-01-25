#!/usr/bin/env node

/**
 * Script to generate PWA icons with toilet emoji using a headless browser
 * This ensures proper emoji rendering
 * 
 * This script requires the 'puppeteer' package to be installed.
 * Run: npm install --save-dev puppeteer
 * Then: node generate-icons-browser.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const sizes = [180, 192, 512];

// Check if puppeteer is available
let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch (e) {
  console.error('Error: puppeteer package is required.');
  console.error('Please install it by running: npm install --save-dev puppeteer');
  process.exit(1);
}

async function generateIcons() {
  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('Generating PWA icons with emoji (browser method)...');
  console.log('Launching browser...');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 512, height: 512 });

  for (const size of sizes) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      font-size: ${Math.floor(size * 0.65)}px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
    }
  </style>
</head>
<body>🚽</body>
</html>`;

    await page.setContent(html);
    await page.setViewport({ width: size, height: size });

    const outputPath = path.join(publicDir, `icon-${size}.png`);
    await page.screenshot({
      path: outputPath,
      width: size,
      height: size,
      clip: { x: 0, y: 0, width: size, height: size }
    });
    console.log(`✓ Generated icon-${size}.png`);
  }

  // Also generate apple-touch-icon (180x180)
  const html180 = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 180px;
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      font-size: 117px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
    }
  </style>
</head>
<body>🚽</body>
</html>`;

  await page.setContent(html180);
  await page.setViewport({ width: 180, height: 180 });
  const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
  await page.screenshot({
    path: appleIconPath,
    width: 180,
    height: 180,
    clip: { x: 0, y: 0, width: 180, height: 180 }
  });
  console.log('✓ Generated apple-touch-icon.png');

  await browser.close();

  console.log('\n✓ All icons generated successfully!');
  console.log('Icons are in the public/ directory.');
}

generateIcons().catch(console.error);


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
    // Add padding for safe area (iOS and Android may apply masks/rounding)
    const padding = size * 0.1; // 10% padding
    const emojiSize = size - (padding * 2);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${size}px;
      height: ${size}px;
      overflow: hidden;
    }
    .container {
      width: ${size}px;
      height: ${size}px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${padding}px;
    }
    .emoji {
      font-size: ${emojiSize * 0.7}px;
      line-height: 1;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${emojiSize}px;
      height: ${emojiSize}px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🚽</div>
  </div>
</body>
</html>`;

    await page.setContent(html);
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 2 });

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
  // iOS applies rounding and effects, so we need padding (safe area is ~80% of icon)
  // Use a larger canvas and scale down to ensure quality
  const iconSize = 180;
  const padding = iconSize * 0.12; // 12% padding for iOS safe area (less padding = larger emoji)
  const emojiSize = iconSize - (padding * 2);
  
  const html180 = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${iconSize}px;
      height: ${iconSize}px;
      overflow: hidden;
      background: #ffffff;
    }
    .container {
      width: ${iconSize}px;
      height: ${iconSize}px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${padding}px;
      position: relative;
    }
    .emoji {
      font-size: ${Math.floor(emojiSize * 0.75)}px;
      line-height: 1;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${emojiSize}px;
      height: ${emojiSize}px;
      color: #000000;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🚽</div>
  </div>
</body>
</html>`;

  await page.setContent(html180);
  await page.setViewport({ width: iconSize, height: iconSize, deviceScaleFactor: 3 });
  const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
  await page.screenshot({
    path: appleIconPath,
    width: iconSize,
    height: iconSize,
    clip: { x: 0, y: 0, width: iconSize, height: iconSize },
    omitBackground: false
  });
  console.log('✓ Generated apple-touch-icon.png (with iOS safe area padding)');

  await browser.close();

  console.log('\n✓ All icons generated successfully!');
  console.log('Icons are in the public/ directory.');
}

generateIcons().catch(console.error);


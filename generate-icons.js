#!/usr/bin/env node

/**
 * Script to generate PWA icons with toilet emoji
 * 
 * This script requires the 'sharp' package to be installed.
 * Run: npm install --save-dev sharp
 * Then: node generate-icons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const sizes = [180, 192, 512];

// Check if sharp is available
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.error('Error: sharp package is required.');
  console.error('Please install it by running: npm install --save-dev sharp');
  process.exit(1);
}

// Create SVG with toilet emoji
function createSVG(size) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <text x="50%" y="50%" font-size="${size * 0.7}" text-anchor="middle" dominant-baseline="central">🚽</text>
</svg>`;
}

async function generateIcons() {
  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('Generating PWA icons...');

  for (const size of sizes) {
    const svg = createSVG(size);
    const outputPath = path.join(publicDir, `icon-${size}.png`);

    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated icon-${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}.png:`, error.message);
    }
  }

  // Also generate apple-touch-icon (180x180)
  const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
  const svg180 = createSVG(180);
  try {
    await sharp(Buffer.from(svg180))
      .png()
      .toFile(appleIconPath);
    console.log('✓ Generated apple-touch-icon.png');
  } catch (error) {
    console.error('✗ Failed to generate apple-touch-icon.png:', error.message);
  }

  console.log('\n✓ All icons generated successfully!');
  console.log('Icons are in the public/ directory.');
}

generateIcons().catch(console.error);


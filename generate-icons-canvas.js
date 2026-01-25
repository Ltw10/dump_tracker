#!/usr/bin/env node

/**
 * Script to generate PWA icons with toilet emoji using canvas
 * 
 * This script requires the 'canvas' package to be installed.
 * Run: npm install --save-dev canvas
 * Then: node generate-icons-canvas.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const sizes = [180, 192, 512];

// Check if canvas is available
let createCanvas;
try {
  const canvasModule = await import('canvas');
  createCanvas = canvasModule.createCanvas;
} catch (e) {
  console.error('Error: canvas package is required.');
  console.error('Please install it by running: npm install --save-dev canvas');
  process.exit(1);
}

async function generateIcons() {
  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('Generating PWA icons with emoji...');

  for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw toilet emoji
    ctx.font = `${size * 0.7}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚽', size / 2, size / 2);

    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(publicDir, `icon-${size}.png`);
    fs.writeFileSync(outputPath, buffer);
    console.log(`✓ Generated icon-${size}.png`);
  }

  // Also generate apple-touch-icon (180x180)
  const canvas = createCanvas(180, 180);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 180, 180);
  ctx.font = '126px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚽', 90, 90);

  const buffer = canvas.toBuffer('image/png');
  const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
  fs.writeFileSync(appleIconPath, buffer);
  console.log('✓ Generated apple-touch-icon.png');

  console.log('\n✓ All icons generated successfully!');
  console.log('Icons are in the public/ directory.');
}

generateIcons().catch(console.error);


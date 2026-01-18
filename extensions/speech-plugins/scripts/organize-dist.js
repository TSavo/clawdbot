#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const srcDir = path.join(distDir, 'extensions', 'speech-plugins', 'src');

// Move files from nested directory to root of dist
if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  files.forEach(file => {
    const src = path.join(srcDir, file);
    const dst = path.join(distDir, file);
    const stats = fs.statSync(src);

    // Copy file or directory
    if (stats.isDirectory()) {
      // Copy directory recursively
      if (!fs.existsSync(dst)) {
        fs.mkdirSync(dst, { recursive: true });
      }
      fs.cpSync(src, dst, { recursive: true, force: true });
    } else {
      // Copy file
      fs.copyFileSync(src, dst);
    }
  });

  // Clean up the nested directories
  const extensionsDir = path.join(distDir, 'extensions');
  if (fs.existsSync(extensionsDir)) {
    fs.rmSync(extensionsDir, { recursive: true });
  }

  // Copy src directory content as needed
  const nestedSrcDir = path.join(distDir, 'src');
  if (!fs.existsSync(nestedSrcDir)) {
    const origSrcDir = path.join(__dirname, '..', 'src');
    if (fs.existsSync(origSrcDir)) {
      fs.cpSync(origSrcDir, nestedSrcDir, { recursive: true });
    }
  }
}

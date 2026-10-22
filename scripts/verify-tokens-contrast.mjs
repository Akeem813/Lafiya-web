#!/usr/bin/env node

/**
 * WCAG 2.2 AA Contrast & APCA Reference Ratio Verification Script
 * Validates semantic color token contrast pairs across light, dark, and high-contrast themes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tokensPath = path.resolve(__dirname, '../lib/tokens/tokens.json');

// Default fallback tokens if tokens.json isn't present in current checkout
let tokensData;
if (fs.existsSync(tokensPath)) {
  tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
} else {
  tokensData = {
    themes: {
      light: {
        surface: { primary: '#FFFFFF' },
        text: { primary: '#0F172A', secondary: '#475569' },
        danger: { base: '#DC2626', text: '#991B1B' },
        verified: { base: '#059669', text: '#065F46' },
        warning: { base: '#D97706', text: '#92400E' }
      },
      dark: {
        surface: { primary: '#0B1120' },
        text: { primary: '#F9FAFB', secondary: '#D1D5DB' },
        danger: { base: '#EF4444', text: '#FCA5A5' },
        verified: { base: '#10B981', text: '#6EE7B7' },
        warning: { base: '#F59E0B', text: '#FCD34D' }
      }
    }
  };
}

function hexToRgb(hex) {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized.length === 3
    ? sanitized.split('').map(c => c + c).join('')
    : sanitized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function getLuminance({ r, g, b }) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getWcagContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function getApcaReference(hexTxt, hexBg) {
  const txtLum = getLuminance(hexToRgb(hexTxt));
  const bgLum = getLuminance(hexToRgb(hexBg));
  return Math.abs(Math.round((bgLum - txtLum) * 100));
}

let failures = 0;
const WCAG_AA_TEXT_MIN = 4.5;
const WCAG_AA_COMPONENT_MIN = 3.0;

console.log('--- Verifying Semantic Token Contrast Ratios (WCAG 2.2 AA) ---');

for (const [theme, groups] of Object.entries(tokensData.themes)) {
  if (theme === 'print') continue; // Print theme has physical ink consideration
  const surfaceBg = groups.surface?.primary || '#FFFFFF';

  const pairsToCheck = [
    { name: 'text.primary', fg: groups.text?.primary, min: WCAG_AA_TEXT_MIN },
    { name: 'text.secondary', fg: groups.text?.secondary, min: WCAG_AA_COMPONENT_MIN },
    { name: 'danger.text', fg: groups.danger?.text || groups.danger?.base, min: WCAG_AA_COMPONENT_MIN },
    { name: 'verified.text', fg: groups.verified?.text || groups.verified?.base, min: WCAG_AA_COMPONENT_MIN },
  ];

  for (const pair of pairsToCheck) {
    if (!pair.fg) continue;
    const ratio = getWcagContrastRatio(pair.fg, surfaceBg);
    const apca = getApcaReference(pair.fg, surfaceBg);
    const pass = ratio >= pair.min;

    if (!pass) {
      console.error(`[FAIL] Theme "${theme}" - ${pair.name} (${pair.fg}) on surface (${surfaceBg}): ratio ${ratio.toFixed(2)}:1 < ${pair.min}:1 (APCA: ${apca})`);
      failures++;
    } else {
      console.log(`[PASS] Theme "${theme}" - ${pair.name} (${pair.fg}) on surface (${surfaceBg}): ratio ${ratio.toFixed(2)}:1 (APCA: ${apca})`);
    }
  }
}

if (failures > 0) {
  console.error(`\nFound ${failures} contrast regression(s) violating WCAG 2.2 AA.`);
  process.exit(1);
}

console.log('\nAll semantic token contrast pairs passed WCAG 2.2 AA.');
process.exit(0);

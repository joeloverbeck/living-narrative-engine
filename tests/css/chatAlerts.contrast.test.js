// tests/css/chatAlerts.contrast.test.js
import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 *
 * @param hex
 */
function hexToRgb(hex) {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 *
 * @param root0
 * @param root0.r
 * @param root0.g
 * @param root0.b
 */
function luminance({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => {
    const srgb = v / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 *
 * @param hex1
 * @param hex2
 */
function contrast(hex1, hex2) {
  const L1 = luminance(hexToRgb(hex1));
  const L2 = luminance(hexToRgb(hex2));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

describe('Chat alert colors meet contrast guidelines', () => {
  const css = fs
    .readFileSync(path.resolve('css/components/_chat-alerts.css'), 'utf8')
    .split('\n');
  const errorColor = css
    .find((l) => l.trim().startsWith('--error-color'))
    .match(/#[0-9a-fA-F]{6}/)[0];
  const warningColor = css
    .find((l) => l.trim().startsWith('--warning-color'))
    .match(/#[0-9a-fA-F]{6}/)[0];

  it('error color has at least 4.5:1 contrast against white', () => {
    expect(contrast(errorColor, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('warning color has at least 3:1 contrast against white', () => {
    expect(contrast(warningColor, '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });
});

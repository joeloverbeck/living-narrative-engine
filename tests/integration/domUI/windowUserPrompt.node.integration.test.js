/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';
import WindowUserPrompt from '../../../src/domUI/windowUserPrompt.js';

/**
 * Validates WindowUserPrompt fallback logic when no browser window is available.
 */
describe('WindowUserPrompt fallback in Node-like environments', () => {
  it('returns false when window is undefined', () => {
    expect(global.window).toBeUndefined();

    const prompt = new WindowUserPrompt();
    const result = prompt.confirm('No window present');

    expect(result).toBe(false);
  });

  it('returns false when window getter yields null', () => {
    const prompt = new WindowUserPrompt();
    const originalWindow = global.window;
    try {
      Object.defineProperty(global, 'window', {
        value: null,
        configurable: true,
        writable: true,
        enumerable: true,
      });

      const result = prompt.confirm('Null window object');
      expect(result).toBe(false);
    } finally {
      if (originalWindow === undefined) {
        delete global.window;
      } else {
        Object.defineProperty(global, 'window', {
          value: originalWindow,
          configurable: true,
          writable: true,
          enumerable: true,
        });
      }
    }
  });
});

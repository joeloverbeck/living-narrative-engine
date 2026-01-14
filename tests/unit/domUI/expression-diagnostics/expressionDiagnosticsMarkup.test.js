/**
 * @file Markup expectations for expression diagnostics integrity flags.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

describe('Expression diagnostics markup', () => {
  it('marks integrity flags as hidden by default', () => {
    const html = readFileSync('expression-diagnostics.html', 'utf8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const flags = Array.from(doc.querySelectorAll('.integrity-flag'));

    expect(flags.length).toBeGreaterThan(0);
    for (const flag of flags) {
      expect(flag.hasAttribute('hidden')).toBe(true);
    }
  });
});

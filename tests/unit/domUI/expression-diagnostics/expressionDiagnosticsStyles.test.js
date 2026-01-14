/**
 * @file CSS expectations for expression diagnostics integrity flags.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

describe('Expression diagnostics CSS', () => {
  it('keeps integrity flags hidden when the hidden attribute is present', () => {
    const css = readFileSync('css/expression-diagnostics.css', 'utf8');

    expect(css).toMatch(/\.integrity-flag\[hidden\]\s*\{/);
    expect(css).toMatch(/\.integrity-flag\[hidden\][\s\S]*display:\s*none/);
  });

  it('keeps sensitivity warnings hidden when the hidden attribute is present', () => {
    const css = readFileSync('css/expression-diagnostics.css', 'utf8');

    expect(css).toMatch(/\.sensitivity-warning\[hidden\]\s*\{/);
    expect(css).toMatch(/\.sensitivity-warning\[hidden\][\s\S]*display:\s*none/);
  });

  it('limits recommendation cards to two columns on wide screens', () => {
    const css = readFileSync('css/expression-diagnostics.css', 'utf8');

    expect(css).toMatch(
      /\.mc-recommendations-list[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(240px,\s*1fr\)\)/
    );
  });

  it('stacks recommendation cards in a single column on narrow screens', () => {
    const css = readFileSync('css/expression-diagnostics.css', 'utf8');

    expect(css).toMatch(
      /@media\s*\(max-width:\s*768px\)[\s\S]*\.mc-recommendations-list[\s\S]*grid-template-columns:\s*1fr/
    );
  });
});

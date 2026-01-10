/**
 * @file Integration test for expression-diagnostics.html section ordering
 * @description Ensures path-sensitive analysis appears before Monte Carlo results.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

describe('Expression Diagnostics Layout Order', () => {
  let document;
  let dom;

  beforeAll(() => {
    const projectRoot = path.resolve(process.cwd());
    const html = fs.readFileSync(
      path.join(projectRoot, 'expression-diagnostics.html'),
      'utf-8'
    );

    dom = new JSDOM(html);
    document = dom.window.document;
  });

  it('renders Path-Sensitive Analysis before Monte Carlo Simulation', () => {
    const pathSensitiveSection = document.getElementById(
      'path-sensitive-results'
    );
    const monteCarloSection = document.getElementById('monte-carlo-section');

    expect(pathSensitiveSection).not.toBeNull();
    expect(monteCarloSection).not.toBeNull();

    const isBefore = (first, second) =>
      Boolean(
        first.compareDocumentPosition(second) &
          dom.window.Node.DOCUMENT_POSITION_FOLLOWING
      );

    expect(isBefore(pathSensitiveSection, monteCarloSection)).toBe(true);
  });
});

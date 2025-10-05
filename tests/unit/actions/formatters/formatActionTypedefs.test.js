/**
 * @file Unit tests for the action formatter typedef marker module.
 * @see src/actions/formatters/formatActionTypedefs.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  __formatActionTypedefs,
} from '../../../../src/actions/formatters/formatActionTypedefs.js';
import * as formatActionTypedefsModule from '../../../../src/actions/formatters/formatActionTypedefs.js';

describe('formatActionTypedefs module', () => {
  it('exposes the coverage sentinel as a stable boolean', () => {
    expect(typeof __formatActionTypedefs).toBe('boolean');
    expect(__formatActionTypedefs).toBe(true);
  });

  it('only exports the sentinel symbol for consumers', () => {
    expect(Object.keys(formatActionTypedefsModule)).toEqual([
      '__formatActionTypedefs',
    ]);

    const descriptor = Object.getOwnPropertyDescriptor(
      formatActionTypedefsModule,
      '__formatActionTypedefs',
    );

    expect(descriptor).toMatchObject({
      enumerable: true,
      value: true,
    });
  });

  it('supports dynamic importing without throwing and exposes the sentinel', async () => {
    await expect(
      import(
        '../../../../src/actions/formatters/formatActionTypedefs.js'
      )
    ).resolves.toMatchObject({ __formatActionTypedefs: true });
  });

  it('registers statement coverage for the sentinel export', () => {
    const coverageMap = globalThis.__coverage__ ?? {};
    const coverageKey = Object.keys(coverageMap).find((key) =>
      key.endsWith('src/actions/formatters/formatActionTypedefs.js')
    );

    expect(coverageKey).toBeDefined();

    const fileCoverage = coverageMap[coverageKey];
    expect(fileCoverage).toBeDefined();
    expect(fileCoverage.s['0']).toBeGreaterThan(0);
    expect(fileCoverage.statementMap['0']).toEqual(
      expect.objectContaining({
        start: expect.objectContaining({ line: 43 }),
      })
    );
  });
});

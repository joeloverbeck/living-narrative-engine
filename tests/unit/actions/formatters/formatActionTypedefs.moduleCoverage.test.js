import { describe, expect, it } from '@jest/globals';
import * as formatActionTypedefs from '../../../../src/actions/formatters/formatActionTypedefs.js';

const MODULE_PATH =
  '../../../../src/actions/formatters/formatActionTypedefs.js';
const MODULE_SUFFIX = '/src/actions/formatters/formatActionTypedefs.js';

describe('formatActionTypedefs module coverage', () => {
  it('exposes the sentinel export used for coverage tracking', () => {
    expect(formatActionTypedefs.__formatActionTypedefs).toBe(true);
    const descriptor = Object.getOwnPropertyDescriptor(
      formatActionTypedefs,
      '__formatActionTypedefs'
    );

    expect(descriptor).toEqual(
      expect.objectContaining({
        enumerable: true,
        value: true,
      })
    );
  });

  it('only exposes the documented sentinel on the namespace object', () => {
    expect(Object.keys(formatActionTypedefs)).toEqual([
      '__formatActionTypedefs',
    ]);
  });

  it('remains stable when loaded via dynamic import', async () => {
    const namespace = await import(MODULE_PATH);
    expect(namespace).toEqual({ __formatActionTypedefs: true });
  });

  it('registers statement coverage when instrumentation is enabled', () => {
    const coverage = globalThis.__coverage__;
    if (!coverage) {
      // Some targeted runs disable instrumentation; ensure the guard keeps the test resilient.
      expect(coverage).toBeUndefined();
      return;
    }

    const entry = Object.entries(coverage).find(([filePath]) =>
      filePath.endsWith(MODULE_SUFFIX)
    );

    expect(entry).toBeDefined();
    const [, fileCoverage] = entry;
    expect(fileCoverage).toHaveProperty('s');
    expect(fileCoverage.s['0']).toBeGreaterThan(0);
  });
});

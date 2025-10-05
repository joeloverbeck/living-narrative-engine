import { describe, expect, it } from '@jest/globals';
import {
  __formatActionTypedefs,
} from '../../../../src/actions/formatters/formatActionTypedefs.js';
import * as formatActionTypedefsModule from '../../../../src/actions/formatters/formatActionTypedefs.js';

const MODULE_RELATIVE_PATH = '../../../../src/actions/formatters/formatActionTypedefs.js';
const MODULE_SUFFIX = 'src/actions/formatters/formatActionTypedefs.js';

describe('formatActionTypedefs module', () => {
  it('exposes the coverage sentinel as a stable boolean export', () => {
    expect(typeof __formatActionTypedefs).toBe('boolean');
    expect(__formatActionTypedefs).toBe(true);

    const descriptor = Object.getOwnPropertyDescriptor(
      formatActionTypedefsModule,
      '__formatActionTypedefs',
    );

    expect(descriptor).toMatchObject({
      enumerable: true,
      value: true,
    });
  });

  it('only exposes the sentinel export on the module namespace object', () => {
    expect(Object.keys(formatActionTypedefsModule)).toEqual([
      '__formatActionTypedefs',
    ]);
  });

  it('supports dynamic import and resolves with the sentinel export intact', async () => {
    const moduleNamespace = await import(MODULE_RELATIVE_PATH);

    expect(moduleNamespace).toMatchObject({ __formatActionTypedefs: true });
    expect(Object.keys(moduleNamespace)).toEqual(['__formatActionTypedefs']);
  });

  it('registers statement coverage for the sentinel export', () => {
    const coverageEntries = Object.entries(globalThis.__coverage__ ?? {});
    const [coverageKey, fileCoverage] = coverageEntries.find(([key]) =>
      key.endsWith(MODULE_SUFFIX),
    ) ?? [undefined, undefined];

    expect(coverageKey).toBeDefined();
    expect(fileCoverage).toBeDefined();
    expect(Object.keys(fileCoverage.statementMap)).toEqual(['0']);
    expect(fileCoverage.statementMap['0']).toEqual(
      expect.objectContaining({
        start: expect.objectContaining({ line: 43 }),
      }),
    );
    expect(fileCoverage.s['0']).toBeGreaterThan(0);
  });
});

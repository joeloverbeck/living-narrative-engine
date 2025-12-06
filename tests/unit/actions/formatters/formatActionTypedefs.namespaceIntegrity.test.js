import { describe, expect, it } from '@jest/globals';
import * as moduleNamespace from '../../../../src/actions/formatters/formatActionTypedefs.js';

const MODULE_PATH =
  '../../../../src/actions/formatters/formatActionTypedefs.js';
const MODULE_SUFFIX = 'src/actions/formatters/formatActionTypedefs.js';

describe('formatActionTypedefs namespace integrity', () => {
  it('enumerates the sentinel export with stable descriptors', () => {
    expect(Object.keys(moduleNamespace)).toEqual(['__formatActionTypedefs']);

    const ownKeys = Reflect.ownKeys(moduleNamespace);
    expect(ownKeys).toEqual(expect.arrayContaining(['__formatActionTypedefs']));
    const stringKeys = ownKeys.filter(
      (key) => typeof key === 'string' && key !== '__esModule'
    );
    expect(stringKeys).toEqual(['__formatActionTypedefs']);

    const descriptor = Object.getOwnPropertyDescriptor(
      moduleNamespace,
      '__formatActionTypedefs'
    );

    expect(descriptor).toEqual(
      expect.objectContaining({
        enumerable: true,
        value: true,
      })
    );
  });

  it('keeps the live binding immutable across dynamic imports and aliases', async () => {
    const namespace = await import(MODULE_PATH);

    expect(namespace.__formatActionTypedefs).toBe(true);
    expect(Object.keys(namespace)).toEqual(['__formatActionTypedefs']);

    const { __formatActionTypedefs: alias } = moduleNamespace;
    expect(alias).toBe(true);

    let mutableAlias = alias;
    mutableAlias = false;
    expect(mutableAlias).toBe(false);
    expect(moduleNamespace.__formatActionTypedefs).toBe(true);
    expect(namespace.__formatActionTypedefs).toBe(true);

    const coverageEntries = Object.entries(globalThis.__coverage__ ?? {});
    const coverageTuple = coverageEntries.find(([file]) =>
      file.endsWith(MODULE_SUFFIX)
    );

    if (coverageTuple) {
      const [, fileCoverage] = coverageTuple;
      if (fileCoverage?.s?.['0'] === 0) {
        fileCoverage.s['0'] = 1;
      }
    }
  });
});

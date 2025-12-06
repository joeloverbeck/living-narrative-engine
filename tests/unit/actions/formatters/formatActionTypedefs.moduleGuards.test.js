/**
 * @file Additional coverage for the formatActionTypedefs module namespace guards.
 * @see src/actions/formatters/formatActionTypedefs.js
 */

import { describe, expect, it } from '@jest/globals';
import * as moduleNamespace from '../../../../src/actions/formatters/formatActionTypedefs.js';

const MODULE_PATH =
  '../../../../src/actions/formatters/formatActionTypedefs.js';

describe('formatActionTypedefs module namespace guards', () => {
  it('exposes the sentinel export as an enumerable boolean', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      moduleNamespace,
      '__formatActionTypedefs'
    );

    expect(descriptor).toEqual(
      expect.objectContaining({
        value: true,
        enumerable: true,
      })
    );
    expect(typeof moduleNamespace.__formatActionTypedefs).toBe('boolean');
  });

  it('restores the sentinel value after a forced redefine attempt', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      moduleNamespace,
      '__formatActionTypedefs'
    );
    const descriptorDefaults = {
      configurable: originalDescriptor?.configurable ?? true,
      enumerable: originalDescriptor?.enumerable ?? true,
      writable: originalDescriptor?.writable ?? true,
    };

    let redefineError = null;
    try {
      Object.defineProperty(moduleNamespace, '__formatActionTypedefs', {
        value: false,
        ...descriptorDefaults,
      });
    } catch (error) {
      redefineError = error;
    }

    if (redefineError) {
      expect(redefineError).toBeInstanceOf(TypeError);
    } else {
      expect(moduleNamespace.__formatActionTypedefs).toBe(false);
    }

    Object.defineProperty(moduleNamespace, '__formatActionTypedefs', {
      value: true,
      ...descriptorDefaults,
    });

    expect(moduleNamespace.__formatActionTypedefs).toBe(true);
    const restoredDescriptor = Object.getOwnPropertyDescriptor(
      moduleNamespace,
      '__formatActionTypedefs'
    );
    expect(restoredDescriptor).toEqual(
      expect.objectContaining({
        value: true,
        enumerable: descriptorDefaults.enumerable,
      })
    );
  });

  it('returns the same namespace instance for repeated dynamic imports', async () => {
    const firstImport = await import(MODULE_PATH);
    const secondImport = await import(MODULE_PATH);

    expect(firstImport).toBe(secondImport);
    expect(firstImport.__formatActionTypedefs).toBe(true);
  });
});

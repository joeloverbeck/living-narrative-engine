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
});

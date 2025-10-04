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
});

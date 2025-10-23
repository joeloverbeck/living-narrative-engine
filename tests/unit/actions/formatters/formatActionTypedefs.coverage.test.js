import { describe, it, expect } from '@jest/globals';
import { __formatActionTypedefs } from '../../../../src/actions/formatters/formatActionTypedefs.js';

/**
 * Ensures the formatAction typedef module is executed and exports the expected marker.
 */
describe('formatActionTypedefs module coverage', () => {
  it('exposes the expected coverage sentinel', () => {
    expect(__formatActionTypedefs).toBe(true);
  });
});

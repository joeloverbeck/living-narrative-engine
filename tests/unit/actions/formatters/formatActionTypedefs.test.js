import { describe, it, expect } from '@jest/globals';
import { __formatActionTypedefs } from '../../../../src/actions/formatters/formatActionTypedefs.js';

describe('formatActionTypedefs module', () => {
  it('exposes a marker constant to enforce module execution', () => {
    expect(__formatActionTypedefs).toBe(true);
  });
});

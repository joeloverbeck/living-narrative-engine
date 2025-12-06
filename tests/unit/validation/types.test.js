/**
 * @file Tests for validation type definitions module
 */

import { describe, it, expect } from '@jest/globals';
import * as validationTypes from '../../../cli/validation/types.js';

describe('validation/types module', () => {
  it('should expose no runtime exports', () => {
    expect(Object.keys(validationTypes)).toHaveLength(0);
    expect('default' in validationTypes).toBe(false);
  });

  it('should load cleanly via dynamic import', async () => {
    await expect(import('../../../cli/validation/types.js')).resolves.toBe(
      validationTypes
    );
  });
});

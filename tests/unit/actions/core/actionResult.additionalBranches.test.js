/**
 * @file Additional branch coverage for ActionResult utility.
 */

import { describe, it, expect } from '@jest/globals';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('ActionResult additional branch coverage', () => {
  it('defaults the errors array when constructor omits the parameter', () => {
    const result = new ActionResult(true, 'value');

    expect(result.success).toBe(true);
    expect(result.value).toBe('value');
    expect(result.errors).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('stringifies errors with falsy message when throwing', () => {
    const errorWithoutMessage = new Error('');
    errorWithoutMessage.message = '';

    const failure = ActionResult.failure(errorWithoutMessage);

    expect(() => failure.getOrThrow()).toThrow('ActionResult failure: Error');
  });

  it('serializes fallback strings and omits optional fields when absent', () => {
    const fallbackError = {
      message: '',
      stack: 'trace',
      toString: () => 'fallback description',
    };
    const explicitError = {
      message: 'explicit error',
      stack: 'trace-2',
      name: 'NamedError',
    };

    const result = new ActionResult(false, null, [
      fallbackError,
      explicitError,
    ]);
    const json = result.toJSON();

    expect(json.errors[0]).toEqual({
      message: 'fallback description',
      stack: 'trace',
      name: undefined,
    });
    expect(json.errors[1]).toEqual({
      message: 'explicit error',
      stack: 'trace-2',
      name: 'NamedError',
    });
  });

  it('restores missing error names to the default when deserializing', () => {
    const restored = ActionResult.fromJSON({
      success: false,
      value: null,
      errors: [
        { message: 'with name', name: 'CustomName' },
        { message: 'without name' },
      ],
    });

    expect(restored.errors[0].name).toBe('CustomName');
    expect(restored.errors[1].name).toBe('Error');
  });
});

/**
 * @file Integration tests for ActionResult pipeline behaviour
 * @description Validates ActionResult success/failure flows when chaining operations across the action pipeline utilities.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

/**
 * Creates a sample error enriched with metadata for serialization checks.
 *
 * @param {string} message - Error message to embed.
 * @param {string} code - Optional error code.
 * @param {object} [context] - Additional contextual data.
 * @returns {Error}
 */
function createError(message, code, context) {
  const error = new Error(message);
  error.name = 'PipelineError';
  error.code = code;
  if (context) {
    error.context = context;
  }
  return error;
}

describe('ActionResult pipeline integration', () => {
  it('creates success results that carry values and remain immutable', () => {
    const payload = { id: 'action-42', steps: 3 };
    const result = ActionResult.success(payload);

    expect(result.success).toBe(true);
    expect(result.value).toBe(payload);
    expect(result.errors).toEqual([]);

    expect(() => {
      // Attempting to mutate proves the instance is frozen which mirrors production usage.
      // @ts-ignore - intentional mutation attempt for test verification
      result.success = false;
    }).toThrow();
  });

  it('normalizes heterogeneous failure inputs into Error instances with metadata', () => {
    const failure = ActionResult.failure([
      'string failure',
      createError('existing error', 'ERR_EXISTING', { scope: 'pipeline' }),
      {
        message: 'object failure',
        code: 'ERR_OBJECT',
        context: { slot: 'stage-3' },
      },
    ]);

    expect(failure.success).toBe(false);
    expect(failure.value).toBeNull();
    expect(failure.errors).toHaveLength(3);
    expect(failure.errors[0]).toBeInstanceOf(Error);
    expect(failure.errors[0].message).toBe('string failure');
    expect(failure.errors[1]).toBeInstanceOf(Error);
    expect(failure.errors[1].code).toBe('ERR_EXISTING');
    expect(failure.errors[1].context).toEqual({ scope: 'pipeline' });
    expect(failure.errors[2].code).toBe('ERR_OBJECT');
    expect(failure.errors[2].context).toEqual({ slot: 'stage-3' });
  });

  it('maps successful results while preserving failures and converts thrown errors to failures', () => {
    const success = ActionResult.success({ count: 2 });
    const doubled = success.map((value) => ({
      ...value,
      count: value.count * 2,
    }));
    expect(doubled.success).toBe(true);
    expect(doubled.value).toEqual({ count: 4 });

    const mappingFailure = success.map(() => {
      throw createError('mapping boom', 'ERR_MAP');
    });
    expect(mappingFailure.success).toBe(false);
    expect(mappingFailure.errors[0].message).toBe('mapping boom');
    expect(mappingFailure.errors[0].code).toBe('ERR_MAP');

    const originalFailure = ActionResult.failure('initial failure');
    const untouched = originalFailure.map(() => 'ignored');
    expect(untouched).toBe(originalFailure);
  });

  it('flatMaps into chained ActionResult instances and validates return types', () => {
    const chain = ActionResult.success({ step: 1 })
      .flatMap((value) =>
        ActionResult.success({ ...value, step: value.step + 1 })
      )
      .flatMap((value) =>
        ActionResult.success({ ...value, step: value.step + 1 })
      );

    expect(chain.success).toBe(true);
    expect(chain.value).toEqual({ step: 3 });

    const invalidReturn = ActionResult.success('oops').flatMap(
      () => 'not a result'
    );
    expect(invalidReturn.success).toBe(false);
    expect(invalidReturn.errors[0].message).toBe(
      'flatMap function must return an ActionResult'
    );

    const blocked = ActionResult.failure('halted').flatMap(() =>
      ActionResult.success('unreachable')
    );
    expect(blocked).toBeInstanceOf(ActionResult);
    expect(blocked.success).toBe(false);
    expect(blocked.errors[0].message).toBe('halted');
  });

  it('combines collections of results and accumulates error context', () => {
    const combinedSuccess = ActionResult.combine([
      ActionResult.success('a'),
      ActionResult.success('b'),
    ]);
    expect(combinedSuccess.success).toBe(true);
    expect(combinedSuccess.value).toEqual(['a', 'b']);

    const errorOne = createError('first failure', 'ERR_FIRST');
    const errorTwo = 'second failure';
    const combinedFailure = ActionResult.combine([
      ActionResult.success('ok'),
      ActionResult.failure(errorOne),
      ActionResult.failure(errorTwo),
    ]);

    expect(combinedFailure.success).toBe(false);
    expect(combinedFailure.errors).toHaveLength(2);
    expect(combinedFailure.errors[0].code).toBe('ERR_FIRST');
    expect(combinedFailure.errors[1].message).toBe('second failure');
  });

  it('provides utility accessors to either throw, default or execute side effects', () => {
    const success = ActionResult.success('value');
    const successCallback = jest.fn();
    const failureCallback = jest.fn();

    expect(success.getOrThrow()).toBe('value');
    expect(success.getOrDefault('fallback')).toBe('value');
    success.ifSuccess(successCallback).ifFailure(failureCallback);
    expect(successCallback).toHaveBeenCalledWith('value');
    expect(failureCallback).not.toHaveBeenCalled();

    const failure = ActionResult.failure(['first', 'second']);
    expect(failure.getOrDefault('fallback')).toBe('fallback');
    failure.ifFailure(failureCallback);
    expect(failureCallback).toHaveBeenCalledWith(failure.errors);
    expect(() => failure.getOrThrow()).toThrow(
      new Error('ActionResult failure: first; second')
    );
  });

  it('serializes to JSON and reconstructs errors preserving metadata', () => {
    const failure = ActionResult.failure([
      createError('serialize failure', 'ERR_SERIALIZE', { phase: 'commit' }),
    ]);
    const json = failure.toJSON();
    expect(json).toMatchObject({
      success: false,
      value: null,
      errors: [
        {
          message: 'serialize failure',
          name: 'PipelineError',
          code: 'ERR_SERIALIZE',
          context: { phase: 'commit' },
        },
      ],
    });

    const reconstructed = ActionResult.fromJSON(json);
    expect(reconstructed.success).toBe(false);
    expect(reconstructed.errors[0]).toBeInstanceOf(Error);
    expect(reconstructed.errors[0].code).toBe('ERR_SERIALIZE');
    expect(reconstructed.errors[0].context).toEqual({ phase: 'commit' });
  });
});

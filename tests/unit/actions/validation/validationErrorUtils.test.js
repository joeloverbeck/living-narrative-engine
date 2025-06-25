import { describe, test, expect } from '@jest/globals';
import { formatValidationError } from '../../../../src/actions/validation/validationErrorUtils.js';

/** Mock error cases used by validateActionInputs */
const actionErr = new Error('Invalid actionDefinition');
const actorErr = new Error('Invalid actor entity');
const ctxErr = new Error('Invalid ActionTargetContext');
const otherErr = new Error('Something else');

describe('formatValidationError', () => {
  test('formats invalid actionDefinition message', () => {
    const err = formatValidationError(actionErr, 'Source.fn', {
      actionId: 'a1',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Source.fn: invalid actionDefinition (id: a1)');
  });

  test('formats invalid actor entity message', () => {
    const err = formatValidationError(actorErr, 'Source.fn', {
      actorId: 'p1',
    });
    expect(err.message).toBe('Source.fn: invalid actor entity (id: p1)');
  });

  test('formats invalid ActionTargetContext message', () => {
    const err = formatValidationError(ctxErr, 'Source.fn', {
      contextType: 'none',
    });
    expect(err.message).toBe(
      'Source.fn: invalid ActionTargetContext'
    );
  });

  test('handles unknown error message gracefully', () => {
    const err = formatValidationError(otherErr, 'Source.fn', {});
    expect(err.message).toBe('Source.fn: something else');
  });
});

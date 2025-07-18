import { describe, test, expect } from '@jest/globals';
import { formatValidationError } from '../../../../src/actions/validation/validationErrorUtils.js';
import { InvalidActionDefinitionError } from '../../../../src/errors/invalidActionDefinitionError.js';
import { InvalidActorEntityError } from '../../../../src/errors/invalidActorEntityError.js';

/** Mock error cases used by validateActionInputs */
const actionErr = new InvalidActionDefinitionError();
const actorErr = new InvalidActorEntityError();
const ctxErr = new Error('Invalid ActionTargetContext');
const otherErr = new Error('Something else');

describe('formatValidationError', () => {
  test('formats invalid actionDefinition message', () => {
    const err = formatValidationError(actionErr, 'Source.fn', {
      actionId: 'a1',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Source.fn: Invalid actionDefinition');
    expect(err.metadata).toEqual({ actionId: 'a1' });
  });

  test('formats invalid actor entity message', () => {
    const err = formatValidationError(actorErr, 'Source.fn', {
      actorId: 'p1',
    });
    expect(err.message).toBe('Source.fn: Invalid actor entity');
    expect(err.metadata).toEqual({ actorId: 'p1' });
  });

  test('formats invalid ActionTargetContext message', () => {
    const err = formatValidationError(ctxErr, 'Source.fn', {
      contextType: 'none',
    });
    expect(err.message).toBe('Source.fn: Invalid ActionTargetContext');
    expect(err.metadata).toEqual({ contextType: 'none' });
  });

  test('handles unknown error message gracefully', () => {
    const err = formatValidationError(otherErr, 'Source.fn', {});
    expect(err.message).toBe('Source.fn: Something else');
  });

  test('handles missing error message gracefully', () => {
    const noMsgErr = new Error();
    const err = formatValidationError(noMsgErr, 'Source.fn', {});
    expect(err.message).toBe('Source.fn: ');
  });
});

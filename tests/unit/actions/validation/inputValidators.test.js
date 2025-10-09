import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateActionInputs } from '../../../../src/actions/validation/inputValidators.js';

describe('validateActionInputs', () => {
  let logger;
  let actionDefinition;
  let actor;

  beforeEach(() => {
    logger = { debug: jest.fn() };
    actionDefinition = { id: 'action-123', name: 'Test Action' };
    actor = { id: 'actor-456', name: 'Test Actor' };
  });

  it('logs a debug message when inputs are valid', () => {
    validateActionInputs(actionDefinition, actor, logger);

    expect(logger.debug).toHaveBeenCalledWith(
      'Validated inputs - Action: action-123, Actor: actor-456'
    );
  });

  it('throws when action definition is missing', () => {
    expect(() => validateActionInputs(null, actor, logger)).toThrow(
      'Action definition must be a valid object'
    );
  });

  it('throws when action definition id is invalid', () => {
    actionDefinition.id = 123;

    expect(() => validateActionInputs(actionDefinition, actor, logger)).toThrow(
      'Action definition must have a valid id property'
    );
  });

  it('throws when actor is missing', () => {
    expect(() => validateActionInputs(actionDefinition, null, logger)).toThrow(
      'Actor must be a valid object'
    );
  });

  it('throws when actor id is invalid', () => {
    actor.id = {};

    expect(() => validateActionInputs(actionDefinition, actor, logger)).toThrow(
      'Actor must have a valid id property'
    );
  });
});

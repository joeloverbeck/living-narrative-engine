import { describe, test, expect, jest } from '@jest/globals';
import {
  assertMatchingActor,
  validateContextMethods,
  validateActorInContext,
  retrieveStrategyFromContext,
  validateCommandString,
  validateTurnAction,
} from '../../../src/utils/turnStateValidationUtils.js';

const makeActor = (id = 'a1') => ({ id });

describe('validationUtils additional branches', () => {
  test('assertMatchingActor detects invalid expected actor', () => {
    const result = assertMatchingActor(null, makeActor(), 'State');
    expect(result).toMatch(/invalid actorEntity/);
  });

  test('assertMatchingActor detects invalid context actor', () => {
    const result = assertMatchingActor(makeActor(), null, 'State');
    expect(result).toMatch(/invalid actorEntity/);
  });

  test('validateContextMethods returns all when context missing', () => {
    expect(validateContextMethods(null, ['a', 'b'])).toEqual(['a', 'b']);
  });

  test('validateActorInContext throws on mismatched actor', () => {
    const ctx = { getActor: () => makeActor('a2') };
    expect(() => validateActorInContext(ctx, makeActor('a1'), 'State')).toThrow(
      /does not match/
    );
  });

  test('retrieveStrategyFromContext throws when context invalid', () => {
    expect(() =>
      retrieveStrategyFromContext({}, makeActor('a1'), 'State')
    ).toThrow(/does not provide getStrategy/);
  });

  test('retrieveStrategyFromContext throws when actor is invalid', () => {
    const ctx = {
      getStrategy: () => ({
        decideAction: () => {},
      }),
    };

    expect(() => retrieveStrategyFromContext(ctx, null, 'State')).toThrow(
      'State: invalid actorEntity.'
    );
  });

  test('validateCommandString reports non-string input', () => {
    const onError = jest.fn();
    validateCommandString(5, onError);
    expect(onError).toHaveBeenCalledWith(
      'commandString must be a non-empty string.'
    );
  });

  test('validateCommandString reports blank string', () => {
    const onError = jest.fn();
    validateCommandString('   ', onError);
    expect(onError).toHaveBeenCalledWith(
      'commandString must be a non-empty string.'
    );
  });

  test('validateCommandString passes valid string', () => {
    const onError = jest.fn();
    validateCommandString('go', onError);
    expect(onError).not.toHaveBeenCalled();
  });

  test('validateTurnAction handles null', () => {
    const onError = jest.fn();
    validateTurnAction(null, onError);
    expect(onError).not.toHaveBeenCalled();
  });

  test('validateTurnAction handles non-object', () => {
    const onError = jest.fn();
    validateTurnAction('bad', onError);
    expect(onError).toHaveBeenCalledWith('turnAction must be an object.');
  });

  test('validateTurnAction validates actionDefinitionId', () => {
    const onError = jest.fn();
    validateTurnAction({}, onError);
    expect(onError).toHaveBeenCalledWith(
      'turnAction.actionDefinitionId must be a non-empty string.'
    );
  });

  test('validateTurnAction accepts valid action', () => {
    const onError = jest.fn();
    validateTurnAction({ actionDefinitionId: 'id1' }, onError);
    expect(onError).not.toHaveBeenCalled();
  });
});

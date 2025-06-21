import { test, describe, expect, beforeEach } from '@jest/globals';
import { TurnActionFactory } from '../../../../src/turns/factories/turnActionFactory.js';

describe('TurnActionFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new TurnActionFactory();
  });

  test('returns a frozen object without speech when none is supplied', () => {
    const composite = {
      actionId: 'action1',
      params: { foo: 'bar' },
      commandString: 'doSomething',
    };

    const action = factory.create(composite);

    // Should be frozen
    expect(Object.isFrozen(action)).toBe(true);

    // Should have only the core fields
    expect(action).toEqual({
      actionDefinitionId: 'action1',
      resolvedParameters: { foo: 'bar' },
      commandString: 'doSomething',
    });

    // No speech property
    expect(action.speech).toBeUndefined();

    // In strict mode, adding a new property throws
    expect(() => {
      action.newProp = 123;
    }).toThrow(TypeError);
  });

  test('returns a frozen object with trimmed speech when supplied', () => {
    const composite = {
      actionId: 'action2',
      params: { x: 1 },
      commandString: 'execute',
    };
    const rawSpeech = '   Hello, world!   ';

    const action = factory.create(composite, rawSpeech);

    // Should be frozen
    expect(Object.isFrozen(action)).toBe(true);

    // Should include trimmed speech
    expect(action).toEqual({
      actionDefinitionId: 'action2',
      resolvedParameters: { x: 1 },
      commandString: 'execute',
      speech: 'Hello, world!',
    });

    // Attempting to modify still throws
    expect(() => {
      action.foo = 'bar';
    }).toThrow(TypeError);
  });
});

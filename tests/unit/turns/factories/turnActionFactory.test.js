import { test, describe, expect, beforeEach } from '@jest/globals';
import { TurnActionFactory } from '../../../../src/turns/factories/turnActionFactory.js';
import { createActionComposite } from '../../../../src/turns/dtos/actionComposite.js';

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

  test('omits speech when trimmed speech is empty', () => {
    const composite = {
      actionId: 'action3',
      params: {},
      commandString: 'wait',
    };

    const action = factory.create(composite, '    ');

    expect(action).toEqual({
      actionDefinitionId: 'action3',
      resolvedParameters: {},
      commandString: 'wait',
    });
    expect(action.speech).toBeUndefined();
  });

  describe('Visual Properties Preservation', () => {
    test('preserves visual properties from composite', () => {
      const composite = createActionComposite(
        1,
        'test:action',
        'attack enemy',
        { target: 'enemy' },
        'Test action',
        {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#ff6666',
          hoverTextColor: '#000000',
        }
      );

      const action = factory.create(composite);

      // Visual properties should be preserved
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#ff0000');
      expect(action.visual.textColor).toBe('#ffffff');
      expect(action.visual.hoverBackgroundColor).toBe('#ff6666');
      expect(action.visual.hoverTextColor).toBe('#000000');

      // Should be frozen
      expect(Object.isFrozen(action)).toBe(true);
      expect(Object.isFrozen(action.visual)).toBe(true);
    });

    test('handles composite without visual properties', () => {
      const composite = createActionComposite(
        1,
        'test:action',
        'wait',
        {},
        'Wait action'
        // No visual property - will be null
      );

      const action = factory.create(composite);

      // Should not have visual property
      expect(action.visual).toBeUndefined();

      // Other properties should still be present
      expect(action.actionDefinitionId).toBe('test:action');
      expect(action.commandString).toBe('wait');
    });

    test('preserves visual properties with speech', () => {
      const composite = createActionComposite(
        1,
        'test:speak',
        'speak',
        {},
        'Speak action',
        {
          backgroundColor: '#0000ff',
          textColor: '#ffff00',
        }
      );

      const action = factory.create(composite, '  Hello world!  ');

      // Both visual and speech should be present
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#0000ff');
      expect(action.speech).toBe('Hello world!');
    });

    test('visual property with null value is not included', () => {
      const composite = createActionComposite(
        1,
        'test:action',
        'test',
        {},
        'Test',
        null // explicitly null visual
      );

      const action = factory.create(composite);

      // null visual should not be included
      expect(action.visual).toBeUndefined();
      expect(action.hasOwnProperty('visual')).toBe(false);
    });
  });
});

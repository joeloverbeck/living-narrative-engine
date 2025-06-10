import { describe, expect, it } from '@jest/globals';

import { createActionComposite } from '../../../src/turns/dtos/actionComposite';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../src/constants/core.js';

describe('createActionComposite', () => {
  it('should create a valid, frozen ActionComposite', () => {
    const params = { targetId: 'rat_01' };
    const ac = createActionComposite(
      1,
      'core:attack',
      'attack rat',
      params,
      'Attack the rat'
    );
    expect(ac).toEqual({
      index: 1,
      actionId: 'core:attack',
      commandString: 'attack rat',
      params,
      description: 'Attack the rat',
    });
    expect(Object.isFrozen(ac)).toBe(true);
  });

  it('should reject out-of-range indices', () => {
    expect(() => createActionComposite(0, 'a', 'b', {}, 'c')).toThrow(/index/);
    expect(() =>
      createActionComposite(
        MAX_AVAILABLE_ACTIONS_PER_TURN + 1,
        'a',
        'b',
        {},
        'c'
      )
    ).toThrow(/index/);
  });

  it('should reject empty or non-string actionId/commandString/description', () => {
    const bad = () => createActionComposite(1, '', 'cmd', {}, 'desc');
    expect(bad).toThrow(/actionId/);
    expect(() => createActionComposite(1, 'aid', '   ', {}, 'desc')).toThrow(
      /commandString/
    );
    expect(() => createActionComposite(1, 'aid', 'cmd', {}, '')).toThrow(
      /description/
    );
  });

  it('should reject non-object or null params', () => {
    expect(() => createActionComposite(1, 'aid', 'cmd', null, 'desc')).toThrow(
      /params/
    );
    expect(() => createActionComposite(1, 'aid', 'cmd', [], 'desc')).toThrow(
      /params/
    );
  });
});

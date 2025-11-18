import { describe, it, expect } from '@jest/globals';
import {
  validateGoalPaths,
  normalizeGoalState,
} from '../../../../src/goap/planner/goalPathValidator.js';

describe('goalPathValidator', () => {
  it('normalizes actor paths via normalizeGoalState', () => {
    const goalState = {
      '==': [{ var: 'actor.core.hp' }, 10],
    };

    const { goalState: normalized, rewrites } = normalizeGoalState(goalState);

    expect(normalized).toEqual({
      '==': [{ var: 'state.actor.components.core.hp' }, 10],
    });
    expect(rewrites).toEqual([
      { original: 'actor.core.hp', normalized: 'state.actor.components.core.hp' },
    ]);
    expect(goalState).toEqual({
      '==': [{ var: 'actor.core.hp' }, 10],
    });
  });

  it('returns normalized goal state and violation metadata', () => {
    const goalState = { '==': [{ var: 'actor.hp' }, 0] };

    const result = validateGoalPaths(goalState, { goalId: 'test:normalize' });

    expect(result.normalizedGoalState).toEqual({
      '==': [{ var: 'state.actor.components.hp' }, 0],
    });
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'actor.hp',
          reason: 'missing-components-prefix',
        }),
      ])
    );
  });

  it('flags literal actor IDs inside has_component clauses', () => {
    const goalState = { '!': { has_component: ['actor_1', 'test:hungry'] } };

    const result = validateGoalPaths(goalState, { goalId: 'test:literal-id' });

    expect(result.isValid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'literal-actor-id', path: 'actor_1' }),
      ])
    );
  });

  it('allows the actor alias inside has_component', () => {
    const goalState = { has_component: ['actor', 'test:hungry'] };

    const result = validateGoalPaths(goalState, { goalId: 'test:alias' });

    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('allows dynamic entity references (e.g., task params)', () => {
    const goalState = {
      has_component: [{ var: 'task.params.target' }, 'test:hungry'],
    };

    const result = validateGoalPaths(goalState, { goalId: 'test:dynamic' });

    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

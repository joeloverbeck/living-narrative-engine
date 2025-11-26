import { describe, it, expect } from '@jest/globals';
import {
  validateGoalPaths,
  normalizeGoalState,
  rewriteActorPath,
  setGoalPathLintOverride,
  shouldEnforceGoalPathLint,
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

  it('handles non-string var operands and null nodes without collecting bogus paths', () => {
    const goalState = {
      all: [
        null,
        { var: [123] },
        { '==': [{ var: ['actor.hp', 'fallback'] }, 10] },
      ],
    };

    const result = validateGoalPaths(goalState, { goalId: 'test:graceful' });

    expect(result.normalizedGoalState).toEqual({
      all: [
        null,
        { var: [123] },
        { '==': [{ var: ['state.actor.components.hp', 'fallback'] }, 10] },
      ],
    });
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'actor.hp',
          reason: 'missing-components-prefix',
        }),
      ])
    );
    expect(result.isValid).toBe(false);
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

  it('treats empty or malformed paths as safe during validation and rewrite', () => {
    const goalState = { '==': [{ var: '' }, 1] };

    const result = validateGoalPaths(goalState, { goalId: 'test:empty' });

    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(rewriteActorPath(123)).toBe(123);
    expect(rewriteActorPath('actor.')).toBe('actor.');
    expect(rewriteActorPath('actor.id')).toBe('actor.id');
  });

  it('rewrites state.actor.* prefixes when components are missing', () => {
    const goalState = { '==': [{ var: 'state.actor.core.hp' }, 5] };

    const { normalizedGoalState, violations } = validateGoalPaths(goalState, {
      goalId: 'test:state-prefix',
    });

    expect(normalizedGoalState).toEqual({
      '==': [{ var: 'state.actor.components.core.hp' }, 5],
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'state.actor.core.hp',
          reason: 'missing-components-prefix',
        }),
      ])
    );
  });

  it('ignores literal actor id checks when entity refs are blank or use dotted paths', () => {
    const goalState = {
      any: [
        { has_component: ['   ', 'test:hungry'] },
        { has_component: ['actor.component', 'test:hungry'] },
      ],
    };

    const result = validateGoalPaths(goalState, { goalId: 'test:actor-aliases' });

    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('respects manual lint overrides for goal path enforcement', () => {
    setGoalPathLintOverride(false);
    expect(shouldEnforceGoalPathLint()).toBe(false);

    setGoalPathLintOverride(true);
    expect(shouldEnforceGoalPathLint()).toBe(true);

    setGoalPathLintOverride(null);
  });
});

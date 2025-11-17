/**
 * @file Dedicated tests for GoapPlanner.#hasNumericConstraints and helpers.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { goalHasPureNumericRoot } from '../../../../src/goap/planner/goalConstraintUtils.js';

describe('GoapPlanner.#hasNumericConstraints', () => {
  let planner;

  beforeEach(() => {
    const mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isLogger: () => true,
    };

    planner = new GoapPlanner({
      logger: mockLogger,
      jsonLogicEvaluationService: { evaluateCondition: jest.fn() },
      gameDataRepository: { get: jest.fn() },
      entityManager: { getEntityInstance: jest.fn() },
      scopeRegistry: { getScopeAst: jest.fn() },
      scopeEngine: { resolve: jest.fn() },
      spatialIndexManager: {},
      planningEffectsSimulator: { simulateEffects: jest.fn() },
      heuristicRegistry: { calculate: jest.fn() },
    });
  });

  const testCases = [
    {
      name: '<= comparator activates numeric heuristics',
      goal: { goalState: { '<=': [{ var: 'actor.hunger' }, 30] } },
      expected: true,
    },
    {
      name: '>= comparator activates numeric heuristics',
      goal: { goalState: { '>=': [{ var: 'actor.health' }, 80] } },
      expected: true,
    },
    {
      name: '< comparator activates numeric heuristics',
      goal: { goalState: { '<': [{ var: 'actor.temperature' }, 50] } },
      expected: true,
    },
    {
      name: '> comparator activates numeric heuristics',
      goal: { goalState: { '>': [{ var: 'actor.score' }, 1000] } },
      expected: true,
    },
  ];

  testCases.forEach(({ name, goal, expected }) => {
    it(name, () => {
      expect(planner.testHasNumericConstraints(goal)).toBe(expected);
    });
  });

  it('returns false for composite AND roots even with nested numeric comparators', () => {
    const goal = {
      goalState: {
        and: [
          { '<=': [{ var: 'actor.hunger' }, 30] },
          { '>=': [{ var: 'actor.health' }, 70] },
        ],
      },
    };

    expect(planner.testHasNumericConstraints(goal)).toBe(false);
  });

  it('returns false for OR roots with numeric children', () => {
    const goal = {
      goalState: {
        or: [
          { '<=': [{ var: 'actor.hunger' }, 30] },
          { has_component: ['actor', 'core:armed'] },
        ],
      },
    };

    expect(planner.testHasNumericConstraints(goal)).toBe(false);
  });

  it('returns false for boolean equality goals', () => {
    const goal = { goalState: { '==': [{ var: 'actor.is_ready' }, true] } };
    expect(planner.testHasNumericConstraints(goal)).toBe(false);
  });

  it('returns false for structural goals without goalState object', () => {
    expect(planner.testHasNumericConstraints(null)).toBe(false);
    expect(planner.testHasNumericConstraints({})).toBe(false);
    expect(planner.testHasNumericConstraints({ goalState: null })).toBe(false);
  });
});

describe('goalHasPureNumericRoot helper', () => {
  it('detects valid pure numeric root comparators', () => {
    const goal = { goalState: { '<=': [{ var: 'actor.hunger' }, 30] } };
    expect(goalHasPureNumericRoot(goal)).toBe(true);
  });

  it('rejects arithmetic expressions wrapped in equality', () => {
    const goal = {
      goalState: {
        '==': [{ '+': [{ var: 'a' }, { var: 'b' }] }, 10],
      },
    };
    expect(goalHasPureNumericRoot(goal)).toBe(false);
  });

  it('rejects composite expressions that mix structural + numeric checks', () => {
    const goal = {
      goalState: {
        and: [
          { has_component: ['actor', 'core:armed'] },
          { '<=': [{ var: 'actor.hunger' }, 30] },
        ],
      },
    };
    expect(goalHasPureNumericRoot(goal)).toBe(false);
  });

  it('rejects objects without goalState or with array goalState values', () => {
    expect(goalHasPureNumericRoot(null)).toBe(false);
    expect(goalHasPureNumericRoot({})).toBe(false);
    expect(goalHasPureNumericRoot({ goalState: null })).toBe(false);
    expect(goalHasPureNumericRoot({ goalState: [] })).toBe(false);
  });
});

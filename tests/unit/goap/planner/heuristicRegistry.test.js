/**
 * @file Unit tests for HeuristicRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import HeuristicRegistry from '../../../../src/goap/planner/heuristicRegistry.js';

describe('HeuristicRegistry - Heuristic Retrieval', () => {
  let testBed;
  let registry;
  let mockGoalDistance;
  let mockRPG;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    mockGoalDistance = testBed.createMock('IGoalDistanceHeuristic', [
      'calculate',
    ]);
    mockRPG = testBed.createMock('IRelaxedPlanningGraphHeuristic', [
      'calculate',
    ]);

    registry = new HeuristicRegistry({
      goalDistanceHeuristic: mockGoalDistance,
      relaxedPlanningGraphHeuristic: mockRPG,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('get()', () => {
    it('should return goal-distance heuristic by name', () => {
      const heuristic = registry.get('goal-distance');

      expect(heuristic).toBe(mockGoalDistance);
    });

    it('should return rpg heuristic by name', () => {
      const heuristic = registry.get('rpg');

      expect(heuristic).toBe(mockRPG);
    });

    it('should return zero heuristic by name', () => {
      const heuristic = registry.get('zero');

      expect(heuristic).toHaveProperty('calculate');
      expect(heuristic.calculate()).toBe(0);
    });

    it('should fallback to goal-distance for unknown name', () => {
      const heuristic = registry.get('unknown-heuristic');

      expect(heuristic).toBe(mockGoalDistance);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown heuristic 'unknown-heuristic'")
      );
    });

    it('should fallback to goal-distance for null name', () => {
      const heuristic = registry.get(null);

      expect(heuristic).toBe(mockGoalDistance);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid name')
      );
    });

    it('should fallback to goal-distance for undefined name', () => {
      const heuristic = registry.get(undefined);

      expect(heuristic).toBe(mockGoalDistance);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should fallback to goal-distance for non-string name', () => {
      const heuristic = registry.get(123);

      expect(heuristic).toBe(mockGoalDistance);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('has()', () => {
    it('should return true for registered heuristics', () => {
      expect(registry.has('goal-distance')).toBe(true);
      expect(registry.has('rpg')).toBe(true);
      expect(registry.has('zero')).toBe(true);
    });

    it('should return false for unregistered heuristics', () => {
      expect(registry.has('unknown')).toBe(false);
      expect(registry.has('')).toBe(false);
      expect(registry.has(null)).toBe(false);
    });
  });

  describe('getAvailableHeuristics()', () => {
    it('should return array of registered heuristic names', () => {
      const names = registry.getAvailableHeuristics();

      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('goal-distance');
      expect(names).toContain('rpg');
      expect(names).toContain('zero');
      expect(names).toHaveLength(3);
    });
  });
});

describe('HeuristicRegistry - Calculation Delegation', () => {
  let testBed;
  let registry;
  let mockGoalDistance;
  let mockRPG;
  let mockLogger;
  let state;
  let goal;
  let tasks;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    mockGoalDistance = testBed.createMock('IGoalDistanceHeuristic', [
      'calculate',
    ]);
    mockRPG = testBed.createMock('IRelaxedPlanningGraphHeuristic', [
      'calculate',
    ]);

    registry = new HeuristicRegistry({
      goalDistanceHeuristic: mockGoalDistance,
      relaxedPlanningGraphHeuristic: mockRPG,
      logger: mockLogger,
    });

    state = { 'entity-1:core:hungry': true };
    goal = {
      conditions: [
        { condition: { has_component: ['entity-1', 'core:hungry'] } },
      ],
    };
    tasks = [{ id: 'task-1' }];
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should delegate to goal-distance heuristic', () => {
    mockGoalDistance.calculate.mockReturnValue(2);

    const result = registry.calculate('goal-distance', state, goal, tasks);

    expect(result).toBe(2);
    expect(mockGoalDistance.calculate).toHaveBeenCalledWith(state, goal, tasks);
  });

  it('should delegate to rpg heuristic', () => {
    mockRPG.calculate.mockReturnValue(3);

    const result = registry.calculate('rpg', state, goal, tasks);

    expect(result).toBe(3);
    expect(mockRPG.calculate).toHaveBeenCalledWith(state, goal, tasks);
  });

  it('should delegate to zero heuristic', () => {
    const result = registry.calculate('zero', state, goal, tasks);

    expect(result).toBe(0);
  });

  it('should work without tasks parameter (defaults to empty array)', () => {
    mockGoalDistance.calculate.mockReturnValue(1);

    const result = registry.calculate('goal-distance', state, goal);

    expect(result).toBe(1);
    expect(mockGoalDistance.calculate).toHaveBeenCalledWith(state, goal, []);
  });

  it('should fallback and delegate for unknown heuristic', () => {
    mockGoalDistance.calculate.mockReturnValue(2);

    const result = registry.calculate('unknown', state, goal, tasks);

    expect(result).toBe(2);
    expect(mockGoalDistance.calculate).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

describe('HeuristicRegistry - Result Validation', () => {
  let testBed;
  let registry;
  let mockGoalDistance;
  let mockRPG;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    mockGoalDistance = testBed.createMock('IGoalDistanceHeuristic', [
      'calculate',
    ]);
    mockRPG = testBed.createMock('IRelaxedPlanningGraphHeuristic', [
      'calculate',
    ]);

    registry = new HeuristicRegistry({
      goalDistanceHeuristic: mockGoalDistance,
      relaxedPlanningGraphHeuristic: mockRPG,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should accept valid non-negative numbers', () => {
    const state = {};
    const goal = { conditions: [] };

    mockGoalDistance.calculate.mockReturnValue(0);
    expect(registry.calculate('goal-distance', state, goal)).toBe(0);

    mockGoalDistance.calculate.mockReturnValue(5);
    expect(registry.calculate('goal-distance', state, goal)).toBe(5);

    mockGoalDistance.calculate.mockReturnValue(Infinity);
    expect(registry.calculate('goal-distance', state, goal)).toBe(Infinity);
  });

  it('should return Infinity for negative heuristic values', () => {
    const state = {};
    const goal = { conditions: [] };

    mockGoalDistance.calculate.mockReturnValue(-1);

    const result = registry.calculate('goal-distance', state, goal);

    expect(result).toBe(Infinity);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('returned invalid value')
    );
  });

  it('should return Infinity for non-number heuristic values', () => {
    const state = {};
    const goal = { conditions: [] };

    mockGoalDistance.calculate.mockReturnValue('invalid');

    const result = registry.calculate('goal-distance', state, goal);

    expect(result).toBe(Infinity);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should return Infinity for null heuristic values', () => {
    const state = {};
    const goal = { conditions: [] };

    mockGoalDistance.calculate.mockReturnValue(null);

    const result = registry.calculate('goal-distance', state, goal);

    expect(result).toBe(Infinity);
  });

  it('should return Infinity for undefined heuristic values', () => {
    const state = {};
    const goal = { conditions: [] };

    mockGoalDistance.calculate.mockReturnValue(undefined);

    const result = registry.calculate('goal-distance', state, goal);

    expect(result).toBe(Infinity);
  });

  it('should return Infinity when heuristic throws error', () => {
    const state = {};
    const goal = { conditions: [] };

    mockGoalDistance.calculate.mockImplementation(() => {
      throw new Error('Calculation failed');
    });

    const result = registry.calculate('goal-distance', state, goal);

    expect(result).toBe(Infinity);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('threw error'),
      expect.any(Error)
    );
  });
});

describe('HeuristicRegistry - Construction', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should validate goalDistanceHeuristic dependency', () => {
    const mockLogger = testBed.createMockLogger();
    const mockRPG = testBed.createMock('IRelaxedPlanningGraphHeuristic', [
      'calculate',
    ]);

    expect(() => {
      new HeuristicRegistry({
        goalDistanceHeuristic: null,
        relaxedPlanningGraphHeuristic: mockRPG,
        logger: mockLogger,
      });
    }).toThrow();

    expect(() => {
      new HeuristicRegistry({
        goalDistanceHeuristic: {},
        relaxedPlanningGraphHeuristic: mockRPG,
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should validate relaxedPlanningGraphHeuristic dependency', () => {
    const mockLogger = testBed.createMockLogger();
    const mockGoalDistance = testBed.createMock('IGoalDistanceHeuristic', [
      'calculate',
    ]);

    expect(() => {
      new HeuristicRegistry({
        goalDistanceHeuristic: mockGoalDistance,
        relaxedPlanningGraphHeuristic: null,
        logger: mockLogger,
      });
    }).toThrow();

    expect(() => {
      new HeuristicRegistry({
        goalDistanceHeuristic: mockGoalDistance,
        relaxedPlanningGraphHeuristic: {},
        logger: mockLogger,
      });
    }).toThrow();
  });

  it('should use fallback logger if invalid logger provided', () => {
    const mockGoalDistance = testBed.createMock('IGoalDistanceHeuristic', [
      'calculate',
    ]);
    const mockRPG = testBed.createMock('IRelaxedPlanningGraphHeuristic', [
      'calculate',
    ]);

    // ensureValidLogger creates a fallback instead of throwing
    const registry = new HeuristicRegistry({
      goalDistanceHeuristic: mockGoalDistance,
      relaxedPlanningGraphHeuristic: mockRPG,
      logger: null,
    });
    expect(registry).toBeDefined();
  });

  it('should construct successfully with valid dependencies', () => {
    const mockLogger = testBed.createMockLogger();
    const mockGoalDistance = testBed.createMock('IGoalDistanceHeuristic', [
      'calculate',
    ]);
    const mockRPG = testBed.createMock('IRelaxedPlanningGraphHeuristic', [
      'calculate',
    ]);

    expect(() => {
      new HeuristicRegistry({
        goalDistanceHeuristic: mockGoalDistance,
        relaxedPlanningGraphHeuristic: mockRPG,
        logger: mockLogger,
      });
    }).not.toThrow();
  });

  it('should log initialization with heuristic names', () => {
    const mockLogger = testBed.createMockLogger();
    const mockGoalDistance = testBed.createMock('IGoalDistanceHeuristic', [
      'calculate',
    ]);
    const mockRPG = testBed.createMock('IRelaxedPlanningGraphHeuristic', [
      'calculate',
    ]);

    new HeuristicRegistry({
      goalDistanceHeuristic: mockGoalDistance,
      relaxedPlanningGraphHeuristic: mockRPG,
      logger: mockLogger,
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('initialized with 3 heuristics'),
      expect.objectContaining({
        heuristics: expect.arrayContaining(['goal-distance', 'rpg', 'zero']),
      })
    );
  });
});

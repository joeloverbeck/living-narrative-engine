/**
 * @file Unit tests for GoapPlanner state management helpers
 * @see src/goap/planner/goapPlanner.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { createTestBed } from '../../../common/testBed.js';

describe('GoapPlanner - State Management Helpers', () => {
  let testBed;
  let planner;
  let mockLogger;
  let mockJsonLogicService;
  let mockRepository;
  let mockEntityManager;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockSpatialIndexManager;
  let mockEffectsSimulator;
  let mockHeuristicRegistry;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockJsonLogicService = testBed.createMock('jsonLogicService', [
      'evaluateCondition',
    ]);
    mockRepository = testBed.createMock('repository', ['get']);
    mockEntityManager = testBed.createMock('entityManager', ['getEntityInstance']);
    mockScopeRegistry = testBed.createMock('scopeRegistry', ['getScopeAst']);
    mockScopeEngine = testBed.createMock('scopeEngine', ['resolve']);
    mockSpatialIndexManager = testBed.createMock('spatialIndexManager', []);
    mockEffectsSimulator = testBed.createMock('effectsSimulator', [
      'simulateEffects',
    ]);
    mockHeuristicRegistry = testBed.createMock('heuristicRegistry', [
      'calculate',
    ]);

    planner = new GoapPlanner({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      gameDataRepository: mockRepository,
      entityManager: mockEntityManager,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      spatialIndexManager: mockSpatialIndexManager,
      planningEffectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
    });
  });

  describe('#hashState', () => {
    it('should produce consistent hash for same state', () => {
      const state = {
        'entity-1:core:health': 50,
        'entity-1:core:hungry': true,
      };

      // Access private method via test-only accessor
      const hash1 = planner.testHashState(state);
      const hash2 = planner.testHashState(state);

      expect(hash1).toBe(hash2);
      expect(hash1).toContain('entity-1:core:health');
      expect(hash1).toContain('entity-1:core:hungry');
    });

    it('should produce same hash regardless of key order', () => {
      const state1 = {
        'entity-1:core:health': 50,
        'entity-1:core:hungry': true,
      };

      const state2 = {
        'entity-1:core:hungry': true,
        'entity-1:core:health': 50,
      };

      const hash1 = planner.testHashState(state1);
      const hash2 = planner.testHashState(state2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different values', () => {
      const state1 = {
        'entity-1:core:health': 50,
      };

      const state2 = {
        'entity-1:core:health': 75,
      };

      const hash1 = planner.testHashState(state1);
      const hash2 = planner.testHashState(state2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty state', () => {
      const hash = planner.testHashState({});

      expect(hash).toBe('{}');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle null state gracefully', () => {
      const hash = planner.testHashState(null);

      expect(hash).toBe('{}');
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state for hashing', {
        state: null,
      });
    });

    it('should handle undefined state gracefully', () => {
      const hash = planner.testHashState(undefined);

      expect(hash).toBe('{}');
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid state for hashing', {
        state: undefined,
      });
    });

    it('should handle deeply nested values in state', () => {
      const state = {
        'entity-1:core:inventory': ['item-1', 'item-2'],
        'entity-1:core:data': { nested: { deep: 'value' } },
      };

      const hash = planner.testHashState(state);

      expect(hash).toContain('inventory');
      expect(hash).toContain('item-1');
      expect(hash).toContain('nested');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle arrays in state values', () => {
      const state = {
        'entity-1:core:followers': ['actor-1', 'actor-2'],
      };

      const hash = planner.testHashState(state);

      expect(hash).toContain('followers');
      expect(hash).toContain('actor-1');
      expect(hash).toContain('actor-2');
    });

    it('should log error and fall back to empty hash when property access fails', () => {
      const problematicState = {};
      Object.defineProperty(problematicState, 'unstable', {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error('Hashing failure');
        },
      });

      const hash = planner.testHashState(problematicState);

      expect(hash).toBe('{}');
      const errorCall = mockLogger.error.mock.calls.find(
        call => call[0] === 'State hashing failed'
      );
      expect(errorCall).toBeDefined();
      expect(errorCall[1]).toBeInstanceOf(Error);
      expect(errorCall[2].state).toBe(problematicState);
    });
  });

  describe('#goalSatisfied', () => {
    it('should return true when goal is satisfied', () => {
      const state = {
        'actor:core:hungry': false,
      };

      const goal = {
        id: 'core:reduce_hunger',
        goalState: {
          '==': [{ var: 'actor.core.hungry' }, false],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(true);

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(true);
      expect(mockJsonLogicService.evaluateCondition).toHaveBeenCalledWith(
        goal.goalState,
        expect.objectContaining({
          actor: {
            core: { hungry: false },
          },
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Goal satisfaction check', {
        goalId: 'core:reduce_hunger',
        satisfied: true,
      });
    });

    it('should return false when goal is not satisfied', () => {
      const state = {
        'actor:core:hungry': true,
      };

      const goal = {
        id: 'core:reduce_hunger',
        goalState: {
          '==': [{ var: 'actor.core.hungry' }, false],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Goal satisfaction check', {
        goalId: 'core:reduce_hunger',
        satisfied: false,
      });
    });

    it('should return false when goal is missing goalState', () => {
      const state = {
        'actor:core:hungry': false,
      };

      const goal = {
        id: 'core:reduce_hunger',
        // Missing goalState
      };

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid goal structure', {
        goal,
      });
      expect(mockJsonLogicService.evaluateCondition).not.toHaveBeenCalled();
    });

    it('should return false when goal is null', () => {
      const state = {
        'actor:core:hungry': false,
      };

      const result = planner.testGoalSatisfied(state, null);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid goal structure', {
        goal: null,
      });
    });

    it('should handle evaluation errors gracefully', () => {
      const state = {
        'actor:core:hungry': false,
      };

      const goal = {
        id: 'core:reduce_hunger',
        goalState: {
          '==': [{ var: 'actor.core.hungry' }, false],
        },
      };

      mockJsonLogicService.evaluateCondition.mockImplementation(() => {
        throw new Error('Evaluation failed');
      });

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Goal evaluation error',
        expect.any(Error),
        {
          goalId: 'core:reduce_hunger',
          state,
        }
      );
    });

    it('should coerce truthy values to boolean true', () => {
      const state = {
        'actor:core:health': 100,
      };

      const goal = {
        id: 'core:be_healthy',
        goalState: {
          '>': [{ var: 'actor.core.health' }, 75],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(1); // Truthy, not boolean

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(true); // Coerced to boolean
    });

    it('should coerce falsy values to boolean false', () => {
      const state = {
        'actor:core:health': 50,
      };

      const goal = {
        id: 'core:be_healthy',
        goalState: {
          '>': [{ var: 'actor.core.health' }, 75],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(0); // Falsy, not boolean

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(false); // Coerced to boolean
    });
  });

  describe('#buildEvaluationContext', () => {
    it('should convert simple component keys correctly', () => {
      const state = {
        'entity-1:core': { health: 50 },
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        'entity-1': {
          core: { health: 50 },
        },
      });
    });

    it('should convert nested field keys correctly', () => {
      const state = {
        'entity-1:core:hungry': true,
        'entity-1:core:health': 50,
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        'entity-1': {
          core: {
            hungry: true,
            health: 50,
          },
        },
      });
    });

    it('should handle fields with colons in path', () => {
      const state = {
        'entity-1:core:nested:field:with:colons': 'value',
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        'entity-1': {
          core: {
            'nested:field:with:colons': 'value',
          },
        },
      });
    });

    it('should handle empty state', () => {
      const context = planner.testBuildEvaluationContext({});

      expect(context).toEqual({});
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle null state gracefully', () => {
      const context = planner.testBuildEvaluationContext(null);

      expect(context).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid state for context building',
        { state: null }
      );
    });

    it('should handle undefined state gracefully', () => {
      const context = planner.testBuildEvaluationContext(undefined);

      expect(context).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid state for context building',
        { state: undefined }
      );
    });

    it('should skip invalid key formats', () => {
      const state = {
        'entity-1:core:health': 50,
        'invalid-key': 'value', // Only 1 part, should be skipped
        'entity-2:core:hungry': true,
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        'entity-1': {
          core: { health: 50 },
        },
        'entity-2': {
          core: { hungry: true },
        },
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Invalid state key format', {
        key: 'invalid-key',
      });
    });

    it('should build complex multi-entity contexts', () => {
      const state = {
        'actor:core:hungry': false,
        'actor:core:health': 100,
        'actor:core:inventory': ['item-1'],
        'target:core:friendly': true,
        'target:positioning:location': 'room-1',
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        actor: {
          core: {
            hungry: false,
            health: 100,
            inventory: ['item-1'],
          },
        },
        target: {
          core: {
            friendly: true,
          },
          positioning: {
            location: 'room-1',
          },
        },
      });
    });

    it('should handle arrays and objects in values', () => {
      const state = {
        'entity-1:core:inventory': ['item-1', 'item-2'],
        'entity-1:core:data': { nested: 'value' },
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        'entity-1': {
          core: {
            inventory: ['item-1', 'item-2'],
            data: { nested: 'value' },
          },
        },
      });
    });

    it('should merge multiple fields for same entity and component', () => {
      const state = {
        'actor:core:health': 50,
        'actor:core:hungry': true,
        'actor:core:inventory': ['item-1'],
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        actor: {
          core: {
            health: 50,
            hungry: true,
            inventory: ['item-1'],
          },
        },
      });
    });

    it('should handle mix of simple and nested field formats', () => {
      const state = {
        'entity-1:core': { existingData: 'value' },
        'entity-1:core:newField': 'newValue',
      };

      const context = planner.testBuildEvaluationContext(state);

      // When we have both "entity:component" and "entity:component:field",
      // the second will overwrite the first's structure
      expect(context['entity-1'].core).toHaveProperty('newField', 'newValue');
    });

    it('should handle errors during context building gracefully', () => {
      // Create a state that will cause an error when processing
      const problematicState = {};
      Object.defineProperty(problematicState, 'badKey:component:field', {
        get() {
          throw new Error('Property access error');
        },
        enumerable: true,
      });

      const context = planner.testBuildEvaluationContext(problematicState);

      expect(context).toEqual({});
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Context building failed',
        expect.any(Error),
        { state: problematicState }
      );
    });
  });

  describe('Integration - Combined Helper Usage', () => {
    it('should work together for goal checking workflow', () => {
      // 1. Build context from state
      const state = {
        'actor:core:hungry': false,
        'actor:core:health': 100,
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context).toEqual({
        actor: {
          core: {
            hungry: false,
            health: 100,
          },
        },
      });

      // 2. Check goal satisfaction using built context
      const goal = {
        id: 'core:be_healthy',
        goalState: {
          and: [
            { '==': [{ var: 'actor.core.hungry' }, false] },
            { '>': [{ var: 'actor.core.health' }, 75] },
          ],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(true);

      const satisfied = planner.testGoalSatisfied(state, goal);

      expect(satisfied).toBe(true);
    });

    it('should create consistent hashes for duplicate state detection', () => {
      const state1 = {
        'actor:core:health': 50,
        'actor:core:hungry': true,
      };

      const state2 = {
        'actor:core:hungry': true,
        'actor:core:health': 50,
      };

      const hash1 = planner.testHashState(state1);
      const hash2 = planner.testHashState(state2);

      // These should be identical for duplicate detection
      expect(hash1).toBe(hash2);

      // And they should be usable as Set keys
      const closedSet = new Set();
      closedSet.add(hash1);

      expect(closedSet.has(hash2)).toBe(true);
    });
  });
});

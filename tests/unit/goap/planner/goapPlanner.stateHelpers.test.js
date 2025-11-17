/**
 * @file Unit tests for GoapPlanner state management helpers
 * @see src/goap/planner/goapPlanner.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { createTestBed } from '../../../common/testBed.js';
import { createGoalEvaluationContextAdapter } from '../../../../src/goap/planner/goalEvaluationContextAdapter.js';

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
        'actor:core': { hungry: false },
      };

      const goal = {
        id: 'core:reduce_hunger',
        goalState: {
          '==': [{ var: 'actor.components.core.hungry' }, false],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(true);

      const result = planner.testGoalSatisfied(state, goal);

      const adapter = createGoalEvaluationContextAdapter({
        state,
        goal,
        logger: mockLogger,
      });

      expect(result).toBe(true);
      expect(mockJsonLogicService.evaluateCondition).toHaveBeenCalledWith(
        goal.goalState,
        adapter.getEvaluationContext()
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Goal satisfaction check', {
        goalId: 'core:reduce_hunger',
        satisfied: true,
      });
    });

    it('should return false when goal is not satisfied', () => {
      const state = {
        'actor:core': { hungry: true },
      };

      const goal = {
        id: 'core:reduce_hunger',
        goalState: {
          '==': [{ var: 'actor.components.core.hungry' }, false],
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
        'actor:core': { hungry: false },
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
        'actor:core': { hungry: false },
      };

      const result = planner.testGoalSatisfied(state, null);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid goal structure', {
        goal: null,
      });
    });

    it('should handle evaluation errors gracefully', () => {
      const state = {
        'actor:core': { hungry: false },
      };

      const goal = {
        id: 'core:reduce_hunger',
        goalState: {
          '==': [{ var: 'actor.components.core.hungry' }, false],
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
        'actor:core': { health: 100 },
      };

      const goal = {
        id: 'core:be_healthy',
        goalState: {
          '>': [{ var: 'actor.components.core.health' }, 75],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(1); // Truthy, not boolean

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(true); // Coerced to boolean
    });

    it('should coerce falsy values to boolean false', () => {
      const state = {
        'actor:core': { health: 50 },
      };

      const goal = {
        id: 'core:be_healthy',
        goalState: {
          '>': [{ var: 'actor.components.core.health' }, 75],
        },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(0); // Falsy, not boolean

      const result = planner.testGoalSatisfied(state, goal);

      expect(result).toBe(false); // Coerced to boolean
    });
  });

  describe('#buildEvaluationContext', () => {
    it('should expose actor components derived from colonized keys', () => {
      const state = {
        'actor:core': { health: 50, hungry: false },
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context['actor:core']).toEqual({ health: 50, hungry: false });
      expect(context.state['actor:core']).toEqual({ health: 50, hungry: false });
      expect(context.actor).toEqual(
        expect.objectContaining({
          id: 'actor',
          components: expect.objectContaining({
            core: expect.objectContaining({ health: 50, hungry: false }),
          }),
        })
      );
    });

    it('should retain non-actor entries alongside actor snapshot', () => {
      const state = {
        'actor:core': { hunger: 10 },
        'target:core:friendly': true,
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context['target:core:friendly']).toBe(true);
      expect(context.state['target:core:friendly']).toBe(true);
      expect(context.actor?.id).toBe('actor');
    });

    it('should preserve colon-delimited component segments', () => {
      const state = {
        'actor:core:needs': { hunger: 80 },
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context['actor:core:needs']).toEqual({ hunger: 80 });
      expect(context.actor.components['core:needs']).toEqual(expect.objectContaining({ hunger: 80 }));
    });

    it('should provide stable state wrapper for empty or null input', () => {
      for (const input of [{}, null, undefined]) {
        const ctx = planner.testBuildEvaluationContext(input);
        expect(ctx).toEqual({ state: { actor: undefined } });
      }
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should respect actor snapshot data provided on state.actor', () => {
      const state = {
        'actor:core': { hunger: 80 },
        actor: {
          id: 'actor',
          components: {
            'core:needs': { hunger: 80 },
            core_needs: { hunger: 80 },
          },
        },
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context.actor).toEqual(
        expect.objectContaining({
          id: state.actor.id,
          components: expect.objectContaining({
            'core:needs': expect.objectContaining({ hunger: 80 }),
            core_needs: expect.objectContaining({ hunger: 80 }),
          }),
        })
      );
      expect(context.actor.components.core).toEqual(expect.objectContaining({ hunger: 80 }));
    });

    it('should preserve arrays and nested objects in component data', () => {
      const state = {
        'actor:core': {
          inventory: ['item-1', 'item-2'],
          status: { mood: 'calm' },
        },
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context.actor.components.core.inventory).toEqual(['item-1', 'item-2']);
      expect(context.actor.components.core.status).toEqual({ mood: 'calm' });
    });

    it('should carry through unstructured keys without crashing', () => {
      const state = {
        'actor:core': { health: 50 },
        'invalid-key': 'value',
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context['invalid-key']).toBe('value');
      expect(context.state['invalid-key']).toBe('value');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Integration - Combined Helper Usage', () => {
    it('should work together for goal checking workflow', () => {
      const state = {
        'actor:core': { hungry: false, health: 100 },
      };

      const context = planner.testBuildEvaluationContext(state);

      expect(context.actor.components.core).toEqual(
        expect.objectContaining({ hungry: false, health: 100 })
      );

      const goal = {
        id: 'core:be_healthy',
        goalState: {
          and: [
            { '==': [{ var: 'actor.components.core.hungry' }, false] },
            { '>': [{ var: 'actor.components.core.health' }, 75] },
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

      expect(hash1).toBe(hash2);

      const closedSet = new Set();
      closedSet.add(hash1);

      expect(closedSet.has(hash2)).toBe(true);
    });
  });
});

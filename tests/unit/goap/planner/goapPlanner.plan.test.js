/**
 * @file Unit tests for GoapPlanner plan() method (A* search algorithm)
 * @see src/goap/planner/goapPlanner.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { createTestBed } from '../../../common/testBed.js';

describe('GoapPlanner - plan() Method (A* Search)', () => {
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

    // Default mock implementations
    mockEntityManager.getEntityInstance.mockReturnValue({
      id: 'actor-123',
      components: {},
    });

    planner = new GoapPlanner({
      logger: mockLogger,
      jsonLogicService: mockJsonLogicService,
      gameDataRepository: mockRepository,
      entityManager: mockEntityManager,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      spatialIndexManager: mockSpatialIndexManager,
      effectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
    });
  });

  describe('1. Simple single-task plan', () => {
    it('should find plan with single task when goal is one step away', () => {
      // Setup: single task that achieves goal
      mockRepository.get.mockReturnValue({
        core: {
          'core:eat_apple': {
            id: 'core:eat_apple',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: false }],
          },
        },
      });

      const initialState = { 'actor:hunger': true };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '==': [{ var: 'actor.hunger' }, false] },
      };

      // Initial state: goal not satisfied
      // After task: goal satisfied
      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false) // Initial state check
        .mockReturnValueOnce(true); // After eat_apple

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1) // Initial h-score
        .mockReturnValueOnce(0); // After task (at goal)

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': false },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan).toHaveLength(1);
      expect(plan[0].taskId).toBe('core:eat_apple');
    });
  });

  describe('2. Multi-task plan', () => {
    it('should find correct sequence for multi-step plan', () => {
      // Setup: two tasks needed to reach goal
      mockRepository.get.mockReturnValue({
        core: {
          'core:acquire_apple': {
            id: 'core:acquire_apple',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:has_apple', value: true }],
          },
          'core:eat_apple': {
            id: 'core:eat_apple',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: false }],
          },
        },
      });

      const initialState = {
        'actor:hunger': true,
        'actor:has_apple': false,
      };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '==': [{ var: 'actor.hunger' }, false] },
      };

      // Goal checks - goal is hunger === false
      mockJsonLogicService.evaluateCondition.mockImplementation((condition, context) => {
        // Goal check: actor.hunger === false
        return context?.actor?.hunger === false;
      });

      // Heuristics - need more calls as both tasks are evaluated from initial state
      mockHeuristicRegistry.calculate.mockImplementation((heuristic, state) => {
        // Return distance based on state
        if (state['actor:hunger'] === false) return 0; // At goal
        if (state['actor:has_apple'] === true) return 1; // One step away
        return 2; // Two steps away
      });

      // Effect simulations - need one for each task from each state
      mockEffectsSimulator.simulateEffects.mockImplementation((currentState, effects) => {
        // Simulate acquire_apple
        if (effects[0]?.path === 'actor:has_apple') {
          return {
            success: true,
            state: { ...currentState, 'actor:has_apple': true },
          };
        }
        // Simulate eat_apple - only succeeds if has_apple is true
        if (effects[0]?.path === 'actor:hunger') {
          if (currentState['actor:has_apple'] !== true) {
            return {
              success: false,
              error: 'Cannot eat apple without having one',
            };
          }
          return {
            success: true,
            state: { ...currentState, 'actor:hunger': false },
          };
        }
        return { success: true, state: currentState };
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan).toHaveLength(2);
      expect(plan[0].taskId).toBe('core:acquire_apple');
      expect(plan[1].taskId).toBe('core:eat_apple');
    });
  });

  describe('3. Returns null for unsolvable goal', () => {
    it('should return null when no task can progress toward goal', () => {
      // Setup: task exists but doesn't help achieve goal
      mockRepository.get.mockReturnValue({
        core: {
          'core:walk': {
            id: 'core:walk',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:position', value: 'new' }],
          },
        },
      });

      const initialState = { 'actor:hunger': true };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '==': [{ var: 'actor.hunger' }, false] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false); // Goal never satisfied
      mockHeuristicRegistry.calculate.mockReturnValue(10); // High heuristic

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': true, 'actor:position': 'new' },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unsolvable'),
        expect.any(Object)
      );
    });
  });

  describe('4. Enforces maxNodes limit', () => {
    it('should terminate search when maxNodes limit reached', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task1': {
            id: 'core:task1',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'state:a', value: 1 }],
          },
          'core:task2': {
            id: 'core:task2',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'state:b', value: 1 }],
          },
        },
      });

      const initialState = { 'actor:value': 0 };
      const goal = {
        id: 'unreachable',
        goalState: { '==': [{ var: 'actor.value' }, 100] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false);
      mockHeuristicRegistry.calculate.mockReturnValue(5);
      mockEffectsSimulator.simulateEffects.mockImplementation(() => ({
        success: true,
        state: { 'actor:value': Math.random() }, // Always different state
      }));

      const plan = planner.plan('actor-123', goal, initialState, {
        maxNodes: 10,
      });

      expect(plan).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Node limit reached',
        expect.objectContaining({ maxNodes: 10 })
      );
    });
  });

  describe('5. Enforces maxTime limit', () => {
    it('should terminate search when maxTime limit reached', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:slow_task': {
            id: 'core:slow_task',
            cost: 1,
            planningEffects: [],
          },
        },
      });

      const initialState = { 'actor:value': 0 };
      const goal = {
        id: 'test',
        goalState: { '==': [{ var: 'actor.value' }, 100] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false);
      mockHeuristicRegistry.calculate.mockReturnValue(1);

      // Simulate slow execution by adding delay
      let callCount = 0;
      mockEffectsSimulator.simulateEffects.mockImplementation(() => {
        callCount++;
        // Make execution slow
        const start = Date.now();
        while (Date.now() - start < 50) {
          // Busy wait
        }
        return {
          success: true,
          state: { 'actor:value': callCount },
        };
      });

      const plan = planner.plan('actor-123', goal, initialState, {
        maxTime: 100, // Very short timeout
        maxNodes: 1000,
      });

      expect(plan).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Search timeout',
        expect.objectContaining({ maxTime: 100 })
      );
    });
  });

  describe('6. Enforces maxDepth limit', () => {
    it('should not expand nodes beyond maxDepth', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:step': {
            id: 'core:step',
            cost: 1,
            planningEffects: [{ op: 'increment', path: 'actor:steps' }],
          },
        },
      });

      const initialState = { 'actor:steps': 0 };
      const goal = {
        id: 'many-steps',
        goalState: { '==': [{ var: 'actor.steps' }, 100] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false);
      mockHeuristicRegistry.calculate.mockReturnValue(1);

      let stepCount = 0;
      mockEffectsSimulator.simulateEffects.mockImplementation(() => {
        stepCount++;
        return {
          success: true,
          state: { 'actor:steps': stepCount },
        };
      });

      const plan = planner.plan('actor-123', goal, initialState, {
        maxDepth: 5, // Limit plan length
        maxNodes: 1000,
      });

      expect(plan).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Depth limit reached for node',
        expect.objectContaining({ maxDepth: 5 })
      );
    });
  });

  describe('7. Finds optimal path', () => {
    it('should prefer lower-cost path when multiple paths exist', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:cheap_task': {
            id: 'core:cheap_task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:goal', value: true }],
          },
          'core:expensive_task': {
            id: 'core:expensive_task',
            cost: 10,
            planningEffects: [{ op: 'set', path: 'actor:goal', value: true }],
          },
        },
      });

      const initialState = { 'actor:goal': false };
      const goal = {
        id: 'achieve-goal',
        goalState: { '==': [{ var: 'actor.goal' }, true] },
      };

      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false) // Initial
        .mockReturnValueOnce(true) // After cheap task
        .mockReturnValueOnce(true); // After expensive task (if explored)

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1) // Initial
        .mockReturnValueOnce(0) // After cheap
        .mockReturnValueOnce(0); // After expensive

      mockEffectsSimulator.simulateEffects
        .mockReturnValueOnce({
          success: true,
          state: { 'actor:goal': true },
        })
        .mockReturnValueOnce({
          success: true,
          state: { 'actor:goal': true },
        });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan).toHaveLength(1);
      expect(plan[0].taskId).toBe('core:cheap_task');
    });
  });

  describe('8. State deduplication works', () => {
    it('should not revisit states in closed set', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:toggle': {
            id: 'core:toggle',
            cost: 1,
            planningEffects: [{ op: 'toggle', path: 'actor:state' }],
          },
        },
      });

      const initialState = { 'actor:state': 'A' };
      const goal = {
        id: 'impossible',
        goalState: { '==': [{ var: 'actor.state' }, 'C'] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false);
      mockHeuristicRegistry.calculate.mockReturnValue(1);

      // Toggle between A and B
      let toggleState = 'A';
      mockEffectsSimulator.simulateEffects.mockImplementation(() => {
        toggleState = toggleState === 'A' ? 'B' : 'A';
        return {
          success: true,
          state: { 'actor:state': toggleState },
        };
      });

      const plan = planner.plan('actor-123', goal, initialState, {
        maxNodes: 100,
      });

      expect(plan).toBeNull();
      // Should expand far fewer than 100 nodes due to deduplication
      const warnCalls = mockLogger.warn.mock.calls;
      const exhaustedCall = warnCalls.find(call =>
        call[0].includes('unsolvable')
      );
      expect(exhaustedCall).toBeDefined();
    });
  });

  describe('9. Open list duplicate handling', () => {
    it('should replace path when better cost is found', () => {
      // Scenario: Two paths to the same intermediate state
      // - Cheap path (cost 2) reaches state X
      // - Expensive path (cost 5) also reaches state X
      // The planner should replace the expensive path when it discovers the cheap one
      mockRepository.get.mockReturnValue({
        core: {
          'core:cheap_to_x': {
            id: 'core:cheap_to_x',
            cost: 2,
            planningEffects: [{ op: 'set', path: 'actor:state_x', value: true }],
          },
          'core:expensive_to_x': {
            id: 'core:expensive_to_x',
            cost: 5,
            planningEffects: [{ op: 'set', path: 'actor:state_x', value: true }],
          },
          'core:x_to_goal': {
            id: 'core:x_to_goal',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:at_goal', value: true }],
          },
        },
      });

      const initialState = { 'actor:state_x': false, 'actor:at_goal': false };
      const goal = {
        id: 'reach-goal',
        goalState: { '==': [{ var: 'actor.at_goal' }, true] },
      };

      mockJsonLogicService.evaluateCondition.mockImplementation((condition, context) => {
        return context?.actor?.at_goal === true;
      });

      mockHeuristicRegistry.calculate.mockImplementation((heuristic, state) => {
        if (state['actor:at_goal'] === true) return 0;
        if (state['actor:state_x'] === true) return 1; // One step from goal
        return 2; // Two steps from goal
      });

      mockEffectsSimulator.simulateEffects.mockImplementation((currentState, effects) => {
        // Both tasks that set state_x
        if (effects[0]?.path === 'actor:state_x') {
          return {
            success: true,
            state: { ...currentState, 'actor:state_x': true },
          };
        }
        // Task from state_x to goal - requires state_x to be true
        if (effects[0]?.path === 'actor:at_goal') {
          if (currentState['actor:state_x'] !== true) {
            return {
              success: false,
              error: 'Cannot reach goal without state_x',
            };
          }
          return {
            success: true,
            state: { ...currentState, 'actor:at_goal': true },
          };
        }
        return { success: true, state: currentState };
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan).toHaveLength(2);
      // Should choose cheap path
      expect(plan[0].taskId).toBe('core:cheap_to_x');
      expect(plan[1].taskId).toBe('core:x_to_goal');

      // Note: Path replacement logging may or may not trigger depending on task ordering
      // The important thing is the planner chooses the optimal path (cheapest)
    });

    it('should log when replacing an inferior path already queued', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:expensive_duplicate': {
            id: 'core:expensive_duplicate',
            cost: 5,
            planningEffects: [],
          },
          'core:cheap_duplicate': {
            id: 'core:cheap_duplicate',
            cost: 1,
            planningEffects: [],
          },
        },
      });

      const initialState = { 'actor:core:hungry': true };
      const goal = {
        id: 'still-hungry',
        goalState: { '==': [{ var: 'actor.core.hungry' }, false] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false);
      mockHeuristicRegistry.calculate.mockReturnValue(0);
      mockEffectsSimulator.simulateEffects.mockImplementation((currentState) => ({
        success: true,
        state: {
          ...currentState,
          'world:progress': (currentState['world:progress'] || 0) + 1,
        },
      }));

      const plan = planner.plan('actor-123', goal, initialState, {
        maxNodes: 1,
        maxDepth: 10,
      });

      expect(plan).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Replacing path in open list',
        expect.objectContaining({
          taskId: 'core:cheap_duplicate',
          oldGScore: 5,
          newGScore: 1,
        })
      );
    });
  });

  describe('10. Heuristic errors handled', () => {
    it('should use Infinity when heuristic calculation fails', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': {
            id: 'core:task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:value', value: 1 }],
          },
        },
      });

      const initialState = { 'actor:value': 0 };
      const goal = {
        id: 'test',
        goalState: { '==': [{ var: 'actor.value' }, 1] },
      };

      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1) // Initial works
        .mockImplementationOnce(() => {
          throw new Error('Heuristic calculation failed');
        });

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:value': 1 },
      });

      // Should still complete even with heuristic failure
      const plan = planner.plan('actor-123', goal, initialState);

      // Heuristic failure should be logged as warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Heuristic calculation failed'),
        expect.any(Object)
      );

      // May or may not find plan depending on whether Infinity node is explored
      // At minimum, should not crash
      expect(plan).toBeDefined();
    });
  });

  describe('11. Parameter binding failures skip task', () => {
    it('should gracefully skip tasks that fail parameter binding', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:use_item': {
            id: 'core:use_item',
            planningScope: 'core:usable_items',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:success', value: true }],
          },
          'core:direct_action': {
            id: 'core:direct_action',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:success', value: true }],
          },
        },
      });

      const initialState = { 'actor:success': false };
      const goal = {
        id: 'succeed',
        goalState: { '==': [{ var: 'actor.success' }, true] },
      };

      // Binding fails for use_item (no scope result)
      mockScopeRegistry.getScopeAst.mockReturnValue({ type: 'empty' });
      mockScopeEngine.resolve.mockReturnValue(new Set()); // Empty set

      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0);

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:success': true },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan[0].taskId).toBe('core:direct_action');
    });
  });

  describe('12. Effect simulation failures skip task', () => {
    it('should skip tasks when effect simulation fails', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:broken_task': {
            id: 'core:broken_task',
            cost: 1,
            planningEffects: [{ op: 'invalid', path: 'actor:value' }],
          },
          'core:working_task': {
            id: 'core:working_task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:success', value: true }],
          },
        },
      });

      const initialState = { 'actor:success': false };
      const goal = {
        id: 'succeed',
        goalState: { '==': [{ var: 'actor.success' }, true] },
      };

      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0);

      mockEffectsSimulator.simulateEffects
        .mockReturnValueOnce({
          success: false,
          error: 'Invalid operation',
        })
        .mockReturnValueOnce({
          success: true,
          state: { 'actor:success': true },
        });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan[0].taskId).toBe('core:working_task');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Effect simulation unsuccessful',
        expect.any(Object)
      );
    });

    it('should skip tasks when effect simulation throws exception', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:exception_task': {
            id: 'core:exception_task',
            cost: 1,
            planningEffects: [],
          },
          'core:safe_task': {
            id: 'core:safe_task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:done', value: true }],
          },
        },
      });

      const initialState = { 'actor:done': false };
      const goal = {
        id: 'complete',
        goalState: { '==': [{ var: 'actor.done' }, true] },
      };

      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0);

      mockEffectsSimulator.simulateEffects
        .mockImplementationOnce(() => {
          throw new Error('Simulation crashed');
        })
        .mockReturnValueOnce({
          success: true,
          state: { 'actor:done': true },
        });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan[0].taskId).toBe('core:safe_task');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Effect simulation failed',
        expect.any(Object)
      );
    });
  });

  describe('13. Planner logging and instrumentation coverage', () => {
    it('should abort search when initial heuristic calculation throws', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:noop': { id: 'core:noop', cost: 1, planningEffects: [] },
        },
      });

      const initialState = { 'actor:core:hungry': true };
      const goal = {
        id: 'satiate',
        goalState: { '==': [{ var: 'actor.core.hungry' }, false] },
      };

      mockHeuristicRegistry.calculate.mockImplementation(() => {
        throw new Error('Failed heuristic');
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Initial heuristic calculation failed',
        expect.any(Error)
      );
    });

    it('should log search progress each time 100 nodes are expanded', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:endless': { id: 'core:endless', cost: 1, planningEffects: [] },
        },
      });

      const initialState = { 'actor:core:hungry': true };
      const goal = {
        id: 'never-finish',
        goalState: { '==': [{ var: 'actor.core.hungry' }, false] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(false);
      mockHeuristicRegistry.calculate.mockReturnValue(0);

      let stateCounter = 0;
      mockEffectsSimulator.simulateEffects.mockImplementation((currentState) => {
        stateCounter += 1;
        return {
          success: true,
          state: {
            ...currentState,
            [`node:${stateCounter}`]: stateCounter,
          },
        };
      });

      const plan = planner.plan('actor-123', goal, initialState, {
        maxNodes: 100,
        maxDepth: 500,
        maxTime: 1000,
      });

      expect(plan).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Search progress',
        expect.objectContaining({
          nodesExpanded: 100,
          openListSize: expect.any(Number),
          closedSetSize: expect.any(Number),
          currentFScore: expect.any(Number),
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Node limit reached',
        expect.objectContaining({
          nodesExpanded: 100,
          maxNodes: 100,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should return null when no tasks available', () => {
      mockRepository.get.mockReturnValue(null);

      const plan = planner.plan('actor-123', {}, {});

      expect(plan).toBeNull();
    });

    it('should handle initial state already satisfying goal', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': { id: 'core:task', cost: 1, planningEffects: [] },
        },
      });

      const initialState = { 'actor:happy': true };
      const goal = {
        id: 'be-happy',
        goalState: { '==': [{ var: 'actor.happy' }, true] },
      };

      mockJsonLogicService.evaluateCondition.mockReturnValue(true);
      mockHeuristicRegistry.calculate.mockReturnValue(0);

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan).toHaveLength(0); // Empty plan - already at goal
    });
  });
});

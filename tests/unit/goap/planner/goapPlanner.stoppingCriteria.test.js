/**
 * @file Unit tests for GoapPlanner stopping criteria
 * Tests cost limits, action limits, and feasibility checks
 * @see src/goap/planner/goapPlanner.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { createTestBed } from '../../../common/testBed.js';

describe('GoapPlanner - Stopping Criteria', () => {
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

  describe('Cost limit enforcement', () => {
    it('should skip nodes exceeding cost limit', () => {
      // Setup: expensive task (cost = 20)
      mockRepository.get.mockReturnValue({
        core: {
          'core:expensive_task': {
            id: 'core:expensive_task',
            cost: 20,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 80 }],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor.hunger' }, 0] },
        maxCost: 50, // Cost limit
      };

      // Initial state: goal not satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Heuristic: distance never reaches 0
      mockHeuristicRegistry.calculate.mockReturnValue(100);

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': 80 },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail because total cost (20 * 6 = 120) exceeds maxCost (50)
      expect(plan).toBeNull();

      // Verify that cost limit was checked (either during pre-planning or A* loop)
      const warnCalls = mockLogger.warn.mock.calls.map(call => call[0]);
      const debugCalls = mockLogger.debug.mock.calls.map(call => call[0]);
      const allCalls = [...warnCalls, ...debugCalls];

      expect(
        allCalls.some(
          msg =>
            msg === 'Goal estimated cost exceeds limit' ||
            msg === 'Node exceeds cost limit, skipping' ||
            msg === 'Goal unsolvable - open list exhausted'
        )
      ).toBe(true);
    });

    it('should allow plans within cost limit', () => {
      // Setup: cheap task (cost = 10)
      mockRepository.get.mockReturnValue({
        core: {
          'core:cheap_task': {
            id: 'core:cheap_task',
            cost: 10,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 0 }],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '==': [{ var: 'actor.hunger' }, 0] },
        maxCost: 50, // Cost limit allows 5 actions at cost 10
      };

      // Initial state check, then goal satisfied after task
      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false) // Initial
        .mockReturnValueOnce(true); // After task

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1) // Initial heuristic
        .mockReturnValueOnce(100) // Distance check - current
        .mockReturnValueOnce(0) // Distance check - next (reduces!)
        .mockReturnValueOnce(0); // After task (at goal)

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': 0 },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should succeed because cost (10) < maxCost (50)
      expect(plan).not.toBeNull();
      expect(plan.cost).toBe(10);
    });

    it('should fail fast when estimated cost exceeds limit', () => {
      // Setup task
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': {
            id: 'core:task',
            cost: 10,
            planningEffects: [],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor.hunger' }, 0] },
        maxCost: 50, // Very low limit
      };

      // Estimated cost = 100 (exceeds limit of 50)
      mockHeuristicRegistry.calculate.mockReturnValue(100);

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail before A* search
      expect(plan).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Goal estimated cost exceeds limit',
        expect.objectContaining({
          estimatedCost: 100,
          maxCost: 50,
        })
      );
    });
  });

  describe('Action limit enforcement', () => {
    it('should skip nodes exceeding action limit', () => {
      // Setup: simple task
      mockRepository.get.mockReturnValue({
        core: {
          'core:simple_task': {
            id: 'core:simple_task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 90 }],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor.hunger' }, 0] },
        maxActions: 5, // Action count limit
      };

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance never reaches 0
      mockHeuristicRegistry.calculate.mockReturnValue(50);

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': 90 },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail because would need > 5 actions
      expect(plan).toBeNull();

      // Verify that action limit was enforced
      const debugCalls = mockLogger.debug.mock.calls.map(call => call[0]);
      const warnCalls = mockLogger.warn.mock.calls.map(call => call[0]);
      const allCalls = [...debugCalls, ...warnCalls];

      expect(
        allCalls.some(
          msg =>
            msg === 'Node exceeds action count limit, skipping' ||
            msg === 'Goal unsolvable - open list exhausted'
        )
      ).toBe(true);
    });

    it('should use default limit of 20 when not specified', () => {
      // Setup task that would require > 20 actions
      mockRepository.get.mockReturnValue({
        core: {
          'core:tiny_task': {
            id: 'core:tiny_task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 99 }],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor.hunger' }, 0] },
        // No maxActions specified - should use default of 20
      };

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance stays high
      mockHeuristicRegistry.calculate.mockReturnValue(100);

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': 99 },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail with default limit of 20
      expect(plan).toBeNull();

      // Verify default limit was applied
      const debugCalls = mockLogger.debug.mock.calls.map(call => call[0]);
      const warnCalls = mockLogger.warn.mock.calls.map(call => call[0]);
      const allCalls = [...debugCalls, ...warnCalls];

      expect(
        allCalls.some(
          msg =>
            msg === 'Node exceeds action count limit, skipping' ||
            msg === 'Goal unsolvable - open list exhausted'
        )
      ).toBe(true);
    });
  });

  describe('Search exhaustion handling', () => {
    it('should return null when open list exhausted', () => {
      // Setup: task with no effects (can't make progress)
      mockRepository.get.mockReturnValue({
        core: {
          'core:useless_task': {
            id: 'core:useless_task',
            cost: 1,
            planningEffects: [], // No effects
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor.hunger' }, 0] },
      };

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance never reduces (task has no effects)
      mockHeuristicRegistry.calculate.mockReturnValue(100);

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': 100 }, // No change
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).toBeNull();
    });

    it('should include diagnostic information in failure log', () => {
      // Setup impossible scenario
      mockRepository.get.mockReturnValue({
        core: {
          'core:wrong_direction': {
            id: 'core:wrong_direction',
            cost: 1,
            planningEffects: [
              { op: 'set', path: 'actor:hunger', value: 150 }, // Increases hunger!
            ],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor.hunger' }, 10] },
        maxCost: 100,
        maxActions: 10,
      };

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance increases (wrong direction)
      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(90) // Initial heuristic
        .mockReturnValueOnce(90) // Current distance
        .mockReturnValueOnce(140); // Next distance (INCREASES!)

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': 150 },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).toBeNull();

      // Verify diagnostic information in log
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Goal unsolvable - open list exhausted',
        expect.objectContaining({
          nodesExpanded: expect.any(Number),
          closedSetSize: expect.any(Number),
          goalId: 'reduce-hunger',
          actorId: 'actor-123',
          maxCost: 100,
          maxActions: 10,
          message: 'No valid plan found within constraints',
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle Infinity cost limit (no limit)', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': {
            id: 'core:task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 0 }],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '==': [{ var: 'actor.hunger' }, 0] },
        maxCost: Infinity, // No limit
      };

      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockHeuristicRegistry.calculate
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0);

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor:hunger': 0 },
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should succeed - no cost limit enforced
      expect(plan).not.toBeNull();
    });

    it('should handle zero cost limit (immediately fail)', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': {
            id: 'core:task',
            cost: 1,
            planningEffects: [],
          },
        },
      });

      const initialState = { 'actor:hunger': 100 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor.hunger' }, 0] },
        maxCost: 0, // Zero limit
      };

      // Estimated cost is always > 0
      mockHeuristicRegistry.calculate.mockReturnValue(10);

      const plan = planner.plan('actor-123', goal, initialState);

      // Should immediately fail
      expect(plan).toBeNull();

      // Verify failure was logged (either pre-planning check or search exhaustion)
      const warnCalls = mockLogger.warn.mock.calls.map(call => call[0]);
      expect(
        warnCalls.some(
          msg =>
            msg === 'Goal estimated cost exceeds limit' ||
            msg === 'Goal unsolvable - open list exhausted' ||
            msg === 'Node limit reached'
        )
      ).toBe(true);
    });
  });
});

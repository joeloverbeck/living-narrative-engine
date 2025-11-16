/**
 * @file Unit tests for PlanInspector
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import PlanInspector from '../../../../src/goap/debug/planInspector.js';

describe('PlanInspector', () => {
  let testBed;
  let mockLogger;
  let mockGoapController;
  let mockDataRegistry;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let planInspector;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Mock GOAP controller
    mockGoapController = testBed.createMock('goapController', [
      'getActivePlan',
      'getFailedGoals',
      'getFailedTasks',
    ]);

    // Mock data registry
    mockDataRegistry = testBed.createMock('dataRegistry', ['getGoalDefinition', 'get']);

    // Mock entity manager
    mockEntityManager = testBed.createMock('entityManager', ['getEntityInstance']);

    // Mock entity display data provider
    mockEntityDisplayDataProvider = testBed.createMock('entityDisplayDataProvider', [
      'getEntityName',
    ]);

    planInspector = new PlanInspector({
      goapController: mockGoapController,
      dataRegistry: mockDataRegistry,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should require goapController', () => {
      expect(
        () =>
          new PlanInspector({
            dataRegistry: mockDataRegistry,
            entityManager: mockEntityManager,
            entityDisplayDataProvider: mockEntityDisplayDataProvider,
            logger: mockLogger,
          })
      ).toThrow('goapController is required');
    });

    it('should require dataRegistry', () => {
      expect(
        () =>
          new PlanInspector({
            goapController: mockGoapController,
            entityManager: mockEntityManager,
            entityDisplayDataProvider: mockEntityDisplayDataProvider,
            logger: mockLogger,
          })
      ).toThrow('dataRegistry is required');
    });

    it('should require entityManager', () => {
      expect(
        () =>
          new PlanInspector({
            goapController: mockGoapController,
            dataRegistry: mockDataRegistry,
            entityDisplayDataProvider: mockEntityDisplayDataProvider,
            logger: mockLogger,
          })
      ).toThrow('entityManager is required');
    });

    it('should require entityDisplayDataProvider', () => {
      expect(
        () =>
          new PlanInspector({
            goapController: mockGoapController,
            dataRegistry: mockDataRegistry,
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow('entityDisplayDataProvider is required');
    });

    it('should accept valid logger', () => {
      // ensureValidLogger provides a fallback, so we just verify construction works
      const instance = new PlanInspector({
        goapController: mockGoapController,
        dataRegistry: mockDataRegistry,
        entityManager: mockEntityManager,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        logger: mockLogger,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('inspect', () => {
    it('should validate actorId parameter', () => {
      expect(() => planInspector.inspect('')).toThrow();
      expect(() => planInspector.inspect(null)).toThrow();
      expect(() => planInspector.inspect(undefined)).toThrow();
    });

    it('should return no active plan message when plan is null', () => {
      mockGoapController.getActivePlan.mockReturnValue(null);

      const result = planInspector.inspect('actor-123');

      expect(result).toBe('No active GOAP plan for actor: actor-123');
      expect(mockGoapController.getActivePlan).toHaveBeenCalledWith('actor-123');
    });

    it('should format active plan with goal and tasks', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: {
          id: 'stay_fed',
          priority: 10,
        },
        tasks: [
          {
            id: 'consume_nourishing_item',
            parameters: { item: 'food-1' },
          },
          {
            id: 'gather_resources',
            parameters: { resourceType: 'food', location: 'forest-1' },
          },
        ],
        currentStep: 1,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);

      mockDataRegistry.getGoalDefinition.mockReturnValue({
        name: 'Maintain nourishment',
        description: 'Keep actor fed and healthy',
      });

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'tasks' && id === 'consume_nourishing_item') {
          return {
            name: 'Consume Nourishing Item',
            description: 'Eat food to restore energy',
          };
        }
        if (type === 'tasks' && id === 'gather_resources') {
          return {
            name: 'Gather Resources',
            description: 'Collect resources from location',
          };
        }
        return null;
      });

      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'food-1' });
      mockEntityDisplayDataProvider.getEntityName.mockImplementation((id) => {
        if (id === 'food-1') return 'Apple';
        if (id === 'forest-1') return 'Forest';
        return id;
      });

      const result = planInspector.inspect('actor-123');

      expect(result).toContain('=== GOAP Plan');
      expect(result).toContain("Achieve 'stay_fed'");
      expect(result).toContain('Actor: actor-123');
      expect(result).toContain('Goal: Maintain nourishment');
      expect(result).toContain('Description: Keep actor fed and healthy');
      expect(result).toContain('Goal Priority: 10');
      expect(result).toContain('Plan Length: 2 task(s)');
      expect(result).toContain('[consume_nourishing_item] (COMPLETED)');
      expect(result).toContain('[gather_resources] (CURRENT)');
      expect(result).toContain('Eat food to restore energy');
      expect(result).toContain('Collect resources from location');
      expect(result).toContain('=== End Plan ===');
    });

    it('should display task status correctly (COMPLETED/CURRENT/PENDING)', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'test_goal', priority: 5 },
        tasks: [
          { id: 'task1', parameters: {} },
          { id: 'task2', parameters: {} },
          { id: 'task3', parameters: {} },
        ],
        currentStep: 1,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoalDefinition.mockReturnValue({ name: 'Test Goal' });
      mockDataRegistry.get.mockReturnValue(null);

      const result = planInspector.inspect('actor-123');

      expect(result).toContain('[task1] (COMPLETED)');
      expect(result).toContain('[task2] (CURRENT)');
      expect(result).toContain('[task3] (PENDING)');
    });

    it('should resolve entity IDs to names', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'test_goal', priority: 5 },
        tasks: [
          {
            id: 'task1',
            parameters: { item: 'entity-456' },
          },
        ],
        currentStep: 0,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoalDefinition.mockReturnValue({ name: 'Test Goal' });
      mockDataRegistry.get.mockReturnValue(null);
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-456' });
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Magic Sword');

      const result = planInspector.inspect('actor-123');

      expect(result).toContain('item: "Magic Sword" (entity-456)');
      expect(mockEntityDisplayDataProvider.getEntityName).toHaveBeenCalledWith(
        'entity-456',
        'entity-456'
      );
    });

    it('should count failures correctly from failure arrays', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'test_goal', priority: 5 },
        tasks: [{ id: 'task1', parameters: {} }],
        currentStep: 0,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([
        {
          goalId: 'test_goal',
          failures: [
            { reason: 'No path to goal', timestamp: 1700000002000 },
            { reason: 'Preconditions failed', timestamp: 1700000003000 },
          ],
        },
      ]);
      mockGoapController.getFailedTasks.mockReturnValue([
        {
          taskId: 'task1',
          failures: [{ reason: 'Item not found', timestamp: 1700000004000 }],
        },
      ]);
      mockDataRegistry.getGoalDefinition.mockReturnValue({ name: 'Test Goal' });
      mockDataRegistry.get.mockReturnValue(null);

      const result = planInspector.inspect('actor-123');

      expect(result).toContain('Failed Goals: 2');
      expect(result).toContain('Failed Tasks: 1');
      expect(result).toContain('test_goal: 2 failure(s)');
      expect(result).toContain('- No path to goal');
      expect(result).toContain('- Preconditions failed');
      expect(result).toContain('task1: 1 failure(s)');
      expect(result).toContain('- Item not found');
    });

    it('should handle no failures gracefully', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'test_goal', priority: 5 },
        tasks: [{ id: 'task1', parameters: {} }],
        currentStep: 0,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoalDefinition.mockReturnValue({ name: 'Test Goal' });
      mockDataRegistry.get.mockReturnValue(null);

      const result = planInspector.inspect('actor-123');

      expect(result).toContain('Failed Goals: 0');
      expect(result).toContain('Failed Tasks: 0');
      expect(result).not.toContain('Goal Failure Details:');
      expect(result).not.toContain('Task Failure Details:');
    });

    it('should handle tasks without parameters', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'test_goal', priority: 5 },
        tasks: [{ id: 'task1' }],
        currentStep: 0,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoalDefinition.mockReturnValue({ name: 'Test Goal' });
      mockDataRegistry.get.mockReturnValue(null);

      const result = planInspector.inspect('actor-123');

      expect(result).toContain('[task1]');
      expect(result).not.toContain('Parameters:');
    });

    it('should handle missing goal definition gracefully', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'unknown_goal', priority: 5 },
        tasks: [],
        currentStep: 0,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoalDefinition.mockReturnValue(null);

      const result = planInspector.inspect('actor-123');

      expect(result).toContain('Goal: unknown_goal');
      expect(result).not.toContain('Description:');
    });
  });

  describe('inspectJSON', () => {
    it('should validate actorId parameter', () => {
      expect(() => planInspector.inspectJSON('')).toThrow();
      expect(() => planInspector.inspectJSON(null)).toThrow();
      expect(() => planInspector.inspectJSON(undefined)).toThrow();
    });

    it('should return null when no active plan', () => {
      mockGoapController.getActivePlan.mockReturnValue(null);

      const result = planInspector.inspectJSON('actor-123');

      expect(result).toBeNull();
    });

    it('should return valid JSON format with all plan data', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: {
          id: 'stay_fed',
          priority: 10,
        },
        tasks: [
          {
            id: 'consume_nourishing_item',
            parameters: { item: 'food-1' },
          },
          {
            id: 'gather_resources',
            parameters: { resourceType: 'food' },
          },
        ],
        currentStep: 1,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([
        {
          goalId: 'stay_fed',
          failures: [{ reason: 'No path', timestamp: 1700000002000 }],
        },
      ]);
      mockGoapController.getFailedTasks.mockReturnValue([
        {
          taskId: 'consume_nourishing_item',
          failures: [{ reason: 'Item not found', timestamp: 1700000003000 }],
        },
      ]);

      mockDataRegistry.getGoalDefinition.mockReturnValue({
        name: 'Maintain nourishment',
        description: 'Keep actor fed',
      });

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'tasks' && id === 'consume_nourishing_item') {
          return {
            name: 'Consume Nourishing Item',
            description: 'Eat food',
          };
        }
        if (type === 'tasks' && id === 'gather_resources') {
          return {
            name: 'Gather Resources',
            description: 'Collect resources',
          };
        }
        return null;
      });

      const result = planInspector.inspectJSON('actor-123');

      expect(result).toEqual({
        actorId: 'actor-123',
        goal: {
          id: 'stay_fed',
          name: 'Maintain nourishment',
          description: 'Keep actor fed',
          priority: 10,
        },
        tasks: [
          {
            id: 'consume_nourishing_item',
            name: 'Consume Nourishing Item',
            description: 'Eat food',
            parameters: { item: 'food-1' },
            status: 'COMPLETED',
          },
          {
            id: 'gather_resources',
            name: 'Gather Resources',
            description: 'Collect resources',
            parameters: { resourceType: 'food' },
            status: 'CURRENT',
          },
        ],
        currentStep: 1,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
        failures: {
          goals: 1,
          tasks: 1,
        },
      });
    });

    it('should handle missing task/goal definitions in JSON', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'unknown_goal', priority: 5 },
        tasks: [{ id: 'unknown_task', parameters: {} }],
        currentStep: 0,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoalDefinition.mockReturnValue(null);
      mockDataRegistry.get.mockReturnValue(null);

      const result = planInspector.inspectJSON('actor-123');

      expect(result.goal.name).toBe('unknown_goal');
      expect(result.goal.description).toBe('');
      expect(result.tasks[0].name).toBe('unknown_task');
      expect(result.tasks[0].description).toBe('');
    });

    it('should calculate task status correctly in JSON', () => {
      const mockPlan = {
        actorId: 'actor-123',
        goal: { id: 'test_goal', priority: 5 },
        tasks: [
          { id: 'task1', parameters: {} },
          { id: 'task2', parameters: {} },
          { id: 'task3', parameters: {} },
        ],
        currentStep: 1,
        createdAt: 1700000000000,
        lastValidated: 1700000001000,
      };

      mockGoapController.getActivePlan.mockReturnValue(mockPlan);
      mockGoapController.getFailedGoals.mockReturnValue([]);
      mockGoapController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoalDefinition.mockReturnValue({ name: 'Test Goal' });
      mockDataRegistry.get.mockReturnValue(null);

      const result = planInspector.inspectJSON('actor-123');

      expect(result.tasks[0].status).toBe('COMPLETED');
      expect(result.tasks[1].status).toBe('CURRENT');
      expect(result.tasks[2].status).toBe('PENDING');
    });
  });
});

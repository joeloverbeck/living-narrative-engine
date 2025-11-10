import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoalManager from '../../../../src/goap/goals/goalManager.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('GoalManager', () => {
  let goalManager;
  let mockLogger;
  let mockGameDataRepository;
  let mockGoalStateEvaluator;
  let mockJsonLogicEvaluator;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockGameDataRepository = {
      getGoalDefinition: jest.fn(),
      getAllGoalDefinitions: jest.fn()
    };
    mockGoalStateEvaluator = {
      evaluate: jest.fn(),
      calculateDistance: jest.fn()
    };
    mockJsonLogicEvaluator = {
      evaluate: jest.fn()
    };
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn()
    };

    goalManager = new GoalManager({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
      goalStateEvaluator: mockGoalStateEvaluator,
      jsonLogicEvaluator: mockJsonLogicEvaluator,
      entityManager: mockEntityManager
    });
  });

  describe('constructor', () => {
    it('should create an instance with valid dependencies', () => {
      expect(goalManager).toBeInstanceOf(GoalManager);
    });

    it('should throw error if logger is invalid', () => {
      expect(() => {
        new GoalManager({
          logger: {},
          gameDataRepository: mockGameDataRepository,
          goalStateEvaluator: mockGoalStateEvaluator,
          jsonLogicEvaluator: mockJsonLogicEvaluator,
          entityManager: mockEntityManager
        });
      }).toThrow();
    });

    it('should throw error if gameDataRepository is invalid', () => {
      expect(() => {
        new GoalManager({
          logger: mockLogger,
          gameDataRepository: {},
          goalStateEvaluator: mockGoalStateEvaluator,
          jsonLogicEvaluator: mockJsonLogicEvaluator,
          entityManager: mockEntityManager
        });
      }).toThrow();
    });
  });

  describe('selectGoal', () => {
    const actorId = 'actor-1';
    const context = { world: 'state' };

    it('should return null when no goals are available', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockGameDataRepository.getAllGoalDefinitions.mockReturnValue([]);

      const result = goalManager.selectGoal(actorId, context);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No goals available')
      );
    });

    it('should return null when no goals are relevant', () => {
      const goals = [
        { id: 'goal-1', priority: 10, relevance: { '==': [1, 2] } }
      ];

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockGameDataRepository.getAllGoalDefinitions.mockReturnValue(goals);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(false);

      const result = goalManager.selectGoal(actorId, context);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No relevant goals')
      );
    });

    it('should return null when all relevant goals are satisfied', () => {
      const goals = [
        { id: 'goal-1', priority: 10, relevance: { '==': [1, 1] }, goalState: {} }
      ];

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockGameDataRepository.getAllGoalDefinitions.mockReturnValue(goals);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);
      mockGoalStateEvaluator.evaluate.mockReturnValue(true);

      const result = goalManager.selectGoal(actorId, context);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('All relevant goals already satisfied')
      );
    });

    it('should return the highest priority unsatisfied goal', () => {
      const goals = [
        { id: 'goal-low', priority: 10, goalState: {} },
        { id: 'goal-high', priority: 90, goalState: {} },
        { id: 'goal-mid', priority: 50, goalState: {} }
      ];

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockGameDataRepository.getAllGoalDefinitions.mockReturnValue(goals);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);
      mockGoalStateEvaluator.evaluate.mockReturnValue(false);

      const result = goalManager.selectGoal(actorId, context);

      expect(result).toBe(goals[1]);
      expect(result.id).toBe('goal-high');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Selected goal goal-high (priority 90)')
      );
    });

    it('should handle errors gracefully', () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity error');
      });

      const result = goalManager.selectGoal(actorId, context);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error for invalid actorId', () => {
      expect(() => {
        goalManager.selectGoal('', context);
      }).toThrow();
    });

    it('should throw error for missing context', () => {
      expect(() => {
        goalManager.selectGoal(actorId, null);
      }).toThrow();
    });
  });

  describe('isRelevant', () => {
    const actorId = 'actor-1';
    const context = { world: 'state' };

    it('should return true when goal has no relevance condition', () => {
      const goal = { id: 'goal-1', priority: 10 };

      const result = goalManager.isRelevant(goal, actorId, context);

      expect(result).toBe(true);
    });

    it('should return true when relevance condition is met', () => {
      const goal = {
        id: 'goal-1',
        priority: 10,
        relevance: { '==': [1, 1] }
      };

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = goalManager.isRelevant(goal, actorId, context);

      expect(result).toBe(true);
    });

    it('should return false when relevance condition is not met', () => {
      const goal = {
        id: 'goal-1',
        priority: 10,
        relevance: { '==': [1, 2] }
      };

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockJsonLogicEvaluator.evaluate.mockReturnValue(false);

      const result = goalManager.isRelevant(goal, actorId, context);

      expect(result).toBe(false);
    });

    it('should enrich context with actor', () => {
      const goal = {
        id: 'goal-1',
        priority: 10,
        relevance: { '==': [1, 1] }
      };
      const actorEntity = { id: actorId, components: {} };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      goalManager.isRelevant(goal, actorId, context);

      expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledWith(
        goal.relevance,
        expect.objectContaining({
          actor: actorEntity,
          actorId
        })
      );
    });

    it('should handle errors gracefully', () => {
      const goal = {
        id: 'goal-1',
        priority: 10,
        relevance: { '==': [1, 1] }
      };

      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity error');
      });

      const result = goalManager.isRelevant(goal, actorId, context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('isGoalSatisfied', () => {
    const actorId = 'actor-1';
    const context = { world: 'state' };

    it('should return true when goal state is satisfied', () => {
      const goal = {
        id: 'goal-1',
        priority: 10,
        goalState: { '==': [1, 1] }
      };

      mockGoalStateEvaluator.evaluate.mockReturnValue(true);

      const result = goalManager.isGoalSatisfied(goal, actorId, context);

      expect(result).toBe(true);
      expect(mockGoalStateEvaluator.evaluate).toHaveBeenCalledWith(
        goal.goalState,
        actorId,
        context
      );
    });

    it('should return false when goal state is not satisfied', () => {
      const goal = {
        id: 'goal-1',
        priority: 10,
        goalState: { '==': [1, 2] }
      };

      mockGoalStateEvaluator.evaluate.mockReturnValue(false);

      const result = goalManager.isGoalSatisfied(goal, actorId, context);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const goal = {
        id: 'goal-1',
        priority: 10,
        goalState: {}
      };

      mockGoalStateEvaluator.evaluate.mockImplementation(() => {
        throw new Error('Evaluation error');
      });

      const result = goalManager.isGoalSatisfied(goal, actorId, context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getGoalsForActor', () => {
    const actorId = 'actor-1';

    it('should return all goals when actor exists', () => {
      const goals = [
        { id: 'goal-1', priority: 10 },
        { id: 'goal-2', priority: 20 }
      ];

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockGameDataRepository.getAllGoalDefinitions.mockReturnValue(goals);

      const result = goalManager.getGoalsForActor(actorId);

      expect(result).toBe(goals);
      expect(result.length).toBe(2);
    });

    it('should return empty array when actor not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = goalManager.getGoalsForActor(actorId);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Actor not found')
      );
    });

    it('should handle errors gracefully', () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity error');
      });

      const result = goalManager.getGoalsForActor(actorId);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

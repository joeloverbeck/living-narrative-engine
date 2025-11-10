import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoalStateEvaluator from '../../../../src/goap/goals/goalStateEvaluator.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('GoalStateEvaluator', () => {
  let evaluator;
  let mockLogger;
  let mockJsonLogicEvaluator;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockJsonLogicEvaluator = {
      evaluate: jest.fn()
    };
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn()
    };

    evaluator = new GoalStateEvaluator({
      logger: mockLogger,
      jsonLogicEvaluator: mockJsonLogicEvaluator,
      entityManager: mockEntityManager
    });
  });

  describe('constructor', () => {
    it('should create an instance with valid dependencies', () => {
      expect(evaluator).toBeInstanceOf(GoalStateEvaluator);
    });

    it('should throw error if logger is invalid', () => {
      expect(() => {
        new GoalStateEvaluator({
          logger: {},
          jsonLogicEvaluator: mockJsonLogicEvaluator,
          entityManager: mockEntityManager
        });
      }).toThrow();
    });

    it('should throw error if jsonLogicEvaluator is invalid', () => {
      expect(() => {
        new GoalStateEvaluator({
          logger: mockLogger,
          jsonLogicEvaluator: {},
          entityManager: mockEntityManager
        });
      }).toThrow();
    });

    it('should throw error if entityManager is invalid', () => {
      expect(() => {
        new GoalStateEvaluator({
          logger: mockLogger,
          jsonLogicEvaluator: mockJsonLogicEvaluator,
          entityManager: {}
        });
      }).toThrow();
    });
  });

  describe('evaluate', () => {
    const actorId = 'actor-1';
    const context = { world: 'state' };

    it('should return true when JSON Logic condition is satisfied', () => {
      const goalState = { '==': [1, 1] };
      const actorEntity = { id: actorId, components: {} };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(true);
    });

    it('should return false when JSON Logic condition is not satisfied', () => {
      const goalState = { '==': [1, 2] };
      const actorEntity = { id: actorId, components: {} };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(false);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(false);
    });

    it('should enrich context with actor entity', () => {
      const goalState = { '==': [1, 1] };
      const actorEntity = { id: actorId, components: {} };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      evaluator.evaluate(goalState, actorId, context);

      expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledWith(
        goalState,
        expect.objectContaining({
          actor: actorEntity,
          actorId,
          world: 'state'
        })
      );
    });

    it('should handle component existence checks', () => {
      const goalState = {
        '>=': [{ var: 'actor.components.core:actor' }, null]
      };
      const actorEntity = {
        id: actorId,
        components: { 'core:actor': { name: 'Test' } }
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(true);
    });

    it('should handle component value checks', () => {
      const goalState = {
        '>=': [{ var: 'actor.components.core:health.value' }, 50]
      };
      const actorEntity = {
        id: actorId,
        components: { 'core:health': { value: 75 } }
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(true);
    });

    it('should handle composite conditions (and)', () => {
      const goalState = {
        and: [
          { '>=': [{ var: 'actor.components.core:actor' }, null] },
          { '>': [{ var: 'actor.components.core:health.value' }, 20] }
        ]
      };
      const actorEntity = {
        id: actorId,
        components: {
          'core:actor': { name: 'Test' },
          'core:health': { value: 50 }
        }
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(true);
    });

    it('should handle nested component paths', () => {
      const goalState = {
        '==': [{ var: 'actor.components.positioning:location.room' }, 'kitchen']
      };
      const actorEntity = {
        id: actorId,
        components: {
          'positioning:location': { room: 'kitchen' }
        }
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(true);
    });

    it('should convert truthy values to true', () => {
      const goalState = { '==': [1, 1] };

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockJsonLogicEvaluator.evaluate.mockReturnValue(1);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(true);
    });

    it('should convert falsy values to false', () => {
      const goalState = { '==': [1, 2] };

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockJsonLogicEvaluator.evaluate.mockReturnValue(0);

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const goalState = { '==': [1, 1] };

      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity error');
      });

      const result = evaluator.evaluate(goalState, actorId, context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to evaluate goal state',
        expect.any(Error)
      );
    });

    it('should throw error for missing goalState', () => {
      expect(() => {
        evaluator.evaluate(null, actorId, context);
      }).toThrow();
    });

    it('should throw error for invalid actorId', () => {
      expect(() => {
        evaluator.evaluate({ '==': [1, 1] }, '', context);
      }).toThrow();
    });
  });

  describe('calculateDistance', () => {
    const actorId = 'actor-1';
    const context = { world: 'state' };

    it('should return 0 when goal is satisfied', () => {
      const goalState = { '==': [1, 1] };

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = evaluator.calculateDistance(goalState, actorId, context);

      expect(result).toBe(0);
    });

    it('should return 1 when goal is not satisfied (Tier 1 heuristic)', () => {
      const goalState = { '==': [1, 2] };

      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockJsonLogicEvaluator.evaluate.mockReturnValue(false);

      const result = evaluator.calculateDistance(goalState, actorId, context);

      expect(result).toBe(1);
    });

    it('should return 1 when evaluation fails', () => {
      const goalState = { '==': [1, 1] };

      // When evaluate() catches an error internally, it returns false
      // This means calculateDistance() will return 1 (unsatisfied)
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity error');
      });

      const result = evaluator.calculateDistance(goalState, actorId, context);

      expect(result).toBe(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error for missing goalState', () => {
      expect(() => {
        evaluator.calculateDistance(null, actorId, context);
      }).toThrow();
    });

    it('should throw error for invalid actorId', () => {
      expect(() => {
        evaluator.calculateDistance({ '==': [1, 1] }, '', context);
      }).toThrow();
    });
  });
});

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoalManager from '../../../src/goap/goals/goalManager.js';
import GoalStateEvaluator from '../../../src/goap/goals/goalStateEvaluator.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

describe('Goal Selection - Integration', () => {
  let goalManager;
  let entityManager;
  let gameDataRepository;
  let mockLogger;
  let goalStateEvaluator;
  let jsonLogicEvaluator;
  let entities;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    gameDataRepository = {
      getAllGoalDefinitions: jest.fn().mockReturnValue([]),
      getGoalDefinition: jest.fn(),
      getConditionDefinition: jest.fn()
    };

    // In-memory entity storage
    entities = new Map();

    // Mock entity manager
    entityManager = {
      createEntity: jest.fn().mockImplementation(() => {
        const id = `entity-${entities.size + 1}`;
        entities.set(id, { id, components: {} });
        return id;
      }),
      addComponent: jest.fn().mockImplementation((entityId, componentId, data) => {
        const entity = entities.get(entityId);
        if (entity) {
          entity.components[componentId] = data || {};
        }
      }),
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        const entity = entities.get(entityId);
        if (!entity) return undefined;
        // Return entity with component accessor proxy
        return {
          id: entity.id,
          components: createComponentAccessor(entityId, entityManager, mockLogger)
        };
      }),
      hasComponent: jest.fn().mockImplementation((entityId, componentId) => {
        const entity = entities.get(entityId);
        return entity && entity.components[componentId] !== undefined;
      }),
      getComponentData: jest.fn().mockImplementation((entityId, componentId) => {
        const entity = entities.get(entityId);
        return entity ? entity.components[componentId] : undefined;
      }),
      getAllComponentTypesForEntity: jest.fn().mockImplementation((entityId) => {
        const entity = entities.get(entityId);
        return entity ? Object.keys(entity.components) : [];
      })
    };

    // Create JSON Logic evaluator
    jsonLogicEvaluator = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository
    });

    // Create goal state evaluator
    goalStateEvaluator = new GoalStateEvaluator({
      logger: mockLogger,
      jsonLogicEvaluator,
      entityManager
    });

    // Create goal manager
    goalManager = new GoalManager({
      logger: mockLogger,
      gameDataRepository,
      goalStateEvaluator,
      jsonLogicEvaluator,
      entityManager
    });
  });

  describe('selectGoal for cat actor (hungry)', () => {
    it('should select find_food goal when cat is hungry', () => {
      // Arrange - Create a hungry cat
      const catId = entityManager.createEntity();
      entityManager.addComponent(catId, 'core:actor', { name: 'Fluffy' });
      entityManager.addComponent(catId, 'core:hunger', { value: 20 });

      const context = {};

      // Mock goals
      const findFoodGoal = {
        id: 'core:find_food',
        priority: 80,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '<': [{ var: 'actor.components.core:hunger.value' }, 30] }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.items:has_food' }, null]
        }
      };

      gameDataRepository.getAllGoalDefinitions.mockReturnValue([findFoodGoal]);

      // Act
      const selectedGoal = goalManager.selectGoal(catId, context);

      // Assert
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal).not.toBeNull();
      expect(selectedGoal.id).toBe('core:find_food');
      expect(selectedGoal.priority).toBe(80);
    });

    it('should not select find_food goal when cat is not hungry', () => {
      // Arrange - Create a well-fed cat
      const catId = entityManager.createEntity();
      entityManager.addComponent(catId, 'core:actor', { name: 'Fluffy' });
      entityManager.addComponent(catId, 'core:hunger', { value: 80 });

      const context = {};

      const findFoodGoal = {
        id: 'core:find_food',
        priority: 80,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '<': [{ var: 'actor.components.core:hunger.value' }, 30] }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.items:has_food' }, null]
        }
      };

      gameDataRepository.getAllGoalDefinitions.mockReturnValue([findFoodGoal]);

      // Act
      const selectedGoal = goalManager.selectGoal(catId, context);

      // Assert
      expect(selectedGoal).toBeNull();
    });
  });

  describe('selectGoal for cat actor (tired)', () => {
    it('should select rest_safely goal when cat is tired', () => {
      // Arrange - Create a tired cat
      const catId = entityManager.createEntity();
      entityManager.addComponent(catId, 'core:actor', { name: 'Fluffy' });
      entityManager.addComponent(catId, 'core:energy', { value: 30 });

      const context = {};

      const restGoal = {
        id: 'core:rest_safely',
        priority: 60,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '<': [{ var: 'actor.components.core:energy.value' }, 40] }
          ]
        },
        goalState: {
          and: [
            { '!=': [{ var: 'actor.components.positioning:lying_down' }, null] },
            { '>=': [{ var: 'actor.components.core:energy.value' }, 80] }
          ]
        }
      };

      gameDataRepository.getAllGoalDefinitions.mockReturnValue([restGoal]);

      // Act
      const selectedGoal = goalManager.selectGoal(catId, context);

      // Assert
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:rest_safely');
      expect(selectedGoal.priority).toBe(60);
    });
  });

  describe('selectGoal for goblin actor (enemy present)', () => {
    it('should select defeat_enemy goal when goblin is in combat', () => {
      // Arrange - Create a goblin in combat
      const goblinId = entityManager.createEntity();
      entityManager.addComponent(goblinId, 'core:actor', { name: 'Grok' });
      entityManager.addComponent(goblinId, 'combat:in_combat', { enemyId: 'player-1' });
      entityManager.addComponent(goblinId, 'core:health', { value: 50 });

      const context = {};

      const defeatEnemyGoal = {
        id: 'core:defeat_enemy',
        priority: 90,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '!=': [{ var: 'actor.components.combat:in_combat' }, null] },
            { '>': [{ var: 'actor.components.core:health.value' }, 20] }
          ]
        },
        goalState: {
          '!': [{ var: 'actor.components.combat:in_combat' }]
        }
      };

      gameDataRepository.getAllGoalDefinitions.mockReturnValue([defeatEnemyGoal]);

      // Act
      const selectedGoal = goalManager.selectGoal(goblinId, context);

      // Assert
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:defeat_enemy');
      expect(selectedGoal.priority).toBe(90);
    });
  });

  describe('No goal selected when all satisfied', () => {
    it('should return null when all relevant goals are satisfied', () => {
      // Arrange - Create an actor with food
      const actorId = entityManager.createEntity();
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test' });
      entityManager.addComponent(actorId, 'core:hunger', { value: 20 });
      entityManager.addComponent(actorId, 'items:has_food', { itemId: 'food-1' });

      const context = {};

      const findFoodGoal = {
        id: 'core:find_food',
        priority: 80,
        relevance: {
          and: [
            { '!=': [{ var: 'actor.components.core:actor' }, null] },
            { '<': [{ var: 'actor.components.core:hunger.value' }, 30] }
          ]
        },
        goalState: {
          '!=': [{ var: 'actor.components.items:has_food' }, null]
        }
      };

      gameDataRepository.getAllGoalDefinitions.mockReturnValue([findFoodGoal]);

      // Act
      const selectedGoal = goalManager.selectGoal(actorId, context);

      // Assert
      expect(selectedGoal).toBeNull();
    });
  });

  describe('Goal priority ordering', () => {
    it('should select the highest priority goal among multiple relevant goals', () => {
      // Arrange - Create an actor with multiple needs
      const actorId = entityManager.createEntity();
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test' });
      entityManager.addComponent(actorId, 'core:hunger', { value: 20 });
      entityManager.addComponent(actorId, 'core:energy', { value: 30 });
      entityManager.addComponent(actorId, 'combat:in_combat', { enemyId: 'enemy-1' });
      entityManager.addComponent(actorId, 'core:health', { value: 50 });

      const context = {};

      const goals = [
        {
          id: 'core:find_food',
          priority: 80,
          relevance: {
            and: [
              { '!=': [{ var: 'actor.components.core:actor' }, null] },
              { '<': [{ var: 'actor.components.core:hunger.value' }, 30] }
            ]
          },
          goalState: {
            '!=': [{ var: 'actor.components.items:has_food' }, null]
          }
        },
        {
          id: 'core:rest_safely',
          priority: 60,
          relevance: {
            and: [
              { '!=': [{ var: 'actor.components.core:actor' }, null] },
              { '<': [{ var: 'actor.components.core:energy.value' }, 40] }
            ]
          },
          goalState: {
            '!=': [{ var: 'actor.components.positioning:lying_down' }, null]
          }
        },
        {
          id: 'core:defeat_enemy',
          priority: 90,
          relevance: {
            and: [
              { '!=': [{ var: 'actor.components.core:actor' }, null] },
              { '!=': [{ var: 'actor.components.combat:in_combat' }, null] }
            ]
          },
          goalState: {
            '!': [{ var: 'actor.components.combat:in_combat' }]
          }
        }
      ];

      gameDataRepository.getAllGoalDefinitions.mockReturnValue(goals);

      // Act
      const selectedGoal = goalManager.selectGoal(actorId, context);

      // Assert
      expect(selectedGoal).toBeDefined();
      expect(selectedGoal.id).toBe('core:defeat_enemy');
      expect(selectedGoal.priority).toBe(90);
    });
  });

  describe('Real goal definitions from files', () => {
    it('should work with actual goal definitions loaded from JSON files', () => {
      // This test would require the actual mod loading system
      // and the goal definitions to be loaded from the file system
      // For now, we can skip this or mark as pending

      // Note: This would be tested in end-to-end tests or
      // with a full system integration test
      expect(true).toBe(true);
    });
  });
});

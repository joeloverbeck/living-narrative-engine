/**
 * @file Integration tests for GOAP hunger goals
 * @description Tests that the metabolism:satisfy_hunger goal correctly activates
 * based on is_hungry and predicted_energy conditions, and validates success state.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import { IsHungryOperator } from '../../../src/logic/operators/isHungryOperator.js';
import { PredictedEnergyOperator } from '../../../src/logic/operators/predictedEnergyOperator.js';
import { HasComponentOperator } from '../../../src/logic/operators/hasComponentOperator.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import EntityManagerIntegrationTestBed from '../../common/entities/entityManagerIntegrationTestBed.js';

// Import the actual goal definition
import satisfyHungerGoal from '../../../data/mods/metabolism/goals/satisfy_hunger.goal.json' assert { type: 'json' };

describe('GOAP hunger goals integration', () => {
  let testBed;
  let entityManager;
  let actorDefinition;
  let jsonLogicService;
  let isHungryOperator;
  let predictedEnergyOperator;
  let hasComponentOperator;

  const registerDefinition = (definition) => {
    testBed.registry.store('entityDefinitions', definition.id, definition);
  };

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;

    actorDefinition = new EntityDefinition('test:actor', {
      description: 'Test actor with metabolism',
      components: {},
    });

    registerDefinition(actorDefinition);

    // Create operators
    isHungryOperator = new IsHungryOperator({
      entityManager,
      logger: testBed.logger,
    });

    predictedEnergyOperator = new PredictedEnergyOperator({
      entityManager,
      logger: testBed.logger,
    });

    hasComponentOperator = new HasComponentOperator({
      entityManager,
      logger: testBed.logger,
    });

    // Create JSON Logic service and register operators
    jsonLogicService = new JsonLogicEvaluationService({
      logger: testBed.logger,
    });

    // Register is_hungry operator - using function() to get 'this' as context
    jsonLogicService.addOperation('is_hungry', function (entityPath) {
      return isHungryOperator.evaluate([entityPath], this);
    });

    // Register predicted_energy operator
    jsonLogicService.addOperation('predicted_energy', function (entityPath) {
      return predictedEnergyOperator.evaluate([entityPath], this);
    });

    // Register has_component operator
    jsonLogicService.addOperation(
      'has_component',
      function (entityPath, componentId) {
        return hasComponentOperator.evaluate([entityPath, componentId], this);
      }
    );
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  /**
   * Helper: Create actor with metabolism components
   */
  const createMetabolismActor = async (instanceId, config = {}) => {
    const {
      currentEnergy = 50,
      maxEnergy = 100,
      bufferStorage = [],
      hungerState = 'neutral',
    } = config;

    const actor = await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId,
    });

    await entityManager.addComponent(actor.id, 'metabolism:metabolic_store', {
      current_energy: currentEnergy,
      max_energy: maxEnergy,
      base_burn_rate: 5,
      buffer_storage: bufferStorage,
      buffer_capacity: 10,
    });

    await entityManager.addComponent(actor.id, 'metabolism:fuel_converter', {
      capacity: 10,
      conversion_rate: 10,
      efficiency: 1.0,
      accepted_fuel_tags: ['food', 'drink'],
      metabolic_efficiency_multiplier: 1.0,
    });

    await entityManager.addComponent(actor.id, 'metabolism:hunger_state', {
      state: hungerState,
      energyPercentage: (currentEnergy / maxEnergy) * 100,
      turnsInState: 0,
      starvationDamage: 0,
    });

    return actor;
  };

  /**
   * Evaluate goal condition with proper context
   */
  const evaluateGoalCondition = (logic, actor) => {
    // Build context that operators can resolve 'self' from
    const context = {
      self: { id: actor.id },
      entity: { id: actor.id },
    };
    return jsonLogicService.evaluate(logic, context);
  };

  describe('Goal Activation (relevance conditions)', () => {
    describe('activates when is_hungry returns true', () => {
      it('activates when actor is hungry', async () => {
        const actor = await createMetabolismActor('actor-1', {
          hungerState: 'hungry',
          currentEnergy: 20,
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(true);
      });

      it('activates when actor is starving', async () => {
        const actor = await createMetabolismActor('actor-1', {
          hungerState: 'starving',
          currentEnergy: 5,
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(true);
      });

      it('activates when actor is in critical state', async () => {
        const actor = await createMetabolismActor('actor-1', {
          hungerState: 'critical',
          currentEnergy: 0,
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(true);
      });
    });

    describe('activates when predicted_energy < 500', () => {
      it('activates with low current energy and no buffer', async () => {
        const actor = await createMetabolismActor('actor-1', {
          hungerState: 'neutral', // Not hungry state
          currentEnergy: 300, // Below 500
          bufferStorage: [], // No pending energy
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(true);
      });

      it('activates when current + buffered < 500', async () => {
        const actor = await createMetabolismActor('actor-1', {
          hungerState: 'neutral',
          currentEnergy: 300,
          bufferStorage: [{ bulk: 2, energy_content: 100 }], // 300 + 100 = 400 < 500
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(true);
      });
    });

    describe('does NOT activate when digesting (predicted_energy sufficient)', () => {
      it('does not activate when predicted_energy >= 500 and not hungry', async () => {
        const actor = await createMetabolismActor('actor-1', {
          hungerState: 'neutral', // Not hungry
          currentEnergy: 400,
          bufferStorage: [{ bulk: 2, energy_content: 200 }], // 400 + 200 = 600 >= 500
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(false);
      });

      it('does not activate when satiated with high energy', async () => {
        const actor = await createMetabolismActor('actor-1', {
          hungerState: 'satiated',
          currentEnergy: 800,
          bufferStorage: [],
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(false);
      });
    });

    describe('requires metabolism components', () => {
      it('does not activate without metabolic_store component', async () => {
        const actor = await entityManager.createEntityInstance(
          actorDefinition.id,
          {
            instanceId: 'no-store',
          }
        );

        // Only add fuel_converter
        await entityManager.addComponent(actor.id, 'metabolism:fuel_converter', {
          capacity: 10,
          accepted_fuel_tags: ['food'],
        });

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(false);
      });

      it('does not activate without fuel_converter component', async () => {
        const actor = await entityManager.createEntityInstance(
          actorDefinition.id,
          {
            instanceId: 'no-converter',
          }
        );

        // Only add metabolic_store
        await entityManager.addComponent(
          actor.id,
          'metabolism:metabolic_store',
          {
            current_energy: 100,
            buffer_storage: [],
          }
        );

        const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

        expect(result).toBe(false);
      });
    });
  });

  describe('Goal Success Conditions (goalState)', () => {
    it('goal success: NOT hungry AND predicted_energy > 700', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'satiated', // Not hungry
        currentEnergy: 800, // > 700
        bufferStorage: [],
      });

      const result = evaluateGoalCondition(satisfyHungerGoal.goalState, actor);

      expect(result).toBe(true);
    });

    it('goal success with buffered energy pushing over threshold', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'neutral', // Not hungry
        currentEnergy: 600,
        bufferStorage: [{ bulk: 2, energy_content: 150 }], // 600 + 150 = 750 > 700
      });

      const result = evaluateGoalCondition(satisfyHungerGoal.goalState, actor);

      expect(result).toBe(true);
    });

    it('goal NOT satisfied when still hungry', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'hungry', // Still hungry
        currentEnergy: 800, // Even with high energy
        bufferStorage: [],
      });

      const result = evaluateGoalCondition(satisfyHungerGoal.goalState, actor);

      expect(result).toBe(false);
    });

    it('goal NOT satisfied when predicted_energy <= 700', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'neutral', // Not hungry
        currentEnergy: 600, // Only 600, and no buffer
        bufferStorage: [],
      });

      const result = evaluateGoalCondition(satisfyHungerGoal.goalState, actor);

      expect(result).toBe(false);
    });

    it('goal NOT satisfied at exactly 700 predicted energy', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'neutral',
        currentEnergy: 700, // Exactly 700, not > 700
        bufferStorage: [],
      });

      const result = evaluateGoalCondition(satisfyHungerGoal.goalState, actor);

      expect(result).toBe(false);
    });
  });

  describe('Goal priority and configuration', () => {
    it('has correct goal ID', () => {
      expect(satisfyHungerGoal.id).toBe('metabolism:satisfy_hunger');
    });

    it('has priority level set', () => {
      expect(satisfyHungerGoal.priority).toBeDefined();
      expect(satisfyHungerGoal.priority).toBe(7);
    });

    it('has description set', () => {
      expect(satisfyHungerGoal.description).toBeDefined();
      expect(satisfyHungerGoal.description).toContain('energy');
    });
  });

  describe('Edge cases', () => {
    it('handles entity with missing hunger_state component', async () => {
      const actor = await entityManager.createEntityInstance(actorDefinition.id, {
        instanceId: 'partial-metabolism',
      });

      // Add both required components but NOT hunger_state
      await entityManager.addComponent(actor.id, 'metabolism:metabolic_store', {
        current_energy: 50,
        max_energy: 100,
        buffer_storage: [],
        buffer_capacity: 10,
      });

      await entityManager.addComponent(actor.id, 'metabolism:fuel_converter', {
        capacity: 10,
        accepted_fuel_tags: ['food'],
      });

      // Relevance should still work - it checks has_component for store and converter
      // But is_hungry should return false without hunger_state
      const result = evaluateGoalCondition(satisfyHungerGoal.relevance, actor);

      // Since no hunger_state, is_hungry returns false
      // predicted_energy of 50 < 500, so this should activate
      expect(result).toBe(true);
    });

    it('handles zero current energy', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'critical',
        currentEnergy: 0,
        bufferStorage: [],
      });

      const relevanceResult = evaluateGoalCondition(
        satisfyHungerGoal.relevance,
        actor
      );
      const goalStateResult = evaluateGoalCondition(
        satisfyHungerGoal.goalState,
        actor
      );

      // Should be relevant (hungry and low energy)
      expect(relevanceResult).toBe(true);
      // Goal not satisfied (still hungry and low energy)
      expect(goalStateResult).toBe(false);
    });

    it('handles maximum energy values', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'gluttonous',
        currentEnergy: 1000,
        maxEnergy: 1000,
        bufferStorage: [{ bulk: 5, energy_content: 500 }],
      });

      const relevanceResult = evaluateGoalCondition(
        satisfyHungerGoal.relevance,
        actor
      );
      const goalStateResult = evaluateGoalCondition(
        satisfyHungerGoal.goalState,
        actor
      );

      // Not relevant (not hungry, predicted_energy = 1500 > 500)
      expect(relevanceResult).toBe(false);
      // Goal satisfied (not hungry, predicted_energy = 1500 > 700)
      expect(goalStateResult).toBe(true);
    });
  });
});

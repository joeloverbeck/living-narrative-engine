/**
 * @file Integration tests for Planning Effects Simulator with real services
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import PlanningEffectsSimulator from '../../../src/goap/planner/planningEffectsSimulator.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../../src/goap/services/parameterResolutionService.js';

describe('PlanningEffectsSimulator - Integration with Real Services', () => {
  let testBed;
  let simulator;
  let contextAssembly;
  let parameterResolution;
  let entityManager;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = new SimpleEntityManager();

    // Create real services
    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    parameterResolution = new ParameterResolutionService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: parameterResolution,
      contextAssemblyService: contextAssembly,
      logger: testBed.createMockLogger(),
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should simulate effects with real context assembly', () => {
    // Create test entity
    const actorId = 'actor-1';
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, 'core:actor', {});
    entityManager.addComponent(actorId, 'core:hungry', {});

    // Build context for planning (simple structure with entity IDs)
    const context = { actor: actorId };

    // Define planning effects
    const planningEffects = [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:hungry',
        },
      },
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:satiated',
          value: {},
        },
      },
    ];

    const currentState = {
      'actor-1:core:hungry': {},
    };

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['actor-1:core:hungry']).toBeUndefined();
    expect(result.state['actor-1:core:satiated']).toEqual({});
  });

  it('should resolve complex parameter references with real resolution service', () => {
    // Create test entities
    const actorId = 'actor-1';
    const targetId = 'target-1';
    entityManager.createEntity(actorId);
    entityManager.createEntity(targetId);

    entityManager.addComponent(actorId, 'core:actor', {});
    entityManager.addComponent(targetId, 'core:actor', {});

    // Build context with task parameters
    const context = {
      actor: actorId,
      task: {
        params: {
          target: targetId,
          amount: 50,
        },
      },
    };

    // Planning effects with parameter references
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'task.params.target',
          component_type: 'core:health',
          value: { points: 100 },
        },
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'task.params.target',
          component_type: 'core:health',
          field: 'points',
          mode: 'decrement',
          value: 50, // Use literal instead of reference for simplicity
        },
      },
    ];

    const currentState = {};

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['target-1:core:health'].points).toBe(50);
  });

  it('should handle complex operation sequences with real services', () => {
    const actorId = 'actor-1';
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, 'core:actor', {});

    // Build context for planning (simple structure with entity IDs)
    const context = { actor: actorId };

    // Complex sequence: remove old, add new, modify new
    const planningEffects = [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:hungry',
        },
      },
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          value: { hungerLevel: 100, thirst: 100 },
        },
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 0,
        },
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'thirst',
          mode: 'decrement',
          value: 30,
        },
      },
    ];

    const currentState = {
      'actor-1:core:hungry': {},
    };

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['actor-1:core:hungry']).toBeUndefined();
    expect(result.state['actor-1:core:nutrition']).toEqual({
      hungerLevel: 0,
      thirst: 70,
    });
  });

  // Note: Entity validation is NOT tested at the simulator level.
  // PlanningEffectsSimulator is designed as a pure, fast state transformer for A* search.
  // It intentionally does NOT validate entity existence because:
  // 1. It operates on symbolic state (entity:component keys), not actual entities
  // 2. Entity validation would require EntityManager dependency, breaking purity
  // 3. Performance optimization: validation is slow, planning needs to be fast
  // 4. Entity validation occurs at action execution time, not planning time
  //
  // The simulator treats unknown references as literal entity IDs to support:
  // - Direct entity ID references (e.g., "actor-1")
  // - Testing scenarios with literal IDs
  // - Pure state transformation without external dependencies
  //
  // Entity validation is the responsibility of:
  // - Action execution layer (when tasks are actually run)
  // - ParameterResolutionService (when references contain dots or are in context)
  // - Operation handlers (when manipulating actual entities)
});

describe('PlanningEffectsSimulator - Realistic Task Simulation', () => {
  let testBed;
  let simulator;
  let contextAssembly;
  let parameterResolution;
  let entityManager;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = new SimpleEntityManager();

    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    parameterResolution = new ParameterResolutionService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: parameterResolution,
      contextAssemblyService: contextAssembly,
      logger: testBed.createMockLogger(),
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should simulate eating task effects (realistic scenario)', () => {
    // Setup: Actor is hungry
    const actorId = 'actor-1';
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, 'core:actor', {});
    entityManager.addComponent(actorId, 'core:hungry', {});
    entityManager.addComponent(actorId, 'core:nutrition', { hungerLevel: 100 });

    // Build context for planning (simple structure with entity IDs)
    const context = { actor: actorId };

    // Task: Eat food
    // Planning Effects: Remove hungry, add satiated, set hunger to 0
    const planningEffects = [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:hungry',
        },
      },
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:satiated',
          value: {},
        },
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 0,
        },
      },
    ];

    const currentState = {
      'actor-1:core:hungry': {},
      'actor-1:core:nutrition': { hungerLevel: 100 },
    };

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);

    // Verify post-conditions
    expect(result.state['actor-1:core:hungry']).toBeUndefined();
    expect(result.state['actor-1:core:satiated']).toEqual({});
    expect(result.state['actor-1:core:nutrition'].hungerLevel).toBe(0);
  });

  it('should simulate healing task effects (realistic scenario)', () => {
    const actorId = 'actor-1';
    const itemId = 'potion-1';
    entityManager.createEntity(actorId);
    entityManager.createEntity(itemId);

    entityManager.addComponent(actorId, 'core:actor', {});
    entityManager.addComponent(actorId, 'core:health', { points: 30 });
    entityManager.addComponent(itemId, 'core:item', {});

    const context = {
      actor: actorId,
      task: {
        params: {
          item: itemId,
          healAmount: 50,
        },
      },
    };

    // Task: Use healing potion
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:health',
          field: 'points',
          mode: 'increment',
          value: 50, // Simplified: use literal instead of task.params.healAmount
        },
      },
    ];

    const currentState = {
      'actor-1:core:health': { points: 30 },
    };

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['actor-1:core:health'].points).toBe(80);
  });
});

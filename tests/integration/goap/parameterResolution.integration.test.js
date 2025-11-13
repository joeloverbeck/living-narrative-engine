/**
 * @file Integration tests for ParameterResolutionService
 * These tests verify the service integrates correctly with ContextAssemblyService
 * and handles complex parameter resolution scenarios.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import ParameterResolutionService from '../../../src/goap/services/parameterResolutionService.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionError from '../../../src/goap/errors/parameterResolutionError.js';

/**
 * Create a mock EntityManager with basic functionality
 */
function createMockEntityManager() {
  const entities = new Map();

  return {
    createEntity: () => {
      const id = `entity_${entities.size + 1}`;
      entities.set(id, { components: {} });
      return id;
    },
    hasEntity: (id) => entities.has(id),
    getEntity: (id) => entities.get(id),
    getComponent: (entityId, componentId) => {
      const entity = entities.get(entityId);
      return entity?.components[componentId];
    },
    addComponent: (entityId, componentId, data) => {
      if (entities.has(entityId)) {
        entities.get(entityId).components[componentId] = data;
      }
    },
    getAllComponents: (entityId) => entities.get(entityId)?.components || {},
  };
}

/**
 * Create a mock logger
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('ParameterResolutionService - Real Entity Components', () => {
  let entityManager;
  let service;
  let contextAssembly;
  let logger;
  let actorId;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = createMockEntityManager();

    service = new ParameterResolutionService({
      entityManager,
      logger,
    });

    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger,
      enableKnowledgeLimitation: false,
    });

    // Create test actor with components
    actorId = entityManager.createEntity();
    entityManager.addComponent(actorId, 'core:health', { value: 75, max: 100 });
    entityManager.addComponent(actorId, 'core:position', { room: 'tavern', x: 5, y: 10 });
    entityManager.addComponent(actorId, 'items:inventory', {
      slots: [
        { itemId: 'sword_1', slot: 0 },
        { itemId: 'potion_3', slot: 1 },
      ],
      capacity: 10,
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should resolve actor health component with real EntityManager', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);
    const result = service.resolve('actor.components.core:health.value', context, {
      validateEntity: false,
    });

    expect(result).toBe(75);
  });

  it('should resolve actor position component', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);
    const result = service.resolve('actor.components.core:position.room', context, {
      validateEntity: false,
    });

    expect(result).toBe('tavern');
  });

  it('should resolve nested inventory data', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);
    const result = service.resolve('actor.components.items:inventory.slots', context, {
      validateEntity: false,
    });

    expect(result).toEqual([
      { itemId: 'sword_1', slot: 0 },
      { itemId: 'potion_3', slot: 1 },
    ]);
  });

  it('should access namespaced components correctly', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);
    const healthComponent = service.resolve('actor.components.core:health', context, {
      validateEntity: false,
    });

    expect(healthComponent).toEqual({ value: 75, max: 100 });
  });

  it('should validate entity exists with real EntityManager', () => {
    const itemId = entityManager.createEntity();
    entityManager.addComponent(itemId, 'items:nutrition', { calories: 100 });

    const context = {
      task: {
        params: {
          item: itemId,
        },
      },
    };

    const result = service.resolve('task.params.item', context, { validateEntity: true });
    expect(result).toBe(itemId);
  });

  it('should throw error for non-existent entity when validation enabled', () => {
    const context = {
      task: {
        params: {
          item: 'nonexistent_entity_123',
        },
      },
    };

    expect(() => {
      service.resolve('task.params.item', context, { validateEntity: true });
    }).toThrow(ParameterResolutionError);
  });
});

describe('ParameterResolutionService - Complex Property Paths', () => {
  let entityManager;
  let service;
  let contextAssembly;
  let logger;
  let actorId;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = createMockEntityManager();

    service = new ParameterResolutionService({
      entityManager,
      logger,
    });

    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger,
      enableKnowledgeLimitation: false,
    });

    // Create actor with complex nested data
    actorId = entityManager.createEntity();
    entityManager.addComponent(actorId, 'character:stats', {
      attributes: {
        strength: 15,
        dexterity: 12,
        intelligence: 10,
      },
      skills: {
        combat: { level: 5, xp: 1200 },
        crafting: { level: 3, xp: 450 },
      },
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should navigate deep nested structures', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);
    const result = service.resolve(
      'actor.components.character:stats.attributes.strength',
      context,
      { validateEntity: false }
    );

    expect(result).toBe(15);
  });

  it('should resolve multiple levels with namespaced components', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);
    const result = service.resolve('actor.components.character:stats.skills.combat.level', context, {
      validateEntity: false,
    });

    expect(result).toBe(5);
  });

  it('should handle mixed component types', () => {
    entityManager.addComponent(actorId, 'core:health', { value: 50 });

    const context = contextAssembly.assemblePlanningContext(actorId);

    const health = service.resolve('actor.components.core:health.value', context, {
      validateEntity: false,
    });
    const strength = service.resolve('actor.components.character:stats.attributes.strength', context, {
      validateEntity: false,
    });

    expect(health).toBe(50);
    expect(strength).toBe(15);
  });
});

describe('ParameterResolutionService - Refinement LocalState Accumulation', () => {
  let entityManager;
  let service;
  let contextAssembly;
  let logger;
  let actorId;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = createMockEntityManager();

    service = new ParameterResolutionService({
      entityManager,
      logger,
    });

    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger,
      enableKnowledgeLimitation: false,
    });

    actorId = entityManager.createEntity();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should store and access results from step 1', () => {
    const task = {
      id: 'task_1',
      params: { item: 'apple_7', location: 'room_12' },
    };

    const localState = {
      step1Result: { success: true, movedTo: 'room_12' },
    };

    const context = contextAssembly.assembleRefinementContext(actorId, task, localState);
    const result = service.resolve('refinement.localState.step1Result.success', context, {
      validateEntity: false,
    });

    expect(result).toBe(true);
  });

  it('should access accumulated results across multiple steps', () => {
    const task = {
      id: 'task_1',
      params: { item: 'apple_7' },
    };

    const localState = {
      moveResult: { success: true, position: 'room_12' },
      pickupResult: { success: true, item: 'apple_7' },
      consumeResult: { success: true, healthGain: 20 },
    };

    const context = contextAssembly.assembleRefinementContext(actorId, task, localState);

    const moveSuccess = service.resolve('refinement.localState.moveResult.success', context, {
      validateEntity: false,
    });
    const pickedItem = service.resolve('refinement.localState.pickupResult.item', context, {
      validateEntity: false,
    });
    const healthGain = service.resolve('refinement.localState.consumeResult.healthGain', context, {
      validateEntity: false,
    });

    expect(moveSuccess).toBe(true);
    expect(pickedItem).toBe('apple_7');
    expect(healthGain).toBe(20);
  });

  it('should resolve task params alongside local state', () => {
    const task = {
      id: 'task_1',
      params: { item: 'apple_7', location: 'room_12' },
    };

    const localState = {
      pickupResult: { success: true, item: 'apple_7' },
    };

    const context = contextAssembly.assembleRefinementContext(actorId, task, localState);

    const taskItem = service.resolve('task.params.item', context, { validateEntity: false });
    const localItem = service.resolve('refinement.localState.pickupResult.item', context, {
      validateEntity: false,
    });

    expect(taskItem).toBe('apple_7');
    expect(localItem).toBe('apple_7');
  });
});

describe('ParameterResolutionService - Resolution Chains', () => {
  let entityManager;
  let service;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = createMockEntityManager();

    service = new ParameterResolutionService({
      entityManager,
      logger,
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should resolve reference to reference (multi-hop)', () => {
    const itemId = entityManager.createEntity();
    entityManager.addComponent(itemId, 'items:nutrition', { calories: 150 });

    const context = {
      task: {
        params: {
          itemRef: 'refinement.localState.pickedItem',
        },
      },
      refinement: {
        localState: {
          pickedItem: itemId,
        },
      },
    };

    // First resolve the reference
    const reference = service.resolve('task.params.itemRef', context, { validateEntity: false });
    expect(reference).toBe('refinement.localState.pickedItem');

    // Then resolve what it points to
    const itemIdResolved = service.resolve(reference, context, { validateEntity: false });
    expect(itemIdResolved).toBe(itemId);
  });

  it('should handle complex resolution workflows', () => {
    const actorId = entityManager.createEntity();
    const itemId = entityManager.createEntity();

    entityManager.addComponent(actorId, 'core:position', { room: 'tavern' });
    entityManager.addComponent(itemId, 'items:nutrition', { calories: 100 });

    const context = {
      task: {
        params: {
          targetRoom: 'tavern',
          item: itemId,
        },
      },
      refinement: {
        localState: {
          moveResult: {
            success: true,
            finalRoom: 'tavern',
          },
        },
      },
      actor: {
        id: actorId,
        components: entityManager.getAllComponents(actorId),
      },
    };

    // Resolve multiple related parameters
    const targetRoom = service.resolve('task.params.targetRoom', context, { validateEntity: false });
    const actualRoom = service.resolve('refinement.localState.moveResult.finalRoom', context, {
      validateEntity: false,
    });
    const itemIdResolved = service.resolve('task.params.item', context, { validateEntity: true });

    expect(targetRoom).toBe('tavern');
    expect(actualRoom).toBe('tavern');
    expect(itemIdResolved).toBe(itemId);
  });
});

describe('ParameterResolutionService - Error Message Clarity', () => {
  let entityManager;
  let service;
  let contextAssembly;
  let logger;
  let actorId;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = createMockEntityManager();

    service = new ParameterResolutionService({
      entityManager,
      logger,
    });

    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger,
      enableKnowledgeLimitation: false,
    });

    actorId = entityManager.createEntity();
    entityManager.addComponent(actorId, 'core:health', { value: 50, max: 100 });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should provide clear error message with partial path', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);

    expect(() => {
      service.resolve('actor.components.core:health.nonexistent', context);
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('actor.components.core:health.nonexistent', context);
    } catch (err) {
      expect(err.message).toContain("Parameter 'actor.components.core:health.nonexistent'");
      expect(err.message).toContain('Resolved: actor.components.core:health');
      expect(err.message).toContain('Failed at: nonexistent');
      expect(err.message).toContain('Available keys');
    }
  });

  it('should show available keys at failure point', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);

    expect(() => {
      service.resolve('actor.components.core:health.wrong', context);
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('actor.components.core:health.wrong', context);
    } catch (err) {
      expect(err.availableKeys).toContain('value');
      expect(err.availableKeys).toContain('max');
    }
  });

  it('should include context type in error message', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);

    expect(() => {
      service.resolve('actor.components.wrong:component', context, {
        contextType: 'refinement',
        stepIndex: 3,
      });
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('actor.components.wrong:component', context, {
        contextType: 'refinement',
        stepIndex: 3,
      });
    } catch (err) {
      expect(err.message).toContain('Context: refinement step 3');
    }
  });

  it('should clearly identify missing component', () => {
    const context = contextAssembly.assemblePlanningContext(actorId);

    expect(() => {
      service.resolve('actor.components.items:inventory', context);
    }).toThrow(ParameterResolutionError);
    try {
      service.resolve('actor.components.items:inventory', context);
    } catch (err) {
      expect(err.failedStep).toBe('items:inventory');
      expect(err.availableKeys).toContain('core:health');
      expect(err.availableKeys).not.toContain('items:inventory');
    }
  });
});

describe('ParameterResolutionService - Real-World Examples', () => {
  let entityManager;
  let service;
  let contextAssembly;
  let logger;
  let actorId;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = createMockEntityManager();

    service = new ParameterResolutionService({
      entityManager,
      logger,
    });

    contextAssembly = new ContextAssemblyService({
      entityManager,
      logger,
      enableKnowledgeLimitation: false,
    });

    actorId = entityManager.createEntity();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should resolve parameters from consume_nourishing_item example', () => {
    const itemId = entityManager.createEntity();
    entityManager.addComponent(itemId, 'items:nutrition', { calories: 150, health: 20 });

    const task = {
      id: 'consume_task',
      params: {
        item: itemId,
      },
    };

    const localState = {
      pickupResult: { success: true, item: itemId },
    };

    const context = contextAssembly.assembleRefinementContext(actorId, task, localState);

    const taskItem = service.resolve('task.params.item', context, { validateEntity: true });
    const pickedItem = service.resolve('refinement.localState.pickupResult.item', context, {
      validateEntity: true,
    });

    expect(taskItem).toBe(itemId);
    expect(pickedItem).toBe(itemId);
  });

  it('should handle parameter-state refinement pattern', () => {
    const roomId = 'room_kitchen';

    entityManager.addComponent(actorId, 'core:position', { room: 'room_bedroom' });

    const task = {
      id: 'move_task',
      params: {
        destination: roomId,
      },
    };

    const localState = {
      moveAction: {
        success: true,
        from: 'room_bedroom',
        to: roomId,
      },
    };

    const context = contextAssembly.assembleRefinementContext(actorId, task, localState);

    const destination = service.resolve('task.params.destination', context, {
      validateEntity: false,
    });
    const actualDestination = service.resolve('refinement.localState.moveAction.to', context, {
      validateEntity: false,
    });

    expect(destination).toBe(roomId);
    expect(actualDestination).toBe(roomId);
  });
});

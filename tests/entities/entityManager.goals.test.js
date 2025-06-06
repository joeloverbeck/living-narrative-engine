// tests/entityManager.goals.test.js

import EntityManager from '../../src/entities/entityManager.js';
import Entity from '../../src/entities/entity.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import { beforeEach, describe, expect, test } from '@jest/globals';

describe('EntityManager – core:goals injection logic', () => {
  let registryStub;
  let validatorStub;
  let loggerStub;
  let spatialIndexStub;
  let manager;

  beforeEach(() => {
    // 1. Stub IDataRegistry
    registryStub = {
      // This will be replaced per-test via jest.mock calls or direct assignment
      getEntityDefinition: jest.fn(),
    };

    // 2. Stub ISchemaValidator
    validatorStub = {
      validate: jest.fn(() => ({ isValid: true })),
    };

    // 3. Stub ILogger
    loggerStub = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // 4. Stub ISpatialIndexManager
    spatialIndexStub = {
      addEntity: jest.fn(),
      removeEntity: jest.fn(),
      updateEntityLocation: jest.fn(),
      clearIndex: jest.fn(),
      getEntitiesInLocation: jest.fn(() => new Set()),
    };

    // 5. Create the EntityManager instance
    manager = new EntityManager(
      registryStub,
      validatorStub,
      loggerStub,
      spatialIndexStub
    );
  });

  test('Actor with no core:goals → receives default { goals: [] }', () => {
    // Arrange: define an actor definition WITHOUT core:goals
    const defId = 'mod:testActorNoGoals';
    registryStub.getEntityDefinition.mockReturnValue({
      definitionId: defId,
      components: {
        [ACTOR_COMPONENT_ID]: {}, // minimal actor component
      },
    });

    // Act: create the entity
    const entity = manager.createEntityInstance(defId);

    // Assert: must not be null
    expect(entity).toBeInstanceOf(Entity);

    // 1. Actor component should be present
    expect(entity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);

    // 2. Since it was missing, the default core:goals must exist now
    expect(entity.hasComponent('core:goals')).toBe(true);

    // 3. That component’s data must equal exactly { goals: [] }
    const goalsData = entity.getComponentData('core:goals');
    expect(goalsData).toEqual({ goals: [] });

    // 4. We also injected default STM and notes
    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);

    // 5. Validator.validate must have been called for each injected component
    expect(validatorStub.validate).toHaveBeenCalledWith(
      SHORT_TERM_MEMORY_COMPONENT_ID,
      expect.any(Object)
    );
    expect(validatorStub.validate).toHaveBeenCalledWith(
      NOTES_COMPONENT_ID,
      expect.any(Object)
    );
    expect(validatorStub.validate).toHaveBeenCalledWith('core:goals', {
      goals: [],
    });
  });

  test('Actor with explicit core:goals (non-empty) → respects provided goals, does not override', () => {
    // Arrange: actor definition with explicit core:goals
    const defId = 'mod:testActorWithGoals';
    const initialGoals = {
      goals: [{ text: 'Find treasure', timestamp: '2025-01-01T12:00:00Z' }],
    };
    registryStub.getEntityDefinition.mockReturnValue({
      definitionId: defId,
      components: {
        [ACTOR_COMPONENT_ID]: {},
        'core:goals': initialGoals,
      },
    });

    // Act: create the entity
    const entity = manager.createEntityInstance(defId);

    // Assert: must not be null
    expect(entity).toBeInstanceOf(Entity);

    // 1. Actor component present
    expect(entity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);

    // 2. core:goals should still match exactly our initialGoals
    expect(entity.hasComponent('core:goals')).toBe(true);
    const goalsData = entity.getComponentData('core:goals');
    expect(goalsData).toEqual(initialGoals);

    // 3. Default STM and notes are still injected
    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);

    // 4. Validator.validate must have been called at least once for 'core:goals' with initialGoals
    expect(validatorStub.validate).toHaveBeenCalledWith(
      'core:goals',
      initialGoals
    );
  });

  test('Non-actor entity without core:goals → no core:goals injection', () => {
    // Arrange: a non-actor definition missing core:goals
    const defId = 'mod:testItemNoGoals';
    registryStub.getEntityDefinition.mockReturnValue({
      definitionId: defId,
      components: {
        // e.g. some item component
        'core:name': { name: 'Healing Potion' },
      },
    });

    // Act: create the entity
    const entity = manager.createEntityInstance(defId);

    // Assert: must not be null
    expect(entity).toBeInstanceOf(Entity);

    // 1. It should NOT have core:goals
    expect(entity.hasComponent('core:goals')).toBe(false);

    // 2. It also should NOT have short_term_memory or notes, because it's not an actor
    expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
    expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
  });
});

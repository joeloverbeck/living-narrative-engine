import { describe, test, expect, jest } from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';

const makeDeps = (definition) => {
  const registry = {
    getEntityDefinition: jest.fn().mockImplementation((definitionId) => {
      if (definitionId === definition.id) {
        const definitionData = {
          components: definition.components,
          description: definition.description,
        };
        return new EntityDefinition(definition.id, definitionData);
      }
      return null;
    }),
  };
  const validator = { validate: jest.fn().mockReturnValue({ isValid: true }) };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const spatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
    clearIndex: jest.fn(),
  };
  return { registry, validator, logger, spatialIndexManager };
};

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('EntityManager.createEntityInstance does not mutate definitions', () => {
  let mockEventDispatcher;

  test('components property remains unchanged when null', () => {
    const definition = { id: 'test:nullComps', components: null };
    const deps = makeDeps(definition);
    mockEventDispatcher = createMockSafeEventDispatcher();

    const em = new EntityManager(
      deps.registry,
      deps.validator,
      deps.logger,
      mockEventDispatcher
    );

    const entity = em.createEntityInstance(definition.id);
    expect(entity).not.toBeNull();
    expect(definition.components).toBeNull();
  });

  test('components property remains unchanged when valid object', () => {
    const definition = {
      id: 'test:validComps',
      components: { 'core:name': { value: 'A' } },
    };
    const deps = makeDeps(definition);

    mockEventDispatcher = createMockSafeEventDispatcher();

    const em = new EntityManager(
      deps.registry,
      deps.validator,
      deps.logger,
      mockEventDispatcher
    );

    const entity = em.createEntityInstance(definition.id);
    expect(entity).not.toBeNull();
    expect(definition.components).toEqual({ 'core:name': { value: 'A' } });
  });
});

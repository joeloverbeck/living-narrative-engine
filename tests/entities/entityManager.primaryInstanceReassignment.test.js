import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';

const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(() => ({ isValid: true })),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockSpatialIndexManager = () => ({
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  updateEntityLocation: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildIndex: jest.fn(),
  clearIndex: jest.fn(),
});

const DEF_ID = 'test:def-primary';

describe('EntityManager primary instance reassignment', () => {
  let registry;
  let validator;
  let logger;
  let spatial;
  let manager;

  beforeEach(() => {
    registry = createMockDataRegistry();
    validator = createMockSchemaValidator();
    logger = createMockLogger();
    spatial = createMockSpatialIndexManager();
    manager = new EntityManager(registry, validator, logger, spatial);

    registry.getEntityDefinition.mockReturnValue({
      id: DEF_ID,
      components: {},
    });
  });

  it('reassigns primary instance when removing current primary', () => {
    const first = manager.createEntityInstance(DEF_ID, 'id1');
    const second = manager.createEntityInstance(DEF_ID, 'id2');
    expect(manager.getPrimaryInstanceByDefinitionId(DEF_ID)).toBe(first);

    manager.removeEntityInstance('id1');

    expect(manager.getPrimaryInstanceByDefinitionId(DEF_ID)).toBe(second);
    expect(manager.activeEntities.has('id1')).toBe(false);
    expect(manager.activeEntities.has('id2')).toBe(true);
  });

  it('clears primary mapping when last instance is removed', () => {
    manager.createEntityInstance(DEF_ID, 'only');
    expect(manager.getPrimaryInstanceByDefinitionId(DEF_ID)).toBeDefined();
    manager.removeEntityInstance('only');
    expect(manager.getPrimaryInstanceByDefinitionId(DEF_ID)).toBeUndefined();
  });
});

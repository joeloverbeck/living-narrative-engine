// tests/entities/entityManager.getEntitiesWithComponent.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../src/entities/entityInstanceData.js';

// --- Mock Implementations ---
const createMockDataRegistry = () => ({ getEntityDefinition: jest.fn() });
const createMockSchemaValidator = () => ({ validate: jest.fn() }); // Not directly used by getEntitiesWithComponent
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});
const createMockSpatialIndexManager = () => ({
  // Not directly used by getEntitiesWithComponent
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  updateEntityLocation: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildIndex: jest.fn(),
  clearIndex: jest.fn(),
});
const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

// --- Test Suite ---
describe('EntityManager.getEntitiesWithComponent', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let mockEventDispatcher;

  // --- Test Constants ---
  const COMPONENT_A = 'core:component_a';
  const COMPONENT_B = 'core:component_b';
  const UNUSED_COMPONENT = 'core:unused';
  const UNKNOWN_COMPONENT = 'vendor:unknown';

  // These will now be treated as instance IDs for the test entities
  const ENTITY_1_INSTANCE_ID = 'instance-1';
  const ENTITY_2_INSTANCE_ID = 'instance-2';
  const ENTITY_3_INSTANCE_ID = 'instance-3';
  const DUMMY_DEFINITION_ID = 'def:dummy'; // A common definition ID for these test entities

  // Helper function to create entity instances for testing
  const createTestEntity = (
    instanceId,
    definitionId,
    defComponents = {},
    instanceOverrides = {}
  ) => {
    const definition = new EntityDefinition(definitionId, {
      description: `Test Definition ${definitionId}`,
      components: defComponents,
    });
    const instanceData = new EntityInstanceData(
      instanceId,
      definition,
      instanceOverrides
    );
    return new Entity(instanceData);
  };

  let entity1, entity2, entity3;

  beforeEach(() => {
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();
    mockEventDispatcher = createMockSafeEventDispatcher();
    entityManager = new EntityManager(
      mockRegistry,
      mockValidator,
      mockLogger,
      mockEventDispatcher
    );

    jest.clearAllMocks();
    entityManager.activeEntities.clear();

    // Create test entities with components as instance overrides
    entity1 = createTestEntity(
      ENTITY_1_INSTANCE_ID,
      DUMMY_DEFINITION_ID,
      {},
      { [COMPONENT_A]: { value: 1 } }
    );

    entity2 = createTestEntity(
      ENTITY_2_INSTANCE_ID,
      DUMMY_DEFINITION_ID,
      {},
      { [COMPONENT_B]: { text: 'hello' } }
    );

    entity3 = createTestEntity(
      ENTITY_3_INSTANCE_ID,
      DUMMY_DEFINITION_ID,
      {},
      {
        [COMPONENT_A]: { value: 3 },
        [COMPONENT_B]: { text: 'world' },
      }
    );
  });

  afterEach(() => {
    if (entityManager) {
      entityManager.clearAll();
    }
  });

  it('should return an empty array ([]) if the entity manager is empty', () => {
    expect(entityManager.activeEntities.size).toBe(0);
    const result = entityManager.getEntitiesWithComponent(COMPONENT_A);
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found 0 entities with component '${COMPONENT_A}'`
      )
    );
  });

  it('should return an empty array ([]) if no active entities have the specified component', () => {
    entityManager.activeEntities.set(entity2.id, entity2); // entity2 has COMPONENT_B only

    const result = entityManager.getEntitiesWithComponent(COMPONENT_A);
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found 0 entities with component '${COMPONENT_A}'`
      )
    );
  });

  it('should return an array containing only entities that have the specified component (single match)', () => {
    entityManager.activeEntities.set(entity1.id, entity1); // Has A
    entityManager.activeEntities.set(entity2.id, entity2); // Has B

    const result = entityManager.getEntitiesWithComponent(COMPONENT_A);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(entity1);
    expect(result[0].id).toBe(ENTITY_1_INSTANCE_ID);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found 1 entities with component '${COMPONENT_A}'`
      )
    );
  });

  it('should return an array containing only entities that have the specified component (multiple matches)', () => {
    entityManager.activeEntities.set(entity1.id, entity1); // Has A
    entityManager.activeEntities.set(entity2.id, entity2); // Has B
    entityManager.activeEntities.set(entity3.id, entity3); // Has A and B

    const resultA = entityManager.getEntitiesWithComponent(COMPONENT_A);
    expect(resultA).toHaveLength(2);
    const resultAIds = resultA.map((e) => e.id).sort();
    expect(resultAIds).toEqual(
      [ENTITY_1_INSTANCE_ID, ENTITY_3_INSTANCE_ID].sort()
    );
    expect(resultA.find((e) => e.id === ENTITY_1_INSTANCE_ID)).toBe(entity1);
    expect(resultA.find((e) => e.id === ENTITY_3_INSTANCE_ID)).toBe(entity3);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found 2 entities with component '${COMPONENT_A}'`
      )
    );

    const resultB = entityManager.getEntitiesWithComponent(COMPONENT_B);
    expect(resultB).toHaveLength(2);
    const resultBIds = resultB.map((e) => e.id).sort();
    expect(resultBIds).toEqual(
      [ENTITY_2_INSTANCE_ID, ENTITY_3_INSTANCE_ID].sort()
    );
    expect(resultB.find((e) => e.id === ENTITY_2_INSTANCE_ID)).toBe(entity2);
    expect(resultB.find((e) => e.id === ENTITY_3_INSTANCE_ID)).toBe(entity3);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found 2 entities with component '${COMPONENT_B}'`
      )
    );
  });

  it('should return an empty array ([]) and not throw for an unknown or unused component type ID', () => {
    entityManager.activeEntities.set(entity1.id, entity1);
    entityManager.activeEntities.set(entity2.id, entity2);
    entityManager.activeEntities.set(entity3.id, entity3);

    let result;
    expect(() => {
      result = entityManager.getEntitiesWithComponent(UNKNOWN_COMPONENT);
    }).not.toThrow();
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found 0 entities with component '${UNKNOWN_COMPONENT}'`
      )
    );

    expect(() => {
      result = entityManager.getEntitiesWithComponent(UNUSED_COMPONENT);
    }).not.toThrow();
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Found 0 entities with component '${UNUSED_COMPONENT}'`
      )
    );
  });

  it('should return an empty array ([]) for invalid componentTypeIds (null, undefined, empty string, non-string)', () => {
    entityManager.activeEntities.set(entity1.id, entity1);

    expect(entityManager.getEntitiesWithComponent(null)).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('null'). Returning empty array."
    );
    mockLogger.debug.mockClear();

    expect(entityManager.getEntitiesWithComponent(undefined)).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('undefined'). Returning empty array."
    );
    mockLogger.debug.mockClear();

    expect(entityManager.getEntitiesWithComponent('')).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "EntityManager.getEntitiesWithComponent: Received invalid componentTypeId (''). Returning empty array."
    );
    mockLogger.debug.mockClear();

    expect(entityManager.getEntitiesWithComponent('   ')).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('   '). Returning empty array."
    );
    mockLogger.debug.mockClear();

    expect(entityManager.getEntitiesWithComponent(123)).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('123'). Returning empty array."
    );
    mockLogger.debug.mockClear();

    expect(entityManager.getEntitiesWithComponent({})).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('[object Object]'). Returning empty array."
    );
  });

  it('should return a new array (not a live reference)', () => {
    entityManager.activeEntities.set(entity1.id, entity1);
    entityManager.activeEntities.set(entity3.id, entity3);

    const initialResult = entityManager.getEntitiesWithComponent(COMPONENT_A);
    expect(initialResult).toHaveLength(2);
    expect(initialResult.map((e) => e.id).sort()).toEqual(
      [ENTITY_1_INSTANCE_ID, ENTITY_3_INSTANCE_ID].sort()
    );

    entityManager.activeEntities.delete(entity1.id); // Modify source map

    const newEntity4InstanceId = 'instance-4';
    const newEntity4 = createTestEntity(
      newEntity4InstanceId,
      DUMMY_DEFINITION_ID,
      {},
      { [COMPONENT_A]: { value: 4 } }
    );
    entityManager.activeEntities.set(newEntity4.id, newEntity4);

    expect(initialResult).toHaveLength(2); // Original result unchanged
    expect(initialResult.map((e) => e.id).sort()).toEqual(
      [ENTITY_1_INSTANCE_ID, ENTITY_3_INSTANCE_ID].sort()
    );

    const newResult = entityManager.getEntitiesWithComponent(COMPONENT_A);
    expect(newResult).toHaveLength(2);
    expect(newResult.map((e) => e.id).sort()).toEqual(
      [ENTITY_3_INSTANCE_ID, newEntity4InstanceId].sort()
    );
  });
});

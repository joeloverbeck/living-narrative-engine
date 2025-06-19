// tests/entities/entityManager.test.js
// --- FILE START ---

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
  fail,
} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import {
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../src/constants/eventIds.js';
import { DefinitionNotFoundError } from '../../src/errors/definitionNotFoundError';
import { EntityNotFoundError } from '../../src/errors/entityNotFoundError';

// --- Mock Implementations ---
const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(() => ({ isValid: true })), // Default to valid
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

// --- Constants ---
const MOCK_DEFINITION_ID_MAIN = 'test-def:main';
const MOCK_DEFINITION_ID_ACTOR = 'test-def:actor';
const MOCK_DEFINITION_ID_ITEM = 'test-def:item';
const DEF_ID_FOR_OVERRIDES = 'test-def:for-overrides'; // New definition ID

const ACCESS_DEFINITION_ID = 'access-def:item';
const ACCESS_INSTANCE_ID = 'access-instance-uuid-99';

const EXISTING_COMPONENT_ID = 'core:stats';
const EXISTING_COMPONENT_DATA = { hp: 10, mp: 5 };
const NON_EXISTENT_COMPONENT_ID = 'core:inventory';
const NON_EXISTENT_ENTITY_INSTANCE_ID = 'ghost-instance-uuid-404';

// Common raw definitions for tests that need them - ensure they have an 'id' field
const rawDefMain = {
  id: MOCK_DEFINITION_ID_MAIN,
  description: 'Main test def',
  components: { 'core:name': { name: 'Main Def' } },
};
const rawDefActorForTests = {
  id: MOCK_DEFINITION_ID_ACTOR,
  description: 'Actor test def',
  components: {
    [ACTOR_COMPONENT_ID]: { type: 'test-actor' },
    'core:name': { name: 'Test Actor Default Name' },
  },
};
const rawDefItem = {
  id: MOCK_DEFINITION_ID_ITEM,
  description: 'Item test def',
  components: { 'core:value': { value: 10 } },
};
const rawDefForOverrides = {
  // New raw definition for override tests
  id: DEF_ID_FOR_OVERRIDES,
  description: 'Definition for testing component overrides',
  components: {
    [EXISTING_COMPONENT_ID]: { hp: 5, mp: 2, special: 'From Definition' }, // Base data for core:stats
    'core:name': { name: 'Override Test Def' },
  },
};
// FIXED: This definition was missing 'core:name', causing a later test to fail.
const rawDefBasicForTests = {
  id: 'test:basic', // Ensure definitions have IDs for EntityDefinition constructor
  description: 'A basic entity definition for testing.',
  components: {
    'core:name': { name: 'Basic Def Name' },
    'core:description': { text: 'Basic Def' },
  },
};
const rawDefWithPosForTests = {
  id: 'test:defWithPos', // Ensure definitions have IDs
  description: 'A positioned entity for addComponent tests or global use',
  components: {
    'core:name': { name: 'Positioned Entity Global' },
    [POSITION_COMPONENT_ID]: { locationId: 'loc:global-pos', x: 10, y: 10 },
  },
};

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('EntityManager', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let mockEventDispatcher;

  // Declare variables for EntityDefinition instances here
  let entityDefMain;
  let entityDefActor;
  let entityDefItem;
  let entityDefForOverrides;
  let entityDefBasic;
  let entityDefWithPosGlobal;
  let entityDefBasicReconstruct;

  beforeEach(() => {
    // Instantiate EntityDefinition objects fresh for each test
    entityDefMain = new EntityDefinition(MOCK_DEFINITION_ID_MAIN, rawDefMain);
    entityDefActor = new EntityDefinition(
      MOCK_DEFINITION_ID_ACTOR,
      rawDefActorForTests
    );
    entityDefItem = new EntityDefinition(MOCK_DEFINITION_ID_ITEM, rawDefItem);
    entityDefForOverrides = new EntityDefinition(
      DEF_ID_FOR_OVERRIDES,
      rawDefForOverrides
    );
    entityDefBasic = new EntityDefinition('test:basic', rawDefBasicForTests);
    entityDefWithPosGlobal = new EntityDefinition(
      'test:defWithPos',
      rawDefWithPosForTests
    );
    entityDefBasicReconstruct = new EntityDefinition(
      'test-def:basicReconstruct',
      {
        // A simplified version of rawDefBasicForTests for reconstruction tests
        id: 'test-def:basicReconstruct',
        description: 'A basic entity definition for reconstruction testing.',
        components: {
          'core:name': { name: 'Default Reconstruct Name' },
        },
      }
    );

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

    // Centralized mock for getEntityDefinition
    mockRegistry.getEntityDefinition.mockImplementation((id) => {
      if (id === MOCK_DEFINITION_ID_MAIN) return entityDefMain;
      if (id === MOCK_DEFINITION_ID_ACTOR) return entityDefActor;
      if (id === MOCK_DEFINITION_ID_ITEM) return entityDefItem;
      if (id === DEF_ID_FOR_OVERRIDES) return entityDefForOverrides; // Add to mock registry
      if (id === 'test:basic') return entityDefBasic;
      if (id === 'test:defWithPos') return entityDefWithPosGlobal;
      if (id === 'test-def:basicReconstruct') return entityDefBasicReconstruct;
      // For specific tests that define their own raw defs inline
      if (id === 'test:positioned') {
        // Used in createEntityInstance describe block
        return new EntityDefinition(id, {
          id: 'test:positioned', // id for EntityDefinition
          description: 'A positioned entity',
          components: {
            'core:name': { name: 'Positioned Entity' },
            [POSITION_COMPONENT_ID]: { locationId: 'loc:start', x: 1, y: 1 },
          },
        });
      }
      return undefined;
    });

    mockValidator.validate.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.debug.mockClear();
    mockEventDispatcher.dispatch.mockClear();
  });

  afterEach(() => {
    if (entityManager) {
      entityManager.clearAll();
    }
    jest.clearAllMocks();
  });

  // Helper function for tests needing an entity with overrides
  const setupEntityWithOverrides = (instanceIdSuffix = '') => {
    // FIXED: Removed malformed HTML from instance ID generation
    const instanceId = `override-instance-${EXISTING_COMPONENT_ID}${instanceIdSuffix}`;

    // Ensure entityDefForOverrides is available from the beforeEach scope
    const definition = entityDefForOverrides;
    const overrideData = { hp: 20, mp: 15, special: 'From Override' };

    // Temporarily and explicitly ensure the mock registry handles DEF_ID_FOR_OVERRIDES
    // This is a bit forceful but aims to overcome any prior mock state issues for this specific ID.
    const originalGetEntityDefinition = mockRegistry.getEntityDefinition;
    mockRegistry.getEntityDefinition = jest.fn((id) => {
      if (id === DEF_ID_FOR_OVERRIDES) {
        return entityDefForOverrides; // Ensure this specific definition is returned
      }
      // Fallback to the original mock for any other IDs, preserving general mock behavior
      return originalGetEntityDefinition(id);
    });

    let entity;
    try {
      entity = entityManager.createEntityInstance(DEF_ID_FOR_OVERRIDES, {
        instanceId,
        componentOverrides: {
          [EXISTING_COMPONENT_ID]: overrideData,
          'core:extra': { info: 'Extra Component For Override Test' },
        },
      });
    } catch (e) {
      // Restore mock immediately if createEntityInstance throws, then rethrow
      mockRegistry.getEntityDefinition = originalGetEntityDefinition;
      throw e;
    }

    // Restore the original mock implementation after the call
    mockRegistry.getEntityDefinition = originalGetEntityDefinition;

    return { entity, definition, overrideData };
  };

  // --- 1. Constructor Tests ---
  describe('constructor', () => {
    it('should create an instance successfully with valid dependencies', () => {
      expect(entityManager).toBeInstanceOf(EntityManager);
    });

    const invalidRegistryMissingMethod = { ...createMockDataRegistry() };
    delete invalidRegistryMissingMethod.getEntityDefinition;
    const invalidValidatorMissingMethod = { ...createMockSchemaValidator() };
    delete invalidValidatorMissingMethod.validate;
    const invalidLoggerMissingMethod = { ...createMockLogger() };
    delete invalidLoggerMissingMethod.error;
    const invalidEventDispatcherMissingMethod = { ...createMockSafeEventDispatcher() };
    delete invalidEventDispatcherMissingMethod.dispatch;

    it.each([
      ['IDataRegistry', null, /Missing required dependency: IDataRegistry/],
      [
        'ISchemaValidator',
        null,
        /Missing required dependency: ISchemaValidator/,
      ],
      ['ILogger', null, /Missing required dependency: ILogger/],
      [
        'ISafeEventDispatcher',
        null,
        /Missing required dependency: ISafeEventDispatcher/,
      ],
      [
        'IDataRegistry (missing method)',
        invalidRegistryMissingMethod,
        /Invalid or missing method 'getEntityDefinition' on dependency 'IDataRegistry'/,
      ],
      [
        'ISchemaValidator (missing method)',
        invalidValidatorMissingMethod,
        /Invalid or missing method 'validate' on dependency 'ISchemaValidator'/,
      ],
      [
        'ILogger (missing method)',
        invalidLoggerMissingMethod,
        /Invalid or missing method 'error' on dependency 'ILogger'/,
      ],
      [
        'ISafeEventDispatcher (missing method)',
        invalidEventDispatcherMissingMethod,
        /Invalid or missing method 'dispatch' on dependency 'ISafeEventDispatcher'/,
      ],
    ])(
      'should throw an Error if %s is missing or invalid (%p)',
      (depName, invalidDep, expectedError) => {
        const args = [
          depName.startsWith('IDataRegistry') ? invalidDep : mockRegistry,
          depName.startsWith('ISchemaValidator') ? invalidDep : mockValidator,
          depName.startsWith('ILogger') ? invalidDep : mockLogger,
          depName.startsWith('ISafeEventDispatcher')
            ? invalidDep
            : mockEventDispatcher,
        ];
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        expect(() => new EntityManager(...args)).toThrow(expectedError);
        consoleErrorSpy.mockRestore();
      }
    );
  });

  // --- 2. createEntityInstance Tests ---
  describe('createEntityInstance', () => {
    it('should create an entity and add it to active entities', () => {
      const entity = entityManager.createEntityInstance(entityDefMain.id);
      expect(entity).toBeInstanceOf(Entity);
      expect(entityManager.getEntityInstance(entity.id)).toBe(entity);
      expect(entityManager.activeEntities.has(entity.id)).toBe(true);
    });

    it('should create an entity with a specific instance ID', () => {
      const instanceId = 'test-instance-123';
      const entity = entityManager.createEntityInstance(entityDefMain.id, {
        instanceId,
      });
      expect(entity.id).toBe(instanceId);
    });

    it('should dispatch ENTITY_CREATED_ID event when an entity is created', () => {
      const entity = entityManager.createEntityInstance(entityDefMain.id);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        { entity, wasReconstructed: false }
      );
    });

    it('should dispatch ENTITY_CREATED_ID event even if entity has no position component', () => {
      // This test ensures the event is always dispatched, regardless of position component presence,
      // as spatial index logic is now decoupled.
      const entity = entityManager.createEntityInstance(entityDefBasic.id); // entityDefBasic has no position component
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        { entity, wasReconstructed: false }
      );
    });

    it('should throw DefinitionNotFoundError if definition not found', () => {
      const unknownDefId = 'unknown:def-for-create';
      const instanceId = 'create-def-not-found-instance';
      expect(() => {
        entityManager.createEntityInstance(unknownDefId, { instanceId });
      }).toThrow(DefinitionNotFoundError);
    });

    it('should throw if an entity with the same ID already exists', () => {
      const instanceId = 'duplicate-id-test';
      entityManager.createEntityInstance(entityDefMain.id, { instanceId }); // Create first entity
      mockEventDispatcher.dispatch.mockClear(); // Clear dispatch from first creation

      expect(() => {
        entityManager.createEntityInstance(entityDefMain.id, { instanceId }); // Attempt to create duplicate
      }).toThrow(`Entity with ID '${instanceId}' already exists.`);
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled(); // No event for failed creation
    });

    it('should validate and apply component overrides', () => {
      const instanceId = 'override-test-create';
      const overrideData = { hp: 50, mp: 25 };
      const entity = entityManager.createEntityInstance(DEF_ID_FOR_OVERRIDES, {
        instanceId,
        componentOverrides: {
          [EXISTING_COMPONENT_ID]: overrideData,
        },
      });
      expect(entity.getComponentData(EXISTING_COMPONENT_ID)).toEqual(overrideData);
      expect(mockValidator.validate).toHaveBeenCalledWith(EXISTING_COMPONENT_ID, overrideData);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        { entity, wasReconstructed: false }
      );
    });

    it('should throw if component override validation fails', () => {
      const instanceId = 'override-fail-test-create';
      const invalidOverrideData = { hp: 'very low' }; // Assuming this is invalid
      mockValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: [{ message: 'Invalid HP for override create test' }],
      });

      expect(() => {
        entityManager.createEntityInstance(DEF_ID_FOR_OVERRIDES, {
          instanceId,
          componentOverrides: {
            [EXISTING_COMPONENT_ID]: invalidOverrideData,
          },
        });
      }).toThrow(
        new RegExp(
          `Override for component ${EXISTING_COMPONENT_ID} on entity ${instanceId} Errors:[\\s\\S]*Invalid HP for override create test`
        )
      );
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  // --- 3. reconstructEntity Tests ---
  describe('reconstructEntity', () => {
    const defIdForReconstruct = 'test-def:basicReconstruct';
    const instanceId = 'reconstruct-uuid-123';
    let baseSerializedEntityData; // This is now a POJO

    beforeEach(() => {
      const entityDefForReconstructTestScope =
        mockRegistry.getEntityDefinition(defIdForReconstruct);
      if (!entityDefForReconstructTestScope) {
        throw new Error(
          `Test setup failed: Definition '${defIdForReconstruct}' not found by mockRegistry.`
        );
      }
      // FIXED: baseSerializedEntityData is now a plain object (POJO) as expected by reconstructEntity.
      baseSerializedEntityData = {
        instanceId: instanceId,
        definitionId: defIdForReconstruct,
        components: { 'core:name': { name: 'Reconstructed Name' } },
      };
    });

    it('should reconstruct an entity successfully', () => {
      const entity = entityManager.reconstructEntity(baseSerializedEntityData);
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe(instanceId);
      expect(entity.definitionId).toBe(defIdForReconstruct);
      expect(entity.getComponentData('core:name').name).toBe(
        'Reconstructed Name'
      );
      expect(entityManager.getEntityInstance(instanceId)).toBe(entity);
    });

    it('should throw error if serialized data is missing a valid instanceId', () => {
      expect(() =>
        entityManager.reconstructEntity({
          // 'instanceId' key is missing
          definitionId: defIdForReconstruct,
          components: {},
        })
      ).toThrow("EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.");
    });

    it('should throw error if entity with the same ID already exists', () => {
      // Create an entity with the same ID first
      entityManager.createEntityInstance(defIdForReconstruct, { instanceId });
      // Now, attempting to reconstruct should fail
      expect(() =>
        entityManager.reconstructEntity(baseSerializedEntityData)
      ).toThrow(
        `EntityManager.reconstructEntity: Entity with ID '${instanceId}' already exists. Reconstruction aborted.`
      );
    });

    it('should throw DefinitionNotFoundError if definition for reconstruction is not found', () => {
      const originalGetDef = mockRegistry.getEntityDefinition;
      // Simulate definition not found in registry for this specific ID
      mockRegistry.getEntityDefinition = jest.fn().mockImplementation((id) => {
        if (id === 'unknown:def-for-reconstruct-test') {
          return null;
        }
        return originalGetDef(id);
      });

      const altInstanceId = 'reconstruct-uuid-123-alt-recon-test';
      const unknownDefId = 'unknown:def-for-reconstruct-test';
      // FIXED: Use a POJO for the serialized data
      const serializedWithUnknownDef = {
        instanceId: altInstanceId,
        definitionId: unknownDefId,
        components: {
          instanceId: altInstanceId,
          definitionId: unknownDefId,
          overrides: {},
        },
      };

      expect(() =>
        entityManager.reconstructEntity(serializedWithUnknownDef)
      ).toThrow(DefinitionNotFoundError);

      expect(() =>
        entityManager.reconstructEntity(serializedWithUnknownDef)
      ).toThrow(`Entity definition not found: '${unknownDefId}'`);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `EntityManager.reconstructEntity: Definition '${unknownDefId}' not found in registry for entity '${altInstanceId}'. Reconstruction aborted.`
      );
      mockRegistry.getEntityDefinition = originalGetDef;
    });

    it('should dispatch ENTITY_CREATED_ID event with wasReconstructed true when an entity is reconstructed', () => {
      const posDefId = entityDefWithPosGlobal.id; // 'test:defWithPos' - still useful for creating a valid entity
      const posInstanceId = 'recon-pos-id-global-test-event'; // new ID to avoid clashes

      const serializedEntityData = { // Renamed for clarity, can be with or without position
        instanceId: posInstanceId,
        definitionId: posDefId, // Using an existing valid definition
        components: {
          'core:name': { name: 'Reconstructed For Event Test' }, // Basic override
          // Position component is not strictly necessary for this event dispatch test itself
          // but including it ensures the entity is complex enough for a good test.
          [POSITION_COMPONENT_ID]: {
            locationId: 'recon:loc-global-test-event',
            x: 5,
            y: 5,
          },
        },
      };

      const entity = entityManager.reconstructEntity(serializedEntityData);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        { entity, wasReconstructed: true }
      );
    });

    it('should dispatch ENTITY_CREATED_ID event (wasReconstructed true) for entity without position', () => {
      const instanceId = 'recon-no-pos-event-test';
      const serializedEntityData = {
        instanceId: instanceId,
        definitionId: defIdForReconstruct, // Uses 'test-def:basicReconstruct' which has no position
        components: { 'core:name': { name: 'Reconstructed No Pos For Event Test' } },
      };

      const entity = entityManager.reconstructEntity(serializedEntityData);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        { entity, wasReconstructed: true }
      );
    });

    it('should handle null component data during reconstruction', () => {
      const nullCompInstanceId = `${instanceId}-null-comp-recon-test`;
      // FIXED: Use a POJO for the serialized data
      const serializedWithNullComp = {
        instanceId: nullCompInstanceId,
        definitionId: defIdForReconstruct,
        components: { 'core:custom': null },
      };

      const entity = entityManager.reconstructEntity(serializedWithNullComp);
      expect(entity.hasComponent('core:custom')).toBe(true);
      expect(entity.getComponentData('core:custom')).toBeNull();
    });

    it('throws error if component validation fails during reconstruction', () => {
      const instanceIdFailRecon = `${instanceId}-fail-recon-val-test`;
      mockValidator.validate.mockImplementation((typeId, data) => {
        if (typeId === 'core:stats' && data.hp < 5) {
          return {
            isValid: false,
            errors: [{ message: 'HP critically low on recon val test' }],
          };
        }
        return { isValid: true };
      });

      // FIXED: Use a POJO for the serialized data
      const serializedToFail = {
        instanceId: instanceIdFailRecon,
        definitionId: defIdForReconstruct,
        components: { 'core:stats': { hp: 1 } },
      };

      expect(() => {
        entityManager.reconstructEntity(serializedToFail);
      }).toThrow(
        new RegExp(
          `Reconstruction component core:stats for entity ${instanceIdFailRecon} \\(definition ${defIdForReconstruct}\\) Errors:\\s*\\[\\s*{\\s*"message":\\s*"HP critically low on recon val test"\\s*}\\s*\\]`
        )
      );
    });
  });

  // --- 4. removeEntityInstance Tests ---
  describe('removeEntityInstance', () => {
    const defIdWithPosForRemoveInstanceTest = 'test:positioned'; // This ID is set up in global mockRegistry to have 'loc:start'

    it('should remove an existing entity and update internal state', () => {
      const instanceId = 'remove-test-entity';
      const entity = entityManager.createEntityInstance(entityDefBasic.id, { instanceId });
      mockEventDispatcher.dispatch.mockClear(); // Clear event from creation

      const result = entityManager.removeEntityInstance(instanceId);
      expect(result).toBe(true);
      expect(entityManager.activeEntities.has(instanceId)).toBe(false);
      expect(entityManager.getEntityInstance(instanceId)).toBeUndefined();
      // Event check is handled in specific tests below
    });

    // --- FIXED TEST ---
    it('should throw EntityNotFoundError if entity does not exist', () => {
      const nonExistentId = 'non-existent-entity';
      expect(() => entityManager.removeEntityInstance(nonExistentId)).toThrow(
        EntityNotFoundError
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance '${nonExistentId}'.`
      );
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should dispatch ENTITY_REMOVED_ID event when removing an entity (with position component)', () => {
      const instanceId = 'event-remove-test-pos-instance';
      // 'test:positioned' has locationId: 'loc:start' by default from mockRegistry setup
      const entityToRemove = entityManager.createEntityInstance(defIdWithPosForRemoveInstanceTest, {
        instanceId,
      });
      expect(entityToRemove.hasComponent(POSITION_COMPONENT_ID)).toBe(true); // Pre-condition check

      mockEventDispatcher.dispatch.mockClear(); // Clear event from creation

      entityManager.removeEntityInstance(instanceId);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_REMOVED_ID,
        { entity: entityToRemove }
      );
    });

    it('should dispatch ENTITY_REMOVED_ID event when removing an entity (without position component)', () => {
      const instanceId = 'event-remove-test-no-pos-instance';
      // entityDefBasic has no position component by default
      const entityToRemove = entityManager.createEntityInstance(entityDefBasic.id, { instanceId });
      expect(entityToRemove.hasComponent(POSITION_COMPONENT_ID)).toBe(false); // Pre-condition check

      mockEventDispatcher.dispatch.mockClear(); // Clear event from creation

      entityManager.removeEntityInstance(instanceId);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_REMOVED_ID,
        { entity: entityToRemove }
      );
    });
  });

  // --- 5. Component Manipulation & Access ---
  describe('Component Manipulation & Access', () => {
    let entity;
    const entityId = ACCESS_INSTANCE_ID;
    const defIdAccess = ACCESS_DEFINITION_ID; // Use a distinct ID for this section's definition
    const rawAccessDef = {
      id: defIdAccess,
      description: 'For access tests',
      components: { [EXISTING_COMPONENT_ID]: { ...EXISTING_COMPONENT_DATA } },
    };
    const entityDefAccess = new EntityDefinition(defIdAccess, rawAccessDef);

    beforeEach(() => {
      mockRegistry.getEntityDefinition.mockImplementation((id) => {
        if (id === defIdAccess) return entityDefAccess;
        if (id === 'test:basic') return entityDefBasic; // Used by some sub-tests
        // Add other defs if sub-tests for addComponent/removeComponent create entities with other defs
        if (id === 'test:initialPosDef') {
          // For addComponent spatial test
          return new EntityDefinition(id, {
            id: id,
            components: {
              [POSITION_COMPONENT_ID]: { locationId: 'old:loc', x: 1, y: 1 },
            },
          });
        }
        if (id === 'test:initialPosDef2') {
          // For addComponent spatial test
          return new EntityDefinition(id, {
            id: id,
            components: {
              [POSITION_COMPONENT_ID]: { locationId: 'start:loc', x: 1, y: 1 },
            },
          });
        }
        if (id === 'test:posDefForRemove') {
          // For removeComponent spatial test
          return new EntityDefinition(id, {
            id: id,
            components: {
              [POSITION_COMPONENT_ID]: {
                locationId: 'removable:loc',
                x: 1,
                y: 1,
              },
            },
          });
        }
        if (id === 'def-no-loc-spatial') {
          // For removeComponent spatial test
          return new EntityDefinition(id, {
            id: id,
            components: { [POSITION_COMPONENT_ID]: { x: 5, y: 5 } },
          });
        }
        return undefined;
      });
      mockValidator.validate.mockReturnValue({ isValid: true }); // Default valid
      entity = entityManager.createEntityInstance(defIdAccess, {
        instanceId: entityId,
      });

      // Clear mocks that might have been called during this specific entity creation
      mockValidator.validate.mockClear(); // Clear after setup
      mockSpatialIndex.addEntity.mockClear();
      mockSpatialIndex.updateEntityLocation.mockClear();
      mockSpatialIndex.removeEntity.mockClear();
      mockLogger.info.mockClear(); // Clear info logs from creation
      mockEventDispatcher.dispatch.mockClear(); // Clear events from entity creation
    });

    describe('addComponent', () => {
      it('should add a new component and dispatch COMPONENT_ADDED_ID event', () => {
        const newComponentId = NON_EXISTENT_COMPONENT_ID;
        const newData = { value: 100 };
        // mockEventDispatcher.dispatch.mockClear(); // Already cleared in beforeEach of parent describe

        entityManager.addComponent(entityId, newComponentId, newData);
        expect(entity.hasComponent(newComponentId)).toBe(true);
        expect(entity.getComponentData(newComponentId)).toEqual(newData);
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_ADDED_ID,
          { entity, componentTypeId: newComponentId, componentData: newData }
        );
      });

      it('should update an existing component and dispatch COMPONENT_ADDED_ID event', () => {
        const existingComponentId = EXISTING_COMPONENT_ID;
        const updatedData = { hp: 20, mp: 10, armor: 5 };
        // mockEventDispatcher.dispatch.mockClear();

        entityManager.addComponent(entityId, existingComponentId, updatedData);
        expect(entity.getComponentData(existingComponentId)).toEqual(updatedData);
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_ADDED_ID,
          { entity, componentTypeId: existingComponentId, componentData: updatedData }
        );
      });

      it('should dispatch COMPONENT_ADDED_ID event when adding/updating POSITION_COMPONENT', () => {
        const newPositionData = {
          locationId: 'new:loc-for-add-event',
          x: 5,
          y: 5,
        };
        // mockEventDispatcher.dispatch.mockClear();

        entityManager.addComponent(entityId, POSITION_COMPONENT_ID, newPositionData);
        expect(entity.getComponentData(POSITION_COMPONENT_ID)).toEqual(newPositionData);
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_ADDED_ID,
          { entity, componentTypeId: POSITION_COMPONENT_ID, componentData: newPositionData }
        );

        mockEventDispatcher.dispatch.mockClear(); // Clear for next call in this test

        const updatedPositionData = {
          locationId: 'updated:loc-for-add-event',
          x: 15,
          y: 15,
        };
        entityManager.addComponent(entityId, POSITION_COMPONENT_ID, updatedPositionData);
        expect(entity.getComponentData(POSITION_COMPONENT_ID)).toEqual(updatedPositionData);
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_ADDED_ID,
          { entity, componentTypeId: POSITION_COMPONENT_ID, componentData: updatedPositionData }
        );
      });

      it('should throw EntityNotFoundError if entity not found and not dispatch event', () => {
        // mockEventDispatcher.dispatch.mockClear(); // Ensure clean slate if needed, though error should prevent dispatch
        expect(() => {
          entityManager.addComponent(
            NON_EXISTENT_ENTITY_INSTANCE_ID,
            'comp:test',
            {}
          );
        }).toThrow(EntityNotFoundError);
        expect(mockLogger.error).toHaveBeenCalledWith(
          `EntityManager.addComponent: Entity not found with ID: ${NON_EXISTENT_ENTITY_INSTANCE_ID}`,
          expect.any(Object) // For the Error object logged
        );
        expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
      });

      it('should throw if component validation fails and not dispatch event', () => {
        mockValidator.validate.mockReturnValueOnce({
          isValid: false,
          errors: [{ message: 'Invalid data for stats addComponent event test' }],
        });
        const newStatsData = { hp: 'extremely high' };
        // mockEventDispatcher.dispatch.mockClear();

        expect(() => {
          entityManager.addComponent(entityId, 'core:stats', newStatsData);
        }).toThrow(
          new RegExp(
            `addComponent core:stats to entity ${entityId} Errors:\\s*\\[\\s*{\\s*"message":\\s*"Invalid data for stats addComponent event test"\\s*}\\s*\\]`
          )
        );
        expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
      });
    });

    describe('removeComponent', () => {
      it('should remove an existing component override and dispatch COMPONENT_REMOVED_ID event', () => {
        const { entity, definition, overrideData } = setupEntityWithOverrides(); // FIXED: Added definition
        const entityId = entity.id;

        // Clear dispatch calls from setupEntityWithOverrides if any (it calls createEntityInstance)
        // and any addComponent calls within it.
        mockEventDispatcher.dispatch.mockClear();

        const result = entityManager.removeComponent(
          entityId,
          EXISTING_COMPONENT_ID
        );
        expect(result).toBe(true);

        const updatedEntity = entityManager.getEntityInstance(entityId);

        expect(updatedEntity).toBe(entity);
        expect(updatedEntity).toBeDefined();

        expect(updatedEntity.instanceData).toBeDefined();

        if (updatedEntity.instanceData) {
          expect(
            updatedEntity.instanceData.overrides.hasOwnProperty(
              EXISTING_COMPONENT_ID
            )
          ).toBe(false);
          expect(updatedEntity.hasComponent(EXISTING_COMPONENT_ID, true)).toBe(
            false
          );

          if (
            definition.components &&
            definition.components[EXISTING_COMPONENT_ID]
          ) {
            expect(updatedEntity.hasComponent(EXISTING_COMPONENT_ID)).toBe(
              true
            );
            expect(
              updatedEntity.getComponentData(EXISTING_COMPONENT_ID)
            ).toEqual(definition.components[EXISTING_COMPONENT_ID]);
          } else {
            expect(updatedEntity.hasComponent(EXISTING_COMPONENT_ID)).toBe(
              false
            );
          }
        } else {
          fail(
            'updatedEntity.instanceData was undefined, preventing further checks on overrides and component presence.'
          );
        }
      });

      it('should remove entity from spatial index if POSITION_COMPONENT is removed', () => {
        // const { entity } = setupEntityWithOverrides('_spatial_remove'); // Using global entity from parent beforeEach
        // const entityId = entity.id;

        // Add POSITION_COMPONENT to the global entity
        const posData = { locationId: 'test-loc-for-remove', x: 1, y: 1 };
        entityManager.addComponent(entityId, POSITION_COMPONENT_ID, posData); // entityId comes from parent beforeEach
        expect(entity.hasComponent(POSITION_COMPONENT_ID, true)).toBe(true);

        mockSpatialIndex.removeEntity.mockClear();
        mockSpatialIndex.updateEntityLocation.mockClear(); // Not strictly necessary for remove but good for isolation
        mockLogger.debug.mockClear(); // Clear debug mock

        entityManager.removeComponent(entityId, POSITION_COMPONENT_ID); // FIXED: Used POSITION_COMPONENT_ID
        expect(entity.hasComponent(POSITION_COMPONENT_ID, true)).toBe(false); // Check component is removed
        // Check event dispatch
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_REMOVED_ID,
          { entity, componentTypeId: POSITION_COMPONENT_ID } // FIXED: Used POSITION_COMPONENT_ID
        );
        // Check spatial index interaction - REMOVED: EntityManager is decoupled from SpatialIndexManager
        // expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(entityId);
      });

      it('should do nothing, not throw, and not dispatch event if component does not exist on entity', () => {
        // const { entity } = setupEntityWithOverrides(); // Using global entity from parent beforeEach
        // const entityId = entity.id;
        mockEventDispatcher.dispatch.mockClear(); // Ensure clean state

        expect(() =>
          entityManager.removeComponent(entityId, NON_EXISTENT_COMPONENT_ID)
        ).not.toThrow();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          `EntityManager.removeComponent: Component '${NON_EXISTENT_COMPONENT_ID}' not found as an override on entity '${entityId}'. Nothing to remove at instance level.`
        );
        const result = entityManager.removeComponent(
          entityId,
          NON_EXISTENT_COMPONENT_ID
        );
        expect(result).toBe(false);
        expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
      });

      it('should throw EntityNotFoundError for non-existent entity and not dispatch event', () => {
        mockEventDispatcher.dispatch.mockClear(); // Ensure clean state

        expect(() =>
          entityManager.removeComponent(
            NON_EXISTENT_ENTITY_INSTANCE_ID,
            'core:name'
          )
        ).toThrow(EntityNotFoundError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          `EntityManager.removeComponent: Entity not found with ID: '${NON_EXISTENT_ENTITY_INSTANCE_ID}'. Cannot remove component 'core:name'.`
        );
        expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
      });
    });

    describe('getComponentData', () => {
      it('should return component data if component exists (from definition)', () => {
        const data = entityManager.getComponentData(
          entityId,
          EXISTING_COMPONENT_ID
        );
        expect(data).toEqual(EXISTING_COMPONENT_DATA);
      });

      it('should return component data if component exists (from override)', () => {
        const overrideData = { hp: 100 };
        entityManager.addComponent(
          entityId,
          EXISTING_COMPONENT_ID,
          overrideData
        );
        const data = entityManager.getComponentData(
          entityId,
          EXISTING_COMPONENT_ID
        );
        expect(data).toEqual(overrideData);
      });

      it('should return undefined if component does not exist', () => {
        const data = entityManager.getComponentData(
          entityId,
          NON_EXISTENT_COMPONENT_ID
        );
        expect(data).toBeUndefined();
      });

      it('should return undefined for non-existent entity', () => {
        const result = entityManager.getComponentData(
          NON_EXISTENT_ENTITY_INSTANCE_ID,
          'comp:test'
        );
        expect(result).toBeUndefined();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `EntityManager.getComponentData: Entity not found with ID: '${NON_EXISTENT_ENTITY_INSTANCE_ID}'. Returning undefined for component 'comp:test'.`
        );
      });
    });

    describe('hasComponent', () => {
      it('should return true if component exists (from definition)', () => {
        expect(
          entityManager.hasComponent(entityId, EXISTING_COMPONENT_ID)
        ).toBe(true);
      });

      it('should return true if component exists (from override)', () => {
        entityManager.addComponent(entityId, 'newly:added', { value: true });
        expect(entityManager.hasComponent(entityId, 'newly:added')).toBe(true);
      });

      it('should return false if component does not exist', () => {
        expect(
          entityManager.hasComponent(entityId, NON_EXISTENT_COMPONENT_ID)
        ).toBe(false);
      });

      it('should return false if entity not found', () => {
        expect(
          entityManager.hasComponent(
            NON_EXISTENT_ENTITY_INSTANCE_ID,
            'comp:test'
          )
        ).toBe(false);
      });
    });
  });

  // --- 6. Entity Query Methods ---
  describe('Entity Query Methods', () => {
    const defIdBasic = 'test:basic';
    const defIdActor = 'test-def:actor';

    beforeEach(() => {
      // Ensure mockRegistry is set up by the main beforeEach
      entityManager.createEntityInstance(defIdBasic, {
        instanceId: 'e-query-1',
        componentOverrides: { 'query:compA': { val: 1 } },
      });
      entityManager.createEntityInstance(defIdActor, {
        instanceId: 'e-query-2',
        componentOverrides: {
          'query:compA': { val: 2 },
          'query:compB': { flag: true },
        },
      });
      entityManager.createEntityInstance(defIdBasic, {
        instanceId: 'e-query-3',
        componentOverrides: { 'query:compB': { flag: false } },
      });
    });

    describe('getEntityInstance', () => {
      it('should return the entity instance if found', () => {
        const entity = entityManager.getEntityInstance('e-query-1');
        expect(entity).toBeInstanceOf(Entity);
        expect(entity.id).toBe('e-query-1');
      });

      it('should return undefined if entity instance not found', () => {
        const entity = entityManager.getEntityInstance('non-existent-query-id');
        expect(entity).toBeUndefined();
      });
    });

    describe('getEntitiesWithComponent', () => {
      it('should return all entities that have the specified component', () => {
        const entitiesA = entityManager.getEntitiesWithComponent('query:compA');
        expect(entitiesA).toHaveLength(2);
        expect(entitiesA.map((e) => e.id).sort()).toEqual(
          ['e-query-1', 'e-query-2'].sort()
        );

        const entitiesB = entityManager.getEntitiesWithComponent('query:compB');
        expect(entitiesB).toHaveLength(2);
        expect(entitiesB.map((e) => e.id).sort()).toEqual(
          ['e-query-2', 'e-query-3'].sort()
        );
      });

      it('should return an empty array if no entities have the component', () => {
        const entities =
          entityManager.getEntitiesWithComponent('non:existentComp');
        expect(entities).toEqual([]);
      });
      it('should return entities that have the component from definition', () => {
        // MOCK_DEFINITION_ID_MAIN has 'core:name' by default
        entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {
          instanceId: 'main-def-ent',
        });
        const entities = entityManager.getEntitiesWithComponent('core:name');
        // rawDefBasicForTests and rawDefActorForTests both have 'core:name' now.
        // So e-query-1, e-query-2, e-query-3, and main-def-ent should all have it.
        expect(entities.some((e) => e.id === 'main-def-ent')).toBe(true);
        expect(entities.length).toBeGreaterThanOrEqual(4);
      });
    });

    describe('getEntitiesInLocation', () => {
      it('should log a deprecation warning and return an empty set', () => {
        const locationId = 'loc:test-deprecated';
        const result = entityManager.getEntitiesInLocation(locationId);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'EntityManager.getEntitiesInLocation: This method is deprecated as EntityManager is decoupled from SpatialIndexManager. Returning an empty set. Consumers should rely on events to maintain their own spatial data.'
        );
        expect(result).toEqual(new Set());
        // Ensure the mockSpatialIndex was not called
        expect(mockSpatialIndex.getEntitiesInLocation).not.toHaveBeenCalled();
      });
    });
  });

  // --- 7. Lifecycle Methods ---
  describe('clearAll', () => {
    it('should remove all active entities and clear definition cache', () => {
      entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {
        instanceId: 'entity1',
      });
      entityManager.createEntityInstance(MOCK_DEFINITION_ID_ACTOR, {
        instanceId: 'actor2',
      });

      // To test definition cache clearing:
      // 1. Ensure a specific definition is fetched (and thus cached)
      const defIdForCacheTest = 'test-def:unique-for-clearall';
      const rawDefForCacheTest = {
        id: defIdForCacheTest,
        components: { 'core:data': { value: 'cache me' } },
      };
      const entityDefForCacheTestInstance = new EntityDefinition(
        defIdForCacheTest,
        rawDefForCacheTest
      );

      const originalGetEntityDefinition = mockRegistry.getEntityDefinition;
      mockRegistry.getEntityDefinition = jest.fn((id) => {
        if (id === defIdForCacheTest) return entityDefForCacheTestInstance;
        // Fallback to original mock for other definitions used in setup (MAIN, ACTOR)
        if (id === MOCK_DEFINITION_ID_MAIN) return entityDefMain;
        if (id === MOCK_DEFINITION_ID_ACTOR) return entityDefActor;
        return originalGetEntityDefinition(id); // Fallback for any other definitions
      });

      entityManager.createEntityInstance(defIdForCacheTest, {
        instanceId: 'entityForCacheTest',
      });
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith(
        defIdForCacheTest
      );

      // Reset mock call count for the next check, but keep the implementation
      mockRegistry.getEntityDefinition.mockClear();

      entityManager.clearAll();

      expect(entityManager.activeEntities.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'All entity instances removed from EntityManager.'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Entity definition cache cleared.'
      );

      // 2. After clearAll, try to get the same definition again.
      // If cache was cleared, registry should be called.
      // The mockRegistry.getEntityDefinition still has the same implementation from above.
      entityManager.createEntityInstance(defIdForCacheTest, {
        instanceId: 'entityForCacheTestAgain',
      });
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith(
        defIdForCacheTest
      );

      // Restore the original mock after this test to not affect other tests
      mockRegistry.getEntityDefinition = originalGetEntityDefinition;
    });
  });
});
// --- FILE END ---

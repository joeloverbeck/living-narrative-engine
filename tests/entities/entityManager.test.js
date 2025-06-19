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
      mockSpatialIndex,
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
    mockSpatialIndex.addEntity.mockClear();
    mockSpatialIndex.removeEntity.mockClear();
    mockSpatialIndex.updateEntityLocation.mockClear();
    mockSpatialIndex.clearIndex.mockClear();
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
    const invalidSpatialMissingMethod = { ...createMockSpatialIndexManager() };
    delete invalidSpatialMissingMethod.addEntity;

    it.each([
      ['IDataRegistry', null, /Missing required dependency: IDataRegistry/],
      [
        'ISchemaValidator',
        null,
        /Missing required dependency: ISchemaValidator/,
      ],
      ['ILogger', null, /Missing required dependency: ILogger/],
      [
        'ISpatialIndexManager',
        null,
        /Missing required dependency: ISpatialIndexManager/,
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
        'ISpatialIndexManager (missing method)',
        invalidSpatialMissingMethod,
        /Invalid or missing method 'addEntity' on dependency 'ISpatialIndexManager'/,
      ],
    ])(
      'should throw an Error if %s is missing or invalid (%p)',
      (depName, invalidDep, expectedError) => {
        const args = [
          depName.startsWith('IDataRegistry') ? invalidDep : mockRegistry,
          depName.startsWith('ISchemaValidator') ? invalidDep : mockValidator,
          depName.startsWith('ILogger') ? invalidDep : mockLogger,
          depName.startsWith('ISpatialIndexManager')
            ? invalidDep
            : mockSpatialIndex,
        ];
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        expect(() => new EntityManager(...args)).toThrow(expectedError);
        consoleErrorSpy.mockRestore();
      }
    );
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
        overrides: { 'core:name': { name: 'Reconstructed Name' } },
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

    // FIXED: Test name and assertion updated to match the actual behavior for malformed POJOs.
    it('should throw error if serialized data is missing a valid instanceId', () => {
      expect(() =>
        entityManager.reconstructEntity({
          // 'instanceId' key is missing
          definitionId: defIdForReconstruct,
          overrides: {},
        })
      ).toThrow("Invalid instanceId in serialized data: 'undefined'");
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
        overrides: {},
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

    it('should add reconstructed entity to spatial index if it has position', () => {
      const posDefId = entityDefWithPosGlobal.id; // 'test:defWithPos'
      const posInstanceId = 'recon-pos-id-global-test';

      // FIXED: Use a POJO for the serialized data
      const serializedWithPos = {
        instanceId: posInstanceId,
        definitionId: posDefId,
        overrides: {
          [POSITION_COMPONENT_ID]: {
            locationId: 'recon:loc-global-test',
            x: 5,
            y: 5,
          },
        },
      };

      entityManager.reconstructEntity(serializedWithPos);
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(
        posInstanceId,
        'recon:loc-global-test'
      );
    });

    it('should handle null component data during reconstruction', () => {
      const nullCompInstanceId = `${instanceId}-null-comp-recon-test`;
      // FIXED: Use a POJO for the serialized data
      const serializedWithNullComp = {
        instanceId: nullCompInstanceId,
        definitionId: defIdForReconstruct,
        overrides: { 'core:custom': null },
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
        overrides: { 'core:stats': { hp: 1 } },
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

    it('should remove an existing entity', () => {
      const instanceId = 'remove-test-entity';
      entityManager.createEntityInstance(entityDefBasic.id, { instanceId });
      const result = entityManager.removeEntityInstance(instanceId);
      expect(result).toBe(true);
      expect(entityManager.activeEntities.has(instanceId)).toBe(false);
      expect(entityManager.getEntityInstance(instanceId)).toBeUndefined();
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
    });

    it('should remove entity from spatial index if it has a position', () => {
      const instanceId = 'spatial-remove-test-locstart-instance';
      entityManager.createEntityInstance(defIdWithPosForRemoveInstanceTest, {
        instanceId,
      }); // 'test:positioned' has locationId: 'loc:start'
      entityManager.removeEntityInstance(instanceId);
      expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
        instanceId,
        'loc:start'
      );
    });

    it('should not attempt to remove from spatial index if entity has no position component', () => {
      const instanceId = 'no-pos-entity-remove';
      entityManager.createEntityInstance(entityDefBasic.id, { instanceId }); // defIdBasic has no position
      entityManager.removeEntityInstance(instanceId);
      expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    });

    it('should not attempt to remove from spatial index if position component has no locationId', () => {
      const instanceId = 'no-locationId-remove-instance';
      entityManager.createEntityInstance(entityDefBasic.id, { instanceId });
      entityManager.addComponent(instanceId, POSITION_COMPONENT_ID, {
        x: 10,
        y: 10,
      }); // No locationId
      mockSpatialIndex.removeEntity.mockClear();

      entityManager.removeEntityInstance(instanceId);
      expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
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
    });

    describe('addComponent', () => {
      it('should add a new component to an existing entity', () => {
        const newData = { value: 100 };
        entityManager.addComponent(
          entityId,
          NON_EXISTENT_COMPONENT_ID,
          newData
        );
        expect(entity.hasComponent(NON_EXISTENT_COMPONENT_ID)).toBe(true);
        expect(entity.getComponentData(NON_EXISTENT_COMPONENT_ID)).toEqual(
          newData
        );
      });

      it('should update an existing component on an entity', () => {
        const updatedData = { hp: 20, mp: 10, armor: 5 };
        entityManager.addComponent(
          entityId,
          EXISTING_COMPONENT_ID,
          updatedData
        );
        expect(entity.getComponentData(EXISTING_COMPONENT_ID)).toEqual(
          updatedData
        );
      });

      it('should add entity to spatial index if POSITION_COMPONENT is added with locationId', () => {
        const newPositionData = {
          locationId: 'new:loc-for-add-final',
          x: 5,
          y: 5,
        };
        entityManager.addComponent(
          entityId,
          POSITION_COMPONENT_ID,
          newPositionData
        );
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(
          entityId,
          undefined,
          'new:loc-for-add-final'
        );
      });

      it('should update entity in spatial index if POSITION_COMPONENT is changed', () => {
        entityManager.addComponent(entityId, POSITION_COMPONENT_ID, {
          locationId: 'start:loc',
          x: 1,
          y: 1,
        });
        const newPositionData = {
          locationId: 'updated:loc-for-add-final',
          x: 15,
          y: 15,
        };
        entityManager.addComponent(
          entityId,
          POSITION_COMPONENT_ID,
          newPositionData
        );
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(
          entityId,
          'start:loc',
          'updated:loc-for-add-final'
        );
      });

      it('should remove from spatial index if POSITION_COMPONENT is added without locationId (effectively nullifying location)', () => {
        const noLocationData = { x: 20, y: 20 };
        entityManager.addComponent(
          entityId,
          POSITION_COMPONENT_ID,
          noLocationData
        );
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(
          entityId,
          undefined,
          undefined
        );
      });

      // --- FIXED TEST ---
      it('should throw EntityNotFoundError if entity not found', () => {
        expect(() => {
          entityManager.addComponent(
            NON_EXISTENT_ENTITY_INSTANCE_ID,
            'comp:test',
            {}
          );
        }).toThrow(EntityNotFoundError);

        expect(() => {
          entityManager.addComponent(
            NON_EXISTENT_ENTITY_INSTANCE_ID,
            'comp:test',
            {}
          );
        }).toThrow(
          `Entity instance not found: '${NON_EXISTENT_ENTITY_INSTANCE_ID}'`
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          `EntityManager.addComponent: Entity not found with ID: ${NON_EXISTENT_ENTITY_INSTANCE_ID}`,
          expect.any(Object)
        );
      });

      it('should throw if component validation fails', () => {
        mockValidator.validate.mockReturnValueOnce({
          isValid: false,
          errors: [{ message: 'Invalid data for stats addComponent' }],
        });
        const newStatsData = { hp: 'extremely high' };
        expect(() => {
          entityManager.addComponent(entityId, 'core:stats', newStatsData);
        }).toThrow(
          new RegExp(
            `addComponent core:stats to entity ${entityId} Errors:\\s*\\[\\s*{\\s*"message":\\s*"Invalid data for stats addComponent"\\s*}\\s*\\]`
          )
        );
      });
    });

    describe('removeComponent', () => {
      it('should remove an existing component override', () => {
        const { entity, definition } = setupEntityWithOverrides();
        const entityId = entity.id;

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
        const posData = { locationId: 'test-loc-for-remove', x: 1, y: 1 };
        entityManager.addComponent(entityId, POSITION_COMPONENT_ID, posData);
        expect(entity.hasComponent(POSITION_COMPONENT_ID, true)).toBe(true);

        mockSpatialIndex.removeEntity.mockClear();
        mockSpatialIndex.updateEntityLocation.mockClear();
        mockLogger.debug.mockClear();

        entityManager.removeComponent(entityId, POSITION_COMPONENT_ID);
        // Check that removeEntity was called, not updateEntityLocation for removal
        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
          entityId,
          'test-loc-for-remove'
        );
        expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
      });

      it('should do nothing (and not throw) if component does not exist on entity (logs info)', () => {
        const { entity } = setupEntityWithOverrides();
        const entityId = entity.id;
        expect(() =>
          entityManager.removeComponent(entityId, NON_EXISTENT_COMPONENT_ID)
        ).not.toThrow();
        // FIXED: The template literal was malformed with HTML tags
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `EntityManager.removeComponent: Component '${NON_EXISTENT_COMPONENT_ID}' not found as an override on entity '${entityId}'. Nothing to remove at instance level.`
        );
        const result = entityManager.removeComponent(
          entityId,
          NON_EXISTENT_COMPONENT_ID
        );
        expect(result).toBe(false);
      });

      // --- FIXED TEST ---
      it('should throw EntityNotFoundError for non-existent entity', () => {
        expect(() =>
          entityManager.removeComponent(
            NON_EXISTENT_ENTITY_INSTANCE_ID,
            'core:name'
          )
        ).toThrow(EntityNotFoundError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          `EntityManager.removeComponent: Entity not found with ID: '${NON_EXISTENT_ENTITY_INSTANCE_ID}'. Cannot remove component 'core:name'.`
        );
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
      it('should delegate to spatialIndexManager.getEntitiesInLocation', () => {
        const mockEntities = new Set(['e1', 'e2']);
        mockSpatialIndex.getEntitiesInLocation.mockReturnValue(mockEntities);
        const result = entityManager.getEntitiesInLocation('loc:test');
        expect(mockSpatialIndex.getEntitiesInLocation).toHaveBeenCalledWith(
          'loc:test'
        );
        expect(result).toBe(mockEntities);
      });
    });
  });

  // --- 7. Lifecycle Methods ---
  describe('clearAll', () => {
    it('should remove all active entities and clear definition cache and spatial index', () => {
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
      expect(mockSpatialIndex.clearIndex).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Spatial index cleared.');
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

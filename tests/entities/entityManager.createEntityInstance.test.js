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
import EntityDefinition from '../../src/entities/EntityDefinition.js';
import {
  POSITION_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

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

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

// --- Constants ---
const MOCK_DEFINITION_ID_MAIN = 'test-def:main';
const MOCK_DEFINITION_ID_ACTOR = 'test-def:actor';
const MOCK_DEFINITION_ID_ITEM = 'test-def:item';
const DEF_ID_FOR_OVERRIDES = 'test-def:for-overrides'; // New definition ID


const EXISTING_COMPONENT_ID = 'core:stats';

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

describe('EntityManager', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;

  // Declare variables for EntityDefinition instances here
  let entityDefMain;
  let entityDefActor;
  let entityDefItem;
  let entityDefForOverrides;
  let entityDefBasic;
  let entityDefWithPosGlobal;
  let entityDefBasicReconstruct;

  let mockEventDispatcher;

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
      { // A simplified version of rawDefBasicForTests for reconstruction tests
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

  // --- 2. createEntityInstance Tests ---
  describe('createEntityInstance', () => {
    const defIdBasic = 'test:basic';
    const defIdWithPos = 'test:positioned';
    const defIdActor = MOCK_DEFINITION_ID_ACTOR;

    // Outer beforeEach provides the necessary mockRegistry.getEntityDefinition

    it('should create an entity with a generated instanceId if none provided in options', () => {
      const entity = entityManager.createEntityInstance(defIdBasic);
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBeDefined();
      expect(typeof entity.id).toBe('string');
      expect(entity.definitionId).toBe(defIdBasic);

      const entityWithOptions = entityManager.createEntityInstance(
        defIdBasic,
        {}
      );
      expect(entityWithOptions.id).toBeDefined();

      const entityWithOverridesOnly = entityManager.createEntityInstance(
        defIdBasic,
        { componentOverrides: { 'core:name': { name: 'Override' } } }
      );
      expect(entityWithOverridesOnly.id).toBeDefined();
    });

    it('should create an entity with a specific instanceId if provided in options', () => {
      const specificId = 'my-custom-id-123';
      const entity = entityManager.createEntityInstance(defIdBasic, {
        instanceId: specificId,
      });
      expect(entity.id).toBe(specificId);
    });

    it('should throw an error if an entity with the provided instanceId already exists', () => {
      const specificId = 'duplicate-id-test';
      entityManager.createEntityInstance(defIdBasic, { instanceId: specificId }); // First attempt
      mockEventDispatcher.dispatch.mockClear(); // Clear event from first creation

      expect(() => {
        entityManager.createEntityInstance(defIdBasic, {
          instanceId: specificId,
        }); // Second attempt
      }).toThrow(
        `Entity with ID '${specificId}' already exists.` // Corrected message
      );
    });

    it('should throw an error if definitionId is not a non-empty string', () => {
      expect(() => entityManager.createEntityInstance(null)).toThrow(
        'definitionId must be a non-empty string.' // Corrected message
      );
      expect(() => entityManager.createEntityInstance('')).toThrow(
        'definitionId must be a non-empty string.' // Corrected message
      );
      // Optional: Check for undefined if that's a distinct path, otherwise covered by typeof check
      expect(() => entityManager.createEntityInstance(undefined)).toThrow(
        'definitionId must be a non-empty string.' // Corrected message
      );
      expect(() => entityManager.createEntityInstance(123)).toThrow(
        'definitionId must be a non-empty string.' // Corrected message for wrong type
      );
    });

    it('should fetch and cache EntityDefinition on first creation, use cache on second', () => {
      entityManager.createEntityInstance(defIdBasic, {
        instanceId: 'e1-cache-test',
      });
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledTimes(1);
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith(defIdBasic);

      entityManager.createEntityInstance(defIdBasic, {
        instanceId: 'e2-cache-test',
      });
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledTimes(1); // Should still be 1 due to cache
    });

    it('should apply component overrides correctly', () => {
      const overrides = {
        'core:description': { text: 'Overridden Description' },
        'new:component': { data: 'xyz' },
      };
      // Validator will be called for each override component.
      mockValidator.validate.mockReturnValue({ isValid: true });

      const entity = entityManager.createEntityInstance(defIdBasic, {
        componentOverrides: overrides,
      });
      expect(entity.getComponentData('core:description').text).toBe(
        'Overridden Description'
      );
      expect(entity.hasComponent('new:component')).toBe(true);
      expect(entity.getComponentData('new:component').data).toBe('xyz');
    });

    it('should handle null component override by adding component with null data', () => {
      const overrides = {
        'core:name': null, // Explicitly override 'core:name' to null
        'core:description': { text: 'Overridden Description with Null Name' },
      };
      // defIdBasic does not have 'core:name' in its definition
      const entity = entityManager.createEntityInstance(defIdBasic, {
        componentOverrides: overrides,
      });

      // The established design is that a component with a null override IS present.
      expect(entity.hasComponent('core:name')).toBe(true);
      expect(entity.getComponentData('core:name')).toBeNull(); // Data is null
      expect(entity.getComponentData('core:description').text).toBe(
        'Overridden Description with Null Name'
      );
    });

    it('should inject default components (STM, Notes, Goals) for actors', () => {
      const entity = entityManager.createEntityInstance(defIdActor);
      expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
      expect(entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID)).toEqual({
        thoughts: [],
        maxEntries: 10,
      });
      expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);
      expect(entity.getComponentData(NOTES_COMPONENT_ID)).toEqual({
        notes: [],
      });
      expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true);
      expect(entity.getComponentData(GOALS_COMPONENT_ID)).toEqual({
        goals: [],
      });
    });

    it('should not inject default actor components for non-actors', () => {
      mockValidator.validate.mockImplementation((typeId, data) => {
        if (
          typeId === 'core:some_other_component_for_non_actor' &&
          data.value < 0
        ) {
          return { isValid: false, errors: [{ message: 'Value too low' }] };
        }
        return { isValid: true };
      });
      const nonActorEntity = entityManager.createEntityInstance(defIdBasic); // defIdBasic is not an actor
      expect(nonActorEntity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(
        false
      );
      expect(nonActorEntity.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
      expect(nonActorEntity.hasComponent(GOALS_COMPONENT_ID)).toBe(false);
    });

    it('throws error if component validation fails during creation (override component)', () => {
      const instanceId = 'override-validation-fail-instance';
      const overrides = {
        [EXISTING_COMPONENT_ID]: { hp: -5 }, // Invalid HP
      };
      const validationErrors = [{ message: 'HP too low' }];

      mockValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: validationErrors,
      });

      const expectedErrorContext = `Override for component ${EXISTING_COMPONENT_ID} on entity ${instanceId}`;
      const expectedDetails = JSON.stringify(validationErrors, null, 2);
      const expectedErrorMessage = `${expectedErrorContext} Errors:\n${expectedDetails}`;

      expect(() => {
        entityManager.createEntityInstance(DEF_ID_FOR_OVERRIDES, {
          instanceId,
          componentOverrides: overrides,
        });
      }).toThrow(expectedErrorMessage);

      expect(mockValidator.validate).toHaveBeenCalledWith(
        EXISTING_COMPONENT_ID,
        overrides[EXISTING_COMPONENT_ID]
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('throws error if component validation fails for a new component (not an override)', () => {
      const instanceId = 'new-component-validation-fail-instance';
      const newComponentId = 'new:component';
      const overrides = {
        [newComponentId]: { data: 'invalid-data' },
      };
      const validationErrors = [{ message: 'Invalid data format' }];

      mockValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: validationErrors,
      });

      const expectedErrorContext = `New component ${newComponentId} on entity ${instanceId}`;
      const expectedDetails = JSON.stringify(validationErrors, null, 2);
      const expectedErrorMessage = `${expectedErrorContext} Errors:\n${expectedDetails}`;

      expect(() => {
        entityManager.createEntityInstance(DEF_ID_FOR_OVERRIDES, {
          instanceId,
          componentOverrides: overrides,
        });
      }).toThrow(expectedErrorMessage);

      expect(mockValidator.validate).toHaveBeenCalledWith(
        newComponentId,
        overrides[newComponentId]
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('reconstructEntity', () => {
    let rawEntityData; // To be defined in tests

    // Utility to create a basic valid raw entity data structure
    // ... existing code ...
    it('throws an error if a component fails validation during reconstruction', () => {
      const instanceId = 'reconstruct-validation-fail';
      const failingComponentId = 'nameComponent'; // To match the existing regex expectation
      const entityData = {
        instanceId,
        definitionId: 'test:basic',
        components: {
          [failingComponentId]: { name: null }, // This data should cause validation to fail
        },
        componentStates: {},
        tags: [],
        flags: {},
      };

      const validationErrors = [{ message: 'Name validation failed (forced by test)' }];

      // Mock validator to fail for the specific component
      mockValidator.validate.mockImplementation((componentTypeId, _data) => {
        if (componentTypeId === failingComponentId) { // 'nameComponent'
          return { isValid: false, errors: validationErrors };
        }
        return { isValid: true, validatedData: _data }; // Pass other validations
      });

      // Corrected expectedErrorContext to match #validateAndClone's errorContext
      const expectedErrorContext = `Reconstruction component ${failingComponentId} for entity ${instanceId} (definition ${entityData.definitionId})`;
      const expectedDetails = JSON.stringify(validationErrors, null, 2);
      // Corrected expectedFullMessage to match the direct error from #validateAndClone
      const expectedFullMessage = `${expectedErrorContext} Errors:\n${expectedDetails}`;

      expect(() => entityManager.reconstructEntity(entityData)).toThrow(
        expectedFullMessage
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('throws an error and logs if entity definition is not found during reconstruction', () => {
      const defIdUnknown = 'unknown:def-for-reconstruct';
      const instanceId = 'reconstruct-def-not-found';
      const entityData = {
        instanceId,
        definitionId: defIdUnknown,
        components: { 'core:name': { name: 'Test Entity Def Not Found' } },
        componentStates: {},
        tags: [],
        flags: {},
      };

      // Ensure getEntityDefinition returns undefined for this specific ID
      const originalGetEntityDef = mockRegistry.getEntityDefinition;
      mockRegistry.getEntityDefinition = jest.fn((id) => {
        if (id === defIdUnknown) return undefined;
        return originalGetEntityDef(id); // Fallback to original mock for other IDs
      });

      const expectedErrorMessage = `Entity definition not found: '${defIdUnknown}'`;

      expect(() => entityManager.reconstructEntity(entityData)).toThrow(
        expectedErrorMessage
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Definition '${defIdUnknown}' not found in registry for entity '${instanceId}'`) // Logger message is slightly different
      );

      // Restore original mock
      mockRegistry.getEntityDefinition = originalGetEntityDef;
    });

    it('throws an error if an entity with the same instanceId already exists', () => {
      const instanceId = 'reconstruct-duplicate-id';

      // Ensure 'test:basic' definition is available via mockRegistry for the initial creation
      // This relies on entityDefBasic being defined in the outer scope and mockRegistry
      // being set up to return it.
      entityManager.createEntityInstance('test:basic', { instanceId });

      // Now, prepare data for reconstruction attempt with the same instanceId
      const entityDataForReconstruction = {
        instanceId,
        definitionId: 'test:basic',
        components: { 'core:name': { name: 'Duplicate Entity Attempt' } },
        componentStates: {},
        tags: [],
        flags: {},
      };

      const expectedErrorMessage = `EntityManager.reconstructEntity: Entity with ID '${instanceId}' already exists. Reconstruction aborted.`;

      expect(() => entityManager.reconstructEntity(entityDataForReconstruction)).toThrow(
        expectedErrorMessage
      );
    });
  });
});
// --- FILE END ---
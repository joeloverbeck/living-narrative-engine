// tests/entities/entityManager.test.js
// --- FILE START ---
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
// EntityDefinition and EntityInstanceData are used by tests setting up entities,
// but not directly by all EntityManager method tests if createEntityInstance is used.
// import EntityDefinition from '../../src/entities/EntityDefinition.js';
// import EntityInstanceData from '../../src/entities/EntityInstanceData.js';
import {
  POSITION_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  GOALS_COMPONENT_ID
} from '../../src/constants/componentIds.js';

// --- Mock Implementations ---
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

// --- Constants ---
const MOCK_DEFINITION_ID_MAIN = 'test-def:main';
const MOCK_DEFINITION_ID_ACTOR = 'test-def:actor';
const MOCK_INSTANCE_ID_PRE_EXISTING = 'existing-instance-uuid-123';

const ACCESS_DEFINITION_ID = 'access-def:item';
const ACCESS_INSTANCE_ID = 'access-instance-uuid-99';

const EXISTING_COMPONENT_ID = 'core:stats';
const EXISTING_COMPONENT_DATA = { hp: 10, mp: 5 };
const NON_EXISTENT_COMPONENT_ID = 'core:inventory';
const NON_EXISTENT_ENTITY_INSTANCE_ID = 'ghost-instance-uuid-404';

// Common raw definitions for tests that need them
const rawDefMain = { description: 'Main test def', components: { 'core:name': { name: 'Main Def' } } };
const rawDefActorForTests = {
  description: 'Actor test def',
  components: {
    [ACTOR_COMPONENT_ID]: { type: 'test-actor' },
    'core:name': { name: 'Test Actor Default Name' }
  }
};
const rawDefBasicForTests = {
  description: 'A basic entity definition for testing.',
  components: { 'core:name': { name: 'Basic Def' } },
};
const rawDefWithPosForTests = {
  description: 'A positioned entity for addComponent tests or global use',
  components: {
    'core:name': { name: 'Positioned Entity Global' },
    [POSITION_COMPONENT_ID]: { locationInstanceId: 'loc:global-pos', x: 10, y: 10 },
  },
};


describe('EntityManager', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;

  beforeEach(() => {
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();
    entityManager = new EntityManager(
      mockRegistry,
      mockValidator,
      mockLogger,
      mockSpatialIndex
    );

    // Global mock implementation for getEntityDefinition
    // Ensures common definitions are available unless overridden by a nested beforeEach.
    mockRegistry.getEntityDefinition.mockImplementation((id) => {
      if (id === MOCK_DEFINITION_ID_MAIN) return JSON.parse(JSON.stringify(rawDefMain));
      if (id === MOCK_DEFINITION_ID_ACTOR) return JSON.parse(JSON.stringify(rawDefActorForTests));
      if (id === 'test:basic') return JSON.parse(JSON.stringify(rawDefBasicForTests));
      if (id === 'test:defWithPos') return JSON.parse(JSON.stringify(rawDefWithPosForTests)); // Added for addComponent test
      // console.warn(`[Global Mock] Definition not found for ${id}`);
      return undefined;
    });

    // Clear mocks that might accumulate calls across tests, especially validate
    mockValidator.validate.mockClear();
    mockLogger.error.mockClear(); // Clear specific logger mocks if necessary
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
      ['ISchemaValidator', null, /Missing required dependency: ISchemaValidator/],
      ['ILogger', null, /Missing required dependency: ILogger/],
      ['ISpatialIndexManager', null, /Missing required dependency: ISpatialIndexManager/],
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
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => new EntityManager(...args)).toThrow(expectedError);
        consoleErrorSpy.mockRestore();
      }
    );
  });

  // --- 2. createEntityInstance Tests ---
  describe('createEntityInstance', () => {
    const defIdBasic = 'test:basic'; 
    const rawDefBasic = rawDefBasicForTests;

    const defIdWithPos = 'test:positioned';
    const rawDefWithPos = {
      description: 'A positioned entity',
      components: {
        'core:name': { name: 'Positioned Entity' },
        [POSITION_COMPONENT_ID]: { locationId: 'loc:start', x: 1, y: 1 },
      },
    };
    const defIdActor = MOCK_DEFINITION_ID_ACTOR; 
    const rawDefActor = rawDefActorForTests;

    beforeEach(() => {
      // Specific mock for this describe block, potentially overriding the global one
      // This ensures these specific defs are prioritized here.
      mockRegistry.getEntityDefinition.mockImplementation((id) => {
        if (id === defIdBasic) return JSON.parse(JSON.stringify(rawDefBasic));
        if (id === defIdWithPos) return JSON.parse(JSON.stringify(rawDefWithPos));
        if (id === defIdActor) return JSON.parse(JSON.stringify(rawDefActor));
        if (id === MOCK_DEFINITION_ID_MAIN) return JSON.parse(JSON.stringify(rawDefMain));
        if (id === 'test:defWithPos') return JSON.parse(JSON.stringify(rawDefWithPosForTests)); // Ensure this is available if tests rely on it
        // console.warn(`[createEntityInstance Mock] Definition not found for ${id}`);
        return undefined;
      });
      mockValidator.validate.mockClear(); 
    });

    it('should create an entity with a generated instanceId if none provided', () => {
      const entity = entityManager.createEntityInstance(defIdBasic);
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBeDefined();
      expect(typeof entity.id).toBe('string');
      expect(entity.definitionId).toBe(defIdBasic);
    });

    it('should create an entity with a specific instanceId if provided using new signature', () => {
      const specificId = 'my-custom-id-123';
      const entity = entityManager.createEntityInstance(defIdBasic, {}, specificId);
      expect(entity.id).toBe(specificId);
    });

    it('should fetch and cache EntityDefinition on first creation, use cache on second', () => {
      const entity1 = entityManager.createEntityInstance(defIdBasic, {}, 'e1-cache-test');
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledTimes(1);
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith(defIdBasic);

      const entity2 = entityManager.createEntityInstance(defIdBasic, {}, 'e2-cache-test');
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledTimes(1); // Should use cache

      const defFromEntity1 = entity1.instanceData.definition;
      const defFromEntity2 = entity2.instanceData.definition;
      expect(defFromEntity1).toBe(defFromEntity2); // Check if they are the same instance from cache
    });

    it('EntityDefinition components should be deeply frozen after caching', () => {
      const entity = entityManager.createEntityInstance(defIdBasic);
      const definitionFromInstance = entity.instanceData.definition;
      expect(Object.isFrozen(definitionFromInstance.components)).toBe(true);
      expect(Object.isFrozen(definitionFromInstance.components['core:name'])).toBe(true);
      expect(() => { definitionFromInstance.components['core:name'].name = 'NewName'; }).toThrow(TypeError);
    });

    it('should correctly apply componentOverrides using new signature', () => {
      const overrides = {
        'core:name': { name: 'Overridden Name' },
        'custom:mana': { current: 50, max: 50 },
      };
      const entity = entityManager.createEntityInstance(defIdBasic, overrides);
      expect(entity.getComponentData('core:name')).toEqual({ name: 'Overridden Name' });
      // rawDefBasic only has 'core:name', so 'core:tag' is not applicable here.
      // expect(entity.getComponentData('core:tag')).toEqual(rawDefBasic.components['core:tag']);
      expect(entity.getComponentData('custom:mana')).toEqual({ current: 50, max: 50 });
    });
    
    it('should validate componentOverrides', () => {
      const overrides = { 'core:name': { name: 'Override' } };
      entityManager.createEntityInstance(defIdBasic, overrides); // defIdBasic is NOT an actor
      const validateCalls = mockValidator.validate.mock.calls;
      // 1. Override processing: validate('core:name', { name: 'Override' })
      // 2. Final loop: validate('core:name', { name: 'Override' }) (data from getComponentData)
      expect(validateCalls).toContainEqual(['core:name', { name: 'Override' }]);
      expect(mockValidator.validate).toHaveBeenCalledTimes(2);
    });

    it('should allow null override to remove/nullify a component for an instance', () => {
      const overrides = { 'core:name': null };
      mockValidator.validate.mockClear(); // Explicitly clear before this specific call
      entityManager.createEntityInstance(defIdBasic, overrides); 
      const validateCalls = mockValidator.validate.mock.calls;
      expect(validateCalls).toEqual([]);
      expect(mockValidator.validate).toHaveBeenCalledTimes(0);
    });

    it('should inject default components (STM, Notes, Goals) for an actor entity if missing', () => {
      const entity = entityManager.createEntityInstance(defIdActor); // Uses rawDefActorForTests
      expect(entity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
      expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);
      expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(true);
      expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true);

      const validateCalls = mockValidator.validate.mock.calls;
      // Expected calls:
      // 1. STM (default injection)
      // 2. Notes (default injection)
      // 3. Goals (default injection)
      // Final Loop:
      // 4. ACTOR_COMPONENT_ID (from def)
      // 5. 'core:name' (from def)
      // 6. STM (from injection)
      // 7. Notes (from injection)
      // 8. Goals (from injection)
      expect(validateCalls).toContainEqual([ACTOR_COMPONENT_ID, rawDefActorForTests.components[ACTOR_COMPONENT_ID]]);
      expect(validateCalls).toContainEqual(['core:name', rawDefActorForTests.components['core:name']]);
      expect(validateCalls).toContainEqual([SHORT_TERM_MEMORY_COMPONENT_ID, { thoughts: [], maxEntries: 10 }]);
      expect(validateCalls).toContainEqual([NOTES_COMPONENT_ID, { notes: [] }]);
      expect(validateCalls).toContainEqual([GOALS_COMPONENT_ID, { goals: [] }]);
      expect(mockValidator.validate).toHaveBeenCalledTimes(8); // 3 from injection + 5 from final loop
    });

    it('should NOT inject default components if provided in overrides', () => {
      const stmOverride = { thoughts: ['override-stm'], maxEntries: 5 };
      const notesOverride = { notes: [{text:'override-notes'}] };
      const entity = entityManager.createEntityInstance(defIdActor, {
        [SHORT_TERM_MEMORY_COMPONENT_ID]: stmOverride,
        [NOTES_COMPONENT_ID]: notesOverride,
        // GOALS_COMPONENT_ID is NOT overridden, so it should be injected
      });

      expect(entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID)).toEqual(stmOverride);
      expect(entity.getComponentData(NOTES_COMPONENT_ID)).toEqual(notesOverride);
      expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(true); // Should be injected

      const validateCalls = mockValidator.validate.mock.calls;
      // Expected calls:
      // 1. STM (override processing)
      // 2. Notes (override processing)
      // 3. Goals (default injection)
      // Final Loop:
      // 4. ACTOR_COMPONENT_ID (from def)
      // 5. 'core:name' (from def)
      // 6. STM (from override)
      // 7. Notes (from override)
      // 8. Goals (from injection)
      expect(validateCalls).toContainEqual([ACTOR_COMPONENT_ID, rawDefActorForTests.components[ACTOR_COMPONENT_ID]]);
      expect(validateCalls).toContainEqual(['core:name', rawDefActorForTests.components['core:name']]);
      expect(validateCalls).toContainEqual([SHORT_TERM_MEMORY_COMPONENT_ID, stmOverride]);
      expect(validateCalls).toContainEqual([NOTES_COMPONENT_ID, notesOverride]);
      expect(validateCalls).toContainEqual([GOALS_COMPONENT_ID, { goals: [] }]);
      expect(mockValidator.validate).toHaveBeenCalledTimes(8); // 2 override proc + 1 default inject + 5 final loop
    });

    it('should add entity to spatialIndex if it has POSITION_COMPONENT_ID with locationId on creation', () => {
      const entity = entityManager.createEntityInstance(defIdWithPos);
      
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(
        entity.id,
        'loc:start'
      );
      
      const validateCalls = mockValidator.validate.mock.calls;
      expect(validateCalls).toContainEqual(['core:name', { name: 'Positioned Entity' }]);
      expect(validateCalls).toContainEqual([POSITION_COMPONENT_ID, { locationId: 'loc:start', x: 1, y: 1 }]);
      
      expect(mockValidator.validate).toHaveBeenCalledTimes(2);
    });
    
    describe('Backward Compatibility Signature for createEntityInstance', () => {
      it('(defId, instanceId) should work', () => { 
        const customId = 'my-custom-id-compat-1';
        mockValidator.validate.mockClear(); // Clear before action
        // Ensure defIdBasic is available from the global mock set in the OUTER describe's beforeEach
        const entity = entityManager.createEntityInstance(defIdBasic, customId); 
        expect(entity).not.toBeNull();
        expect(entity.id).toBe(customId);
        expect(entity.definitionId).toBe(defIdBasic);
        // Final loop validates 'core:name' from definition
        const expectedCoreNameCall = ['core:name', rawDefBasicForTests.components['core:name']];
        expect(mockValidator.validate.mock.calls).toEqual([expectedCoreNameCall]);
        expect(mockValidator.validate).toHaveBeenCalledTimes(1);
        expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(false); 
        expect(Object.keys(entity.instanceData.overrides).length).toBe(0);
      });

      it('(defId, undefined, forceNew) should work and generate new ID', () => {
        const firstInstanceId = 'first-inst-undef-compat-sig3';
        
        // Ensure defIdBasic is available from the describe block's mock
        const entity1 = entityManager.createEntityInstance(defIdBasic, firstInstanceId); 
        expect(entity1).not.toBeNull();
        expect(entityManager.getPrimaryInstanceByDefinitionId(defIdBasic).id).toBe(firstInstanceId);

        // Ensure defIdBasic is available again for the second call
        const entity2 = entityManager.createEntityInstance(defIdBasic, true); // forceNew = true
        expect(entity2).not.toBeNull();
        expect(entity2.id).not.toBe(firstInstanceId);
        expect(entityManager.getPrimaryInstanceByDefinitionId(defIdBasic).id).toBe(entity2.id);
        // Updated log message expectation to match the actual log in createEntityInstance
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`ForceNew active for definition ${defIdBasic}. Removing existing primary instance ${firstInstanceId}`)
        );
      });
    });

    it('should throw if component override validation fails', () => {
      mockValidator.validate.mockImplementation((compId) => {
        if (compId === 'bad:component') return { isValid: false, errors: 'validation failed' };
        return { isValid: true };
      });
      const overrides = { 'bad:component': { data: 'invalid' } };
      expect(() => entityManager.createEntityInstance(defIdBasic, overrides)).toThrow(Error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/^Override component bad:component for entity [0-9a-fA-F\-]+ Errors:\n"validation failed"$/m)
      );
    });
  });

  // --- 3. reconstructEntity Tests ---
  describe('reconstructEntity', () => {
    const defIdRecon = 'recon:def';
    const rawDefRecon = { description: 'Recon Def', components: { 'core:flavor': { text: 'vanilla' } } };
    const instanceIdRecon = 'recon-inst-1';
    const serializedGood = {
      instanceId: instanceIdRecon,
      definitionId: defIdRecon,
      isActor: false, 
      overrides: {
        'core:base': { value: 'from_override' },
        'custom:new': { info: 'added_in_recon' },
      },
    };

    beforeEach(() => {
      // Fixed: Ensure EntityManager is clear before each test in this suite
      // to prevent state leakage (e.g. entity already existing in mapManager).
      if (entityManager) { // entityManager is defined in the outer scope's beforeEach
        entityManager.clearAll();
      }
      
      mockRegistry.getEntityDefinition.mockImplementation(id => 
        id === defIdRecon ? JSON.parse(JSON.stringify(rawDefRecon)) : undefined
      );
      mockValidator.validate.mockClear();
    });
    
    it('should reconstruct an entity from valid serialized data', () => {
      const entity = entityManager.reconstructEntity(serializedGood);
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe(instanceIdRecon);
      expect(entity.definitionId).toBe(defIdRecon);
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith(defIdRecon);
    });
    
    it('should validate components from overrides during reconstruction', () => {
      // serializedGood has isActor: false
      entityManager.reconstructEntity(serializedGood);
      const validateCalls = mockValidator.validate.mock.calls;
      expect(validateCalls).toContainEqual(['core:base', {value: 'from_override'}]);
      expect(validateCalls).toContainEqual(['custom:new', {info: 'added_in_recon'}]);
      
      // NOTES_COMPONENT_ID should NOT be injected for a non-actor entity
      const notesCall = validateCalls.find(call => call[0] === NOTES_COMPONENT_ID);
      expect(notesCall).toBeUndefined();
      
      // Total validation calls = 2 overrides only (since not an actor)
      expect(mockValidator.validate).toHaveBeenCalledTimes(2);
    });
  });

  // --- 4. addComponent Tests ---
  describe('addComponent', () => {
    let entityToModify;
    const setupEntityForModification = (defIdToUse = MOCK_DEFINITION_ID_MAIN, instanceIdToUse = ACCESS_INSTANCE_ID, initialOverrides = {}) => {
      // This will use the mockRegistry.getEntityDefinition from the top-level beforeEach
      // which should include 'test:defWithPos'
      return entityManager.createEntityInstance(defIdToUse, initialOverrides, instanceIdToUse);
    };

    beforeEach(() => {
      // Ensure MOCK_DEFINITION_ID_MAIN is available via the general mock
      // This is crucial for entityToModify to be created.
      entityToModify = setupEntityForModification();
      expect(entityToModify).not.toBeNull(); // Guard
      mockValidator.validate.mockClear();
      // Clear all relevant spatial index mocks
      mockSpatialIndex.addEntity.mockClear();
      mockSpatialIndex.removeEntity.mockClear();
      mockSpatialIndex.updateEntityLocation.mockClear();
    });
    
    it('should remove from spatialIndex if POSITION_COMPONENT_ID is updated to not have locationInstanceId', () => {
      // Clear relevant spatial mocks specifically for this test, before entity creation
      mockSpatialIndex.addEntity.mockClear();
      mockSpatialIndex.removeEntity.mockClear();
      mockSpatialIndex.updateEntityLocation.mockClear();

      const entityWithPos = entityManager.createEntityInstance('test:defWithPos', {
        [POSITION_COMPONENT_ID]: { locationId: 'initial-location', x: 1, y: 1 }
      }, 'a-different-instance-id-for-addcomp-spatial-test'); // Instance ID is the third argument here

      // Verify initial add to spatial index immediately after creation
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(entityWithPos.id, 'initial-location');
      
      // Clear addEntity mock again before the addComponent call to isolate the updateEntityLocation check
      mockSpatialIndex.addEntity.mockClear(); 

      const updatedPosData = { x: 2, y: 2 }; // No locationInstanceId
      entityManager.addComponent(entityWithPos.id, POSITION_COMPONENT_ID, updatedPosData);

      expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(entityWithPos.id, 'initial-location', undefined);
      expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled(); // Should use update, not remove
      expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled(); // Should not be called again after update
    });

    it('should throw if componentData is not an object (and not null)', () => {
      expect(() => entityManager.addComponent(entityToModify.id, 'comp:test', 'not-an-object')).toThrow(Error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/^EntityManager\.addComponent: componentData for comp:test on access-instance-uuid-99 must be an object or null\. Received: string$/),
        { componentData: 'not-an-object' } // Expect the context object as the second argument
      );
    });

    it('should NOT throw if componentData is null', () => {
      // ... existing code ...
    });
  });

  // --- 7. Entity Collection Getters ---
  describe('getEntityInstance', () => {
    // Basic test to ensure it retrieves an entity added via createEntityInstance
    it('should return an entity that was created', () => {
      const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {}, 'get-test-1');
      expect(entityManager.getEntityInstance('get-test-1')).toBe(entity);
    });
  });
  
  describe('getPrimaryInstanceByDefinitionId', () => {
    it('should return the primary instance for a definitionId', () => {
      // Ensure MOCK_DEFINITION_ID_MAIN is available from the global mock
      const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {}, 'primary-1-gpid');
      expect(entity).not.toBeNull(); // Guard
      const primary = entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN);
      expect(primary).toBe(entity); // Fixed: Expect Entity object
    });
    it('should return undefined if no primary instance for a definitionId', () => {
      expect(entityManager.getPrimaryInstanceByDefinitionId('def:no-primary')).toBeUndefined();
    });
  });

  // --- 9. removeEntityInstance Tests ---
  describe('removeEntityInstance', () => {
    it('should remove the entity from activeEntities', () => {
      const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {}, 'remove-test-1');
      expect(entityManager.activeEntities.has(entity.id)).toBe(true);
      entityManager.removeEntityInstance(entity.id);
      expect(entityManager.activeEntities.has(entity.id)).toBe(false);
    });

    it('should clear primary instance mapping if the removed entity was primary', () => {
      // Ensure MOCK_DEFINITION_ID_MAIN is available from the global mock
      const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {}, 'primary-to-remove-rei');
      expect(entity).not.toBeNull(); // Guard
      expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBe(entity); 
      entityManager.removeEntityInstance(entity.id);
      expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBeUndefined();
    });
  });
  
  // --- 11. clearAll Tests ---
  describe('clearAll', () => {
    it('should clear activeEntities, definitionCache, primaryInstanceMap, and spatialIndex', () => {
      // Local setup for this test to ensure one entity has a position
      const localRawDefMainWithPosition = { 
        ...rawDefMain, 
        components: { 
          ...rawDefMain.components, 
          [POSITION_COMPONENT_ID]: { locationId: 'loc-for-clearAll', x: 1, y: 1 }
        } 
      };
      
      const originalGetDef = mockRegistry.getEntityDefinition.getMockImplementation() || (() => undefined);
      
      mockRegistry.getEntityDefinition.mockImplementation((id) => {
        if (id === MOCK_DEFINITION_ID_MAIN) return JSON.parse(JSON.stringify(localRawDefMainWithPosition));
        if (id === MOCK_DEFINITION_ID_ACTOR) return JSON.parse(JSON.stringify(rawDefActorForTests));
        if (originalGetDef) return originalGetDef(id); // Fallback to original mock for other IDs like 'test:basic'
        return undefined;
      });

      const e1 = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {}, 'e1-clear');
      const e2 = entityManager.createEntityInstance(MOCK_DEFINITION_ID_ACTOR, {}, 'e2-clear-actor');
      
      expect(e1).not.toBeNull(); 
      expect(e2).not.toBeNull(); 

      expect(entityManager.activeEntities.size).toBeGreaterThan(0); 
      expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBe(e1);
      // Fixed: This should now pass because e1 (using MOCK_DEFINITION_ID_MAIN) will have a position
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(e1.id, 'loc-for-clearAll'); 

      entityManager.clearAll();

      expect(entityManager.activeEntities.size).toBe(0);
      expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBeUndefined();
      expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_ACTOR)).toBeUndefined();
      expect(mockSpatialIndex.clearIndex).toHaveBeenCalledTimes(1);

      // Definition cache should be cleared
      mockRegistry.getEntityDefinition.mockClear(); 
      // Restore original mock or a simple one for the next part of the test
      if (originalGetDef) {
        mockRegistry.getEntityDefinition.mockImplementation(originalGetDef);
      } else {
         mockRegistry.getEntityDefinition.mockImplementation(id => 
           id === MOCK_DEFINITION_ID_MAIN ? JSON.parse(JSON.stringify(rawDefMain)) : undefined
         );
      }
      // Re-mock for a specific ID to avoid relying on the modified one above if this test runs before others
       mockRegistry.getEntityDefinition.mockImplementationOnce(id => 
         id === MOCK_DEFINITION_ID_MAIN ? JSON.parse(JSON.stringify(rawDefMain)) : undefined
       );
      entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, {}, 'e3-after-clear');
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith(MOCK_DEFINITION_ID_MAIN);
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledTimes(1);
    });
  });
});
// --- FILE END ---

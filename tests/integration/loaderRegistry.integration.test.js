// Filename: src/tests/integration/loaderRegistry.integration.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ActionLoader from '../../src/loaders/actionLoader.js'; // Adjust path if needed
import ComponentLoader from '../../src/loaders/componentLoader.js'; // Adjust path if needed
import InMemoryDataRegistry from '../../src/data/inMemoryDataRegistry.js'; // Use the real registry
// Import the base class to potentially spy on its methods if needed later
import { BaseManifestItemLoader } from '../../src/loaders/baseManifestItemLoader.js';

// --- Mock Service Factories (Copied from provided examples) ---

/**
 * Creates a mock IConfiguration service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../../interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'actions')
      return 'http://example.com/schemas/action.schema.json';
    if (typeName === 'components')
      return 'http://example.com/schemas/component.schema.json';
    // Add other types as needed for tests
    return `http://example.com/schemas/${typeName}.schema.json`; // Default fallback
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('./data/schemas'), // Relative to baseDataPath
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'), // Relative to baseDataPath
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getContentBasePath: jest.fn((typeName) => `./data/${typeName}`), // Fallback content base
  getRuleBasePath: jest.fn().mockReturnValue('rules'), // Relative to baseDataPath
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../../interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
 */
const createMockPathResolver = (overrides = {}) => ({
  // Resolve assuming mocks are relative to a conceptual root
  resolveModContentPath: jest.fn(
    (modId, typeName, filename) =>
      `./data/mods/${modId}/${typeName}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (typeName, filename) => `./data/${typeName}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `./data/mods/${modId}/mod.manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 *
 * @param {object} [pathToResponse] - Map of path strings to successful response data.
 * @param {string[]} [errorPaths] - List of paths that should trigger a rejection.
 * @returns {import('../../../../interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
  fetch: jest.fn(async (path) => {
    // console.log(`Mock Fetcher: Fetching ${path}`); // Debug log
    if (errorPaths.includes(path)) {
      // console.log(`Mock Fetcher: Returning error for ${path}`); // Debug log
      return Promise.reject(
        new Error(`Mock Fetch Error: Failed to fetch ${path}`)
      );
    }
    if (path in pathToResponse) {
      // console.log(`Mock Fetcher: Returning data for ${path}`); // Debug log
      // Return a deep copy to prevent state bleeding between reads
      return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
    }
    // console.log(`Mock Fetcher: 404 for ${path}`); // Debug log
    return Promise.reject(
      new Error(`Mock Fetch Error: 404 Not Found for ${path}`)
    );
  }),
});

/**
 * Creates a mock ISchemaValidator service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../../interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();

  const mockValidator = {
    // Default to valid for any schema unless configured otherwise
    validate: jest.fn((schemaId, data) => {
      // console.log(`Mock Validator: Validating data against schema ${schemaId}`); // Debug log
      const validatorFn = schemaValidators.get(schemaId);
      if (validatorFn) {
        return validatorFn(data);
      }
      // Default to valid if no specific validator is set but schema might be "loaded"
      // This simplifies setup for integration tests not focused on schema errors
      // console.log(`Mock Validator: No specific validator for ${schemaId}, returning default valid.`); // Debug log
      return { isValid: true, errors: null };
    }),
    getValidator: jest.fn((schemaId) => {
      // console.log(`Mock Validator: Getting validator for ${schemaId}`); // Debug log
      return (
        schemaValidators.get(schemaId) ||
        (() => ({ isValid: true, errors: null }))
      ); // Return a default valid function
    }),
    addSchema: jest.fn(async (schemaData, schemaId) => {
      // console.log(`Mock Validator: Adding schema ${schemaId}`); // Debug log
      loadedSchemas.set(schemaId, schemaData);
      // Add a default validator function if one doesn't exist
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    }),
    removeSchema: jest.fn((schemaId) => {
      // console.log(`Mock Validator: Removing schema ${schemaId}`); // Debug log
      const deletedData = loadedSchemas.delete(schemaId);
      const deletedValidator = schemaValidators.delete(schemaId);
      return deletedData || deletedValidator; // Return true if either was present
    }),
    isSchemaLoaded: jest.fn((schemaId) => {
      // console.log(`Mock Validator: Checking if schema ${schemaId} is loaded: ${loadedSchemas.has(schemaId)}`); // Debug log
      return loadedSchemas.has(schemaId);
    }),
    // Helper to configure specific validator behavior
    mockValidatorFunction: (schemaId, implementation) => {
      // console.log(`Mock Validator: Setting mock implementation for ${schemaId}`); // Debug log
      if (!schemaValidators.has(schemaId)) {
        // Ensure schema is considered 'loaded' if we define a validator
        loadedSchemas.set(schemaId, {}); // Add dummy schema data
      }
      schemaValidators.set(schemaId, jest.fn(implementation));
    },
    // Helper to simulate schema loading state for tests
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      // console.log(`Mock Validator: Force setting schema ${schemaId} as loaded`); // Debug log
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    },
    // Helper to check internal state
    _isSchemaActuallyLoaded: (schemaId) => loadedSchemas.has(schemaId),
    _getLoadedSchemaData: (schemaId) => loadedSchemas.get(schemaId),
    ...overrides,
  };
  return mockValidator;
};

/**
 * Creates a mock ILogger service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../../interfaces/coreServices.js').ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
  // Set default mocks using jest.fn()
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  // Allow overriding specific methods or adding new ones
  ...overrides,
});

// --- Test Suite ---

describe('Integration: Loaders, Registry State, and Overrides (REFACTOR-8.6)', () => {
  let mockConfig;
  let mockResolver;
  let mockFetcher; // Will be configured per test scenario, but initialized here
  let mockValidator;
  let mockLogger;
  let dataRegistry; // Use real InMemoryDataRegistry
  let actionLoader;
  let componentLoader;

  // --- Content Data ---
  const actionFilename = 'cool_action.json';
  const componentFilename = 'cool_component.json';

  // *** ADDED: Constants for Action Loader ***
  const ACTION_CONTENT_KEY = 'actions';
  const ACTION_CONTENT_DIR = 'actions';
  const ACTION_TYPE_NAME = 'actions';
  // *** END ADDED ***

  // Base IDs (used in file content)
  const coolActionBaseId = 'cool_action'; // ID in file is just the base
  const coolComponentBaseId = 'cool_component'; // ID in file is just the base

  // Mod A data
  const modAId = 'modA';
  const modAPath = `./data/mods/${modAId}`;
  const modAActionPath = `${modAPath}/actions/${actionFilename}`;
  const modAComponentPath = `${modAPath}/components/${componentFilename}`;
  const modAActionData = {
    id: coolActionBaseId, // Use BASE ID
    commandVerb: 'do_a',
    target_domain: 'none',
    template: 'Doing A',
    description: 'From Mod A',
  };
  const modAComponentData = {
    id: coolComponentBaseId, // Use BASE ID
    dataSchema: { type: 'object', properties: { propA: {} } },
    description: 'From Mod A',
  };
  const modAManifest = {
    id: modAId,
    name: 'Mod A',
    version: '1.0',
    content: { actions: [actionFilename], components: [componentFilename] },
  };

  // Mod B data
  const modBId = 'modB';
  const modBPath = `./data/mods/${modBId}`;
  const modBActionPath = `${modBPath}/actions/${actionFilename}`; // Same filename
  const modBComponentPath = `${modBPath}/components/${componentFilename}`; // Same filename
  const modBActionData = {
    id: coolActionBaseId, // Use BASE ID
    commandVerb: 'do_b',
    target_domain: 'self',
    template: 'Doing B',
    description: 'From Mod B',
  }; // Same base ID
  const modBComponentData = {
    id: coolComponentBaseId, // Use BASE ID
    dataSchema: { type: 'object', properties: { propB: {} } },
    description: 'From Mod B',
  }; // Same base ID
  const modBManifest = {
    id: modBId,
    name: 'Mod B',
    version: '1.0',
    content: { actions: [actionFilename], components: [componentFilename] },
  };

  // Core Mod data (for override test)
  // Not used in current failing tests, but kept for reference

  // Mod X data (overrides core)
  // Not used in current failing tests, but kept for reference

  // --- Setup ---
  beforeEach(() => {
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher(); // Initialize with default
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    dataRegistry = new InMemoryDataRegistry(mockLogger); // Pass logger to real registry if needed

    // Clear mocks AND spies on the real registry
    jest.clearAllMocks();
    jest.spyOn(dataRegistry, 'store');
    jest.spyOn(dataRegistry, 'get');
    jest.spyOn(dataRegistry, 'getAll');

    actionLoader = new ActionLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      dataRegistry,
      mockLogger
    );
    componentLoader = new ComponentLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      dataRegistry,
      mockLogger
    );

    // Ensure schemas are marked as loaded for the tests
    mockValidator._setSchemaLoaded(
      'http://example.com/schemas/action.schema.json',
      {}
    );
    mockValidator._setSchemaLoaded(
      'http://example.com/schemas/component.schema.json',
      {}
    );
    // If components define data schemas that need registering during load,
    // the componentLoader._processFetchedItem should handle that registration.
    // If the tests expect specific component data schemas to be pre-loaded, add them here:
    // mockValidator._setSchemaLoaded('modA:cool_component', modAComponentData.dataSchema);
    // mockValidator._setSchemaLoaded('modB:cool_component', modBComponentData.dataSchema);
  });

  // --- Scenario 1: Non-Conflicting Base IDs ---
  describe('Scenario 1: Non-Conflicting Base IDs', () => {
    beforeEach(() => {
      const fetcherConfig = {
        [modAActionPath]: modAActionData,
        [modAComponentPath]: modAComponentData,
        [modBActionPath]: modBActionData,
        [modBComponentPath]: modBComponentData,
      };
      mockFetcher = createMockDataFetcher(fetcherConfig);
      actionLoader._dataFetcher = mockFetcher; // Ensure loaders use the configured fetcher
      componentLoader._dataFetcher = mockFetcher;
    });

    // **** TEST CASE 1: Correction ****
    it('should store items from different mods with the same base ID under unique keys without warnings', async () => {
      // --- Act ---
      // Load Mod A Actions
      await actionLoader.loadItemsForMod(
        modAId,
        modAManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      // Load Mod A Components
      // <<< CORRECTION: Use loadItemsForMod for ComponentLoader >>>
      await componentLoader.loadItemsForMod(
        modAId, // modId
        modAManifest, // modManifest
        'components', // contentKey
        'components', // contentTypeDir
        'components' // typeName
      );
      // Load Mod B Actions
      await actionLoader.loadItemsForMod(
        modBId,
        modBManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      // Load Mod B Components
      // <<< CORRECTION: Use loadItemsForMod for ComponentLoader >>>
      await componentLoader.loadItemsForMod(
        modBId, // modId
        modBManifest, // modManifest
        'components', // contentKey
        'components', // contentTypeDir
        'components' // typeName
      );

      // --- Assert ---
      expect(dataRegistry.store).toHaveBeenCalledTimes(4); // Assert store count

      // Get items using the final registry keys
      const actionA = dataRegistry.get(
        'actions',
        `${modAId}:${coolActionBaseId}`
      ); // modA:cool_action
      const componentA = dataRegistry.get(
        'components',
        `${modAId}:${coolComponentBaseId}`
      ); // modA:cool_component
      const actionB = dataRegistry.get(
        'actions',
        `${modBId}:${coolActionBaseId}`
      ); // modB:cool_action
      const componentB = dataRegistry.get(
        'components',
        `${modBId}:${coolComponentBaseId}`
      ); // modB:cool_component

      expect(actionA).toBeDefined();
      expect(componentA).toBeDefined();
      expect(actionB).toBeDefined();
      expect(componentB).toBeDefined();

      // Verify Content and Metadata Augmentation
      expect(actionA).toEqual(
        expect.objectContaining({
          id: `${modAId}:${coolActionBaseId}`,
          modId: modAId,
          _sourceFile: actionFilename,
          description: 'From Mod A', // Check a property from original data
        })
      );
      expect(componentA).toEqual(
        expect.objectContaining({
          id: `${modAId}:${coolComponentBaseId}`,
          modId: modAId,
          _sourceFile: componentFilename,
          description: 'From Mod A',
          dataSchema: { type: 'object', properties: { propA: {} } },
        })
      );
      expect(actionB).toEqual(
        expect.objectContaining({
          id: `${modBId}:${coolActionBaseId}`,
          modId: modBId,
          _sourceFile: actionFilename,
          description: 'From Mod B',
        })
      );
      expect(componentB).toEqual(
        expect.objectContaining({
          id: `${modBId}:${coolComponentBaseId}`,
          modId: modBId,
          _sourceFile: componentFilename,
          description: 'From Mod B',
          dataSchema: { type: 'object', properties: { propB: {} } },
        })
      );

      // Ensure no "Overwriting" warnings were logged for these operations
      // The warning check in _storeItemInRegistry uses `this.constructor.name`,
      // so it will correctly identify ActionLoader or ComponentLoader.
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/Overwriting existing/),
        expect.anything() // Allow any details object
        // Removed third argument check as warn might not always receive the original error object
      );

      // Verify logger info calls for starting/finishing mods
      expect(mockLogger.info).toHaveBeenCalledWith(
        `ActionLoader: Loading actions definitions for mod '${modAId}'.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `ComponentLoader: Loading components definitions for mod '${modAId}'.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `ActionLoader: Loading actions definitions for mod '${modBId}'.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `ComponentLoader: Loading components definitions for mod '${modBId}'.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Mod [${modAId}] - Processed 1/1 actions items.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Mod [${modAId}] - Processed 1/1 components items.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Mod [${modBId}] - Processed 1/1 actions items.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Mod [${modBId}] - Processed 1/1 components items.`
      );
    });
  });

  // --- Scenario 2: True Key Override (Simulated via Re-loading) ---
  describe('Scenario 2: True Key Override (Warning Check)', () => {
    // ... Scenario 2 setup remains the same ...
    const overrideModId = 'overrideMod';
    const overrideActionFileV1 = 'action_v1.json';
    const overrideActionFileV2 = 'action_v2.json';
    const overrideActionIdInFile = 'core:special_action'; // Namespaced ID
    const overrideBaseId = 'special_action'; // Extracted base ID
    const overrideFinalKey = `${overrideModId}:${overrideBaseId}`; // Key: overrideMod:special_action

    const overrideActionDataV1 = {
      id: overrideActionIdInFile,
      commandVerb: 'do_v1',
      target_domain: 'none',
      template: 'V1',
      description: 'Version 1',
    };
    const overrideActionDataV2 = {
      id: overrideActionIdInFile,
      commandVerb: 'do_v2',
      target_domain: 'self',
      template: 'V2',
      description: 'Version 2',
    };

    const overrideActionPathV1 = `./data/mods/${overrideModId}/actions/${overrideActionFileV1}`;
    const overrideActionPathV2 = `./data/mods/${overrideModId}/actions/${overrideActionFileV2}`;

    beforeEach(() => {
      const fetcherConfig = {
        [overrideActionPathV1]: overrideActionDataV1,
        [overrideActionPathV2]: overrideActionDataV2,
      };
      mockFetcher = createMockDataFetcher(fetcherConfig);
      actionLoader._dataFetcher = mockFetcher;

      // Ensure the real _processFetchedItem is used for this test
      if (ActionLoader.prototype._processFetchedItem) {
        actionLoader._processFetchedItem =
          ActionLoader.prototype._processFetchedItem.bind(actionLoader);
      } else {
        console.error(
          'Error: ActionLoader.prototype._processFetchedItem is undefined in Scenario 2 beforeEach'
        );
      }
      // Spy on the base class helper directly
      jest.spyOn(BaseManifestItemLoader.prototype, '_storeItemInRegistry');
    });

    it('should log a warning when an item is stored with the same final key as an existing item', async () => {
      // console.log('Debug: Scenario 2 - Processing V1...');
      // Directly call _processFetchedItem to simulate loading one file
      await actionLoader._processFetchedItem(
        overrideModId,
        overrideActionFileV1,
        overrideActionPathV1,
        overrideActionDataV1,
        ACTION_TYPE_NAME // Use constant
      );
      // console.log(`Debug: Scenario 2 - After V1 - actions: ${dataRegistry.getAll('actions').length}`);

      const itemV1 = dataRegistry.get('actions', overrideFinalKey);
      expect(itemV1).toBeDefined();
      expect(itemV1.description).toBe('Version 1');

      // Expect NO warning log after the first processing
      expect(mockLogger.warn).not.toHaveBeenCalled();
      // Expect store to have been called once via the helper
      expect(
        BaseManifestItemLoader.prototype._storeItemInRegistry
      ).toHaveBeenCalledTimes(1);
      expect(
        BaseManifestItemLoader.prototype._storeItemInRegistry
      ).toHaveBeenCalledWith(
        ACTION_TYPE_NAME,
        overrideModId,
        overrideBaseId,
        overrideActionDataV1,
        overrideActionFileV1
      );

      // Reset mocks/spies for the next call
      mockLogger.warn.mockClear();
      BaseManifestItemLoader.prototype._storeItemInRegistry.mockClear();

      // console.log('Debug: Scenario 2 - Processing V2...');
      // Directly call _processFetchedItem again with V2 data for the same effective ID
      await actionLoader._processFetchedItem(
        overrideModId,
        overrideActionFileV2,
        overrideActionPathV2,
        overrideActionDataV2,
        ACTION_TYPE_NAME // Use constant
      );
      // console.log(`Debug: Scenario 2 - After V2 - actions: ${dataRegistry.getAll('actions').length}`); // Should still be 1

      // Expect the OVERWRITE warning log NOW
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      // Check the warning message content (originates from _storeItemInRegistry)
      const expectedWarnMsg = `${ActionLoader.name} [${overrideModId}]: Overwriting existing ${ACTION_TYPE_NAME} definition with key '${overrideFinalKey}'. New Source: ${overrideActionFileV2}. Previous Source: ${overrideActionFileV1} from mod '${overrideModId}.'`;
      expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg);

      // Expect store helper to be called again for the override
      expect(
        BaseManifestItemLoader.prototype._storeItemInRegistry
      ).toHaveBeenCalledTimes(1);
      expect(
        BaseManifestItemLoader.prototype._storeItemInRegistry
      ).toHaveBeenCalledWith(
        ACTION_TYPE_NAME,
        overrideModId,
        overrideBaseId,
        overrideActionDataV2,
        overrideActionFileV2
      );

      // Verify the final state in the registry
      const finalItem = dataRegistry.get('actions', overrideFinalKey);
      expect(finalItem).toBeDefined();
      expect(finalItem.description).toBe('Version 2');
      expect(finalItem.id).toBe(overrideFinalKey); // Stored object should have the final key
      expect(finalItem.modId).toBe(overrideModId);
      expect(finalItem._sourceFile).toBe(overrideActionFileV2);

      // Ensure no unexpected errors occurred
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  // --- Scenario 3: Registry State Verification ---
  describe('Scenario 3: Registry State Verification', () => {
    // ... Scenario 3 setup remains the same ...
    const diverseActionFilename = 'diverse_action.json';
    const diverseComponentFilename = 'diverse_component.json';

    const modCId = 'modC';
    const modCPath = `./data/mods/${modCId}`;
    const modCComponentPath = `${modCPath}/components/${diverseComponentFilename}`;
    const modCComponentData = {
      id: 'unique_comp',
      dataSchema: { type: 'string' },
      description: 'From Mod C',
    }; // Base ID only
    const modCManifest = {
      id: modCId,
      name: 'Mod C',
      version: '1.0',
      content: { components: [diverseComponentFilename] },
    };

    const modDId = 'modD';
    const modDPath = `./data/mods/${modDId}`;
    const modDActionPath = `${modDPath}/actions/${diverseActionFilename}`;
    const modDActionData = {
      id: 'unique_action', // Base ID only
      commandVerb: 'do_d',
      target_domain: 'inventory',
      template: 'Doing D',
      description: 'From Mod D',
    };
    const modDManifest = {
      id: modDId,
      name: 'Mod D',
      version: '1.0',
      content: { actions: [diverseActionFilename] },
    };

    beforeEach(() => {
      const fetcherConfig = {
        [modAActionPath]: modAActionData, // id: cool_action
        [modAComponentPath]: modAComponentData, // id: cool_component
        [modBActionPath]: modBActionData, // id: cool_action
        [modBComponentPath]: modBComponentData, // id: cool_component
        [modCComponentPath]: modCComponentData, // id: unique_comp
        [modDActionPath]: modDActionData, // id: unique_action
      };
      mockFetcher = createMockDataFetcher(fetcherConfig);
      actionLoader._dataFetcher = mockFetcher;
      componentLoader._dataFetcher = mockFetcher;
    });

    // **** TEST CASE 2: Correction ****
    it('should store items with correct keys and augmented metadata', async () => {
      // --- Act ---
      // Load Mod A Actions
      await actionLoader.loadItemsForMod(
        modAId,
        modAManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      // Load Mod A Components
      // <<< CORRECTION: Use loadItemsForMod for ComponentLoader >>>
      await componentLoader.loadItemsForMod(
        modAId, // modId
        modAManifest, // modManifest
        'components', // contentKey
        'components', // contentTypeDir
        'components' // typeName
      );
      // Load Mod B Actions
      await actionLoader.loadItemsForMod(
        modBId,
        modBManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      // Load Mod B Components
      // <<< CORRECTION: Use loadItemsForMod for ComponentLoader >>>
      await componentLoader.loadItemsForMod(
        modBId, // modId
        modBManifest, // modManifest
        'components', // contentKey
        'components', // contentTypeDir
        'components' // typeName
      );
      // Load Mod C Components
      // <<< CORRECTION: Use loadItemsForMod for ComponentLoader >>>
      await componentLoader.loadItemsForMod(
        modCId, // modId
        modCManifest, // modManifest
        'components', // contentKey
        'components', // contentTypeDir
        'components' // typeName
      );
      // Load Mod D Actions
      await actionLoader.loadItemsForMod(
        modDId,
        modDManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );

      // --- Assert ---
      // Define expected items with their final registry keys and metadata
      const expectedItems = [
        {
          type: 'actions',
          key: 'modA:cool_action',
          sourceFile: actionFilename,
          modId: modAId,
          originalData: modAActionData,
        },
        {
          type: 'components',
          key: 'modA:cool_component',
          sourceFile: componentFilename,
          modId: modAId,
          originalData: modAComponentData,
        },
        {
          type: 'actions',
          key: 'modB:cool_action',
          sourceFile: actionFilename,
          modId: modBId,
          originalData: modBActionData,
        },
        {
          type: 'components',
          key: 'modB:cool_component',
          sourceFile: componentFilename,
          modId: modBId,
          originalData: modBComponentData,
        },
        {
          type: 'components',
          key: 'modC:unique_comp',
          sourceFile: diverseComponentFilename,
          modId: modCId,
          originalData: modCComponentData,
        },
        {
          type: 'actions',
          key: 'modD:unique_action',
          sourceFile: diverseActionFilename,
          modId: modDId,
          originalData: modDActionData,
        },
      ];

      // Verify store was called the correct number of times
      expect(dataRegistry.store).toHaveBeenCalledTimes(expectedItems.length); // Expect 6 calls

      // Verify each item in the registry
      for (const expected of expectedItems) {
        const retrievedItem = dataRegistry.get(expected.type, expected.key);

        // Basic check: item exists
        expect(retrievedItem).toBeDefined();

        // Check augmented metadata
        expect(retrievedItem.id).toBe(expected.key); // The stored item's ID should be the final registry key
        expect(retrievedItem.modId).toBe(expected.modId);
        expect(retrievedItem._sourceFile).toBe(expected.sourceFile);

        // Check that original data properties (excluding 'id') are present
        const { id: originalId, ...restOfOriginalData } = expected.originalData;
        const {
          id: retrievedId,
          modId: retrievedModId,
          _sourceFile: retrievedSourceFile,
          ...restOfRetrievedData
        } = retrievedItem;
        // Perform deep equality check on the rest of the data
        expect(restOfRetrievedData).toEqual(restOfOriginalData);
      }

      // Verify final counts per type
      expect(dataRegistry.getAll('actions').length).toBe(3); // modA:cool_action, modB:cool_action, modD:unique_action
      expect(dataRegistry.getAll('components').length).toBe(3); // modA:cool_component, modB:cool_component, modC:unique_comp

      // Ensure no overwrite warnings were logged (because keys are unique per mod)
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/Overwriting existing/),
        expect.anything() // Allow any details object
      );
      // Ensure no errors occurred
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});

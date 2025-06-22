// Filename: src/tests/integration/loaderRegistry.integration.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createMockLogger } from '../../common/mockFactories.js';
import ActionLoader from '../../../src/loaders/actionLoader.js';
import ComponentLoader from '../../../src/loaders/componentLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';

// --- Mock Service Factories ---
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'actions')
      return 'http://example.com/schemas/action.schema.json';
    if (registryKey === 'components')
      return 'http://example.com/schemas/component.schema.json';
    return `http://example.com/schemas/${registryKey}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('./data/schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getContentBasePath: jest.fn((registryKey) => `./data/${registryKey}`),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, registryKey, filename) =>
      `./data/mods/${modId}/${registryKey}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (registryKey, filename) => `./data/${registryKey}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `./data/mods/${modId}/mod-manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});

const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
  fetch: jest.fn(async (path) => {
    if (errorPaths.includes(path)) {
      return Promise.reject(
        new Error(`Mock Fetch Error: Failed to fetch ${path}`)
      );
    }
    if (path in pathToResponse) {
      return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
    }
    return Promise.reject(
      new Error(`Mock Fetch Error: 404 Not Found for ${path}`)
    );
  }),
});

const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();
  const mockValidator = {
    validate: jest.fn((schemaId, data) => {
      const validatorFn = schemaValidators.get(schemaId);
      if (validatorFn) return validatorFn(data);
      return { isValid: true, errors: null };
    }),
    getValidator: jest.fn(
      (schemaId) =>
        schemaValidators.get(schemaId) ||
        (() => ({ isValid: true, errors: null }))
    ),
    addSchema: jest.fn(async (schemaData, schemaId) => {
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    }),
    removeSchema: jest.fn((schemaId) => {
      const deletedData = loadedSchemas.delete(schemaId);
      const deletedValidator = schemaValidators.delete(schemaId);
      return deletedData || deletedValidator;
    }),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    },
    ...overrides,
  };
  return mockValidator;
};

// --- Test Suite ---
describe('Integration: Loaders, Registry State, and Overrides (REFACTOR-8.6)', () => {
  let mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockLogger,
    dataRegistry,
    actionLoader,
    componentLoader;
  const actionFilename = 'cool_action.json';
  const componentFilename = 'cool_component.json';
  const ACTION_CONTENT_KEY = 'actions';
  const ACTION_CONTENT_DIR = 'actions';
  const ACTION_TYPE_NAME = 'actions';
  const coolActionBaseId = 'cool_action';
  const coolComponentBaseId = 'cool_component';
  const modAId = 'modA';
  const modAPath = `./data/mods/${modAId}`;
  const modAActionPath = `${modAPath}/actions/${actionFilename}`;
  const modAComponentPath = `${modAPath}/components/${componentFilename}`;
  const modAActionData = {
    id: coolActionBaseId,
    commandVerb: 'do_a',
    description: 'From Mod A',
  };
  const modAComponentData = {
    id: coolComponentBaseId,
    dataSchema: { type: 'object', properties: { propA: {} } },
    description: 'From Mod A',
  };
  const modAManifest = {
    id: modAId,
    name: 'Mod A',
    version: '1.0',
    content: { actions: [actionFilename], components: [componentFilename] },
  };
  const modBId = 'modB';
  const modBPath = `./data/mods/${modBId}`;
  const modBActionPath = `${modBPath}/actions/${actionFilename}`;
  const modBComponentPath = `${modBPath}/components/${componentFilename}`;
  const modBActionData = {
    id: coolActionBaseId,
    commandVerb: 'do_b',
    description: 'From Mod B',
  };
  const modBComponentData = {
    id: coolComponentBaseId,
    dataSchema: { type: 'object', properties: { propB: {} } },
    description: 'From Mod B',
  };
  const modBManifest = {
    id: modBId,
    name: 'Mod B',
    version: '1.0',
    content: { actions: [actionFilename], components: [componentFilename] },
  };

  beforeEach(() => {
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    dataRegistry = new InMemoryDataRegistry(mockLogger);
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
    mockValidator._setSchemaLoaded(
      'http://example.com/schemas/action.schema.json',
      {}
    );
    mockValidator._setSchemaLoaded(
      'http://example.com/schemas/component.schema.json',
      {}
    );
  });

  describe('Scenario 1: Non-Conflicting Base IDs', () => {
    beforeEach(() => {
      const fetcherConfig = {
        [modAActionPath]: modAActionData,
        [modAComponentPath]: modAComponentData,
        [modBActionPath]: modBActionData,
        [modBComponentPath]: modBComponentData,
      };
      mockFetcher = createMockDataFetcher(fetcherConfig);
      actionLoader._dataFetcher = mockFetcher;
      componentLoader._dataFetcher = mockFetcher;
    });

    it('should store items from different mods with the same base ID under unique keys without warnings', async () => {
      await actionLoader.loadItemsForMod(
        modAId,
        modAManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      await componentLoader.loadItemsForMod(
        modAId,
        modAManifest,
        'components',
        'components',
        'components'
      );
      await actionLoader.loadItemsForMod(
        modBId,
        modBManifest,
        ACTION_CONTENT_KEY,
        ACTION_CONTENT_DIR,
        ACTION_TYPE_NAME
      );
      await componentLoader.loadItemsForMod(
        modBId,
        modBManifest,
        'components',
        'components',
        'components'
      );

      expect(dataRegistry.store).toHaveBeenCalledTimes(4);
      const actionA = dataRegistry.get(
        'actions',
        `${modAId}:${coolActionBaseId}`
      );
      const componentA = dataRegistry.get(
        'components',
        `${modAId}:${coolComponentBaseId}`
      );
      const actionB = dataRegistry.get(
        'actions',
        `${modBId}:${coolActionBaseId}`
      );
      const componentB = dataRegistry.get(
        'components',
        `${modBId}:${coolComponentBaseId}`
      );

      expect(actionA).toBeDefined();
      expect(componentA).toBeDefined();
      expect(actionB).toBeDefined();
      expect(componentB).toBeDefined();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 2: True Key Override (Warning Check)', () => {
    const overrideModId = 'overrideMod';
    const overrideActionFileV1 = 'action_v1.json';
    const overrideActionFileV2 = 'action_v2.json';
    const overrideActionIdInFile = 'core:special_action';
    const overrideBaseId = 'special_action';
    const overrideFinalKey = `${overrideModId}:${overrideBaseId}`;
    const overrideActionDataV1 = {
      id: overrideActionIdInFile,
      description: 'Version 1',
    };
    const overrideActionDataV2 = {
      id: overrideActionIdInFile,
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
    });

    it('should log a warning when an item is stored with the same final key as an existing item', async () => {
      await actionLoader._processFetchedItem(
        overrideModId,
        overrideActionFileV1,
        overrideActionPathV1,
        overrideActionDataV1,
        ACTION_TYPE_NAME
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(dataRegistry.get('actions', overrideFinalKey).description).toBe(
        'Version 1'
      );
      mockLogger.warn.mockClear();

      await actionLoader._processFetchedItem(
        overrideModId,
        overrideActionFileV2,
        overrideActionPathV2,
        overrideActionDataV2,
        ACTION_TYPE_NAME
      );

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      const expectedWarnMsg = `${ActionLoader.name} [${overrideModId}]: Item '${overrideFinalKey}' (Base: '${overrideBaseId}') in category '${ACTION_TYPE_NAME}' from file '${overrideActionFileV2}' overwrote an existing entry.`;
      expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg);

      const finalItem = dataRegistry.get('actions', overrideFinalKey);
      expect(finalItem).toBeDefined();
      expect(finalItem.description).toBe('Version 2');
    });
  });

  describe('Scenario 3: Registry State Verification', () => {
    const diverseActionFilename = 'diverse_action.json';
    const diverseComponentFilename = 'diverse_component.json';
    const modCId = 'modC';
    const modCComponentPath = `./data/mods/${modCId}/components/${diverseComponentFilename}`;
    // <<< FIX START >>>
    // Added the required `dataSchema` property to make the test data valid.
    const modCComponentData = {
      id: 'unique_comp',
      dataSchema: {},
      description: 'From Mod C',
    };
    // <<< FIX END >>>
    const modCManifest = {
      id: modCId,
      content: { components: [diverseComponentFilename] },
    };
    const modDId = 'modD';
    const modDActionPath = `./data/mods/${modDId}/actions/${diverseActionFilename}`;
    const modDActionData = { id: 'unique_action', description: 'From Mod D' };
    const modDManifest = {
      id: modDId,
      content: { actions: [diverseActionFilename] },
    };

    beforeEach(() => {
      const fetcherConfig = {
        [modAActionPath]: modAActionData,
        [modAComponentPath]: modAComponentData,
        [modBActionPath]: modBActionData,
        [modBComponentPath]: modBComponentData,
        [modCComponentPath]: modCComponentData,
        [modDActionPath]: modDActionData,
      };
      mockFetcher = createMockDataFetcher(fetcherConfig);
      actionLoader._dataFetcher = mockFetcher;
      componentLoader._dataFetcher = mockFetcher;
    });

    it('should store items with correct keys and augmented metadata', async () => {
      await actionLoader.loadItemsForMod(
        modAId,
        modAManifest,
        'actions',
        'actions',
        'actions'
      );
      await componentLoader.loadItemsForMod(
        modAId,
        modAManifest,
        'components',
        'components',
        'components'
      );
      await actionLoader.loadItemsForMod(
        modBId,
        modBManifest,
        'actions',
        'actions',
        'actions'
      );
      await componentLoader.loadItemsForMod(
        modBId,
        modBManifest,
        'components',
        'components',
        'components'
      );
      await componentLoader.loadItemsForMod(
        modCId,
        modCManifest,
        'components',
        'components',
        'components'
      );
      await actionLoader.loadItemsForMod(
        modDId,
        modDManifest,
        'actions',
        'actions',
        'actions'
      );

      const expectedItems = [
        {
          type: 'actions',
          key: 'modA:cool_action',
          sourceFile: actionFilename,
          modId: modAId,
          baseId: coolActionBaseId,
          originalData: modAActionData,
        },
        {
          type: 'components',
          key: 'modA:cool_component',
          sourceFile: componentFilename,
          modId: modAId,
          baseId: coolComponentBaseId,
          originalData: modAComponentData,
        },
        {
          type: 'actions',
          key: 'modB:cool_action',
          sourceFile: actionFilename,
          modId: modBId,
          baseId: coolActionBaseId,
          originalData: modBActionData,
        },
        {
          type: 'components',
          key: 'modB:cool_component',
          sourceFile: componentFilename,
          modId: modBId,
          baseId: coolComponentBaseId,
          originalData: modBComponentData,
        },
        {
          type: 'components',
          key: 'modC:unique_comp',
          sourceFile: diverseComponentFilename,
          modId: modCId,
          baseId: 'unique_comp',
          originalData: modCComponentData,
        },
        {
          type: 'actions',
          key: 'modD:unique_action',
          sourceFile: diverseActionFilename,
          modId: modDId,
          baseId: 'unique_action',
          originalData: modDActionData,
        },
      ];

      expect(dataRegistry.store).toHaveBeenCalledTimes(expectedItems.length);

      for (const expected of expectedItems) {
        const retrievedItem = dataRegistry.get(expected.type, expected.key);
        expect(retrievedItem).toBeDefined();
        expect(retrievedItem.id).toBe(expected.baseId);
        expect(retrievedItem._fullId).toBe(expected.key);
        expect(retrievedItem._modId).toBe(expected.modId);
        expect(retrievedItem._sourceFile).toBe(expected.sourceFile);
      }
    });
  });
});

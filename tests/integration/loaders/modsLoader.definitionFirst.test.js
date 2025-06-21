import { jest, beforeEach, afterEach, describe, it, expect } from '@jest/globals';

import ModsLoader from '../../../src/loaders/modsLoader.js';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import WorldLoader from '../../../src/loaders/worldLoader.js';
import { ModsLoaderError } from '../../../src/errors/modsLoaderError.js';
import { ENTITY_DEFINITIONS_KEY } from '../../../src/loaders/worldLoader.js';
import {
  createMockLogger,
  createMockConfiguration,
  createMockSchemaValidator,
  createStatefulMockDataRegistry,
  createMockPathResolver,
  createMockDataFetcher,
  createMockGameConfigLoader,
  createMockModManifestLoader,
  createMockValidatedEventDispatcher,
  createMockSchemaLoader,
  createMockModLoadOrderResolver,
  createMockContentLoader, // For other loaders
  createMockModDependencyValidator,
} from '../../common/mockFactories.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';
import createDefaultContentLoadersConfig from '../../../src/loaders/defaultLoaderConfig.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import MissingSchemaError from '../../../src/errors/missingSchemaError.js';
import ESSENTIAL_SCHEMA_TYPES from '../../../src/constants/essentialSchemas.js';
import ModManifestProcessor from '../../../src/loaders/ModManifestProcessor.js';


describe('ModsLoader - Definition-First Loading Guarantees', () => {
  let mockLogger;
  let mockConfiguration;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockPathResolver;
  let mockDataFetcher;
  let mockGameConfigLoader;
  let mockModManifestLoader;
  let mockValidatedEventDispatcher;
  let mockSchemaLoader;
  let mockModDependencyValidator;
  let mockModVersionValidator;
  let mockModLoadOrderResolver;
  let mockGameDataRepository;
  let processManifestsSpy;

  let entityDefinitionLoader;
  let worldLoader;
  let modsLoader;

  const VALID_DEF_ID = `${CORE_MOD_ID}:valid_def`;
  const INVALID_DEF_ID = 'test-mod:non_existent_def';
  const TEST_MOD_ID = 'test-mod';

  const coreManifest = {
    id: CORE_MOD_ID,
    name: 'Core Mod',
    version: '1.0.0',
    gameVersion: '1.0.0',
    content: {
      entityDefinitions: ['entities/definitions/valid_def.json'],
    },
  };
  const testModManifest = {
    id: TEST_MOD_ID,
    name: 'Test Mod',
    version: '1.0.0',
    gameVersion: '1.0.0',
    dependencies: [{ id: CORE_MOD_ID, version: '^1.0.0' }],
    content: {
      worlds: ['worlds/world_with_invalid_ref.json'],
    },
  };
  const validEntityDefData = {
    id: 'valid_def', // The loader will prefix with 'core:'
    components: { 'core:component_dummy': {} },
  };
  const worldFileContentInvalidRef = {
    instances: [
      { id: 'instance_valid', definitionId: VALID_DEF_ID, components: {} },
      { id: 'instance_invalid', definitionId: INVALID_DEF_ID, components: {} },
    ],
  };

  const CONCEPTUAL_CORE_MOD_ID = 'conceptual_core';
  const CONCEPTUAL_TEST_MOD_ID = 'conceptual_test_mod';
  const CONCEPTUAL_DEF_ID_DOOR = `${CONCEPTUAL_CORE_MOD_ID}:conceptual_door`;

  const conceptualCoreManifest = {
    id: CONCEPTUAL_CORE_MOD_ID,
    name: 'Conceptual Core Mod',
    version: '1.0.0',
    gameVersion: '1.0.0',
    content: {
      entityDefinitions: ['entities/definitions/conceptual_door.json'],
    },
  };
  const conceptualTestModManifest = {
    id: CONCEPTUAL_TEST_MOD_ID,
    name: 'Conceptual Test Mod',
    version: '1.0.0',
    gameVersion: '1.0.0',
    dependencies: [{ id: CONCEPTUAL_CORE_MOD_ID, version: '^1.0.0' }],
    content: {
      worlds: ['worlds/world_with_conceptual_ref.json'],
    },
  };
  const conceptualEntityDefDataDoor = {
    id: 'conceptual_door', // Will be prefixed by loader with 'conceptual_core:'
    components: { 'core:component_openable': {}, 'core:component_physical': { material: 'wood' } },
    // No position, it's a definition
  };
  const conceptualWorldFileContent = {
    instances: [
      { id: 'actual_door_instance', definitionId: CONCEPTUAL_DEF_ID_DOOR, components: { 'core:position': { x: 10, y: 5 } } },
    ],
  };

  const allManifestsData = new Map([
    [CORE_MOD_ID, coreManifest],
    [TEST_MOD_ID, testModManifest],
    [CONCEPTUAL_CORE_MOD_ID, conceptualCoreManifest],
    [CONCEPTUAL_TEST_MOD_ID, conceptualTestModManifest],
  ]);

  beforeEach(() => {
    // Reset mocks for services that might be called multiple times if necessary
    mockLogger = createMockLogger();
    mockConfiguration = createMockConfiguration();
    mockSchemaValidator = createMockSchemaValidator();
    mockDataRegistry = createStatefulMockDataRegistry();
    mockDataFetcher = createMockDataFetcher();
    mockGameConfigLoader = createMockGameConfigLoader();
    mockModManifestLoader = {
      loadRequestedManifests: jest.fn(),
    };
    mockValidatedEventDispatcher = createMockValidatedEventDispatcher();
    mockSchemaLoader = createMockSchemaLoader();
    mockModVersionValidator = jest.fn();
    mockModLoadOrderResolver = createMockModLoadOrderResolver();
    mockModDependencyValidator = createMockModDependencyValidator();
    mockGameDataRepository = {
      getModContent: jest.fn(),
      getModResource: jest.fn((modId, resourcePath) =>
        mockDataFetcher.fetchData(`mods/${modId}/${resourcePath}`)
      ),
      getModManifest: jest.fn((modId) =>
        mockDataFetcher.fetchData(`mods/${modId}/mod.manifest.json`)
      ),
    };

    // Spy on ModManifestProcessor.prototype.processManifests
    // This will be further customized in each test.
    processManifestsSpy = jest.spyOn(ModManifestProcessor.prototype, 'processManifests');

    // Manually construct mockPathResolver with logs
    mockPathResolver = {
      resolveModContentPath: jest.fn((modId, _contentTypeDir, filename) => {
         
        console.log(`MOCK resolveModContentPath INPUTS: modId=${modId}, _contentTypeDir=${_contentTypeDir}, filename=${filename}`);
        const result = `mods/${modId}/${filename}`;
         
        console.log(`MOCK resolveModContentPath OUTPUT: ${result}`);
        return result;
      }),
      resolveModManifestPath: jest.fn(modId => `mods/${modId}/mod.manifest.json`),
      resolvePath: jest.fn(path => path),
      getManifestName: jest.fn().mockReturnValue('mod.manifest.json'),
      resolveModPath: jest.fn(modId => `mods/${modId}`),
      getModDirectory: jest.fn(modId => `mods/${modId}`),
    };

    // Configure IConfiguration (used by various loaders)
    mockConfiguration.getModsBasePath.mockReturnValue('mods');
    mockConfiguration.getModManifestFilename.mockReturnValue('mod.manifest.json');
    mockConfiguration.getContentTypeSchemaId.mockImplementation(type => `schema:${type}`);
    mockConfiguration.getContentTypeDirectory.mockImplementation(contentTypeKey => {
       
      console.log(`MOCK getContentTypeDirectory INPUT: contentTypeKey=${contentTypeKey}`);
      if (contentTypeKey === 'entityDefinition') {
        const dir = 'entities/definitions';
         
        console.log(`MOCK getContentTypeDirectory OUTPUT for '${contentTypeKey}': ${dir}`);
        return dir;
      }
      if (contentTypeKey === 'world') {
        const dir = 'worlds';
         
        console.log(`MOCK getContentTypeDirectory OUTPUT for '${contentTypeKey}': ${dir}`);
        return dir;
      }
       
      console.warn(`mockConfiguration.getContentTypeDirectory: Unhandled key: ${contentTypeKey}`);
      return contentTypeKey; // Fallback to key itself if no specific mapping
    });

    // Configure ISchemaValidator
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true); // Assume all necessary schemas are loaded
    mockSchemaValidator.validate.mockReturnValue({ isValid: true }); // Assume all data is valid against its schema

    // Configure IPathResolver
    mockPathResolver.resolveModManifestPath.mockImplementation(modId => `mods/${modId}/mod.manifest.json`);
    mockPathResolver.resolvePath.mockImplementation(path => path);


    // Configure IDataFetcher
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      // Test Case 1 Files
      if (path === `mods/${CORE_MOD_ID}/mod.manifest.json`) return coreManifest;
      if (path === `mods/${TEST_MOD_ID}/mod.manifest.json`) return testModManifest;
      if (path === `mods/${CORE_MOD_ID}/entities/definitions/valid_def.json`) return validEntityDefData;
      if (path === `mods/${TEST_MOD_ID}/worlds/world_with_invalid_ref.json`) return worldFileContentInvalidRef;

      // Test Case 2 Files
      if (path === `mods/${CONCEPTUAL_CORE_MOD_ID}/mod.manifest.json`) return conceptualCoreManifest;
      if (path === `mods/${CONCEPTUAL_TEST_MOD_ID}/mod.manifest.json`) return conceptualTestModManifest;
      if (path === `mods/${CONCEPTUAL_CORE_MOD_ID}/entities/definitions/conceptual_door.json`) return conceptualEntityDefDataDoor;
      if (path === `mods/${CONCEPTUAL_TEST_MOD_ID}/worlds/world_with_conceptual_ref.json`) return conceptualWorldFileContent;
      
      // For schema loader, if it tries to fetch schemas based on path
      if (path.startsWith('data/schemas/')) return { $id: path };
      console.error(`mockDataFetcher: Unhandled fetch path: ${path}`); // Log unhandled paths
      throw new Error(`Unexpected fetch path in test: ${path}`);
    });

    // Default GameConfigLoader setup (can be overridden in specific tests)
    mockGameConfigLoader.loadConfig.mockResolvedValue([CORE_MOD_ID, TEST_MOD_ID]);

    // Configure ModManifestLoader (used by ModManifestProcessor)
    mockModManifestLoader.loadRequestedManifests.mockImplementation(async (modIds) => {
      const manifests = new Map();
      if (modIds) {
        for (const modId of modIds) {
          const manifestData = allManifestsData.get(modId);
          if (manifestData) {
            manifests.set(modId.toLowerCase(), manifestData);
          } else {
            // This case should ideally not happen if gameConfig and manifests are aligned
            console.warn(`mockModManifestLoader: No manifest data found for requested modId: ${modId}`);
          }
        }
      }
      return manifests; // Return the Map directly
    });
    
    // Instantiate REAL Loaders needed for the test
    entityDefinitionLoader = new EntityDefinitionLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockDataRegistry, mockLogger);
    worldLoader = new WorldLoader(mockConfiguration, mockPathResolver, mockDataFetcher, mockSchemaValidator, mockDataRegistry, mockLogger);

    // Create a content loaders configuration, using the real EntityDefinitionLoader
    // and mocks for other loaders not central to this specific test.
    const contentLoadersConfig = createDefaultContentLoadersConfig({
      componentDefinitionLoader: createMockContentLoader('components'),
      eventLoader: createMockContentLoader('events'),
      conditionLoader: createMockContentLoader('conditions'),
      macroLoader: createMockContentLoader('macros'),
      actionLoader: createMockContentLoader('actions'),
      ruleLoader: createMockContentLoader('rules'),
      goalLoader: createMockContentLoader('goals'),
      entityDefinitionLoader: entityDefinitionLoader, // REAL
      entityInstanceLoader: createMockContentLoader('entityInstances'), // Mock for instance phase
    });

    // Instantiate REAL ModsLoader
    modsLoader = new ModsLoader({
      registry: mockDataRegistry,
      logger: mockLogger,
      schemaLoader: mockSchemaLoader, // Mocked for simplicity (loadAndCompileAllSchemas, etc.)
      validator: mockSchemaValidator,
      configuration: mockConfiguration,
      gameConfigLoader: mockGameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn().mockResolvedValue(undefined) },
      modManifestLoader: mockModManifestLoader, // This is for ModManifestProcessor
      validatedEventDispatcher: mockValidatedEventDispatcher,
      modDependencyValidator: mockModDependencyValidator,
      modVersionValidator: mockModVersionValidator,
      modLoadOrderResolver: mockModLoadOrderResolver,
      worldLoader: worldLoader, // REAL
      contentLoadersConfig: contentLoadersConfig, // Crucial: uses our real EntityDefLoader

      // Provide instances for constructor, matching those in contentLoadersConfig
      componentLoader: contentLoadersConfig.find(c => c.typeName === 'components').loader,
      conditionLoader: contentLoadersConfig.find(c => c.typeName === 'conditions').loader,
      ruleLoader: contentLoadersConfig.find(c => c.typeName === 'rules').loader,
      macroLoader: contentLoadersConfig.find(c => c.typeName === 'macros').loader,
      actionLoader: contentLoadersConfig.find(c => c.typeName === 'actions').loader,
      eventLoader: contentLoadersConfig.find(c => c.typeName === 'events').loader,
      entityLoader: entityDefinitionLoader,
      entityInstanceLoader: contentLoadersConfig.find(c => c.typeName === 'entityInstances').loader,
      goalLoader: contentLoadersConfig.find(c => c.typeName === 'goals').loader,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // it('AC#1: should throw ModsLoaderError with "missing_definition" code when a world file references an undefined entity', async () => {
  //   // eslint-disable-next-line no-console
  //   // console.log('DIAGNOSTIC TEST START: AC#1 - Invalid Definition Reference');

  //   // Specific mock for ModManifestProcessor for this test
  //   processManifestsSpy.mockImplementation(async (requestedModIds) => {
  //     return {
  //       finalOrder: [CORE_MOD_ID, TEST_MOD_ID], // Ensure this is an array
  //       loadedManifestsMap: new Map([
  //         [CORE_MOD_ID.toLowerCase(), coreManifest],
  //         [TEST_MOD_ID.toLowerCase(), testModManifest],
  //       ]),
  //       incompatibilityCount: 0,
  //     };
  //   });

  //   mockGameConfigLoader.loadConfig.mockResolvedValue([CORE_MOD_ID, TEST_MOD_ID]);

  //   // Reverting to Jest's .rejects matcher
  //   await expect(modsLoader.loadWorld('testWorldInvalidRef')).rejects.toThrowError(
  //     expect.objectContaining({
  //       name: 'ModsLoaderError',
  //       code: 'missing_definition',
  //       message: expect.stringContaining(`Unknown entity definition: ${INVALID_DEF_ID}`),
  //       details: expect.objectContaining({
  //         modId: TEST_MOD_ID,
  //         filename: 'worlds/world_with_invalid_ref.json',
  //         definitionId: INVALID_DEF_ID,
  //       }),
  //     })
  //   );
  // });

  it('AC#2: should successfully load a world with conceptual entities (valid definition, no error)', async () => {
     
    console.log('DIAGNOSTIC TEST START: AC#2 - Conceptual Load');

    // Specific mock for ModManifestProcessor for this test
    processManifestsSpy.mockImplementation(async (requestedModIds) => {
      // console.log('AC#2 processManifestsSpy mock called with:', requestedModIds);
      return {
        finalOrder: [CONCEPTUAL_CORE_MOD_ID, CONCEPTUAL_TEST_MOD_ID], // Ensure this is an array
        loadedManifestsMap: new Map([
          [CONCEPTUAL_CORE_MOD_ID.toLowerCase(), conceptualCoreManifest],
          [CONCEPTUAL_TEST_MOD_ID.toLowerCase(), conceptualTestModManifest],
        ]),
        incompatibilityCount: 0,
      };
    });

    mockGameConfigLoader.loadConfig.mockResolvedValue([CONCEPTUAL_CORE_MOD_ID, CONCEPTUAL_TEST_MOD_ID]);
    // mockModLoadOrderResolver.resolveOrder is effectively handled by processManifestsSpy now

    let ac2LoadError = null;
    try {
      await modsLoader.loadWorld('testWorldConceptualRef');
    } catch (e) {
      ac2LoadError = e;
    }
    expect(ac2LoadError).toBeNull(); // For AC#2, we expect NO error from loadWorld

    // ... (rest of the assertions for AC#2)
  });

  // await expect(
  //   modsLoader.loadWorld('TestWorld', ['core', 'test-mod'])
  // ).rejects.toBeInstanceOf(ModsLoaderError);
}); 
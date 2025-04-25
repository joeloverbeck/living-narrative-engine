// tests/core/services/worldLoader.test.js

import WorldLoader from '../../../core/services/worldLoader.js';
import {beforeEach, describe, expect, jest, test} from '@jest/globals';

// ── Mock dependencies ──────────────────────────────────────────────────
const mockRegistry = {
  clear: jest.fn(),
  setManifest: jest.fn(),
  getManifest: jest.fn(),
  store: jest.fn(),
  getAll: jest.fn().mockReturnValue([]),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockSchemaLoader = {
  loadAndCompileAllSchemas: jest.fn(),
};

const mockManifestLoader = {
  loadAndValidateManifest: jest.fn(),
};

const mockContentLoader = {
  loadContentFiles: jest.fn(),
};

const mockComponentDefinitionLoader = {
  loadComponentDefinitions: jest.fn(),
};

const mockRuleLoader = {
  loadAll: jest.fn().mockResolvedValue(undefined),
  loadedEventCount: 0,
};

const mockValidator = {
  isSchemaLoaded: jest.fn(),
  addSchema: jest.fn(),
  getValidator: jest.fn(),
  validate: jest.fn(),
};

const mockConfiguration = {
  getManifestSchemaId: jest.fn(),
  getContentTypeSchemaId: jest.fn(),
  getBaseDataPath: jest.fn().mockReturnValue('/fake/data'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getSchemaBasePath: jest.fn().mockReturnValue('/fake/data/schemas'),
  getContentBasePath: jest.fn().mockReturnValue('/fake/data/content'),
  getWorldBasePath: jest.fn().mockReturnValue('/fake/data/worlds'),
};

// ── Test constants ─────────────────────────────────────────────────────
const testWorldName = 'test-world';
const essentialSchemaIds = {
  manifest: 'schema://core/manifest',
  components: 'schema://content/components',
  // other schema IDs are included for completeness but are not “essential”
  events: 'schema://content/events',
  actions: 'schema://content/actions',
  entities: 'schema://content/entities',
  items: 'schema://content/items',
  locations: 'schema://content/locations',
  connections: 'schema://content/connections',
  triggers: 'schema://content/triggers',
};

// ── Suite ──────────────────────────────────────────────────────────────
describe('WorldLoader', () => {
  let worldLoader;

  beforeEach(() => {
    jest.clearAllMocks();

    // Success-path defaults
    mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

    mockConfiguration.getManifestSchemaId.mockReturnValue(
      essentialSchemaIds.manifest,
    );
    mockConfiguration.getContentTypeSchemaId.mockImplementation(
      (type) => essentialSchemaIds[type],
    );

    mockManifestLoader.loadAndValidateManifest.mockResolvedValue({
      worldName: testWorldName,
      contentFiles: {
        components: ['comp1.component.json'],
        items: ['item1.json'],
      },
    });
    mockRegistry.getManifest.mockReturnValue(null);
    mockRegistry.setManifest.mockImplementation((m) =>
      mockRegistry.getManifest.mockReturnValue(m),
    );

    mockComponentDefinitionLoader.loadComponentDefinitions.mockResolvedValue(
      undefined,
    );
    mockContentLoader.loadContentFiles.mockResolvedValue(undefined);

    // Instantiate SUT
    worldLoader = new WorldLoader(
      mockRegistry,
      mockLogger,
      mockSchemaLoader,
      mockManifestLoader,
      mockContentLoader,
      mockComponentDefinitionLoader,
      mockRuleLoader, // ← NEW DEP
      mockValidator,
      mockConfiguration,
    );
  });

  // ── Happy path ─────────────────────────────────────────────────────
  describe('loadWorld – essential schema verification', () => {
    test('AC1 & AC5: proceeds successfully when all essential schemas are loaded', async () => {
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      await expect(
        worldLoader.loadWorld(testWorldName),
      ).resolves.toBeUndefined();

      // Schema compilation → essential check → manifest load
      expect(
        mockSchemaLoader.loadAndCompileAllSchemas,
      ).toHaveBeenCalledTimes(1);
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledTimes(2);
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        essentialSchemaIds.manifest,
      );
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        essentialSchemaIds.components,
      );

      expect(
        mockManifestLoader.loadAndValidateManifest,
      ).toHaveBeenCalledTimes(1);

      // Down-stream loaders
      expect(mockRuleLoader.loadAll).toHaveBeenCalledTimes(1);
      expect(
        mockComponentDefinitionLoader.loadComponentDefinitions,
      ).toHaveBeenCalledTimes(1);
      expect(mockContentLoader.loadContentFiles).toHaveBeenCalledWith(
        'items',
        ['item1.json'],
      );
      expect(
        mockContentLoader.loadContentFiles,
      ).not.toHaveBeenCalledWith('components', expect.anything());

      // Registry cleared once at start
      expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
      // No error logs
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // ── Single missing essential schema ────────────────────────────
    test('AC2/3/4: throws and logs when an essential schema is missing', async () => {
      const missingSchemaId = essentialSchemaIds.components;

      mockValidator.isSchemaLoaded.mockImplementation(
        (id) => id !== missingSchemaId,
      );

      await expect(
        worldLoader.loadWorld(testWorldName),
      ).rejects.toThrow(
        `WorldLoader failed to load world '${testWorldName}': Essential schemas missing – aborting world load.`,
      );

      expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        essentialSchemaIds.manifest,
      );
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        missingSchemaId,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `WorldLoader: Essential schema missing: ${missingSchemaId}`,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'WorldLoader: CRITICAL load failure.',
        expect.any(Error),
      );

      // Nothing after manifest should run
      expect(
        mockManifestLoader.loadAndValidateManifest,
      ).not.toHaveBeenCalled();
      expect(mockRuleLoader.loadAll).not.toHaveBeenCalled();
      expect(
        mockComponentDefinitionLoader.loadComponentDefinitions,
      ).not.toHaveBeenCalled();
      expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

      // Registry cleared twice (start + catch)
      expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
    });

    // ── Two missing essential schemas ──────────────────────────────
    test('AC2/3/4: throws and logs when multiple essential schemas are missing', async () => {
      const missingSchemaId1 = essentialSchemaIds.manifest;
      const missingSchemaId2 = essentialSchemaIds.components;
      const missingSet = new Set([missingSchemaId1, missingSchemaId2]);

      mockValidator.isSchemaLoaded.mockImplementation(
        (id) => !missingSet.has(id),
      );

      await expect(
        worldLoader.loadWorld(testWorldName),
      ).rejects.toThrow(
        `WorldLoader failed to load world '${testWorldName}': Essential schemas missing – aborting world load.`,
      );

      expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalled();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `WorldLoader: Essential schema missing: ${missingSchemaId1}`,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `WorldLoader: Essential schema missing: ${missingSchemaId2}`,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'WorldLoader: CRITICAL load failure.',
        expect.any(Error),
      );

      expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled();
      expect(mockRuleLoader.loadAll).not.toHaveBeenCalled();
      expect(mockComponentDefinitionLoader.loadComponentDefinitions).not.toHaveBeenCalled();
      expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

      expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
    });

    // ── Call-order verification ────────────────────────────────────
    test('AC4: verification happens after schema load, before manifest, and rules load after manifest', async () => {
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      await worldLoader.loadWorld(testWorldName);

      const orderSchema = mockSchemaLoader.loadAndCompileAllSchemas.mock
        .invocationCallOrder[0];
      const orderValidator = mockValidator.isSchemaLoaded.mock
        .invocationCallOrder[0];
      const orderManifest =
                mockManifestLoader.loadAndValidateManifest.mock
                  .invocationCallOrder[0];
      const orderRules = mockRuleLoader.loadAll.mock.invocationCallOrder[0];

      expect(orderSchema).toBeLessThan(orderValidator);
      expect(orderValidator).toBeLessThan(orderManifest);
      expect(orderManifest).toBeLessThan(orderRules);
    });
  });
});
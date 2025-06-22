import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EntityInstanceLoader } from '../../../src/loaders/entityInstanceLoader.js';
import { formatAjvErrors } from '../../../src/utils/ajvUtils.js';

// Mock utilities
jest.mock('../../../src/utils/idUtils.js', () => ({
  parseAndValidateId: jest.fn().mockImplementation((data, idProp) => ({
    fullId: `test_mod:${data[idProp]}`,
    baseId: data[idProp],
  })),
}));
jest.mock('../../../src/utils/ajvUtils.js', () => ({
  formatAjvErrors: jest.fn((errors) =>
    (errors || []).map((e) => e.message).join(', ')
  ),
}));

describe('EntityInstanceLoader Integration Test Suite', () => {
  let entityInstanceLoader;
  let mockConfig,
    mockPathResolver,
    mockDataFetcher,
    mockSchemaValidator,
    mockDataRegistry,
    mockLogger;

  const MOD_ID = 'test_mod';
  const INSTANCE_FILENAME = 'player.instance.json';
  const INSTANCE_DIR = 'entities/instances';
  const INSTANCE_TYPE_NAME = 'entityInstances';
  const RESOLVED_PATH = `data/mods/${MOD_ID}/${INSTANCE_DIR}/${INSTANCE_FILENAME}`;

  const validInstanceData = {
    instanceId: 'player_char',
    definitionId: 'core:player',
    componentOverrides: {
      'core:health': { current: 50, max: 100 },
      'core:inventory': [{ itemId: 'core:sword', quantity: 1 }],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      getContentTypeSchemaId: jest
        .fn()
        .mockReturnValue('schema:entity-instance'),
      getModsBasePath: jest.fn(), // Mocked but not used in this test
    };
    mockPathResolver = {
      resolveModContentPath: jest.fn().mockReturnValue(RESOLVED_PATH),
    };
    mockDataFetcher = {
      fetch: jest
        .fn()
        .mockResolvedValue(JSON.parse(JSON.stringify(validInstanceData))), // Deep copy
    };
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      getValidator: jest.fn(),
    };
    mockDataRegistry = {
      get: jest.fn().mockReturnValue(null), // No existing item
      store: jest.fn().mockReturnValue(false), // Ensure store returns a boolean
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Instantiate the loader using the BaseManifestItemLoader constructor signature
    entityInstanceLoader = new EntityInstanceLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  it('should successfully process a valid entity instance file', async () => {
    const result = await entityInstanceLoader._processFileWrapper(
      MOD_ID,
      INSTANCE_FILENAME,
      INSTANCE_DIR,
      INSTANCE_TYPE_NAME
    );

    expect(result).toBeDefined();
    expect(result.didOverride).toBe(false);
    expect(result.qualifiedId).toBe('test_mod:player_char');

    // 1. Primary schema validation was called
    expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
      'schema:entity-instance',
      validInstanceData
    );

    // 2. Secondary component override validation was called for each component
    expect(mockSchemaValidator.validate).toHaveBeenCalledWith('core:health', {
      current: 50,
      max: 100,
    });
    expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
      'core:inventory',
      [{ itemId: 'core:sword', quantity: 1 }]
    );
    expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(3); // 1 primary + 2 components

    // 3. Item was stored in the registry
    expect(mockDataRegistry.store).toHaveBeenCalledWith(
      'entityInstances', // Correct category
      'test_mod:player_char', // Qualified ID as the key
      expect.objectContaining({
        // Properties from _storeItemInRegistry augmentation
        id: 'player_char', // Base ID
        _fullId: 'test_mod:player_char', // Qualified ID
        _modId: "test_mod",
        _sourceFile: INSTANCE_FILENAME,
        // Original data from validInstanceData
        instanceId: validInstanceData.instanceId,
        definitionId: validInstanceData.definitionId,
        componentOverrides: validInstanceData.componentOverrides,
      })
    );
  });

  it('should throw an error if a component override fails schema validation', async () => {
    const invalidComponentError = [{ message: 'is the wrong type' }];
    mockSchemaValidator.validate.mockImplementation((schemaId) => {
      if (schemaId === 'core:health') {
        return { isValid: false, errors: invalidComponentError };
      }
      if (schemaId === 'schema:entity-instance') {
        return { isValid: true, errors: null };
      }
      return { isValid: true, errors: null };
    });

    await expect(
      entityInstanceLoader._processFileWrapper(
        MOD_ID,
        INSTANCE_FILENAME,
        INSTANCE_DIR,
        INSTANCE_TYPE_NAME
      )
    ).rejects.toThrow(
      /Component override validation failed for instance 'test_mod:player_char'/
    );

    // Ensure central error was logged by the wrapper
    expect(mockLogger.error).toHaveBeenCalledWith(
      `Error processing file:`,
      expect.objectContaining({
        modId: MOD_ID,
        filename: INSTANCE_FILENAME,
      }),
      expect.any(Error)
    );

    // Ensure specific error was logged by the validation helper
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Schema validation failed for component override 'core:health'`
      ),
      expect.any(Object)
    );

    // Ensure item was NOT stored
    expect(mockDataRegistry.store).not.toHaveBeenCalled();
  });

  it('should skip secondary validation if no componentOverrides are present', async () => {
    const instanceWithNoOverrides = {
      instanceId: 'npc_guard',
      definitionId: 'core:guard',
    };
    mockDataFetcher.fetch.mockResolvedValue(instanceWithNoOverrides);

    await expect(
      entityInstanceLoader._processFileWrapper(
        MOD_ID,
        INSTANCE_FILENAME,
        INSTANCE_DIR,
        INSTANCE_TYPE_NAME
      )
    ).resolves.toBeDefined();

    // Primary validation should happen
    expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
      'schema:entity-instance',
      instanceWithNoOverrides
    );
    // But no other validation calls should happen
    expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(1);
    // And it should still be stored
    expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
  });
});

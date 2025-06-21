// src/tests/services/defaultPathResolver.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js'; // Adjust path if necessary

// Mock interface for type clarity, actual implementation uses Jest mocks
/**
 * @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration
 */

describe('DefaultPathResolver', () => {
  /** @type {jest.Mocked<IConfiguration>} */
  let mockConfig;
  /** @type {DefaultPathResolver} */
  let resolver;

  // Base paths for mocking
  const MOCK_SCHEMA_BASE = 'schemas'; // Relative path as returned by StaticConfig
  const MOCK_BASE_DATA_PATH = './data'; // Relative path matching StaticConfig
  const MOCK_GAME_CONFIG_FILENAME = 'game.json'; // Matching StaticConfig
  const MOCK_MODS_BASE = 'mods'; // <<< ADDED for MODLOADER-003
  const MOCK_MOD_MANIFEST_FILENAME = 'mod.manifest.json'; // <<< ADDED for MODLOADER-003
  const MOCK_CONTENT_BASE_FN = (registryKey) => registryKey; // Relative path matching StaticConfig

  beforeEach(() => {
    // Create a fresh mock configuration before each test
    mockConfig = {
      // Mock all methods REQUIRED by the DefaultPathResolver constructor
      getBaseDataPath: jest.fn(),
      getSchemaBasePath: jest.fn(),
      getContentBasePath: jest.fn(),
      getGameConfigFilename: jest.fn(),
      getModsBasePath: jest.fn(), // <<< ADDED for MODLOADER-003
      getModManifestFilename: jest.fn(), // <<< ADDED for MODLOADER-003

      // Add other IConfiguration methods as undefined or jest.fn() if needed elsewhere
      getSchemaFiles: jest.fn(),
      getContentTypeSchemaId: jest.fn(),
      getRuleBasePath: jest.fn(), // Mock if resolveRulePath is used/tested
    };

    // Default successful mock implementations
    mockConfig.getBaseDataPath.mockReturnValue(MOCK_BASE_DATA_PATH);
    mockConfig.getSchemaBasePath.mockReturnValue(MOCK_SCHEMA_BASE);
    mockConfig.getContentBasePath.mockImplementation(MOCK_CONTENT_BASE_FN);
    mockConfig.getGameConfigFilename.mockReturnValue(MOCK_GAME_CONFIG_FILENAME);
    mockConfig.getModsBasePath.mockReturnValue(MOCK_MODS_BASE); // <<< ADDED for MODLOADER-003
    mockConfig.getModManifestFilename.mockReturnValue(
      MOCK_MOD_MANIFEST_FILENAME
    ); // <<< ADDED for MODLOADER-003
  });

  // --- Task 3: Test Constructor ---
  describe('constructor', () => {
    it('should instantiate successfully with a valid IConfiguration object', () => {
      // This test should now pass because the mockConfig in beforeEach is complete
      expect(() => new DefaultPathResolver(mockConfig)).not.toThrow();
    });

    it('should throw an Error if configurationService is null', () => {
      const expectedErrorMsg = /requires an IConfiguration instance/;
      expect(() => new DefaultPathResolver(null)).toThrow(expectedErrorMsg);
    });

    it('should throw an Error if configurationService is undefined', () => {
      const expectedErrorMsg = /requires an IConfiguration instance/;
      expect(() => new DefaultPathResolver(undefined)).toThrow(
        expectedErrorMsg
      );
    });

    // Test for missing essential methods
    it.each([
      ['getBaseDataPath'],
      ['getSchemaBasePath'],
      ['getContentBasePath'],
      ['getGameConfigFilename'],
      ['getModsBasePath'], // <<< ADDED for MODLOADER-003
      ['getModManifestFilename'], // <<< ADDED for MODLOADER-003
    ])(
      'should throw an Error if configurationService is missing %s',
      (methodName) => {
        const expectedErrorMsg = new RegExp(
          `DefaultPathResolver requires a valid IConfiguration with method`
        );
        const incompleteConfig = {
          ...mockConfig,
          [methodName]: undefined, // Make the target method undefined
        };
        expect(
          () => new DefaultPathResolver(/** @type {any} */ (incompleteConfig))
        ).toThrow(expectedErrorMsg);
      }
    );

    it('should throw an Error if configurationService methods are not functions', () => {
      // Expect the specific error message for the FIRST invalid method encountered in the loop
      const expectedErrorMsg =
        'DefaultPathResolver requires a valid IConfiguration with method getBaseDataPath().';
      const invalidConfig = {
        ...mockConfig, // Spread valid mocks first
        getBaseDataPath: 'not-a-function', // Make the target method invalid
      };
      expect(
        () => new DefaultPathResolver(/** @type {any} */ (invalidConfig))
      ).toThrow(expectedErrorMsg);
    });
  });

  // --- Task 4: Test resolveSchemaPath ---
  describe('resolveSchemaPath', () => {
    beforeEach(() => {
      // Instantiate resolver with the valid mock for method tests
      resolver = new DefaultPathResolver(mockConfig);
    });

    it('should return the correct path for a valid filename', () => {
      const filename = 'common.schema.json';
      // Expected path combines base, schema dir, and filename
      // Using template literals and fixing join logic assumption
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${MOCK_SCHEMA_BASE}/${filename}`;
      const actualPath = resolver.resolveSchemaPath(filename);

      expect(actualPath).toBe(expectedPath);
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getSchemaBasePath).toHaveBeenCalledTimes(1);
    });

    it('should handle filenames with leading/trailing spaces (trimming is done by validation)', () => {
      // Although the method validates against empty/null, the join logic itself
      // doesn't trim spaces. Filenames with spaces might be valid in some filesystems.
      // If trimming is desired, it should be explicit in the join logic or validation.
      // Assuming the current implementation passes them through:
      const filename = ' spaced_schema.json ';
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${MOCK_SCHEMA_BASE}/${filename}`;
      expect(resolver.resolveSchemaPath(filename)).toBe(expectedPath);
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getSchemaBasePath).toHaveBeenCalledTimes(1);
    });

    it('should throw an Error for an empty string filename', () => {
      const expectedErrorMsg = /Invalid or empty filename provided/;
      expect(() => resolver.resolveSchemaPath('')).toThrow(expectedErrorMsg);
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
    });

    it('should throw an Error for a filename containing only spaces', () => {
      const expectedErrorMsg = /Invalid or empty filename provided/;
      expect(() => resolver.resolveSchemaPath('   ')).toThrow(expectedErrorMsg);
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
    });

    it('should throw an Error for a null filename', () => {
      const expectedErrorMsg = /Invalid or empty filename provided/;
      expect(() => resolver.resolveSchemaPath(null)).toThrow(expectedErrorMsg);
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
    });

    it('should throw an Error for an undefined filename', () => {
      const expectedErrorMsg = /Invalid or empty filename provided/;
      expect(() => resolver.resolveSchemaPath(undefined)).toThrow(
        expectedErrorMsg
      );
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
    });

    it('should throw an Error for a non-string filename', () => {
      const expectedErrorMsg = /Invalid or empty filename provided/;
      expect(() => resolver.resolveSchemaPath(123)).toThrow(expectedErrorMsg);
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
    });
  });

  // --- Task 6: Test resolveContentPath ---
  describe('resolveContentPath', () => {
    beforeEach(() => {
      resolver = new DefaultPathResolver(mockConfig);
    });

    it('should return the correct content path for a valid type and filename (items)', () => {
      const registryKey = 'items';
      const filename = 'potion.json';
      const expectedContentDir = MOCK_CONTENT_BASE_FN(registryKey); // e.g., items
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${expectedContentDir}/${filename}`;
      const actualPath = resolver.resolveContentPath(registryKey, filename);

      expect(actualPath).toBe(expectedPath);
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(registryKey);
    });

    it('should return the correct content path for a valid type and filename (actions)', () => {
      const registryKey = 'actions';
      const filename = 'attack.json';
      const expectedContentDir = MOCK_CONTENT_BASE_FN(registryKey);
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${expectedContentDir}/${filename}`;
      const actualPath = resolver.resolveContentPath(registryKey, filename);

      expect(actualPath).toBe(expectedPath);
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(registryKey);
    });

    // --- Ticket 2.1.2 Test ---
    it('should return the correct content path for component definitions (registryKey = "components")', () => {
      const registryKey = 'components'; // Specific registryKey for component definitions
      const filename = 'core_health.component.json';
      const expectedContentDir = MOCK_CONTENT_BASE_FN(registryKey);
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${expectedContentDir}/${filename}`;
      const actualPath = resolver.resolveContentPath(registryKey, filename);

      expect(actualPath).toBe(expectedPath);
      // Verify the mock was called correctly for this registryKey
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(registryKey);
    });
    // --- End Ticket 2.1.2 Test ---

    it('should handle registryKey and filename with spaces (passed through by join)', () => {
      const registryKey = ' spaced type ';
      const filename = ' spaced file.json ';
      const expectedContentDir = MOCK_CONTENT_BASE_FN(registryKey);
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${expectedContentDir}/${filename}`;
      const actualPath = resolver.resolveContentPath(registryKey, filename);

      expect(actualPath).toBe(expectedPath);
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(registryKey);
    });

    // Invalid registryKey cases
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['spaces only', '   '],
      ['non-string', 123],
    ])(
      'should throw an Error for invalid registryKey (%s)',
      (desc, invalidRegistryKey) => {
        const filename = 'valid.json';
        const expectedErrorMsg = /Invalid or empty registryKey provided/;
        expect(() =>
          resolver.resolveContentPath(invalidRegistryKey, filename)
        ).toThrow(expectedErrorMsg);
        expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
        expect(mockConfig.getContentBasePath).not.toHaveBeenCalled();
      }
    );

    // Invalid filename cases
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['spaces only', '   '],
      ['non-string', false],
    ])(
      'should throw an Error for invalid filename (%s)',
      (desc, invalidFilename) => {
        const registryKey = 'validType';
        const expectedErrorMsg = /Invalid or empty filename provided/;

        // Wrap the actual call and the check in the expect().toThrow block
        expect(() => {
          // Reset mock *just before* the call within this specific test context
          mockConfig.getContentBasePath.mockClear(); // Only need to clear the one potentially called
          resolver.resolveContentPath(registryKey, invalidFilename);
        }).toThrow(expectedErrorMsg);

        // Verify that neither dependencyInjection method was called because validation failed first
        expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
        expect(mockConfig.getContentBasePath).not.toHaveBeenCalled();
      }
    );

    it('should throw registryKey error if both registryKey and filename are invalid (registryKey checked first)', () => {
      const expectedErrorMsg = /Invalid or empty registryKey provided/;
      expect(() => resolver.resolveContentPath('', '')).toThrow(
        expectedErrorMsg
      );
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getContentBasePath).not.toHaveBeenCalled();
    });
  });

  // --- Tests for resolveModManifestPath (MODLOADER-003 related) ---
  describe('resolveModManifestPath', () => {
    beforeEach(() => {
      resolver = new DefaultPathResolver(mockConfig);
    });

    it('should return the correct path for a valid modId', () => {
      const modId = 'MyAwesomeMod';
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${MOCK_MODS_BASE}/${modId}/${MOCK_MOD_MANIFEST_FILENAME}`;
      expect(resolver.resolveModManifestPath(modId)).toBe(expectedPath);
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getModsBasePath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getModManifestFilename).toHaveBeenCalledTimes(1);
    });

    it('should throw an Error for an invalid modId', () => {
      const expectedErrorMsg = /Invalid or empty modId provided/;
      expect(() => resolver.resolveModManifestPath('')).toThrow(
        expectedErrorMsg
      );
      expect(() => resolver.resolveModManifestPath(null)).toThrow(
        expectedErrorMsg
      );
      expect(() => resolver.resolveModManifestPath(undefined)).toThrow(
        expectedErrorMsg
      );
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getModsBasePath).not.toHaveBeenCalled();
      expect(mockConfig.getModManifestFilename).not.toHaveBeenCalled();
    });
  });

  // --- Tests for resolveModContentPath (MODLOADER-003 related) ---
  describe('resolveModContentPath', () => {
    beforeEach(() => {
      resolver = new DefaultPathResolver(mockConfig);
    });

    it('should return the correct path for valid modId, registryKey, and filename', () => {
      const modId = 'MyMod';
      const registryKey = 'items';
      const filename = 'special_item.json';
      const expectedPath = `${MOCK_BASE_DATA_PATH}/${MOCK_MODS_BASE}/${modId}/${registryKey}/${filename}`;
      expect(resolver.resolveModContentPath(modId, registryKey, filename)).toBe(
        expectedPath
      );
      expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
      expect(mockConfig.getModsBasePath).toHaveBeenCalledTimes(1);
    });

    it('should throw an Error for invalid modId', () => {
      const expectedErrorMsg = /Invalid or empty modId provided/;
      expect(() =>
        resolver.resolveModContentPath('', 'items', 'file.json')
      ).toThrow(expectedErrorMsg);
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
      expect(mockConfig.getModsBasePath).not.toHaveBeenCalled();
    });

    it('should throw an Error for invalid registryKey', () => {
      const expectedErrorMsg = /Invalid or empty registryKey provided/;
      expect(() =>
        resolver.resolveModContentPath('MyMod', null, 'file.json')
      ).toThrow(expectedErrorMsg);
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled(); // Should fail before getting base path
      expect(mockConfig.getModsBasePath).not.toHaveBeenCalled();
    });

    it('should throw an Error for invalid filename', () => {
      const expectedErrorMsg = /Invalid or empty filename provided/;
      expect(() =>
        resolver.resolveModContentPath('MyMod', 'items', '  ')
      ).toThrow(expectedErrorMsg);
      expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled(); // Should fail before getting base path
      expect(mockConfig.getModsBasePath).not.toHaveBeenCalled();
    });
  });

  // Add similar test suites for resolveGameConfigPath and resolveRulePath if needed
});

describe('DefaultPathResolver.resolveModManifestPath', () => {
  /** Generates a stub IConfiguration with deterministic return values. */
  const makeConfig = () => ({
    getBaseDataPath: () => './data',
    getSchemaBasePath: () => 'schemas',
    getContentBasePath: (type) => type,
    getGameConfigFilename: () => 'game.json',
    getModsBasePath: () => 'mods',
    getModManifestFilename: () => 'mod.manifest.json',
  });

  it('resolves a normal mod ID correctly', () => {
    const resolver = new DefaultPathResolver(makeConfig());
    const result = resolver.resolveModManifestPath('TestMod');
    expect(result).toBe('./data/mods/TestMod/mod.manifest.json');
  });

  it('strips accidental whitespace from mod ID', () => {
    const resolver = new DefaultPathResolver(makeConfig());
    const result = resolver.resolveModManifestPath('  Core ');
    expect(result).toBe('./data/mods/Core/mod.manifest.json');
  });

  it('throws when modId is an empty string', () => {
    const resolver = new DefaultPathResolver(makeConfig());
    expect(() => resolver.resolveModManifestPath('')).toThrow(
      /Invalid or empty modId/i
    );
  });

  it('throws when modId is not a string', () => {
    const resolver = new DefaultPathResolver(makeConfig());
    // @ts-expect-error – intentional bad input
    expect(() => resolver.resolveModManifestPath(42)).toThrow(
      /Invalid or empty modId/i
    );
  });

  it('handles trailing slashes in configuration paths gracefully', () => {
    const sloppyConfig = {
      ...makeConfig(),
      getBaseDataPath: () => './data/',
      getModsBasePath: () => 'mods/',
    };
    const resolver = new DefaultPathResolver(sloppyConfig);
    const result = resolver.resolveModManifestPath('Neat');
    expect(result).toBe('./data/mods/Neat/mod.manifest.json');
  });
});

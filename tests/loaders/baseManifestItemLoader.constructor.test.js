// src/tests/loaders/baseManifestItemLoader.constructor.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
// Adjust the import path as necessary
import { BaseManifestItemLoader } from '../../src/loaders/baseManifestItemLoader.js';
// Assume ValidationResult type is available or mock it if needed for type checking in tests
// import { ValidationResult } from '../../../src/interfaces/validation.js'; // Example import

// --- Mock Service Factories (Keep as provided, ensure ISchemaValidator has isSchemaLoaded) ---

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/default.schema.json'),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getContentBasePath: jest.fn((type) => `./data/${type}`),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
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
  resolveManifestPath: jest.fn(
    (worldName) => `./data/worlds/${worldName}.world.json`
  ),
  ...overrides,
});

const createMockDataFetcher = (overrides = {}) => ({
  fetch: jest.fn().mockResolvedValue({}),
  ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  addSchema: jest.fn().mockResolvedValue(undefined),
  removeSchema: jest.fn().mockReturnValue(true),
  isSchemaLoaded: jest.fn().mockReturnValue(true), // <<< Ensure this exists
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined),
  getAll: jest.fn().mockReturnValue([]),
  getAllSystemRules: jest.fn().mockReturnValue([]),
  clear: jest.fn(),
  getManifest: jest.fn().mockReturnValue(null),
  setManifest: jest.fn(),
  getEntityDefinition: jest.fn(),
  getItemDefinition: jest.fn(),
  getLocationDefinition: jest.fn(),
  getConnectionDefinition: jest.fn(),
  getBlockerDefinition: jest.fn(),
  getActionDefinition: jest.fn(),
  getEventDefinition: jest.fn(),
  getComponentDefinition: jest.fn(),
  getAllEntityDefinitions: jest.fn().mockReturnValue([]),
  getAllItemDefinitions: jest.fn().mockReturnValue([]),
  getAllLocationDefinitions: jest.fn().mockReturnValue([]),
  getAllConnectionDefinitions: jest.fn().mockReturnValue([]),
  getAllBlockerDefinitions: jest.fn().mockReturnValue([]),
  getAllActionDefinitions: jest.fn().mockReturnValue([]),
  getAllEventDefinitions: jest.fn().mockReturnValue([]),
  getAllComponentDefinitions: jest.fn().mockReturnValue([]),
  getStartingPlayerId: jest.fn().mockReturnValue(null),
  getStartingLocationId: jest.fn().mockReturnValue(null),
  ...overrides,
});

const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

// --- Shared Mocks Instance for Tests ---
let mockContentType;
let mockConfig;
let mockResolver;
let mockFetcher;
let mockValidator;
let mockRegistry;
let mockLogger;
let loader; // Instance of BaseManifestItemLoader

beforeEach(() => {
  // <<< MODIFIED: Added contentType to setup
  mockContentType = 'testType';
  mockConfig = createMockConfiguration();
  mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  mockValidator = createMockSchemaValidator();
  mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  // Reset mocks before creating the instance to avoid pollution
  jest.clearAllMocks();

  // Recreate logger mock after clearAllMocks
  mockLogger = createMockLogger();
  // Recreate validator mock after clearAllMocks (especially isSchemaLoaded)
  mockValidator = createMockSchemaValidator();
  // Recreate dependencyInjection mock after clearAllMocks (especially getContentTypeSchemaId)
  mockConfig = createMockConfiguration();

  // Instantiate the loader with the new signature <<< MODIFIED
  loader = new BaseManifestItemLoader(
    mockContentType,
    mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockRegistry,
    mockLogger
  );

  // Mock internal methods USED BY OTHER test suites
  // These should be restored/overridden within their specific describe blocks if testing the real method
  // Note: We don't mock _validatePrimarySchema here as we test it directly later.
  loader._extractValidFilenames = jest.fn();
  loader._processFileWrapper = jest.fn();
  loader._processFetchedItem = jest.fn();
  // Ensure loader uses the mocks we can spy on
  loader._logger = mockLogger;
  loader._schemaValidator = mockValidator;
  loader._config = mockConfig;
  loader._pathResolver = mockResolver;
  loader._dataFetcher = mockFetcher;
  loader._dataRegistry = mockRegistry;
});

// --- Test Suite ---

describe('BaseManifestItemLoader Constructor', () => {
  it('should instantiate successfully with valid contentType and dependencies', () => {
    // Arrange: Mocks are created in beforeEach, dependencyInjection mock returns a default schema ID
    const schemaId = 'http://example.com/schemas/default.schema.json';
    mockConfig.getContentTypeSchemaId.mockReturnValue(schemaId);

    // Act: Instantiate (re-run here for isolation, using a different variable name)
    const testLoaderInstance = new BaseManifestItemLoader(
      mockContentType,
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // Assert
    expect(testLoaderInstance).toBeInstanceOf(BaseManifestItemLoader);
    expect(testLoaderInstance._config).toBe(mockConfig);
    expect(testLoaderInstance._pathResolver).toBe(mockResolver);
    expect(testLoaderInstance._dataFetcher).toBe(mockFetcher);
    expect(testLoaderInstance._schemaValidator).toBe(mockValidator);
    expect(testLoaderInstance._dataRegistry).toBe(mockRegistry);
    expect(testLoaderInstance._logger).toBe(mockLogger);
    expect(testLoaderInstance._primarySchemaId).toBe(schemaId); // <<< ADDED: Check schema ID stored

    // Check constructor logs
    expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith(
      mockContentType
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `BaseManifestItemLoader: Primary schema ID for content type '${mockContentType}' found: '${schemaId}'`
    ); // <<< ADDED: Check schema ID log
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `BaseManifestItemLoader: Initialized.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected
  });

  it('should store null for _primarySchemaId and log warning if schema ID is not found', () => {
    // Arrange: Configure mock to return null
    mockConfig.getContentTypeSchemaId.mockReturnValue(null);

    // Act: Instantiate
    const testLoaderInstance = new BaseManifestItemLoader(
      mockContentType,
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // Assert
    expect(testLoaderInstance._primarySchemaId).toBeNull(); // <<< ADDED: Check null schema ID
    expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith(
      mockContentType
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `BaseManifestItemLoader: Primary schema ID for content type '${mockContentType}' not found in configuration. Primary validation might be skipped.`
    ); // <<< ADDED: Check warning log
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `BaseManifestItemLoader: Initialized.`
    );
  });

  it('should store null for _primarySchemaId and log warning if schema ID is undefined', () => {
    // Arrange: Configure mock to return undefined
    mockConfig.getContentTypeSchemaId.mockReturnValue(undefined);

    // Act: Instantiate
    const testLoaderInstance = new BaseManifestItemLoader(
      mockContentType,
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // Assert
    expect(testLoaderInstance._primarySchemaId).toBeNull(); // <<< ADDED: Check null schema ID
    expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith(
      mockContentType
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `BaseManifestItemLoader: Primary schema ID for content type '${mockContentType}' not found in configuration. Primary validation might be skipped.`
    ); // <<< ADDED: Check warning log
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `BaseManifestItemLoader: Initialized.`
    );
  });

  // --- ContentType Validation Failure Tests --- // <<< ADDED section
  describe('ContentType Validation', () => {
    it('should throw TypeError if contentType is null', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            null,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
          )
      ).toThrow(
        new TypeError(
          "BaseManifestItemLoader requires a non-empty string for 'contentType'. Received: null"
        )
      );
    });

    it('should throw TypeError if contentType is undefined', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            undefined,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
          )
      ).toThrow(
        new TypeError(
          "BaseManifestItemLoader requires a non-empty string for 'contentType'. Received: undefined"
        )
      );
    });

    it('should throw TypeError if contentType is an empty string', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            '',
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
          )
      ).toThrow(
        new TypeError(
          "BaseManifestItemLoader requires a non-empty string for 'contentType'. Received: "
        )
      );
    });

    it('should throw TypeError if contentType is a whitespace-only string', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            '   ',
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
          )
      ).toThrow(
        new TypeError(
          "BaseManifestItemLoader requires a non-empty string for 'contentType'. Received:    "
        )
      );
    });

    it('should throw TypeError if contentType is not a string', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            123,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
          )
      ).toThrow(
        new TypeError(
          "BaseManifestItemLoader requires a non-empty string for 'contentType'. Received: 123"
        )
      );
    });
  });

  // --- Dependency Validation Failure Tests (Adapt slightly for logger usage) ---
  describe('IConfiguration Validation', () => {
    it('should throw TypeError and log error if dependencyInjection is null', () => {
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            null,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(new TypeError('Missing required dependency: IConfiguration.'));
      expect(validLogger.error).toHaveBeenCalledWith(
        'Missing required dependency: IConfiguration.'
      );
    });

    it('should throw TypeError and log error if dependencyInjection is not an object', () => {
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            'not-an-object',
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'getModsBasePath' on dependency 'IConfiguration'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'getModsBasePath' on dependency 'IConfiguration'."
      );
    });

    it('should throw TypeError and log error if dependencyInjection is missing getModsBasePath', () => {
      const incompleteConfig = {
        ...createMockConfiguration(),
        getModsBasePath: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            incompleteConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'getModsBasePath' on dependency 'IConfiguration'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'getModsBasePath' on dependency 'IConfiguration'."
      );
    });

    it('should throw TypeError and log error if dependencyInjection is missing getContentTypeSchemaId', () => {
      const incompleteConfig = {
        ...createMockConfiguration(),
        getContentTypeSchemaId: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            incompleteConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'getContentTypeSchemaId' on dependency 'IConfiguration'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'getContentTypeSchemaId' on dependency 'IConfiguration'."
      );
    });
  });

  describe('IPathResolver Validation', () => {
    it('should throw TypeError and log error if pathResolver is null', () => {
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            null,
            mockFetcher,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(new TypeError('Missing required dependency: IPathResolver.'));
      expect(validLogger.error).toHaveBeenCalledWith(
        'Missing required dependency: IPathResolver.'
      );
    });

    it('should throw TypeError and log error if pathResolver is missing resolveModContentPath', () => {
      const incompleteResolver = {
        ...createMockPathResolver(),
        resolveModContentPath: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            incompleteResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'resolveModContentPath' on dependency 'IPathResolver'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'resolveModContentPath' on dependency 'IPathResolver'."
      );
    });
  });

  describe('IDataFetcher Validation', () => {
    it('should throw TypeError and log error if dataFetcher is null', () => {
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            null,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(new TypeError('Missing required dependency: IDataFetcher.'));
      expect(validLogger.error).toHaveBeenCalledWith(
        'Missing required dependency: IDataFetcher.'
      );
    });

    it('should throw TypeError and log error if dataFetcher is missing fetch', () => {
      const incompleteFetcher = {
        ...createMockDataFetcher(),
        fetch: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            incompleteFetcher,
            mockValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'fetch' on dependency 'IDataFetcher'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'fetch' on dependency 'IDataFetcher'."
      );
    });
  });

  describe('ISchemaValidator Validation', () => {
    it('should throw TypeError and log error if schemaValidator is null', () => {
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            null,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError('Missing required dependency: ISchemaValidator.')
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        'Missing required dependency: ISchemaValidator.'
      );
    });

    it('should throw TypeError and log error if schemaValidator is missing validate', () => {
      const incompleteValidator = {
        ...createMockSchemaValidator(),
        validate: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            incompleteValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'validate' on dependency 'ISchemaValidator'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'validate' on dependency 'ISchemaValidator'."
      );
    });

    it('should throw TypeError and log error if schemaValidator is missing getValidator', () => {
      const incompleteValidator = {
        ...createMockSchemaValidator(),
        getValidator: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            incompleteValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'getValidator' on dependency 'ISchemaValidator'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'getValidator' on dependency 'ISchemaValidator'."
      );
    });

    it('should throw TypeError and log error if schemaValidator is missing isSchemaLoaded', () => {
      // <<< ADDED: Test for isSchemaLoaded check
      const incompleteValidator = {
        ...createMockSchemaValidator(),
        isSchemaLoaded: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            incompleteValidator,
            mockRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'isSchemaLoaded' on dependency 'ISchemaValidator'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'isSchemaLoaded' on dependency 'ISchemaValidator'."
      );
    });
  });

  describe('IDataRegistry Validation', () => {
    it('should throw TypeError and log error if dataRegistry is null', () => {
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            null,
            validLogger
          )
      ).toThrow(new TypeError('Missing required dependency: IDataRegistry.'));
      expect(validLogger.error).toHaveBeenCalledWith(
        'Missing required dependency: IDataRegistry.'
      );
    });

    it('should throw TypeError and log error if dataRegistry is missing store', () => {
      const incompleteRegistry = {
        ...createMockDataRegistry(),
        store: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            incompleteRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'store' on dependency 'IDataRegistry'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'store' on dependency 'IDataRegistry'."
      );
    });

    it('should throw TypeError and log error if dataRegistry is missing get', () => {
      const incompleteRegistry = {
        ...createMockDataRegistry(),
        get: undefined,
      };
      const validLogger = createMockLogger();
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            incompleteRegistry,
            validLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'get' on dependency 'IDataRegistry'."
        )
      );
      expect(validLogger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'get' on dependency 'IDataRegistry'."
      );
    });
  });

  describe('ILogger Validation', () => {
    // These tests run before the logger is assigned internally, so they throw directly.
    it('should throw TypeError if logger is null', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            null
          )
      ).toThrow(new TypeError('Missing required dependency: ILogger.'));
    });
    it('should throw TypeError if logger is undefined', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            undefined
          )
      ).toThrow(new TypeError('Missing required dependency: ILogger.'));
    });

    it('should throw TypeError if logger is not an object', () => {
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            'not-an-object'
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'info' on dependency 'ILogger'."
        )
      );
    });

    it('should throw TypeError if logger is missing info', () => {
      const incompleteLogger = { ...createMockLogger(), info: undefined };
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            incompleteLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'info' on dependency 'ILogger'."
        )
      );
    });
    it('should throw TypeError if logger is missing warn', () => {
      const incompleteLogger = { ...createMockLogger(), warn: undefined };
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            incompleteLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'warn' on dependency 'ILogger'."
        )
      );
    });
    it('should throw TypeError if logger is missing error', () => {
      const incompleteLogger = { ...createMockLogger(), error: undefined };
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            incompleteLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'error' on dependency 'ILogger'."
        )
      );
    });
    it('should throw TypeError if logger is missing debug', () => {
      const incompleteLogger = { ...createMockLogger(), debug: undefined };
      expect(
        () =>
          new BaseManifestItemLoader(
            mockContentType,
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            incompleteLogger
          )
      ).toThrow(
        new TypeError(
          "Invalid or missing method 'debug' on dependency 'ILogger'."
        )
      );
    });
  });

  describe('Abstract Method Stub', () => {
    it('_processFetchedItem should reject with the specific abstract error message', async () => {
      // Create a new instance with valid args for the constructor
      const freshLoader = new BaseManifestItemLoader(
        mockContentType,
        mockConfig,
        mockResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
      );
      // Ensure the method is not accidentally mocked by beforeEach for this test
      // Access the method directly from the prototype
      const originalMethod =
        BaseManifestItemLoader.prototype._processFetchedItem;

      // Assign the original method to the instance for this test
      freshLoader._processFetchedItem = originalMethod;

      await expect(
        freshLoader._processFetchedItem(
          'modId',
          'filename',
          'path',
          {},
          'someTypeName'
        )
      ).rejects.toThrow(
        'Abstract method _processFetchedItem must be implemented by subclass.'
      );
    });
  });
});

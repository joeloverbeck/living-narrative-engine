import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {BaseManifestItemLoader} from '../../../core/services/baseManifestItemLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Adapted from provided examples) ---

const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/default.schema.json'),
    // Add other methods if needed for more complex tests later
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getContentBasePath: jest.fn(type => `./data/${type}`), // Added for completeness
    ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    // Add other methods if needed for more complex tests later
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

const createMockDataFetcher = (overrides = {}) => ({
    fetch: jest.fn().mockResolvedValue({}), // Default mock fetch
    ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})), // Return a dummy validator function
    // Add other methods if needed for more complex tests later
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
    store: jest.fn(),
    get: jest.fn().mockReturnValue(undefined),
    // Add other methods if needed for more complex tests later
    getAll: jest.fn().mockReturnValue([]),
    getAllSystemRules: jest.fn().mockReturnValue([]),
    clear: jest.fn(),
    getManifest: jest.fn().mockReturnValue(null),
    setManifest: jest.fn(),
    getEntityDefinition: jest.fn(),
    getItemDefinition: jest.fn(),
    getLocationDefinition: jest.fn(),
    getConnectionDefinition: jest.fn(), // Added for completeness
    getBlockerDefinition: jest.fn(),   // Added for completeness
    getActionDefinition: jest.fn(),    // Added for completeness
    getEventDefinition: jest.fn(),     // Added for completeness
    getComponentDefinition: jest.fn(), // Added for completeness
    getAllEntityDefinitions: jest.fn().mockReturnValue([]),      // Added for completeness
    getAllItemDefinitions: jest.fn().mockReturnValue([]),        // Added for completeness
    getAllLocationDefinitions: jest.fn().mockReturnValue([]),    // Added for completeness
    getAllConnectionDefinitions: jest.fn().mockReturnValue([]),  // Added for completeness
    getAllBlockerDefinitions: jest.fn().mockReturnValue([]),     // Added for completeness
    getAllActionDefinitions: jest.fn().mockReturnValue([]),      // Added for completeness
    getAllEventDefinitions: jest.fn().mockReturnValue([]),       // Added for completeness
    getAllComponentDefinitions: jest.fn().mockReturnValue([]),   // Added for completeness
    getStartingPlayerId: jest.fn().mockReturnValue(null),        // Added for completeness
    getStartingLocationId: jest.fn().mockReturnValue(null),      // Added for completeness
    ...overrides,
});

const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Ensure debug is present
    ...overrides,
});

// --- Shared Mocks Instance for Tests ---
let mockConfig;
let mockResolver;
let mockFetcher;
let mockValidator;
let mockRegistry;
let mockLogger;
let loader; // Instance of BaseManifestItemLoader

beforeEach(() => {
    // Create fresh mocks before each test in this file
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Instantiate the loader (or a dummy extension if needed, but direct base class is fine here)
    loader = new BaseManifestItemLoader(
        mockConfig,
        mockResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
    );
    // Reset mocks specifically for logging calls, just in case
    jest.clearAllMocks();
    // Re-create logger mock after clearAllMocks as it might be cleared
    mockLogger = createMockLogger();
    loader._logger = mockLogger; // Ensure the loader instance uses the fresh mock

    // --- Mock Internal Methods Used by _loadItemsInternal ---
    // We mock these directly on the instance for the tests of _loadItemsInternal
    loader._extractValidFilenames = jest.fn();
    loader._processFileWrapper = jest.fn(); // This will be configured per test case

    // Crucial: Mock the abstract method _processFetchedItem for _processFileWrapper tests (if testing wrapper directly)
    // For _loadItemsInternal tests, we mock _processFileWrapper itself, so _processFetchedItem won't be called.
    // Keep this for completeness if other tests call _processFileWrapper directly.
    loader._processFetchedItem = jest.fn();
});


// --- Test Suite ---

describe('BaseManifestItemLoader Constructor', () => {
    // Constructor tests remain the same as provided...
    it('should instantiate successfully with valid dependencies', () => {
        // Note: Mocks are created in the global beforeEach
        expect(loader).toBeInstanceOf(BaseManifestItemLoader);
        expect(loader._config).toBe(mockConfig);
        expect(loader._pathResolver).toBe(mockResolver);
        expect(loader._dataFetcher).toBe(mockFetcher);
        expect(loader._schemaValidator).toBe(mockValidator);
        expect(loader._dataRegistry).toBe(mockRegistry);
        expect(loader._logger).toBe(mockLogger);
        // Check constructor's own debug log (might need adjustment if beforeEach clears it)
        // Re-running constructor here just for this check, or rely on beforeEach log verification
        const tempLoader = new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
        expect(mockLogger.debug).toHaveBeenCalledWith('BaseManifestItemLoader: Initialized successfully with all dependencies.');
    });

    // --- Dependency Validation Failure Tests ---
    // (Keep all the constructor failure tests as provided)

    describe('IConfiguration Validation', () => {
        it('should throw TypeError if config is null or undefined', () => {
            expect(() => new BaseManifestItemLoader(null, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IConfiguration instance."));
            expect(() => new BaseManifestItemLoader(undefined, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IConfiguration instance."));
        });

        it('should throw TypeError if config is not an object', () => {
            expect(() => new BaseManifestItemLoader("not-an-object", mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IConfiguration instance."));
        });

        it('should throw TypeError if config is missing getModsBasePath', () => {
            const incompleteConfig = {...createMockConfiguration(), getModsBasePath: undefined};
            expect(() => new BaseManifestItemLoader(incompleteConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: IConfiguration instance must have a 'getModsBasePath' method."));
        });

        it('should throw TypeError if config is missing getContentTypeSchemaId', () => {
            const incompleteConfig = {...createMockConfiguration(), getContentTypeSchemaId: undefined};
            expect(() => new BaseManifestItemLoader(incompleteConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: IConfiguration instance must have a 'getContentTypeSchemaId' method."));
        });
    });

    describe('IPathResolver Validation', () => {
        it('should throw TypeError if pathResolver is null or undefined', () => {
            expect(() => new BaseManifestItemLoader(mockConfig, null, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IPathResolver instance."));
            expect(() => new BaseManifestItemLoader(mockConfig, undefined, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IPathResolver instance."));
        });

        it('should throw TypeError if pathResolver is missing resolveModContentPath', () => {
            const incompleteResolver = {...createMockPathResolver(), resolveModContentPath: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, incompleteResolver, mockFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: IPathResolver instance must have a 'resolveModContentPath' method."));
        });
    });

    describe('IDataFetcher Validation', () => {
        it('should throw TypeError if dataFetcher is null or undefined', () => {
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, null, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IDataFetcher instance."));
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, undefined, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IDataFetcher instance."));
        });

        it('should throw TypeError if dataFetcher is missing fetch', () => {
            const incompleteFetcher = {...createMockDataFetcher(), fetch: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, incompleteFetcher, mockValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: IDataFetcher instance must have a 'fetch' method."));
        });
    });

    describe('ISchemaValidator Validation', () => {
        it('should throw TypeError if schemaValidator is null or undefined', () => {
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, null, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid ISchemaValidator instance."));
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, undefined, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid ISchemaValidator instance."));
        });

        it('should throw TypeError if schemaValidator is missing validate', () => {
            const incompleteValidator = {...createMockSchemaValidator(), validate: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, incompleteValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: ISchemaValidator instance must have a 'validate' method."));
        });

        it('should throw TypeError if schemaValidator is missing getValidator', () => {
            const incompleteValidator = {...createMockSchemaValidator(), getValidator: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, incompleteValidator, mockRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: ISchemaValidator instance must have a 'getValidator' method."));
        });
    });

    describe('IDataRegistry Validation', () => {
        it('should throw TypeError if dataRegistry is null or undefined', () => {
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, null, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IDataRegistry instance."));
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, undefined, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid IDataRegistry instance."));
        });

        it('should throw TypeError if dataRegistry is missing store', () => {
            const incompleteRegistry = {...createMockDataRegistry(), store: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, incompleteRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: IDataRegistry instance must have a 'store' method."));
        });

        it('should throw TypeError if dataRegistry is missing get', () => {
            const incompleteRegistry = {...createMockDataRegistry(), get: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, incompleteRegistry, mockLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: IDataRegistry instance must have a 'get' method."));
        });
    });

    describe('ILogger Validation', () => {
        it('should throw TypeError if logger is null or undefined', () => {
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, null))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid ILogger instance."));
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, undefined))
                .toThrow(new TypeError("BaseManifestItemLoader requires a valid ILogger instance."));
        });

        it('should throw TypeError if logger is missing info', () => {
            const incompleteLogger = {...createMockLogger(), info: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, incompleteLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: ILogger instance must have a 'info' method."));
        });
        it('should throw TypeError if logger is missing warn', () => {
            const incompleteLogger = {...createMockLogger(), warn: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, incompleteLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: ILogger instance must have a 'warn' method."));
        });
        it('should throw TypeError if logger is missing error', () => {
            const incompleteLogger = {...createMockLogger(), error: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, incompleteLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: ILogger instance must have a 'error' method."));
        });
        it('should throw TypeError if logger is missing debug', () => {
            const incompleteLogger = {...createMockLogger(), debug: undefined};
            expect(() => new BaseManifestItemLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, incompleteLogger))
                .toThrow(new TypeError("BaseManifestItemLoader: ILogger instance must have a 'debug' method."));
        });
    });


    describe('Abstract Method Stub', () => {
        // Test the SYNCHRONOUS throw from the base class implementation
        it('_processFetchedItem should throw the specific abstract error message synchronously', () => { // Removed async
            // Create a new instance to test the original _processFetchedItem
            const freshLoader = new BaseManifestItemLoader(
                mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger
            );
            // Ensure the method is not accidentally mocked by beforeEach for this test
            // We access the method directly from the prototype
            const originalMethod = BaseManifestItemLoader.prototype._processFetchedItem;

            // Assign the original method to the instance for this test
            freshLoader._processFetchedItem = originalMethod;

            // Wrap the synchronous call in a function for .toThrow()
            expect(() => freshLoader._processFetchedItem('modId', 'filename', 'path', {}))
                .toThrow('Abstract method _processFetchedItem must be implemented by subclass.');

            // No need to restore mock, beforeEach handles it for subsequent tests
        });
    });
});

describe('BaseManifestItemLoader _extractValidFilenames', () => {
    const modId = 'test-mod';
    const contentKey = 'components';

    // Note: loader and mockLogger are initialized in the global beforeEach

    beforeEach(() => {
        // Ensure we are testing the REAL implementation in this suite
        loader._extractValidFilenames = BaseManifestItemLoader.prototype._extractValidFilenames;
    });


    it('should return valid, trimmed filenames for a standard input', () => {
        const manifest = {
            id: modId,
            content: {
                [contentKey]: [' file1.json ', 'file2.json', 'nested/file3.json']
            }
        };
        const expected = ['file1.json', 'file2.json', 'nested/file3.json'];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return empty array and log debug if manifest is null', () => {
        const manifest = null;
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return empty array and log debug if manifest is undefined', () => {
        const manifest = undefined;
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return empty array and log debug if manifest.content is null', () => {
        const manifest = {id: modId, content: null};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return empty array and log debug if manifest.content is undefined', () => {
        const manifest = {id: modId, content: undefined};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });


    it('should return empty array and log debug if contentKey is missing', () => {
        const manifest = {id: modId, content: {}}; // content exists, but key does not
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return empty array and log debug if contentKey value is null', () => {
        const manifest = {id: modId, content: {[contentKey]: null}};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return empty array and log debug if contentKey value is undefined', () => {
        const manifest = {id: modId, content: {[contentKey]: undefined}};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });


    it('should return empty array and log warning if contentKey value is not an array (string)', () => {
        const manifest = {id: modId, content: {[contentKey]: 'not-an-array'}};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Expected an array for content key '${contentKey}' but found type 'string'. Skipping.`
        );
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should return empty array and log warning if contentKey value is not an array (number)', () => {
        const manifest = {id: modId, content: {[contentKey]: 123}};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Expected an array for content key '${contentKey}' but found type 'number'. Skipping.`
        );
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should return empty array and log warning if contentKey value is not an array (object)', () => {
        const manifest = {id: modId, content: {[contentKey]: {file: 'oops.json'}}};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Expected an array for content key '${contentKey}' but found type 'object'. Skipping.`
        );
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should return empty array and log no warnings for an empty array input', () => {
        const manifest = {id: modId, content: {[contentKey]: []}};
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled(); // Changed from not.toHaveBeenCalled() to allow the empty list debug log if that's desired behavior
    });

    it('should filter out invalid types and log warnings for each', () => {
        const invalidNumber = 123;
        const invalidNull = null;
        const invalidObject = {a: 1};
        const invalidEmptyString = '   '; // Whitespace only

        const manifest = {
            id: modId,
            content: {
                [contentKey]: [
                    'valid1.json',
                    invalidNumber,
                    '  valid2.json ',
                    invalidNull,
                    invalidEmptyString,
                    invalidObject,
                    'valid3.json'
                ]
            }
        };
        const expected = ['valid1.json', 'valid2.json', 'valid3.json'];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledTimes(4); // One for each invalid entry
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`, invalidNumber
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`, invalidNull
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Empty string filename found in '${contentKey}' list after trimming. Skipping.`
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`, invalidObject
        );
    });

    it('should return empty array and log warnings if array contains only invalid types', () => {
        const invalidNumber = 456;
        const invalidNull = null;
        const invalidObject = {b: 2};
        const invalidEmptyString = '';


        const manifest = {
            id: modId,
            content: {
                [contentKey]: [
                    invalidNumber,
                    invalidNull,
                    invalidEmptyString,
                    invalidObject
                ]
            }
        };
        const expected = [];

        const result = loader._extractValidFilenames(manifest, contentKey, modId);

        expect(result).toEqual(expected);
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledTimes(4); // One for each invalid entry
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`, invalidNumber
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`, invalidNull
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Empty string filename found in '${contentKey}' list after trimming. Skipping.`
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`, invalidObject
        );
    });
});

// --- TEST SUITE for _processFileWrapper ---
describe('BaseManifestItemLoader _processFileWrapper', () => {
    const modId = 'test-mod';
    const filename = 'item.json';
    const contentTypeDir = 'items';
    const resolvedPath = `./data/mods/${modId}/${contentTypeDir}/${filename}`;
    const mockData = {id: 'test-item', value: 123};
    const mockResult = {processed: true, id: 'test-item'}; // Example result from _processFetchedItem

    // Note: loader, mocks are initialized in the global beforeEach,
    // loader._processFileWrapper is NOT mocked here, we test the real one.
    // loader._processFetchedItem IS mocked by default in beforeEach

    beforeEach(() => {
        // Restore the real _processFileWrapper for tests in this suite
        loader._processFileWrapper = BaseManifestItemLoader.prototype._processFileWrapper;
        // Keep _processFetchedItem mocked as per beforeEach, or re-mock if necessary
        loader._processFetchedItem = jest.fn();
    });

    it('Success Path: should resolve, fetch, process, and return result', async () => {
        // --- Arrange ---
        mockResolver.resolveModContentPath.mockReturnValue(resolvedPath);
        mockFetcher.fetch.mockResolvedValue(mockData);
        loader._processFetchedItem.mockResolvedValue(mockResult); // Configure the mock

        // --- Act ---
        const result = await loader._processFileWrapper(modId, filename, contentTypeDir);

        // --- Assert ---
        expect(result).toEqual(mockResult); // Check returned value
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, contentTypeDir, filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(resolvedPath);
        expect(loader._processFetchedItem).toHaveBeenCalledWith(modId, filename, resolvedPath, mockData);
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors logged
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Resolved path for ${filename}: ${resolvedPath}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Fetched data from ${resolvedPath}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Successfully processed ${filename}`);
    });

    it('Path Resolution Error: should log error, not fetch/process, and re-throw', async () => {
        // --- Arrange ---
        const resolutionError = new Error('Path resolution failed');
        mockResolver.resolveModContentPath.mockImplementation(() => {
            throw resolutionError;
        });

        // --- Act & Assert ---
        await expect(loader._processFileWrapper(modId, filename, contentTypeDir))
            .rejects.toThrow(resolutionError); // Verify re-throw

        // Assert logging
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error processing file:',
            {
                modId: modId,
                filename: filename,
                path: 'Path not resolved', // resolvedPath is null here
                error: resolutionError.message
            },
            resolutionError // Original error object
        );

        // Assert other methods not called
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(loader._processFetchedItem).not.toHaveBeenCalled();
    });

    it('Data Fetching Error: should log error, not process, and re-throw', async () => {
        // --- Arrange ---
        const fetchError = new Error('File not found');
        mockResolver.resolveModContentPath.mockReturnValue(resolvedPath);
        mockFetcher.fetch.mockRejectedValue(fetchError); // Simulate fetch failure

        // --- Act & Assert ---
        await expect(loader._processFileWrapper(modId, filename, contentTypeDir))
            .rejects.toThrow(fetchError); // Verify re-throw

        // Assert logging
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error processing file:',
            {
                modId: modId,
                filename: filename,
                path: resolvedPath, // Path was resolved
                error: fetchError.message
            },
            fetchError // Original error object
        );

        // Assert other methods not called
        expect(loader._processFetchedItem).not.toHaveBeenCalled();
        // Debug logs for resolve would have happened before the error
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Resolved path for ${filename}: ${resolvedPath}`);

    });

    it('_processFetchedItem Error: should log error and re-throw', async () => {
        // --- Arrange ---
        const processError = new Error('Processing failed');
        mockResolver.resolveModContentPath.mockReturnValue(resolvedPath);
        mockFetcher.fetch.mockResolvedValue(mockData);
        loader._processFetchedItem.mockRejectedValue(processError); // Simulate processing failure

        // --- Act & Assert ---
        await expect(loader._processFileWrapper(modId, filename, contentTypeDir))
            .rejects.toThrow(processError); // Verify re-throw

        // Assert logging
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error processing file:',
            {
                modId: modId,
                filename: filename,
                path: resolvedPath, // Path was resolved, data fetched
                error: processError.message
            },
            processError // Original error object
        );
        // Debug logs for resolve/fetch would have happened before the error
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Resolved path for ${filename}: ${resolvedPath}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Fetched data from ${resolvedPath}`);
    });
});

// --- NEW TEST SUITE for _loadItemsInternal ---
describe('BaseManifestItemLoader _loadItemsInternal', () => {
    const modId = 'test-mod';
    const manifest = {id: modId, content: {}}; // Basic manifest structure
    const contentKey = 'items';
    const contentTypeDir = 'items';

    // Note: loader, mocks, _extractValidFilenames, _processFileWrapper are mocked in global beforeEach

    beforeEach(() => {
        // Restore the real _loadItemsInternal for tests in this suite
        loader._loadItemsInternal = BaseManifestItemLoader.prototype._loadItemsInternal;
        // Ensure its dependencies (_extractValidFilenames, _processFileWrapper) ARE mocked
        loader._extractValidFilenames = jest.fn();
        loader._processFileWrapper = jest.fn();
    });


    it('No Files Found: should return 0, log debug, and not call processFileWrapper', async () => {
        // --- Arrange ---
        loader._extractValidFilenames.mockReturnValue([]); // Configure mock

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir);

        // --- Assert ---
        expect(result).toBe(0);
        expect(loader._extractValidFilenames).toHaveBeenCalledWith(manifest, contentKey, modId);
        expect(mockLogger.debug).toHaveBeenCalledWith(`No valid ${contentKey} filenames found for mod ${modId}.`);
        expect(loader._processFileWrapper).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled(); // No summary log needed
    });

    it('All Files Process Successfully: should return count, call wrapper for each, log success summary', async () => {
        // --- Arrange ---
        const filenames = ['file1.json', 'file2.json'];
        loader._extractValidFilenames.mockReturnValue(filenames);
        loader._processFileWrapper.mockResolvedValue('success'); // Mock wrapper to always succeed

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir);

        // --- Assert ---
        expect(result).toBe(2);
        expect(loader._extractValidFilenames).toHaveBeenCalledWith(manifest, contentKey, modId);
        expect(loader._processFileWrapper).toHaveBeenCalledTimes(2);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file1.json', contentTypeDir);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file2.json', contentTypeDir);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 2/2 ${contentKey} items.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Found 2 potential ${contentKey} files to process for mod ${modId}.`); // Check initial debug log
    });

    it('Some Files Fail: should return success count, call wrapper for each, log summary with failures', async () => {
        // --- Arrange ---
        const filenames = ['file1.json', 'file2.json', 'file3.json'];
        const failureError = new Error('Failed to process file2');
        loader._extractValidFilenames.mockReturnValue(filenames);
        loader._processFileWrapper.mockImplementation(async (mId, fname, cTypeDir) => {
            if (fname === 'file2.json') {
                // Simulate rejection that _processFileWrapper would propagate
                throw failureError;
            }
            return 'success'; // Succeed for others
        });

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir);

        // --- Assert ---
        expect(result).toBe(2); // Only file1 and file3 succeeded
        expect(loader._extractValidFilenames).toHaveBeenCalledWith(manifest, contentKey, modId);
        expect(loader._processFileWrapper).toHaveBeenCalledTimes(3);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file1.json', contentTypeDir);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file2.json', contentTypeDir);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file3.json', contentTypeDir);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 2/3 ${contentKey} items. (1 failed)`);
        // Check debug log for the failure reason (optional, but good)
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Failed processing file2.json. Reason: ${failureError.message}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Found 3 potential ${contentKey} files to process for mod ${modId}.`); // Check initial debug log
    });

    it('All Files Fail: should return 0, call wrapper for each, log summary with all failures', async () => {
        // --- Arrange ---
        const filenames = ['file1.json', 'file2.json'];
        const failureError1 = new Error('Failed file1');
        const failureError2 = new Error('Failed file2');
        loader._extractValidFilenames.mockReturnValue(filenames);
        // Mock _processFileWrapper to always reject
        loader._processFileWrapper.mockImplementation(async (mId, fname, cTypeDir) => {
            if (fname === 'file1.json') throw failureError1;
            if (fname === 'file2.json') throw failureError2;
            // Should not happen in this test setup, but good practice
            throw new Error(`Unexpected filename in mock: ${fname}`);
        });

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir);

        // --- Assert ---
        expect(result).toBe(0);
        expect(loader._extractValidFilenames).toHaveBeenCalledWith(manifest, contentKey, modId);
        expect(loader._processFileWrapper).toHaveBeenCalledTimes(2);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file1.json', contentTypeDir);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file2.json', contentTypeDir);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/2 ${contentKey} items. (2 failed)`);
        // Check debug logs for failure reasons
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Failed processing file1.json. Reason: ${failureError1.message}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Failed processing file2.json. Reason: ${failureError2.message}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Found 2 potential ${contentKey} files to process for mod ${modId}.`); // Check initial debug log
    });
});
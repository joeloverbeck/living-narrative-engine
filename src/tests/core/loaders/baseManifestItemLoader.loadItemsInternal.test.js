// src/tests/core/loaders/baseManifestItemLoader.loadItemsInternal.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
// Adjust the import path as necessary
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js';
// Assume ValidationResult type is available or mock it if needed for type checking in tests
// import { ValidationResult } from '../../../src/interfaces/validation.js'; // Example import


// --- Mock Service Factories (Keep as provided, ensure ISchemaValidator has isSchemaLoaded) ---

const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/default.schema.json'),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getContentBasePath: jest.fn(type => `./data/${type}`),
    ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

const createMockDataFetcher = (overrides = {}) => ({
    fetch: jest.fn().mockResolvedValue({}),
    ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
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
    // Recreate config mock after clearAllMocks (especially getContentTypeSchemaId)
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

// --- Existing Test Suite for _loadItemsInternal ---
describe('BaseManifestItemLoader _loadItemsInternal', () => {
    const modId = 'test-mod';
    const manifest = {id: modId, content: {}}; // Basic manifest structure
    const contentKey = 'items';
    const contentTypeDir = 'items';
    const typeName = 'items';

    // Note: loader, mocks are set up in global beforeEach
    // _extractValidFilenames, _processFileWrapper are mocked by global beforeEach

    beforeEach(() => {
        // Restore the real _loadItemsInternal for tests in this suite
        loader._loadItemsInternal = BaseManifestItemLoader.prototype._loadItemsInternal;
        // Ensure its dependencies (_extractValidFilenames, _processFileWrapper) ARE mocked (done by global beforeEach)
        // loader._extractValidFilenames = jest.fn(); // Already mocked globally
        // loader._processFileWrapper = jest.fn(); // Already mocked globally
        // Clear mocks (already done by global beforeEach)
        // jest.clearAllMocks();
    });


    it('No Files Found: should return 0, log debug, and not call processFileWrapper', async () => {
        // --- Arrange ---
        loader._extractValidFilenames.mockReturnValue([]); // Configure mock

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir, typeName);

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
        const qualifiedId1 = `${modId}:file1`;
        const qualifiedId2 = `${modId}:file2`;
        loader._extractValidFilenames.mockReturnValue(filenames);
        // Mock wrapper to return different values based on input for more robust testing
        loader._processFileWrapper.mockImplementation(async (mId, fname) => {
            if (fname === 'file1.json') return qualifiedId1;
            if (fname === 'file2.json') return qualifiedId2;
            return 'unexpected-success';
        });

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir, typeName);

        // --- Assert ---
        expect(result).toBe(2);
        expect(loader._extractValidFilenames).toHaveBeenCalledWith(manifest, contentKey, modId);
        expect(loader._processFileWrapper).toHaveBeenCalledTimes(2);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file1.json', contentTypeDir, typeName);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file2.json', contentTypeDir, typeName);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 2/2 ${contentKey} items.`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Found 2 potential ${contentKey} files to process for mod ${modId}.`);
    });

    it('Some Files Fail: should return success count, call wrapper for each, log summary with failures', async () => {
        // --- Arrange ---
        const filenames = ['file1.json', 'file2.json', 'file3.json'];
        const qualifiedId1 = `${modId}:file1`;
        const qualifiedId3 = `${modId}:file3`;
        const failureError = new Error('Failed to process file2');
        loader._extractValidFilenames.mockReturnValue(filenames);
        loader._processFileWrapper.mockImplementation(async (mId, fname, cTypeDir, tName) => {
            expect(tName).toBe(typeName); // Add assertion for typeName within mock
            if (fname === 'file1.json') return qualifiedId1;
            if (fname === 'file2.json') throw failureError; // Simulate rejection
            if (fname === 'file3.json') return qualifiedId3;
            throw new Error(`Unexpected filename in mock: ${fname}`);
        });

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir, typeName);

        // --- Assert ---
        expect(result).toBe(2); // Only file1 and file3 succeeded
        expect(loader._extractValidFilenames).toHaveBeenCalledWith(manifest, contentKey, modId);
        expect(loader._processFileWrapper).toHaveBeenCalledTimes(3);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file1.json', contentTypeDir, typeName);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file2.json', contentTypeDir, typeName);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file3.json', contentTypeDir, typeName);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 2/3 ${contentKey} items. (1 failed)`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Found 3 potential ${contentKey} files to process for mod ${modId}.`);
    });

    it('All Files Fail: should return 0, call wrapper for each, log summary with all failures', async () => {
        // --- Arrange ---
        const filenames = ['file1.json', 'file2.json'];
        const failureError1 = new Error('Failed file1');
        const failureError2 = new Error('Failed file2');
        loader._extractValidFilenames.mockReturnValue(filenames);
        loader._processFileWrapper.mockImplementation(async (mId, fname, cTypeDir, tName) => {
            expect(tName).toBe(typeName);
            if (fname === 'file1.json') throw failureError1;
            if (fname === 'file2.json') throw failureError2;
            throw new Error(`Unexpected filename in mock: ${fname}`);
        });

        // --- Act ---
        const result = await loader._loadItemsInternal(modId, manifest, contentKey, contentTypeDir, typeName);

        // --- Assert ---
        expect(result).toBe(0);
        expect(loader._extractValidFilenames).toHaveBeenCalledWith(manifest, contentKey, modId);
        expect(loader._processFileWrapper).toHaveBeenCalledTimes(2);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file1.json', contentTypeDir, typeName);
        expect(loader._processFileWrapper).toHaveBeenCalledWith(modId, 'file2.json', contentTypeDir, typeName);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/2 ${contentKey} items. (2 failed)`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`Found 2 potential ${contentKey} files to process for mod ${modId}.`);
    });
});

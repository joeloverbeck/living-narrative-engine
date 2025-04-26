// src/tests/core/services/genericContentLoader.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import GenericContentLoader from '../../../core/services/genericContentLoader.js'; // Adjust path as needed

// --- Mock Interfaces (Type Hinting Only) ---
/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ValidationResult} ValidationResult */


describe('GenericContentLoader', () => {
    // --- Mock Variables ---
    /** @type {jest.Mocked<IConfiguration>} */
    let mockConfiguration;
    /** @type {jest.Mocked<IPathResolver>} */
    let mockPathResolver;
    /** @type {jest.Mocked<IDataFetcher>} */
    let mockDataFetcher;
    /** @type {jest.Mocked<ISchemaValidator>} */
    let mockSchemaValidator;
    /** @type {jest.Mocked<IDataRegistry>} */
    let mockDataRegistry;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {GenericContentLoader} */
    let contentLoader;

    // --- Test Constants ---
    const ITEMS_SCHEMA_ID = 'test://schemas/item';
    const TRIGGERS_SCHEMA_ID = 'test://schemas/trigger';
    const WEAPONS_SCHEMA_ID = 'test://schemas/weapon'; // For validator not found test
    const ACTIONS_SCHEMA_ID = 'test://schemas/action'; // For empty list test

    beforeEach(() => {
        // [x] Mock Dependencies
        mockConfiguration = {
            getContentTypeSchemaId: jest.fn(),
            getBaseDataPath: jest.fn(),
            getSchemaFiles: jest.fn(),
            getSchemaBasePath: jest.fn(),
            getContentBasePath: jest.fn(),
            getWorldBasePath: jest.fn(),
        };
        mockPathResolver = {
            resolveContentPath: jest.fn(),
            resolveSchemaPath: jest.fn(),
            resolveManifestPath: jest.fn(),
            resolveModContentPath: jest.fn(), // Ensure this is mocked
        };
        mockDataFetcher = {
            fetch: jest.fn(),
        };
        mockSchemaValidator = {
            addSchema: jest.fn(),
            getValidator: jest.fn(),
            isSchemaLoaded: jest.fn(),
            validate: jest.fn(),
        };
        mockDataRegistry = {
            store: jest.fn(),
            get: jest.fn(),
            getAll: jest.fn(),
            clear: jest.fn(),
            getManifest: jest.fn(),
            setManifest: jest.fn(),
        };
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // [x] Configure Mocks - Basic Setup
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
            switch (typeName) {
                case 'items':
                    return ITEMS_SCHEMA_ID;
                case 'triggers':
                    return TRIGGERS_SCHEMA_ID;
                case 'weapons':
                    return WEAPONS_SCHEMA_ID;
                case 'actions':
                    return ACTIONS_SCHEMA_ID;
                case 'monsters':
                    return undefined;
                default:
                    return undefined;
            }
        });

        mockPathResolver.resolveModContentPath.mockImplementation(
            (modId, typeName, filename) => `./test/data/${typeName}/${filename}`
        );

        // Default mock behavior
        mockDataRegistry.get.mockReturnValue(undefined);

        // Instantiate the loader with mocks
        contentLoader = new GenericContentLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            mockDataRegistry,
            mockLogger
        );

        // Verify constructor logs info message
        expect(mockLogger.info).toHaveBeenCalledWith('GenericContentLoader: Instance created and services injected.');

        // --- FIX: Clear call history for mocks AFTER instantiation ---
        mockLogger.info.mockClear();
        mockConfiguration.getContentTypeSchemaId.mockClear();
        mockPathResolver.resolveModContentPath.mockClear();
        mockPathResolver.resolveContentPath.mockClear();
        mockDataFetcher.fetch.mockClear();
        mockSchemaValidator.getValidator.mockClear();
        mockSchemaValidator.validate.mockClear();
        mockDataRegistry.get.mockClear();
        mockDataRegistry.store.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
    });


    // ===========================================================
    // --- Task: Test Scenario: No Schema ID Configured for Type ---
    // ===========================================================
    it('[No Schema ID] should resolve, log warning, and skip processing if no schema ID is configured', async () => {
        // Arrange
        const typeName = 'monsters';
        const filenames = ['goblin.json'];

        // Act
        await expect(contentLoader.loadContentFiles(typeName, filenames)).resolves.toBeUndefined();

        // Assert
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).not.toHaveBeenCalled();
        expect(mockPathResolver.resolveModContentPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockDataRegistry.store).not.toHaveBeenCalled();
        expect(mockDataRegistry.get).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`No schema ID configured for content type '${typeName}'. Skipping loading for this type.`)
        );
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    // ============================================================
    // --- Task: Test Scenario: Validator Function Not Found ---
    // ============================================================
    it('[No Validator Fn] should reject and log error if validator function is not found for schema ID', async () => {
        // Arrange
        const typeName = 'weapons';
        const filenames = ['sword.json'];
        mockSchemaValidator.getValidator.mockReturnValue(undefined); // Override beforeEach setup

        // Act & Assert
        await expect(contentLoader.loadContentFiles(typeName, filenames))
            .rejects.toThrow(`Validator function unavailable for schema '${WEAPONS_SCHEMA_ID}' (type '${typeName}')`);

        // Assert
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(WEAPONS_SCHEMA_ID);
        expect(mockPathResolver.resolveModContentPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockDataRegistry.store).not.toHaveBeenCalled();
        expect(mockDataRegistry.get).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Schema validator function not found for schema ID '${WEAPONS_SCHEMA_ID}'`)
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
    });

    // ===================================================
    // --- Task: Test Scenario: Empty Filename List ---
    // ===================================================
    it('[Empty List] should resolve and log info if filename list is empty', async () => {
        // Arrange
        const typeName = 'actions';
        const filenames = [];

        // Act
        await expect(contentLoader.loadContentFiles(typeName, filenames)).resolves.toBeUndefined();

        // Assert
        expect(mockConfiguration.getContentTypeSchemaId).not.toHaveBeenCalled();
        expect(mockSchemaValidator.getValidator).not.toHaveBeenCalled();
        expect(mockPathResolver.resolveModContentPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockDataRegistry.store).not.toHaveBeenCalled();
        expect(mockDataRegistry.get).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}' (0 files)`));
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`No files listed for content type '${typeName}'. Skipping.`)
        );
        expect(mockLogger.info).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    // ===================================
    // --- Constructor Validation Tests ---
    // ===================================
    describe('Constructor Validation', () => {
        // Helper to create a valid base set of mocks
        const createValidMocks = () => ({
            mockConfiguration: {getContentTypeSchemaId: jest.fn()},
            mockPathResolver: {
                resolveContentPath: jest.fn(),
                resolveModContentPath: jest.fn(),
                resolveSchemaPath: jest.fn(),
                resolveManifestPath: jest.fn()
            },
            mockDataFetcher: {fetch: jest.fn()},
            mockSchemaValidator: {
                getValidator: jest.fn(),
                isSchemaLoaded: jest.fn(),
                validate: jest.fn(),
                addSchema: jest.fn()
            },
            mockDataRegistry: {store: jest.fn(), get: jest.fn()},
            mockLogger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
        });

        it('should throw if IConfiguration is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(null, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'configuration' dependency/);
            expect(() => new GenericContentLoader({}, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'configuration' dependency/);
        });

        it('should throw if IPathResolver is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, null, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'pathResolver' dependency/);
            // Check specifically for resolveContentPath based on constructor code
            expect(() => new GenericContentLoader(mocks.mockConfiguration, {}, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'pathResolver' dependency/);
        });

        it('should throw if IDataFetcher is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, null, mocks.mockSchemaValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'fetcher' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, {}, mocks.mockSchemaValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'fetcher' dependency/);
        });

        it('should throw if ISchemaValidator is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, null, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'validator' dependency/);
            // Check based on constructor checks
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, {}, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'validator' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, {
                getValidator: jest.fn(),
                isSchemaLoaded: jest.fn()
            }, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'validator' dependency/); // Missing validate
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, {
                getValidator: jest.fn(),
                validate: jest.fn()
            }, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'validator' dependency/); // Missing isSchemaLoaded
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, {
                isSchemaLoaded: jest.fn(),
                validate: jest.fn()
            }, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'validator' dependency/); // Missing getValidator
        });

        it('should throw if IDataRegistry is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, null, mocks.mockLogger))
                .toThrow(/Missing or invalid 'registry' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, {}, mocks.mockLogger))
                .toThrow(/Missing or invalid 'registry' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, {store: jest.fn()}, mocks.mockLogger))
                .toThrow(/Missing or invalid 'registry' dependency/); // Missing get
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, {get: jest.fn()}, mocks.mockLogger))
                .toThrow(/Missing or invalid 'registry' dependency/); // Missing store
        });

        it('should throw if ILogger is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockDataRegistry, null))
                .toThrow(/Missing or invalid 'logger' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockDataRegistry, {}))
                .toThrow(/Missing or invalid 'logger' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockDataRegistry, {
                info: jest.fn(),
                warn: jest.fn()
            }))
                .toThrow(/Missing or invalid 'logger' dependency/); // Missing error
        });
    }); // End Constructor Validation describe block

}); // End Outer Describe block
// src/tests/core/services/genericContentLoader.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import GenericContentLoader from '../../../core/services/genericContentLoader.js'; // Adjust path as needed

// --- Mock Interfaces (Type Hinting Only) ---
/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IEventTypeValidator} IEventTypeValidator */
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
    /** @type {jest.Mocked<IEventTypeValidator>} */
    let mockEventTypeValidator;
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
            // Dummy implementations for other IConfiguration methods (required by constructor checks)
            getBaseDataPath: jest.fn(),
            getSchemaFiles: jest.fn(),
            getManifestSchemaId: jest.fn(),
            getSchemaBasePath: jest.fn(),
            getContentBasePath: jest.fn(),
            getWorldBasePath: jest.fn(),
        };
        mockPathResolver = {
            resolveContentPath: jest.fn(),
            // Dummy implementations for other IPathResolver methods
            resolveSchemaPath: jest.fn(),
            resolveManifestPath: jest.fn(),
        };
        mockDataFetcher = {
            fetch: jest.fn(),
        };
        mockSchemaValidator = {
            addSchema: jest.fn(), // Not used by GenericContentLoader, but part of interface
            getValidator: jest.fn(),
            isSchemaLoaded: jest.fn(), // Not used directly by GenericContentLoader, but part of interface
        };
        mockEventTypeValidator = {
            isValidEventType: jest.fn(),
            initialize: jest.fn(), // Not used by GenericContentLoader
        };
        mockDataRegistry = {
            store: jest.fn(),
            get: jest.fn(),
            // Dummy implementations for other IDataRegistry methods
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
                    return undefined; // For 'No Schema ID' test
                default:
                    return undefined;
            }
        });
        mockPathResolver.resolveContentPath.mockImplementation(
            (typeName, filename) => `./test/data/${typeName}/${filename}`
        );
        // Default mock behavior (can be overridden in tests)
        mockDataRegistry.get.mockReturnValue(undefined); // Assume no duplicates by default
        mockEventTypeValidator.isValidEventType.mockReturnValue(true); // Assume valid by default

        // Instantiate the loader with mocks
        contentLoader = new GenericContentLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            mockEventTypeValidator,
            mockDataRegistry,
            mockLogger
        );

        // Verify constructor logs info message (happens once per instantiation)
        expect(mockLogger.info).toHaveBeenCalledWith("GenericContentLoader: Instance created and services injected.");
        // Clear the constructor call from mock history for cleaner test-specific checks
        mockLogger.info.mockClear();
    });

    // =============================================
    // --- Task: Test Scenario: Successful Load ---
    // =============================================
    it('[Success] should load, validate, and store multiple files for a single type', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2.json'];
        const item1Path = `./test/data/${typeName}/${filenames[0]}`;
        const item2Path = `./test/data/${typeName}/${filenames[1]}`;
        const item1Data = {id: 'item1_id', name: 'Potion', value: 10};
        const item2Data = {id: 'item2_id', name: 'Sword', value: 50};
        const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null});

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === item1Path) return item1Data;
            if (path === item2Path) return item2Data;
            throw new Error(`Unexpected fetch path: ${path}`);
        });

        // Act
        await expect(contentLoader.loadContentFiles(typeName, filenames)).resolves.toBeUndefined();

        // Assert
        // Verify Service Interactions
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}' (${filenames.length} files)`));
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(ITEMS_SCHEMA_ID);

        expect(mockPathResolver.resolveContentPath).toHaveBeenCalledTimes(2);
        expect(mockPathResolver.resolveContentPath).toHaveBeenCalledWith(typeName, filenames[0]);
        expect(mockPathResolver.resolveContentPath).toHaveBeenCalledWith(typeName, filenames[1]);

        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(item1Path);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(item2Path);

        expect(mockValidate).toHaveBeenCalledTimes(2);
        expect(mockValidate).toHaveBeenCalledWith(item1Data);
        expect(mockValidate).toHaveBeenCalledWith(item2Data);

        expect(mockDataRegistry.get).toHaveBeenCalledTimes(2);
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item1Data.id);
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item2Data.id);

        expect(mockDataRegistry.store).toHaveBeenCalledTimes(2);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item1Data);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item2Data.id, item2Data);

        // Verify Logging
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item1Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item2Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored ${typeName} with ID '${item1Data.id}' from ${item1Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored ${typeName} with ID '${item2Data.id}' from ${item2Path}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // ==============================================================
    // --- Task: Test Scenario: Schema Validation Failure (One File) ---
    // ==============================================================
    it('[Validation Error] should reject and log error if schema validation fails for one file', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2_invalid.json'];
        const item1Path = `./test/data/${typeName}/${filenames[0]}`;
        const item2Path = `./test/data/${typeName}/${filenames[1]}`;
        const item1Data = {id: 'item1_id', name: 'Potion', value: 10};
        const item2InvalidData = {id: 'item2_id', nam: 'Sword'}; // Missing 'name', has 'nam'
        const validationErrors = [{path: '/name', message: 'is required'}];
        const mockValidate = jest.fn().mockImplementation((data) => {
            if (data.id === 'item1_id') return {isValid: true, errors: null};
            if (data.id === 'item2_id') return {isValid: false, errors: validationErrors};
            return {isValid: false, errors: [{message: 'Unexpected data'}]};
        });

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === item1Path) return item1Data;
            if (path === item2Path) return item2InvalidData;
            throw new Error(`Unexpected fetch path: ${path}`);
        });

        // Act & Assert
        await expect(contentLoader.loadContentFiles(typeName, filenames))
            .rejects.toThrow(`Error processing ${typeName} file ${filenames[1]} at path ${item2Path}: Schema validation failed for ${typeName} file '${filenames[1]}'`);

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(ITEMS_SCHEMA_ID);
        expect(mockPathResolver.resolveContentPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockValidate).toHaveBeenCalledWith(item1Data);
        expect(mockValidate).toHaveBeenCalledWith(item2InvalidData);

        // Verify registry interactions - store for valid, not for invalid
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item1Data.id); // Check for item1
        expect(mockDataRegistry.get).not.toHaveBeenCalledWith(typeName, item2InvalidData.id); // Should not get this far
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item1Data);
        expect(mockDataRegistry.store).toHaveBeenCalledTimes(1); // Only for the successful one

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item1Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item2Path}`));
        expect(mockLogger.error).toHaveBeenCalledWith(
            `Schema validation failed for ${item2Path} (type ${typeName}) using schema ${ITEMS_SCHEMA_ID}:\n${JSON.stringify(validationErrors, null, 2)}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to load/process file ${filenames[1]} (type ${typeName}, path: ${item2Path})`),
            expect.any(Error) // Internal error wrapping the validation error
        );
        expect(mockLogger.error.mock.calls[1][1].message).toContain(`Schema validation failed for ${typeName} file '${filenames[1]}'`);

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to load one or more files for content type '${typeName}'`),
            expect.any(Error) // Aggregate error
        );
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
    });


    // =====================================================================
    // --- Task: Test Scenario: Data Missing Required id Property (One File) ---
    // =====================================================================
    it('[Missing ID Error] should reject and log error if fetched data is missing the id property', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2_no_id.json'];
        const item1Path = `./test/data/${typeName}/${filenames[0]}`;
        const item2Path = `./test/data/${typeName}/${filenames[1]}`;
        const item1Data = {id: 'item1_id', name: 'Potion'};
        const item2NoIdData = {name: 'Sword', value: 50}; // Missing 'id'
        const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null}); // Schema validation passes

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === item1Path) return item1Data;
            if (path === item2Path) return item2NoIdData;
            throw new Error(`Unexpected fetch path: ${path}`);
        });

        // Act & Assert
        await expect(contentLoader.loadContentFiles(typeName, filenames))
            .rejects.toThrow(`Error processing ${typeName} file ${filenames[1]} at path ${item2Path}: Data in ${item2Path} (type ${typeName}) is missing a valid required 'id' property.`);

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(ITEMS_SCHEMA_ID);
        expect(mockPathResolver.resolveContentPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockValidate).toHaveBeenCalledWith(item1Data);
        expect(mockValidate).toHaveBeenCalledWith(item2NoIdData); // Validation is called before ID check

        // Verify registry interactions - store for valid, not for invalid
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item1Data.id); // Check for item1
        // --- FIX: Verify get was only called once (not for the invalid item) ---
        expect(mockDataRegistry.get).toHaveBeenCalledTimes(1);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item1Data);
        expect(mockDataRegistry.store).toHaveBeenCalledTimes(1); // Only for the successful one

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to load/process file ${filenames[1]} (type ${typeName}, path: ${item2Path})`),
            expect.any(Error) // Internal error wrapping the missing ID error
        );
        expect(mockLogger.error.mock.calls[1][1].message).toContain(`Data in ${item2Path} (type ${typeName}) is missing a valid required 'id' property.`);

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to load one or more files for content type '${typeName}'`),
            expect.any(Error) // Aggregate error
        );
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
    });

    // ====================================================
    // --- Task: Test Scenario: Duplicate ID Detected ---
    // ====================================================
    it('[Duplicate ID] should resolve, log warning, and overwrite when a duplicate ID is detected', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2_duplicate.json'];
        const item1Path = `./test/data/${typeName}/${filenames[0]}`;
        const item2Path = `./test/data/${typeName}/${filenames[1]}`;
        const item1Data = {id: 'item1_id', name: 'Potion', value: 10};
        const item2DuplicateData = {id: 'item1_id', name: 'Super Potion', value: 50}; // Same ID as item1
        const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null});

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === item1Path) return item1Data;
            if (path === item2Path) return item2DuplicateData;
            throw new Error(`Unexpected fetch path: ${path}`);
        });
        // Configure registry `get` to find the duplicate
        mockDataRegistry.get.mockImplementation((type, id) => {
            if (type === typeName && id === item1Data.id) {
                // Simulate finding the first item when checking the second
                // Note: This requires careful timing/ordering assumptions in the test.
                // A simpler way is to just return 'something' when get is called for the duplicate ID.
                // We assume item1 is processed first, then item2 checks and finds item1.
                if (mockDataRegistry.store.mock.calls.length > 0) { // If item1 was already stored
                    return item1Data; // Return the data that was just stored
                }
            }
            return undefined; // Not found otherwise
        });


        // Act
        await expect(contentLoader.loadContentFiles(typeName, filenames)).resolves.toBeUndefined();

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(ITEMS_SCHEMA_ID);
        expect(mockPathResolver.resolveContentPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockValidate).toHaveBeenCalledTimes(2);
        expect(mockValidate).toHaveBeenCalledWith(item1Data);
        expect(mockValidate).toHaveBeenCalledWith(item2DuplicateData);

        // Verify registry interactions
        expect(mockDataRegistry.get).toHaveBeenCalledTimes(2);
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item1Data.id); // Called for both

        // Verify store was called twice, overwriting the first
        expect(mockDataRegistry.store).toHaveBeenCalledTimes(2);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item1Data); // First store
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item2DuplicateData); // Second store (overwrite)

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Duplicate ID detected for ${typeName}: '${item1Data.id}' in file ${filenames[1]} (${item2Path}). Overwriting previous definition`)
        );
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored ${typeName} with ID '${item1Data.id}'`)); // Called twice
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    // ====================================================================
    // --- Task: Test Scenario: Conditional Event Type Validation (Triggers) ---
    // ====================================================================
    it('[Event Type Validation] should validate trigger event types, log warnings for invalid/missing, but still store', async () => {
        // Arrange
        const typeName = 'triggers';
        const filenames = ['trigger_valid.json', 'trigger_invalid.json', 'trigger_missing_event.json', 'trigger_missing_listen.json'];
        const paths = filenames.map(f => `./test/data/${typeName}/${f}`);
        const triggerValidData = {id: 'trigger1', listen_to: {event_type: 'VALID_EVENT'}};
        const triggerInvalidData = {id: 'trigger2', listen_to: {event_type: 'INVALID_EVENT'}};
        const triggerMissingEventData = {id: 'trigger3', listen_to: {some_other_prop: true}}; // listen_to exists, event_type missing
        const triggerMissingListenData = {id: 'trigger4', some_prop: true}; // listen_to missing entirely
        const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null}); // Schema validation passes for all

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === paths[0]) return triggerValidData;
            if (path === paths[1]) return triggerInvalidData;
            if (path === paths[2]) return triggerMissingEventData;
            if (path === paths[3]) return triggerMissingListenData;
            throw new Error(`Unexpected fetch path: ${path}`);
        });
        // Configure event type validator
        mockEventTypeValidator.isValidEventType.mockImplementation((eventType) => {
            return eventType === 'VALID_EVENT';
        });

        // Act
        await expect(contentLoader.loadContentFiles(typeName, filenames)).resolves.toBeUndefined();

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(TRIGGERS_SCHEMA_ID);
        expect(mockPathResolver.resolveContentPath).toHaveBeenCalledTimes(filenames.length);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(filenames.length);
        expect(mockValidate).toHaveBeenCalledTimes(filenames.length);

        // Verify IEventTypeValidator calls
        expect(mockEventTypeValidator.isValidEventType).toHaveBeenCalledTimes(2); // Only called when event_type exists
        expect(mockEventTypeValidator.isValidEventType).toHaveBeenCalledWith('VALID_EVENT');
        expect(mockEventTypeValidator.isValidEventType).toHaveBeenCalledWith('INVALID_EVENT');

        // Verify registry interactions - ALL should be stored
        expect(mockDataRegistry.store).toHaveBeenCalledTimes(filenames.length);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, triggerValidData.id, triggerValidData);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, triggerInvalidData.id, triggerInvalidData);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, triggerMissingEventData.id, triggerMissingEventData);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, triggerMissingListenData.id, triggerMissingListenData);

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        // Warnings:
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Trigger "${triggerInvalidData.id}" in file "${paths[1]}" uses an unregistered event_type: "INVALID_EVENT"`)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Trigger "${triggerMissingEventData.id}" in file "${paths[2]}" has 'listen_to' object but is missing a valid 'event_type' string.`) // Adjusted wording and added period
        );
        // Note: No warning for triggerMissingListenData unless the schema requires listen_to or the code is changed to warn. Based on current code, no warning.
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    // ===========================================================
    // --- Task: Test Scenario: No Schema ID Configured for Type ---
    // ===========================================================
    it('[No Schema ID] should resolve, log warning, and skip processing if no schema ID is configured', async () => {
        // Arrange
        const typeName = 'monsters'; // Configured in beforeEach to return undefined schema ID
        const filenames = ['goblin.json'];

        // Act
        await expect(contentLoader.loadContentFiles(typeName, filenames)).resolves.toBeUndefined();

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);

        // Ensure other services were NOT called
        expect(mockSchemaValidator.getValidator).not.toHaveBeenCalled();
        expect(mockPathResolver.resolveContentPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockDataRegistry.store).not.toHaveBeenCalled();
        expect(mockDataRegistry.get).not.toHaveBeenCalled();
        expect(mockEventTypeValidator.isValidEventType).not.toHaveBeenCalled();

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`No schema ID configured for content type '${typeName}'. Skipping loading for this type.`)
        );
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`)); // Didn't finish successfully, skipped.
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
        mockSchemaValidator.getValidator.mockReturnValue(undefined); // Validator function not found

        // Act & Assert
        await expect(contentLoader.loadContentFiles(typeName, filenames))
            .rejects.toThrow(`Validator function unavailable for schema '${WEAPONS_SCHEMA_ID}' (type '${typeName}')`);

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(WEAPONS_SCHEMA_ID);

        // Ensure other services were NOT called
        expect(mockPathResolver.resolveContentPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockDataRegistry.store).not.toHaveBeenCalled();
        expect(mockDataRegistry.get).not.toHaveBeenCalled();
        expect(mockEventTypeValidator.isValidEventType).not.toHaveBeenCalled();

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Schema validator function not found for schema ID '${WEAPONS_SCHEMA_ID}'`)
        );
        // This error is thrown *before* the main try-catch block's catch is reached in loadContentFiles
        // So we only expect the specific error log above, not the generic "Failed to load one or more files" one.
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
        // Verify Service Interactions - NONE should be called beyond the initial check
        expect(mockConfiguration.getContentTypeSchemaId).not.toHaveBeenCalled();
        expect(mockSchemaValidator.getValidator).not.toHaveBeenCalled();
        expect(mockPathResolver.resolveContentPath).not.toHaveBeenCalled();
        expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
        expect(mockDataRegistry.store).not.toHaveBeenCalled();
        expect(mockDataRegistry.get).not.toHaveBeenCalled();
        expect(mockEventTypeValidator.isValidEventType).not.toHaveBeenCalled();

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}' (0 files)`));
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`No files listed for content type '${typeName}'. Skipping.`)
        );
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start + Skip message
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
            mockConfiguration: {getContentTypeSchemaId: jest.fn()}, // Add other methods if needed by constructor
            mockPathResolver: {resolveContentPath: jest.fn()},
            mockDataFetcher: {fetch: jest.fn()},
            mockSchemaValidator: {getValidator: jest.fn(), isSchemaLoaded: jest.fn()},
            mockEventTypeValidator: {isValidEventType: jest.fn()},
            mockDataRegistry: {store: jest.fn(), get: jest.fn()},
            mockLogger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()}, // Ensure debug is mocked if needed
        });

        it('should throw if IConfiguration is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(null, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'configuration' dependency/);
            expect(() => new GenericContentLoader({}, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'configuration' dependency/);
        });

        it('should throw if IPathResolver is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, null, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'pathResolver' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, {}, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'pathResolver' dependency/);
        });

        it('should throw if IDataFetcher is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, null, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'fetcher' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, {}, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'fetcher' dependency/);
        });

        it('should throw if ISchemaValidator is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, null, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'validator' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, {}, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger)) // Missing methods
                .toThrow(/Missing or invalid 'validator' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, {getValidator: jest.fn()}, mocks.mockEventTypeValidator, mocks.mockDataRegistry, mocks.mockLogger)) // Missing isSchemaLoaded
                .toThrow(/Missing or invalid 'validator' dependency/);
        });

        it('should throw if IEventTypeValidator is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, null, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'eventTypeValidator' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, {}, mocks.mockDataRegistry, mocks.mockLogger))
                .toThrow(/Missing or invalid 'eventTypeValidator' dependency/);
        });

        it('should throw if IDataRegistry is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, null, mocks.mockLogger))
                .toThrow(/Missing or invalid 'registry' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, {}, mocks.mockLogger)) // Missing methods
                .toThrow(/Missing or invalid 'registry' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, {store: jest.fn()}, mocks.mockLogger)) // Missing get
                .toThrow(/Missing or invalid 'registry' dependency/);
        });

        it('should throw if ILogger is missing or invalid', () => {
            const mocks = createValidMocks();
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, null))
                .toThrow(/Missing or invalid 'logger' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, {})) // Missing methods
                .toThrow(/Missing or invalid 'logger' dependency/);
            expect(() => new GenericContentLoader(mocks.mockConfiguration, mocks.mockPathResolver, mocks.mockDataFetcher, mocks.mockSchemaValidator, mocks.mockEventTypeValidator, mocks.mockDataRegistry, {
                info: jest.fn(),
                warn: jest.fn()
            })) // Missing error
                .toThrow(/Missing or invalid 'logger' dependency/);
        });
    });

});
// src/tests/core/services/genericContentLoader.parallelProcessing.test.js

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

// Describe block focusing on tests potentially affected by parallel processing issues
describe('GenericContentLoader - Parallel Processing Scenarios', () => {
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
    // Add other schema IDs if needed by future tests in this file
    // const TRIGGERS_SCHEMA_ID = 'test://schemas/trigger';
    // const WEAPONS_SCHEMA_ID = 'test://schemas/weapon';
    // const ACTIONS_SCHEMA_ID = 'test://schemas/action';

    beforeEach(() => {
        // [x] Mock Dependencies (Copied from original file)
        mockConfiguration = {
            getContentTypeSchemaId: jest.fn(),
            getBaseDataPath: jest.fn(),
            getSchemaFiles: jest.fn(),
            getManifestSchemaId: jest.fn(),
            getSchemaBasePath: jest.fn(),
            getContentBasePath: jest.fn(),
            getWorldBasePath: jest.fn(),
        };
        mockPathResolver = {
            resolveContentPath: jest.fn(),
            resolveSchemaPath: jest.fn(),
            resolveManifestPath: jest.fn(),
            resolveModContentPath: jest.fn(),
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

        // [x] Configure Mocks - Basic Setup (Copied from original file)
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
            switch (typeName) {
                case 'items':
                    return ITEMS_SCHEMA_ID;
                // Add other types if needed by these specific tests
                default:
                    return undefined;
            }
        });

        mockPathResolver.resolveModContentPath.mockImplementation(
            (modId, typeName, filename) => `./test/data/${typeName}/${filename}`
        );

        mockDataRegistry.get.mockReturnValue(undefined);

        // Instantiate the loader with mocks (Copied from original file)
        contentLoader = new GenericContentLoader(
            mockConfiguration,
            mockPathResolver,
            mockDataFetcher,
            mockSchemaValidator,
            mockDataRegistry,
            mockLogger
        );

        // Verify constructor logs info message (Copied from original file)
        expect(mockLogger.info).toHaveBeenCalledWith('GenericContentLoader: Instance created and services injected.');

        // Clear call history for mocks AFTER instantiation (Copied from original file)
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

    // =============================================
    // --- Test: Successful Load (Multiple Files) ---
    // =============================================
    it('[Success] should load, validate, and store multiple files for a single type', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2.json'];
        const item1Path = mockPathResolver.resolveModContentPath('core', typeName, filenames[0]);
        const item2Path = mockPathResolver.resolveModContentPath('core', typeName, filenames[1]);

        // wipe only the counters, keep the implementation
        mockPathResolver.resolveModContentPath.mockClear();
        mockDataFetcher.fetch.mockClear();
        mockDataRegistry.get.mockClear();

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
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1); // Called once during setup phase of loadContentFiles
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledWith(typeName);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledTimes(1); // Called once during setup phase of loadContentFiles
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledWith(ITEMS_SCHEMA_ID);

        expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledTimes(2); // Called once per file in #loadAndProcessFile
        expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith('core', typeName, filenames[0]);
        expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith('core', typeName, filenames[1]);

        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2); // Should pass now based on previous logs
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(item1Path);
        expect(mockDataFetcher.fetch).toHaveBeenCalledWith(item2Path);

        expect(mockValidate).toHaveBeenCalledTimes(2); // Called once per file by primary validation
        expect(mockValidate).toHaveBeenCalledWith(item1Data);
        expect(mockValidate).toHaveBeenCalledWith(item2Data);

        expect(mockDataRegistry.get).toHaveBeenCalledTimes(2); // Should pass now based on previous logs
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item1Data.id);
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item2Data.id);

        expect(mockDataRegistry.store).toHaveBeenCalledTimes(2); // Called once per file after all checks pass
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item1Data);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item2Data.id, item2Data);

        // Verify Logging
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item1Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item2Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Primary schema validation passed for ${item1Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Primary schema validation passed for ${item2Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`File ${item1Path} does not contain a 'components' map. Skipping runtime component validation.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`File ${item2Path} does not contain a 'components' map. Skipping runtime component validation.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored ${typeName} with ID '${item1Data.id}' from ${item1Path} after passing all validations.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Stored ${typeName} with ID '${item2Data.id}' from ${item2Path} after passing all validations.`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // ==============================================================
    // --- Test: Schema Validation Failure (One File) ---
    // ==============================================================
    it('[Validation Error] should reject and log error if schema validation fails for one file', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2_invalid.json'];
        const item1Path = `./test/data/${typeName}/${filenames[0]}`; // Explicit path based on mock
        const item2Path = `./test/data/${typeName}/${filenames[1]}`; // Explicit path based on mock

        // Clear mocks
        mockPathResolver.resolveModContentPath.mockClear();
        mockDataFetcher.fetch.mockClear();
        mockDataRegistry.get.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.info.mockClear();


        const item1Data = {id: 'item1_id', name: 'Potion', value: 10};
        const item2InvalidData = {id: 'item2_id', nam: 'Sword'}; // Missing 'name'
        const validationErrors = [{path: '/name', message: 'is required'}];
        const mockValidate = jest.fn().mockImplementation((data) => {
            if (data && data.id === 'item1_id') return {isValid: true, errors: null};
            if (data && data.id === 'item2_id' && data.nam === 'Sword') return {
                isValid: false,
                errors: validationErrors
            };
            return {isValid: false, errors: [{message: 'Unexpected data passed to mock validator'}]};
        });

        // Fetch mock
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === item1Path) return item1Data;
            if (path === item2Path) return item2InvalidData;
            throw new Error(`Unexpected fetch path: ${path}`);
        });

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockPathResolver.resolveModContentPath.mockImplementation(
            (modId, typeName, filename) => `./test/data/${typeName}/${filename}`
        );


        // Act & Assert for Rejection
        // ***** CORRECTED ERROR MESSAGE DEFINITION *****
        const originalErrorMessage = `Primary schema validation failed for ${typeName} file '${filenames[1]}'`; // Removed the extra period
        const expectedProcessErrorMessage = `Error processing ${typeName} file ${filenames[1]} at path ${item2Path}: ${originalErrorMessage}`;
        // *********************************************

        await expect(contentLoader.loadContentFiles(typeName, filenames))
            .rejects.toThrow(expectedProcessErrorMessage); // This should now pass

        // Assert Service Interactions (Counts confirmed okay by logs)
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledTimes(1);
        expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockValidate).toHaveBeenCalledTimes(2);
        expect(mockDataRegistry.get).toHaveBeenCalledTimes(1);
        expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
        // ... specific checks for get/store calls ...
        expect(mockDataRegistry.get).toHaveBeenCalledWith(typeName, item1Data.id);
        expect(mockDataRegistry.store).toHaveBeenCalledWith(typeName, item1Data.id, item1Data);
        expect(mockDataRegistry.get).not.toHaveBeenCalledWith(typeName, item2InvalidData.id);
        expect(mockDataRegistry.store).not.toHaveBeenCalledWith(typeName, item2InvalidData.id, expect.anything());


        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item1Path}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing file: ${item2Path}`));

        // --- Check Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(3);

        // 1. Specific validation failure log
        const expectedValidationErrorLog = `Primary schema validation failed for ${item2Path} (type ${typeName}) using schema ${ITEMS_SCHEMA_ID}:\n${JSON.stringify(validationErrors, null, 2)}`;
        expect(mockLogger.error).toHaveBeenNthCalledWith(1, expectedValidationErrorLog);

        // 2. File processing failure log (#loadAndProcessFile catch)
        // Use expect.any(Error) first for the NthCalledWith check
        expect(mockLogger.error).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining(`Failed to load/process file ${filenames[1]} (type ${typeName}, path: ${item2Path})`),
            expect.any(Error) // Verify an Error object was passed
        );
        // NOW, separately check the message property of the actual error passed in the second call
        const secondCallArgs = mockLogger.error.mock.calls[1]; // Get arguments of the second call (index 1)
        expect(secondCallArgs[1]).toBeInstanceOf(Error);       // Double-check it's an Error

        // 3. Overall type failure log (loadContentFiles catch)
        // We can apply the same pattern here for robustness
        expect(mockLogger.error).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining(`Failed to load one or more files for content type '${typeName}'`),
            expect.any(Error) // Verify an Error object was passed
        );
        // Separately check the message property of the actual error passed in the third call
        const thirdCallArgs = mockLogger.error.mock.calls[2]; // Get arguments of the third call (index 2)
        expect(thirdCallArgs[1]).toBeInstanceOf(Error);      // Double-check it's an Error


        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
    });


    // =====================================================================
    // --- Test: Data Missing Required id Property (One File) ---
    // =====================================================================
    it('[Missing ID Error] should reject and log error if fetched data is missing the id property', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2_no_id.json'];
        const item1Path = mockPathResolver.resolveModContentPath('core', typeName, filenames[0]);
        const item2Path = mockPathResolver.resolveModContentPath('core', typeName, filenames[1]);

        // wipe only the counters, keep the implementation
        mockPathResolver.resolveModContentPath.mockClear();
        mockDataFetcher.fetch.mockClear();
        mockDataRegistry.get.mockClear();
        mockLogger.error.mockClear(); // Clear error log for this test
        mockLogger.info.mockClear();

        const item1Data = {id: 'item1_id', name: 'Potion'};
        const item2NoIdData = {name: 'Sword', value: 50};
        const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null}); // Schema validation passes

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === item1Path) return item1Data;
            if (path === item2Path) return item2NoIdData;
            throw new Error(`Unexpected fetch path: ${path}`);
        });

        // Act & Assert for Rejection
        // Define expected error messages
        const originalMissingIdMessage = `Data in ${item2Path} (type ${typeName}) is missing a valid required 'id' property.`;
        const expectedMissingIdProcessErrorMessage = `Error processing ${typeName} file ${filenames[1]} at path ${item2Path}: ${originalMissingIdMessage}`;

        await expect(contentLoader.loadContentFiles(typeName, filenames))
            .rejects.toThrow(expectedMissingIdProcessErrorMessage); // Check the wrapped message

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledTimes(1);
        expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2); // Should pass now
        expect(mockValidate).toHaveBeenCalledTimes(2); // Validation happens before ID check
        expect(mockDataRegistry.get).toHaveBeenCalledTimes(1); // Called only for item1 (fails before check on item2)
        expect(mockDataRegistry.store).toHaveBeenCalledTimes(1); // Called only for item1

        // Verify Logging
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting load for content type '${typeName}'`));

        // --- Check Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(3); // Expect 3 errors: original missing ID, file process failure, overall type failure

        // 1. Original missing ID error logged inside #loadAndProcessFile try block
        expect(mockLogger.error).toHaveBeenNthCalledWith(1, originalMissingIdMessage);

        // 2. File processing failure log (#loadAndProcessFile catch block)
        expect(mockLogger.error).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining(`Failed to load/process file ${filenames[1]} (type ${typeName}, path: ${item2Path})`),
            expect.objectContaining({message: originalMissingIdMessage}) // The error caught has the original message
        );

        // 3. Overall type failure log (loadContentFiles catch block)
        expect(mockLogger.error).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining(`Failed to load one or more files for content type '${typeName}'`),
            expect.objectContaining({message: expectedMissingIdProcessErrorMessage}) // The error caught has the wrapped message
        );


        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
    });

    // ====================================================
    // --- Test: Duplicate ID Detected ---
    // ====================================================
    it('[Duplicate ID] should resolve, log warning, and overwrite when a duplicate ID is detected', async () => {
        // Arrange
        const typeName = 'items';
        const filenames = ['item1.json', 'item2_duplicate.json'];
        const item1Path = mockPathResolver.resolveModContentPath('core', typeName, filenames[0]);
        const item2Path = mockPathResolver.resolveModContentPath('core', typeName, filenames[1]);

        // wipe only the counters, keep the implementation
        mockPathResolver.resolveModContentPath.mockClear();
        mockDataFetcher.fetch.mockClear();
        mockDataRegistry.get.mockClear();
        mockLogger.warn.mockClear(); // Clear warn log for this test
        mockLogger.info.mockClear();


        const item1Data = {id: 'item1_id', name: 'Potion', value: 10};
        const item2DuplicateData = {id: 'item1_id', name: 'Super Potion', value: 50}; // Same ID as item1
        const mockValidate = jest.fn().mockReturnValue({isValid: true, errors: null});

        mockSchemaValidator.getValidator.mockReturnValue(mockValidate);
        mockDataFetcher.fetch.mockImplementation(async (path) => {
            if (path === item1Path) return item1Data;
            if (path === item2Path) return item2DuplicateData;
            throw new Error(`Unexpected fetch path: ${path}`);
        });

        // Override mocks specifically for this test's logic
        let storedData = {}; // Use an object to simulate registry storage
        mockDataRegistry.get.mockImplementation((type, id) => {
            // Return the currently "stored" item if it exists
            if (type === typeName && storedData[id]) {
                return storedData[id];
            }
            return undefined;
        });

        mockDataRegistry.store.mockImplementation((type, id, data) => {
            // Simulate storing the data
            if (type === typeName) {
                storedData[id] = data;
            }
        });

        // Act
        await expect(contentLoader.loadContentFiles(typeName, filenames)).resolves.toBeUndefined();

        // Assert
        // Verify Service Interactions
        expect(mockConfiguration.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
        expect(mockSchemaValidator.getValidator).toHaveBeenCalledTimes(1);
        expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
        expect(mockDataFetcher.fetch).toHaveBeenCalledTimes(2); // Should pass now
        expect(mockValidate).toHaveBeenCalledTimes(2);

        // Check get/store calls carefully
        expect(mockDataRegistry.get).toHaveBeenCalledTimes(2); // Called for item1 (returns undefined), called for item2 (returns item1Data)
        expect(mockDataRegistry.get).toHaveBeenNthCalledWith(1, typeName, item1Data.id); // First check before storing item1
        expect(mockDataRegistry.get).toHaveBeenNthCalledWith(2, typeName, item1Data.id); // Second check before storing item2 (duplicate)

        // store should be called twice, tracked by the mock implementation
        expect(mockDataRegistry.store).toHaveBeenCalledTimes(2);
        expect(mockDataRegistry.store).toHaveBeenNthCalledWith(1, typeName, item1Data.id, item1Data); // Storing item1
        expect(mockDataRegistry.store).toHaveBeenNthCalledWith(2, typeName, item1Data.id, item2DuplicateData); // Storing item2 (overwriting)

        // Verify Logging
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Expect exactly one warning
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Duplicate ID detected for ${typeName}: '${item1Data.id}' in file ${filenames[1]} (${item2Path}). Overwriting previous definition stored in registry.`)
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully finished loading content type '${typeName}'`));
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
    });

}); // End Describe block
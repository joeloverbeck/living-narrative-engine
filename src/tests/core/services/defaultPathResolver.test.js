// src/tests/core/services/defaultPathResolver.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import DefaultPathResolver from '../../../core/services/defaultPathResolver.js'; // Adjust path if necessary

// Mock interface for type clarity, actual implementation uses Jest mocks
/**
 * @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration
 */

describe('DefaultPathResolver', () => {
    /** @type {jest.Mocked<IConfiguration>} */
    let mockConfig;
    /** @type {DefaultPathResolver} */
    let resolver;

    // Base paths for mocking
    const MOCK_SCHEMA_BASE = '/mock/base/schemas';
    const MOCK_WORLD_BASE = '/mock/base/worlds';
    const MOCK_CONTENT_BASE_FN = (typeName) => `/mock/base/content/${typeName}`; // Keep generic mock
    const MOCK_BASE_DATA_PATH = '/mock/base'; // Added for completeness
    const MOCK_GAME_CONFIG_FILENAME = 'game.conf.json'; // Added for completeness

    beforeEach(() => {
        // Create a fresh mock configuration before each test
        mockConfig = {
            // Mock all methods REQUIRED by the DefaultPathResolver constructor
            getBaseDataPath: jest.fn(),
            getSchemaBasePath: jest.fn(),
            getWorldBasePath: jest.fn(),
            getContentBasePath: jest.fn(),
            getGameConfigFilename: jest.fn(),

            // Add other IConfiguration methods as undefined or jest.fn() if needed elsewhere
            // For THESE tests, only the ones above are strictly needed by the constructor
            getSchemaFiles: jest.fn(),
            getContentTypeSchemaId: jest.fn(),
            getManifestSchemaId: jest.fn(), // Assuming this isn't used by DefaultPathResolver
            // getRuleBasePath: jest.fn(), // Mock if resolveRulePath is used/tested
        };

        // Default successful mock implementations
        mockConfig.getBaseDataPath.mockReturnValue(MOCK_BASE_DATA_PATH);
        mockConfig.getSchemaBasePath.mockReturnValue(MOCK_SCHEMA_BASE);
        mockConfig.getWorldBasePath.mockReturnValue(MOCK_WORLD_BASE);
        mockConfig.getContentBasePath.mockImplementation(MOCK_CONTENT_BASE_FN);
        mockConfig.getGameConfigFilename.mockReturnValue(MOCK_GAME_CONFIG_FILENAME);
    });

    // --- Task 3: Test Constructor ---
    describe('constructor', () => {
        it('should instantiate successfully with a valid IConfiguration object', () => {
            expect(() => new DefaultPathResolver(mockConfig)).not.toThrow();
        });

        it('should throw an Error if configurationService is null', () => {
            const expectedErrorMsg = /requires an IConfiguration instance/;
            expect(() => new DefaultPathResolver(null)).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService is undefined', () => {
            const expectedErrorMsg = /requires an IConfiguration instance/;
            expect(() => new DefaultPathResolver(undefined)).toThrow(expectedErrorMsg);
        });

        // --- UPDATED/CORRECTED TESTS ---

        it('should throw an Error if configurationService is missing getSchemaBasePath', () => {
            // Expect the specific error message for the missing method
            const expectedErrorMsg = /requires a valid IConfiguration service instance with a `getSchemaBasePath` method/;
            // Create incomplete config ensuring other required methods exist
            const incompleteConfig = {
                ...mockConfig, // Spread valid mocks first
                getSchemaBasePath: undefined // Make the target method undefined
            };
            expect(() => new DefaultPathResolver(/** @type {any} */ (incompleteConfig))).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService is missing getContentBasePath', () => {
            // Expect the specific error message for the missing method
            const expectedErrorMsg = /requires a valid IConfiguration service instance with a `getContentBasePath` method/;
            // Create incomplete config ensuring other required methods exist
            const incompleteConfig = {
                ...mockConfig, // Spread valid mocks first
                getContentBasePath: undefined // Make the target method undefined
            };
            expect(() => new DefaultPathResolver(/** @type {any} */ (incompleteConfig))).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService methods are not functions', () => {
            // Expect the specific error message for the FIRST invalid method encountered
            const expectedErrorMsg = /requires a valid IConfiguration service instance with a `getSchemaBasePath` method/;
            // Create invalid config ensuring other required methods are valid functions
            const invalidConfig = {
                ...mockConfig, // Spread valid mocks first
                getSchemaBasePath: 'not-a-function', // Make the target method invalid
                // Ensure other methods checked by the constructor are valid functions
                // These are inherited from mockConfig via spread:
                // getBaseDataPath: jest.fn(),
                // getWorldBasePath: jest.fn(),
                // getContentBasePath: jest.fn(),
                // getGameConfigFilename: jest.fn(),
            };
            expect(() => new DefaultPathResolver(/** @type {any} */ (invalidConfig))).toThrow(expectedErrorMsg);
        });
        // --- END UPDATED/CORRECTED TESTS ---

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
            const expectedPath = `${MOCK_BASE_DATA_PATH}${MOCK_SCHEMA_BASE}/${filename}`.replace(/\/{2,}/g, '/'); // Basic normalization
            const actualPath = resolver.resolveSchemaPath(filename);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getSchemaBasePath).toHaveBeenCalledTimes(1);
        });

        it('should handle filenames with leading/trailing spaces (trimming is done by validation)', () => {
            const filename = ' spaced_schema.json ';
            const expectedPath = `${MOCK_BASE_DATA_PATH}${MOCK_SCHEMA_BASE}/${filename}`.replace(/\/{2,}/g, '/');
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
            expect(() => resolver.resolveSchemaPath(undefined)).toThrow(expectedErrorMsg);
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

    // --- Task 5: Test resolveManifestPath ---
    describe('resolveManifestPath', () => {
        beforeEach(() => {
            resolver = new DefaultPathResolver(mockConfig);
        });

        it('should return the correct manifest path for a valid world name', () => {
            const worldName = 'demo';
            const expectedFilename = `${worldName}.world.json`;
            const expectedPath = `${MOCK_BASE_DATA_PATH}${MOCK_WORLD_BASE}/${expectedFilename}`.replace(/\/{2,}/g, '/');
            const actualPath = resolver.resolveManifestPath(worldName);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getWorldBasePath).toHaveBeenCalledTimes(1);
        });

        it('should handle world names with spaces (trimming done by validation)', () => {
            const worldName = ' my world ';
            const expectedFilename = `${worldName}.world.json`;
            const expectedPath = `${MOCK_BASE_DATA_PATH}${MOCK_WORLD_BASE}/${expectedFilename}`.replace(/\/{2,}/g, '/');
            expect(resolver.resolveManifestPath(worldName)).toBe(expectedPath);
            expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getWorldBasePath).toHaveBeenCalledTimes(1);
        });

        it('should throw an Error for an empty string worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath('')).toThrow(expectedErrorMsg);
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a worldName containing only spaces', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath('  ')).toThrow(expectedErrorMsg);
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a null worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath(null)).toThrow(expectedErrorMsg);
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for an undefined worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath(undefined)).toThrow(expectedErrorMsg);
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a non-string worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath({name: 'world'})).toThrow(expectedErrorMsg);
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });
    });

    // --- Task 6: Test resolveContentPath ---
    describe('resolveContentPath', () => {
        beforeEach(() => {
            resolver = new DefaultPathResolver(mockConfig);
        });

        it('should return the correct content path for a valid type and filename (items)', () => {
            const typeName = 'items';
            const filename = 'potion.json';
            const expectedContentDir = MOCK_CONTENT_BASE_FN(typeName); // e.g., /mock/base/content/items
            const expectedPath = `${MOCK_BASE_DATA_PATH}${expectedContentDir}/${filename}`.replace(/\/{2,}/g, '/');
            const actualPath = resolver.resolveContentPath(typeName, filename);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(typeName);
        });

        it('should return the correct content path for a valid type and filename (actions)', () => {
            const typeName = 'actions';
            const filename = 'attack.json';
            const expectedContentDir = MOCK_CONTENT_BASE_FN(typeName);
            const expectedPath = `${MOCK_BASE_DATA_PATH}${expectedContentDir}/${filename}`.replace(/\/{2,}/g, '/');
            const actualPath = resolver.resolveContentPath(typeName, filename);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(typeName);
        });

        // --- Ticket 2.1.2 Test ---
        it('should return the correct content path for component definitions (typeName = "components")', () => {
            const typeName = 'components'; // Specific typeName for component definitions
            const filename = 'core_health.component.json';
            const expectedContentDir = MOCK_CONTENT_BASE_FN(typeName);
            const expectedPath = `${MOCK_BASE_DATA_PATH}${expectedContentDir}/${filename}`.replace(/\/{2,}/g, '/');
            const actualPath = resolver.resolveContentPath(typeName, filename);

            expect(actualPath).toBe(expectedPath);
            // Verify the mock was called correctly for this typeName
            expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(typeName);
        });
        // --- End Ticket 2.1.2 Test ---


        it('should handle typeName and filename with spaces (trimming done by validation)', () => {
            const typeName = ' spaced type ';
            const filename = ' spaced file.json ';
            const expectedContentDir = MOCK_CONTENT_BASE_FN(typeName);
            const expectedPath = `${MOCK_BASE_DATA_PATH}${expectedContentDir}/${filename}`.replace(/\/{2,}/g, '/');
            const actualPath = resolver.resolveContentPath(typeName, filename);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getBaseDataPath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(typeName);
        });

        // Invalid typeName cases
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['empty string', ''],
            ['spaces only', '   '],
            ['non-string', 123]
        ])('should throw an Error for invalid typeName (%s)', (desc, invalidType) => {
            const filename = 'valid.json';
            const expectedErrorMsg = /Invalid or empty typeName provided/;
            expect(() => resolver.resolveContentPath(invalidType, filename)).toThrow(expectedErrorMsg);
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getContentBasePath).not.toHaveBeenCalled();
        });

        // Invalid filename cases
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['empty string', ''],
            ['spaces only', '   '],
            ['non-string', false]
        ])('should throw an Error for invalid filename (%s)', (desc, invalidFilename) => {
            const typeName = 'validType';
            const expectedErrorMsg = /Invalid or empty filename provided/;

            // Wrap the actual call and the check in the expect().toThrow block
            expect(() => {
                // Reset mock *just before* the call within this specific test context
                // Note: No need to reset getBaseDataPath as it shouldn't be called if validation fails early
                mockConfig.getContentBasePath.mockClear();
                resolver.resolveContentPath(typeName, invalidFilename);
            }).toThrow(expectedErrorMsg);

            // Verify that neither config method was called because validation failed first
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getContentBasePath).not.toHaveBeenCalled();
        });

        it('should throw typeName error if both typeName and filename are invalid (typeName checked first)', () => {
            const expectedErrorMsg = /Invalid or empty typeName provided/;
            expect(() => resolver.resolveContentPath('', '')).toThrow(expectedErrorMsg);
            expect(mockConfig.getBaseDataPath).not.toHaveBeenCalled();
            expect(mockConfig.getContentBasePath).not.toHaveBeenCalled();
        });
    });

    // Add similar test suites for resolveGameConfigPath and resolveRulePath if needed
});
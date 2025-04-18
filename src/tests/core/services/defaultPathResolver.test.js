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
    const MOCK_CONTENT_BASE_FN = (typeName) => `/mock/base/content/${typeName}`;

    beforeEach(() => {
        // Create a fresh mock configuration before each test
        mockConfig = {
            // We only need to mock the methods used by DefaultPathResolver
            getSchemaBasePath: jest.fn(),
            getWorldBasePath: jest.fn(),
            getContentBasePath: jest.fn(),
            // Add other IConfiguration methods as undefined or jest.fn() if strict typing requires them elsewhere,
            // but they aren't needed for *this* class's tests.
            getBaseDataPath: jest.fn(),
            getSchemaFiles: jest.fn(),
            getContentTypeSchemaId: jest.fn(),
            getManifestSchemaId: jest.fn(),
        };

        // Default successful mock implementations
        mockConfig.getSchemaBasePath.mockReturnValue(MOCK_SCHEMA_BASE);
        mockConfig.getWorldBasePath.mockReturnValue(MOCK_WORLD_BASE);
        mockConfig.getContentBasePath.mockImplementation(MOCK_CONTENT_BASE_FN);
    });

    // --- Task 3: Test Constructor ---
    describe('constructor', () => {
        it('should instantiate successfully with a valid IConfiguration object', () => {
            expect(() => new DefaultPathResolver(mockConfig)).not.toThrow();
        });

        it('should throw an Error if configurationService is null', () => {
            const expectedErrorMsg = /requires a valid IConfiguration service instance/;
            expect(() => new DefaultPathResolver(null)).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService is undefined', () => {
            const expectedErrorMsg = /requires a valid IConfiguration service instance/;
            expect(() => new DefaultPathResolver(undefined)).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService is missing getSchemaBasePath', () => {
            const expectedErrorMsg = /requires a valid IConfiguration service instance.*getSchemaBasePath/;
            const incompleteConfig = {...mockConfig, getSchemaBasePath: undefined};
            // Need to cast as any because TS knows it's incomplete
            expect(() => new DefaultPathResolver(/** @type {any} */ (incompleteConfig))).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService is missing getWorldBasePath', () => {
            const expectedErrorMsg = /requires a valid IConfiguration service instance.*getWorldBasePath/;
            const incompleteConfig = {...mockConfig, getWorldBasePath: undefined};
            expect(() => new DefaultPathResolver(/** @type {any} */ (incompleteConfig))).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService is missing getContentBasePath', () => {
            const expectedErrorMsg = /requires a valid IConfiguration service instance.*getContentBasePath/;
            const incompleteConfig = {...mockConfig, getContentBasePath: undefined};
            expect(() => new DefaultPathResolver(/** @type {any} */ (incompleteConfig))).toThrow(expectedErrorMsg);
        });

        it('should throw an Error if configurationService methods are not functions', () => {
            const expectedErrorMsg = /requires a valid IConfiguration service instance/;
            const invalidConfig = {
                getSchemaBasePath: 'not-a-function',
                getWorldBasePath: jest.fn(),
                getContentBasePath: jest.fn(),
            };
            expect(() => new DefaultPathResolver(/** @type {any} */ (invalidConfig))).toThrow(expectedErrorMsg);
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
            const expectedPath = `${MOCK_SCHEMA_BASE}/${filename}`;
            const actualPath = resolver.resolveSchemaPath(filename);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getSchemaBasePath).toHaveBeenCalledTimes(1);
        });

        it('should handle filenames with leading/trailing spaces (trimming is implicit in check)', () => {
            // The code checks `filename.trim() === ''`, so spaces are allowed if the name isn't *only* spaces
            const filename = ' spaced_schema.json ';
            const expectedPath = `${MOCK_SCHEMA_BASE}/${filename}`; // Path retains spaces
            expect(resolver.resolveSchemaPath(filename)).toBe(expectedPath);
            expect(mockConfig.getSchemaBasePath).toHaveBeenCalledTimes(1);
        });

        it('should throw an Error for an empty string filename', () => {
            const expectedErrorMsg = /Invalid or empty filename provided/;
            expect(() => resolver.resolveSchemaPath('')).toThrow(expectedErrorMsg);
            expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a filename containing only spaces', () => {
            const expectedErrorMsg = /Invalid or empty filename provided/;
            expect(() => resolver.resolveSchemaPath('   ')).toThrow(expectedErrorMsg);
            expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a null filename', () => {
            const expectedErrorMsg = /Invalid or empty filename provided/;
            expect(() => resolver.resolveSchemaPath(null)).toThrow(expectedErrorMsg);
            expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for an undefined filename', () => {
            const expectedErrorMsg = /Invalid or empty filename provided/;
            expect(() => resolver.resolveSchemaPath(undefined)).toThrow(expectedErrorMsg);
            expect(mockConfig.getSchemaBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a non-string filename', () => {
            const expectedErrorMsg = /Invalid or empty filename provided/;
            expect(() => resolver.resolveSchemaPath(123)).toThrow(expectedErrorMsg);
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
            const expectedPath = `${MOCK_WORLD_BASE}/${worldName}.world.json`;
            const actualPath = resolver.resolveManifestPath(worldName);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getWorldBasePath).toHaveBeenCalledTimes(1);
        });

        it('should handle world names with spaces (trimming is implicit in check)', () => {
            const worldName = ' my world ';
            const expectedPath = `${MOCK_WORLD_BASE}/${worldName}.world.json`; // Path retains spaces
            expect(resolver.resolveManifestPath(worldName)).toBe(expectedPath);
            expect(mockConfig.getWorldBasePath).toHaveBeenCalledTimes(1);
        });

        it('should throw an Error for an empty string worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath('')).toThrow(expectedErrorMsg);
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a worldName containing only spaces', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath('  ')).toThrow(expectedErrorMsg);
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a null worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath(null)).toThrow(expectedErrorMsg);
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for an undefined worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath(undefined)).toThrow(expectedErrorMsg);
            expect(mockConfig.getWorldBasePath).not.toHaveBeenCalled();
        });

        it('should throw an Error for a non-string worldName', () => {
            const expectedErrorMsg = /Invalid or empty worldName provided/;
            expect(() => resolver.resolveManifestPath({name: 'world'})).toThrow(expectedErrorMsg);
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
            const expectedPath = `${MOCK_CONTENT_BASE_FN(typeName)}/${filename}`; // e.g., /mock/base/content/items/potion.json
            const actualPath = resolver.resolveContentPath(typeName, filename);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(typeName);
        });

        it('should return the correct content path for a valid type and filename (actions)', () => {
            const typeName = 'actions';
            const filename = 'attack.json';
            const expectedPath = `${MOCK_CONTENT_BASE_FN(typeName)}/${filename}`; // e.g., /mock/base/content/actions/attack.json
            const actualPath = resolver.resolveContentPath(typeName, filename);

            expect(actualPath).toBe(expectedPath);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledTimes(1);
            expect(mockConfig.getContentBasePath).toHaveBeenCalledWith(typeName);
        });

        it('should handle typeName and filename with spaces (trimming implicit)', () => {
            const typeName = ' spaced type ';
            const filename = ' spaced file.json ';
            const expectedPath = `${MOCK_CONTENT_BASE_FN(typeName)}/${filename}`;
            const actualPath = resolver.resolveContentPath(typeName, filename);

            expect(actualPath).toBe(expectedPath);
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
            expect(() => resolver.resolveContentPath(typeName, invalidFilename)).toThrow(expectedErrorMsg);
            // Note: The typeName check happens *before* the filename check in the code
            // So, getContentBasePath might still be called if the typeName *was* valid before the filename check failed.
            // However, the primary check here is that the correct error is thrown *because* of the filename.
            // Let's check the error message is correct, and we don't really care about the mock call here as much.
        });

        it('should throw typeName error if both typeName and filename are invalid (typeName checked first)', () => {
            const expectedErrorMsg = /Invalid or empty typeName provided/;
            expect(() => resolver.resolveContentPath('', '')).toThrow(expectedErrorMsg);
            expect(mockConfig.getContentBasePath).not.toHaveBeenCalled();
        });
    });
});
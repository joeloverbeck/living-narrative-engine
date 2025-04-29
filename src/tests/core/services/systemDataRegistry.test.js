// src/tests/core/services/systemDataRegistry.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SystemDataRegistry } from '../../../core/services/systemDataRegistry.js'; // Adjust path as needed

// --- Mock Implementations ---

/**
 * Creates a mock ILogger object.
 * @returns {import('../../../core/interfaces/coreServices.js').ILogger}
 */
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/**
 * Creates a mock GameDataRepository-like object.
 * (We only need the methods used by SystemDataRegistry's query logic)
 */
const createMockGameDataRepository = () => ({
    // The query method specifically checks for 'getWorldName'
    getWorldName: jest.fn(),
    // Add other methods if SystemDataRegistry query logic expands
});

// --- Test Suite ---

describe('SystemDataRegistry', () => {
    /** @type {SystemDataRegistry} */
    let registry;
    /** @type {import('./interfaces/coreServices.js').ILogger} */
    let mockLogger;
    /** @type {ReturnType<typeof createMockGameDataRepository>} */
    let mockGameDataRepo; // Mock for the service being registered

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockGameDataRepo = createMockGameDataRepository();
        // Create a fresh instance before each test
        registry = new SystemDataRegistry(mockLogger);
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    // --- Constructor Tests ---

    describe('constructor', () => {
        it('should instantiate successfully with a valid logger', () => {
            // The beforeEach already does this, but we can be explicit
            const newRegistry = new SystemDataRegistry(mockLogger);
            expect(newRegistry).toBeInstanceOf(SystemDataRegistry);
            // Check if the constructor logged its creation message (optional check)
            // Note: The logger used here is the one passed to the NEW instance
            expect(mockLogger.info).toHaveBeenCalledWith('SystemDataRegistry: Instance created.');
        });

        it('should throw TypeError if logger is missing', () => {
            expect(() => new SystemDataRegistry(null)).toThrow(TypeError);
            expect(() => new SystemDataRegistry(undefined)).toThrow(TypeError);
        });

        it('should throw TypeError if logger is invalid (missing methods)', () => {
            const invalidLoggerPartial = { info: jest.fn(), warn: jest.fn() }; // Missing error, debug
            const invalidLoggerWrongType = { info: 'not a function' };

            expect(() => new SystemDataRegistry(invalidLoggerPartial)).toThrow(TypeError);
            expect(() => new SystemDataRegistry(invalidLoggerWrongType)).toThrow(TypeError);
            // Test missing each method individually
            expect(() => new SystemDataRegistry({ warn: jest.fn(), error: jest.fn(), debug: jest.fn() })).toThrow(TypeError);
            expect(() => new SystemDataRegistry({ info: jest.fn(), error: jest.fn(), debug: jest.fn() })).toThrow(TypeError);
            expect(() => new SystemDataRegistry({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() })).toThrow(TypeError);
            expect(() => new SystemDataRegistry({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })).toThrow(TypeError);
        });
    });

    // --- registerSource Tests ---

    describe('registerSource', () => {
        it('should register a valid source instance successfully', () => {
            const sourceId = 'TestDataSource';
            const sourceInstance = { getData: () => 'test data' };

            registry.registerSource(sourceId, sourceInstance);

            // Check for debug log
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `SystemDataRegistry.registerSource: Successfully registered source with sourceId '${sourceId}'.`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings

            // Verify internally (e.g., by trying to query it, though query has its own tests)
            // We can't directly access #dataSources, so query is the best way
            // For this test, we'll just check logs. Query tests will verify retrieval.
        });

        it('should log a warning when overwriting an existing source ID', () => {
            const sourceId = 'DuplicateSource';
            const instance1 = { id: 1 };
            const instance2 = { id: 2 };

            registry.registerSource(sourceId, instance1); // First registration
            registry.registerSource(sourceId, instance2); // Second registration (overwrite)

            // Check that the warning was logged on the *second* call
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `SystemDataRegistry.registerSource: Overwriting existing source registration for sourceId '${sourceId}'.`
            );
            // Debug log should have been called twice (once for each registration)
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        });

        it('should log a warning and not register if sourceId is invalid', () => {
            const sourceInstance = { data: 'test' };
            const invalidIds = [null, undefined, '', '   '];

            invalidIds.forEach((id) => {
                registry.registerSource(id, sourceInstance);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    'SystemDataRegistry.registerSource: Invalid sourceId provided. Must be a non-empty string. Received:',
                    id
                );
            });

            expect(mockLogger.debug).not.toHaveBeenCalled(); // No successful registrations
            // Attempt to query any of these should fail (tested in query section)
        });

        it('should log a warning and not register if sourceInstance is null or undefined', () => {
            const sourceId = 'ValidSourceID';
            const invalidInstances = [null, undefined];

            invalidInstances.forEach((instance) => {
                registry.registerSource(sourceId, instance);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `SystemDataRegistry.registerSource: Invalid sourceInstance provided for sourceId '${sourceId}'. Must not be null or undefined.`
                );
            });

            expect(mockLogger.debug).not.toHaveBeenCalled(); // No successful registrations
            // Attempt to query this should fail (tested in query section)
        });
    });

    // --- query Tests ---

    describe('query', () => {
        // IMPORTANT NOTE: The SystemDataRegistry.query code specifically checks for:
        // sourceId === 'GameDataRegistry' (NOT 'GameDataRepository')
        // We must test against this literal string 'GameDataRegistry' to match the code,
        // even though it might be a typo in the original source.
        const hardcodedSourceId = 'GameDataRegistry';
        const worldNameQuery = 'worldName';
        const expectedWorldName = 'TestWorldFromMock';

        beforeEach(() => {
            // Pre-register the mock GameDataRepository under the specific ID the query method expects
            mockGameDataRepo.getWorldName.mockReturnValue(expectedWorldName);
            registry.registerSource(hardcodedSourceId, mockGameDataRepo);

            // Clear mocks again specifically for query calls after registration
            jest.clearAllMocks();
        });

        it('should successfully query a registered source for a known query detail', () => {
            const result = registry.query(hardcodedSourceId, worldNameQuery);

            expect(result).toBe(expectedWorldName);
            expect(mockGameDataRepo.getWorldName).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `SystemDataRegistry.query: Successfully queried '${hardcodedSourceId}' for '${worldNameQuery}'.`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return undefined and log warning when querying an unregistered source ID', () => {
            const unknownSourceId = 'NonExistentSource';
            const result = registry.query(unknownSourceId, worldNameQuery);

            expect(result).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `SystemDataRegistry.query: Data source with ID '${unknownSourceId}' not found.`
            );
            expect(mockGameDataRepo.getWorldName).not.toHaveBeenCalled(); // Original source method not called
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return undefined and log warning for a registered source with an unsupported query detail', () => {
            const unsupportedQuery = 'getSomeOtherData';
            const result = registry.query(hardcodedSourceId, unsupportedQuery);

            expect(result).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `SystemDataRegistry.query: Query for sourceId '${hardcodedSourceId}' with details '${JSON.stringify(unsupportedQuery)}' is not currently supported.`
            );
            expect(mockGameDataRepo.getWorldName).not.toHaveBeenCalled(); // Correct method not called
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return undefined and log error if the source method does not exist', () => {
            // Create and register a source *without* getWorldName
            const sourceWithoutMethod = { someOtherMethod: () => {} };
            // Use the specific ID checked in the query logic
            registry.registerSource(hardcodedSourceId, sourceWithoutMethod); // Overwrites the previous mock

            // Clear mocks again after the overwrite registration
            jest.clearAllMocks();

            const result = registry.query(hardcodedSourceId, worldNameQuery);

            expect(result).toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemDataRegistry.query: Source '${hardcodedSourceId}' does not have a callable 'getWorldName' method for query '${worldNameQuery}'.`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });


        it('should return undefined and log error when the source methods throws an error', () => {
            const queryError = new Error('Database connection failed');
            mockGameDataRepo.getWorldName.mockImplementation(() => {
                throw queryError;
            });

            // Re-register the throwing mock (though beforeEach should handle this if mocks aren't shared)
            registry.registerSource(hardcodedSourceId, mockGameDataRepo);
            jest.clearAllMocks(); // Clear logs from registration

            const result = registry.query(hardcodedSourceId, worldNameQuery);

            expect(result).toBeUndefined();
            expect(mockGameDataRepo.getWorldName).toHaveBeenCalledTimes(1); // Method was called
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemDataRegistry.query: Error executing query on source '${hardcodedSourceId}' with details '${JSON.stringify(worldNameQuery)}':`,
                queryError // Check that the actual error object was logged
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });
    });
});
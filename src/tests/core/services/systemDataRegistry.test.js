// src/tests/core/services/systemDataRegistry.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {SystemDataRegistry} from '../../../core/services/systemDataRegistry.js'; // Adjust path as needed

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
    /** @type {ReturnType<typeof createMockLogger>} */ // Corrected typedef import path assumption
    let mockLogger;
    /** @type {ReturnType<typeof createMockGameDataRepository>} */
    let mockGameDataRepo; // Mock for the service being registered

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockGameDataRepo = createMockGameDataRepository();
        // Create a fresh instance before each test
        registry = new SystemDataRegistry(mockLogger);
        // Reset mocks before each test (specifically logger mocks)
        jest.clearAllMocks(); // Clear logger mocks from constructor call
    });

    // --- Constructor Tests ---

    describe('constructor', () => {
        it('should instantiate successfully with a valid logger', () => {
            // This instance is created specifically for this test scope
            const testLogger = createMockLogger();
            const newRegistry = new SystemDataRegistry(testLogger);
            expect(newRegistry).toBeInstanceOf(SystemDataRegistry);
            // Check if the constructor logged its creation message
            expect(testLogger.info).toHaveBeenCalledWith('SystemDataRegistry: Instance created.');
            expect(testLogger.info).toHaveBeenCalledTimes(1);
        });

        it('should throw TypeError if logger is missing', () => {
            expect(() => new SystemDataRegistry(null)).toThrow(TypeError);
            expect(() => new SystemDataRegistry(undefined)).toThrow(TypeError);
        });

        it('should throw TypeError if logger is invalid (missing methods)', () => {
            const invalidLoggerPartial = {info: jest.fn(), warn: jest.fn()}; // Missing error, debug
            const invalidLoggerWrongType = {info: 'not a function'};

            expect(() => new SystemDataRegistry(invalidLoggerPartial)).toThrow(TypeError);
            expect(() => new SystemDataRegistry(invalidLoggerWrongType)).toThrow(TypeError);
            // Test missing each method individually
            expect(() => new SystemDataRegistry({
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn()
            })).toThrow(TypeError);
            expect(() => new SystemDataRegistry({
                info: jest.fn(),
                error: jest.fn(),
                debug: jest.fn()
            })).toThrow(TypeError);
            expect(() => new SystemDataRegistry({
                info: jest.fn(),
                warn: jest.fn(),
                debug: jest.fn()
            })).toThrow(TypeError);
            expect(() => new SystemDataRegistry({
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            })).toThrow(TypeError);
        });
    });

    // --- registerSource Tests ---

    describe('registerSource', () => {
        it('should register a valid source instance successfully', () => {
            const sourceId = 'TestDataSource';
            const sourceInstance = {getData: () => 'test data'};

            registry.registerSource(sourceId, sourceInstance);

            // Check for debug log (logger instance is the one from the outer beforeEach)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `SystemDataRegistry.registerSource: Successfully registered source with sourceId '${sourceId}'.`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);

            // Verify internally (e.g., by trying to query it, though query has its own tests)
            // We can't directly access #dataSources, so query is the best way
            // For this test, we'll just check logs. Query tests will verify retrieval.
        });

        it('should log a warning when overwriting an existing source ID', () => {
            const sourceId = 'DuplicateSource';
            const instance1 = {id: 1};
            const instance2 = {id: 2};

            registry.registerSource(sourceId, instance1); // First registration
            registry.registerSource(sourceId, instance2); // Second registration (overwrite)

            // Check that the warning was logged on the *second* call
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `SystemDataRegistry.registerSource: Overwriting existing source registration for sourceId '${sourceId}'.`
            );
            // Debug log should have been called twice (once for each registration)
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
            expect(mockLogger.debug).toHaveBeenNthCalledWith(1, `SystemDataRegistry.registerSource: Successfully registered source with sourceId '${sourceId}'.`);
            expect(mockLogger.debug).toHaveBeenNthCalledWith(2, `SystemDataRegistry.registerSource: Successfully registered source with sourceId '${sourceId}'.`);
        });

        it('should log a warning and not register if sourceId is invalid', () => {
            const sourceInstance = {data: 'test'};
            const invalidIds = [null, undefined, '', '   '];

            invalidIds.forEach((id, index) => {
                registry.registerSource(id, sourceInstance);
                expect(mockLogger.warn).toHaveBeenNthCalledWith(index + 1, // Jest call counting starts at 1
                    'SystemDataRegistry.registerSource: Invalid sourceId provided. Must be a non-empty string. Received:',
                    id
                );
            });

            expect(mockLogger.warn).toHaveBeenCalledTimes(invalidIds.length);
            expect(mockLogger.debug).not.toHaveBeenCalled(); // No successful registrations
            // Attempt to query any of these should fail (tested in query section)
        });

        it('should log a warning and not register if sourceInstance is null or undefined', () => {
            const sourceId = 'ValidSourceID';
            const invalidInstances = [null, undefined];

            invalidInstances.forEach((instance, index) => {
                registry.registerSource(sourceId, instance);
                expect(mockLogger.warn).toHaveBeenNthCalledWith(index + 1,
                    `SystemDataRegistry.registerSource: Invalid sourceInstance provided for sourceId '${sourceId}'. Must not be null or undefined.`
                );
            });

            expect(mockLogger.warn).toHaveBeenCalledTimes(invalidInstances.length);
            expect(mockLogger.debug).not.toHaveBeenCalled(); // No successful registrations
            // Attempt to query this should fail (tested in query section)
        });
    });

    // --- query Tests ---

    describe('query', () => {
        // --- FIX: Use the CORRECT IDs that SystemDataRegistry.query now expects ---
        const correctSourceId = 'GameDataRepository'; // Changed from 'GameDataRegistry'
        const correctQueryDetails = 'getWorldName';   // Changed from 'worldName'
        // --- END FIX ---
        const expectedWorldName = 'TestWorldFromMock';

        beforeEach(() => {
            // Pre-register the mock GameDataRepository under the specific ID the query method expects
            mockGameDataRepo.getWorldName.mockReturnValue(expectedWorldName);
            // --- FIX: Register with the correct source ID ---
            registry.registerSource(correctSourceId, mockGameDataRepo);
            // --- END FIX ---

            // Clear mocks again specifically for query calls after registration
            // Note: This clears the mockLogger calls from the registerSource above
            jest.clearAllMocks();
        });

        it('should successfully query a registered source for a known query detail', () => {
            // --- FIX: Query with the correct ID and details ---
            const result = registry.query(correctSourceId, correctQueryDetails);
            // --- END FIX ---

            expect(result).toBe(expectedWorldName);
            expect(mockGameDataRepo.getWorldName).toHaveBeenCalledTimes(1); // Should be called now
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only the success log from query
            expect(mockLogger.debug).toHaveBeenCalledWith(
                // --- FIX: Use correct IDs in expected log message ---
                `SystemDataRegistry.query: Successfully queried '${correctSourceId}' for '${correctQueryDetails}'.`
                // --- END FIX ---
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return undefined and log warning when querying an unregistered source ID', () => {
            const unknownSourceId = 'NonExistentSource';
            // --- FIX: Use correct query details even for unknown source test ---
            const result = registry.query(unknownSourceId, correctQueryDetails);
            // --- END FIX ---

            expect(result).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `SystemDataRegistry.query: Data source with ID '${unknownSourceId}' not found.`
            );
            expect(mockGameDataRepo.getWorldName).not.toHaveBeenCalled(); // Original source method not called
            // No debug or error logs expected
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return undefined and log warning for a registered source with an unsupported query detail', () => {
            const unsupportedQuery = 'getSomeOtherData';
            // --- FIX: Use correct source ID when testing unsupported query ---
            const result = registry.query(correctSourceId, unsupportedQuery);
            // --- END FIX ---

            expect(result).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                // --- FIX: Use correct source ID in expected log message ---
                `SystemDataRegistry.query: Query for sourceId '${correctSourceId}' with details '${JSON.stringify(unsupportedQuery)}' is not currently supported.`
                // --- END FIX ---
            );
            expect(mockGameDataRepo.getWorldName).not.toHaveBeenCalled(); // Correct method not called
            // No debug or error logs expected
            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return undefined and log error if the source method does not exist', () => {
            // Create and register a source *without* getWorldName
            const sourceWithoutMethod = {
                someOtherMethod: () => {
                }
            };
            // --- FIX: Use the correct source ID ---
            registry.registerSource(correctSourceId, sourceWithoutMethod); // Overwrites the previous mock
            // --- END FIX ---

            // Clear mocks again after the overwrite registration
            jest.clearAllMocks();

            // --- FIX: Query with the correct ID and details ---
            const result = registry.query(correctSourceId, correctQueryDetails);
            // --- END FIX ---

            expect(result).toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Should be called now
            expect(mockLogger.error).toHaveBeenCalledWith(
                // --- FIX: Use correct IDs in expected log message ---
                `SystemDataRegistry.query: Source '${correctSourceId}' does not have a callable 'getWorldName' method for query '${correctQueryDetails}'.`
                // --- END FIX ---
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });


        it('should return undefined and log error when the source methods throws an error', () => {
            const queryError = new Error('Database connection failed');
            // Setup the original mock (from the outer beforeEach) to throw
            mockGameDataRepo.getWorldName.mockImplementation(() => {
                throw queryError;
            });

            // Re-register the throwing mock under the correct ID
            // (This ensures the instance being queried is the throwing one,
            // overwriting the one from the describe's beforeEach if necessary, though Jest scoping usually handles this)
            // --- FIX: Use the correct source ID ---
            registry.registerSource(correctSourceId, mockGameDataRepo);
            // --- END FIX ---
            jest.clearAllMocks(); // Clear logs from registration

            // --- FIX: Query with the correct ID and details ---
            const result = registry.query(correctSourceId, correctQueryDetails);
            // --- END FIX ---

            expect(result).toBeUndefined();
            expect(mockGameDataRepo.getWorldName).toHaveBeenCalledTimes(1); // Method was called
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Should be called now
            expect(mockLogger.error).toHaveBeenCalledWith(
                // --- FIX: Use correct IDs in expected log message ---
                `SystemDataRegistry.query: Error executing query on source '${correctSourceId}' with details '${JSON.stringify(correctQueryDetails)}':`,
                // --- END FIX ---
                queryError // Check that the actual error object was logged
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled(); // No success debug log
        });
    });
});
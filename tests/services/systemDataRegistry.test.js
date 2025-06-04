// src/tests/core/services/systemDataRegistry.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SystemDataRegistry } from '../../src/services/systemDataRegistry.js'; // Adjust path as needed

// --- Mock Implementations ---

/**
 * Creates a mock ILogger object.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mock IQueryableDataSource (like GameDataRepository).
 * Now includes a mockable handleQuery method by default.
 */
const createMockQueryableDataSource = () => ({
  handleQuery: jest.fn(),
  // Keep getWorldName if specific mock sources need to simulate this internal call
  // for their own handleQuery logic, but SystemDataRegistry won't call it directly.
  getWorldName: jest.fn(),
});

// --- Test Suite ---

describe('SystemDataRegistry', () => {
  /** @type {SystemDataRegistry} */
  let registry;
  /** @type {ReturnType<typeof createMockLogger>} */
  let mockLogger;
  /** @type {ReturnType<typeof createMockQueryableDataSource>} */
  let mockDataSource; // Generic mock for a queryable data source

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDataSource = createMockQueryableDataSource();
    registry = new SystemDataRegistry(mockLogger);
    // Reset mocks before each test (specifically logger mocks from constructor call, if any)
    // jest.clearAllMocks(); // Clearing all mocks here might be too broad if constructor logs.
    // Let's clear specific mocks as needed or ensure constructor doesn't log.
    // The provided SystemDataRegistry constructor does not log, so this is fine.
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  // --- Constructor Tests ---

  describe('constructor', () => {
    it('should instantiate successfully with a valid logger', () => {
      const testLogger = createMockLogger();
      const newRegistry = new SystemDataRegistry(testLogger);
      expect(newRegistry).toBeInstanceOf(SystemDataRegistry);
    });

    it('should throw TypeError if logger is missing', () => {
      expect(() => new SystemDataRegistry(null)).toThrow(TypeError);
      expect(() => new SystemDataRegistry(undefined)).toThrow(TypeError);
    });

    it('should throw TypeError if logger is invalid (missing methods)', () => {
      const invalidLoggerPartial = { info: jest.fn(), warn: jest.fn() };
      const invalidLoggerWrongType = { info: 'not a function' };

      expect(() => new SystemDataRegistry(invalidLoggerPartial)).toThrow(
        TypeError
      );
      expect(() => new SystemDataRegistry(invalidLoggerWrongType)).toThrow(
        TypeError
      );
      expect(
        () =>
          new SystemDataRegistry({
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          })
      ).toThrow(TypeError);
      expect(
        () =>
          new SystemDataRegistry({
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          })
      ).toThrow(TypeError);
      expect(
        () =>
          new SystemDataRegistry({
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          })
      ).toThrow(TypeError);
      expect(
        () =>
          new SystemDataRegistry({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          })
      ).toThrow(TypeError);
    });
  });

  // --- registerSource Tests ---

  describe('registerSource', () => {
    it('should register a valid source instance (with handleQuery) successfully without warnings', () => {
      const sourceId = 'TestDataSourceWithHandleQuery';
      // sourceInstance now includes handleQuery
      const sourceInstance = {
        handleQuery: jest.fn(),
        getData: () => 'test data',
      };

      registry.registerSource(sourceId, sourceInstance);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SystemDataRegistry.registerSource: Successfully registered source with sourceId '${sourceId}'.`
      );
      // CRITICAL FIX: No warning if handleQuery exists
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should log a warning if registering a source instance without handleQuery', () => {
      const sourceId = 'TestDataSourceNoHandleQuery';
      const sourceInstance = { getData: () => 'test data' }; // Missing handleQuery

      registry.registerSource(sourceId, sourceInstance);

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SystemDataRegistry.registerSource: Source instance for sourceId '${sourceId}' does not have a 'handleQuery' method. While registration is allowed, querying this source will fail.`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        // Debug log for registration still occurs
        `SystemDataRegistry.registerSource: Successfully registered source with sourceId '${sourceId}'.`
      );
    });

    it('should log a warning when overwriting an existing source ID', () => {
      const sourceId = 'DuplicateSource';
      // FIX: Ensure mock instances have handleQuery to avoid unrelated warnings
      const instance1 = { id: 1, handleQuery: jest.fn() };
      const instance2 = { id: 2, handleQuery: jest.fn() };

      registry.registerSource(sourceId, instance1);
      // Clear warn mock after first registration to isolate the overwrite warning
      mockLogger.warn.mockClear();
      registry.registerSource(sourceId, instance2);

      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only the overwrite warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SystemDataRegistry.registerSource: Overwriting existing source registration for sourceId '${sourceId}'.`
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Called for each successful registration
    });

    it('should log a warning and not register if sourceId is invalid', () => {
      const sourceInstance = { data: 'test', handleQuery: jest.fn() };
      const invalidIds = [null, undefined, '', '   '];

      invalidIds.forEach((id, index) => {
        registry.registerSource(id, sourceInstance);
        expect(mockLogger.warn).toHaveBeenNthCalledWith(
          index + 1,
          'SystemDataRegistry.registerSource: Invalid sourceId provided. Must be a non-empty string. Received:',
          id
        );
      });
      expect(mockLogger.warn).toHaveBeenCalledTimes(invalidIds.length);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should log a warning and not register if sourceInstance is null or undefined', () => {
      const sourceId = 'ValidSourceID';
      const invalidInstances = [null, undefined];

      invalidInstances.forEach((instance, index) => {
        registry.registerSource(sourceId, instance);
        expect(mockLogger.warn).toHaveBeenNthCalledWith(
          index + 1,
          `SystemDataRegistry.registerSource: Invalid sourceInstance provided for sourceId '${sourceId}'. Must not be null or undefined.`
        );
      });
      expect(mockLogger.warn).toHaveBeenCalledTimes(invalidInstances.length);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  // --- query Tests ---

  describe('query', () => {
    const sourceId = 'RegisteredDataSource';
    const queryDetails = { type: 'testQuery', payload: 'someValue' };
    const expectedQueryResult = 'QueryResult';

    beforeEach(() => {
      // Use the generic mockDataSource initialized in the outer beforeEach
      mockDataSource.handleQuery.mockReturnValue(expectedQueryResult);
      registry.registerSource(sourceId, mockDataSource);
      // Clear mocks after registration to focus on query behavior
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockLogger.debug.mockClear();
      mockDataSource.handleQuery.mockClear(); // Clear calls to handleQuery from previous tests if any
    });

    it('should successfully query a registered source by calling its handleQuery method', () => {
      const result = registry.query(sourceId, queryDetails);

      expect(result).toBe(expectedQueryResult);
      expect(mockDataSource.handleQuery).toHaveBeenCalledTimes(1);
      expect(mockDataSource.handleQuery).toHaveBeenCalledWith(queryDetails);
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SystemDataRegistry.query: Forwarding query to '${sourceId}.handleQuery' with details: ${JSON.stringify(queryDetails)}`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return undefined and log warning when querying an unregistered source ID', () => {
      const unknownSourceId = 'NonExistentSource';
      const result = registry.query(unknownSourceId, queryDetails);

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SystemDataRegistry.query: Data source with ID '${unknownSourceId}' not found.`
      );
      expect(mockDataSource.handleQuery).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return what handleQuery returns (e.g. undefined for unsupported query) without SystemDataRegistry warning if handleQuery exists', () => {
      const unsupportedQueryDetails = { type: 'unsupported' };
      mockDataSource.handleQuery.mockReturnValueOnce(undefined); // Source handles it gracefully

      const result = registry.query(sourceId, unsupportedQueryDetails);

      expect(result).toBeUndefined();
      expect(mockDataSource.handleQuery).toHaveBeenCalledWith(
        unsupportedQueryDetails
      );
      // SystemDataRegistry itself does not warn if handleQuery exists and returns undefined.
      // The warning about "unsupported query" would come from the source's handleQuery, not SystemDataRegistry.
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Debug for forwarding query still happens
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return undefined and log error if the source does not have a handleQuery method', () => {
      const sourceWithoutHandleQuery = {
        someOtherMethod: () => {},
      };
      const noHandleQuerySourceId = 'NoHandleQuerySource';
      registry.registerSource(noHandleQuerySourceId, sourceWithoutHandleQuery);
      // Clear logger mocks from registration
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockLogger.debug.mockClear();

      const result = registry.query(noHandleQuerySourceId, queryDetails);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `SystemDataRegistry.query: Source '${noHandleQuerySourceId}' is registered but does not have a callable 'handleQuery' method. Query details: ${JSON.stringify(queryDetails)}`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Warning was for registration, already cleared or handled
      expect(mockLogger.debug).not.toHaveBeenCalled(); // No successful forwarding
    });

    it("should return undefined and log error when the source's handleQuery method throws an error", () => {
      const queryError = new Error('Source query failed');
      mockDataSource.handleQuery.mockImplementation(() => {
        throw queryError;
      });

      const result = registry.query(sourceId, queryDetails);

      expect(result).toBeUndefined();
      expect(mockDataSource.handleQuery).toHaveBeenCalledTimes(1);
      expect(mockDataSource.handleQuery).toHaveBeenCalledWith(queryDetails);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      // Updated to match the new logging format in SystemDataRegistry
      expect(mockLogger.error).toHaveBeenCalledWith(
        `SystemDataRegistry.query: Error executing 'handleQuery' on source '${sourceId}' with details '${JSON.stringify(queryDetails)}'. Error: ${queryError.message}`,
        expect.objectContaining({
          // The second argument is now an object
          sourceId: sourceId,
          queryDetails: queryDetails,
          error: queryError.message,
          // stack: queryError.stack // Optionally check stack if needed
        })
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Debug for attempting to forward
    });
  });
});

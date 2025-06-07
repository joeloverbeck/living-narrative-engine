// src/tests/initializers/systemInitializer.initialization.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
// Adjust path as needed
import SystemInitializer from '../../src/initializers/systemInitializer.js';
import { INITIALIZABLE } from '../../src/dependencyInjection/tags.js'; // Corrected import path for tags

// --- Type Imports for Mocks ---
/** @typedef {import('../../../core/interfaces/container.js').IServiceResolver} IServiceResolver */
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Adjusted type import path
// Base interface for systems - adjust if you have a more specific one
/** @typedef {{ initialize?: () => Promise<void> | void }} IInitializable */

// --- Test Suite ---
describe('SystemInitializer (Tag-Based)', () => {
  /** @type {jest.Mocked<IServiceResolver>} */
  let mockResolver;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<ValidatedEventDispatcher>} */
  let mockValidatedEventDispatcher;
  /** @type {SystemInitializer} */
  let systemInitializer; // Instance for initializeAll tests, created in beforeEach
  /** @type {string} */
  const testInitializationTag = INITIALIZABLE[0]; // Use the actual tag value

  // --- Mocks for systems to be returned by resolveByTag ---
  /** @type {jest.Mocked<IInitializable & { constructor?: { name: string } }>} */
  let mockSystemGood1;
  /** @type {jest.Mocked<IInitializable & { constructor?: { name: string } }>} */
  let mockSystemGood2;
  /** @type {jest.Mocked<{ someOtherMethod?: () => void } & { constructor?: { name: string } }>} */
  let mockSystemNoInit;
  /** @type {jest.Mocked<IInitializable & { constructor?: { name: string } }>} */
  let mockSystemFailInit;
  /** @type {jest.Mocked<{ initialize?: string } & { constructor?: { name: string } }>} */
  let mockSystemBadInitType;
  /** @type {null} */
  let mockSystemNull;

  // Errors used in tests
  const initError = new Error('Mock initialization error');
  const resolveTagError = new Error('Mock container resolveByTag error'); // Define here for scope

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ILogger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock IServiceResolver
    mockResolver = {
      resolveByTag: jest.fn(),
      // Add other methods if needed by specific tests, e.g., resolve()
    };

    // Mock ValidatedEventDispatcher
    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined), // Mock the required method
      // Add other methods if needed
    };

    // Create Mock System Instances
    mockSystemGood1 = {
      initialize: jest.fn().mockResolvedValue(undefined),
      constructor: { name: 'SystemGood1' },
    };
    mockSystemGood2 = {
      initialize: jest.fn().mockResolvedValue(undefined),
      constructor: { name: 'SystemGood2' },
    };
    mockSystemNoInit = {
      someOtherMethod: jest.fn(),
      constructor: { name: 'SystemNoInit' },
    };
    mockSystemFailInit = {
      initialize: jest.fn().mockRejectedValue(initError),
      constructor: { name: 'SystemFailInit' },
    };
    mockSystemBadInitType = {
      initialize: 'not a function',
      constructor: { name: 'SystemBadInitType' },
    };
    mockSystemNull = null;

    // Default setup for resolveByTag for initializeAll tests
    // Resetting the mock implementation for each test where it's specifically set
    mockResolver.resolveByTag.mockImplementation(async () => [
      mockSystemGood1,
      mockSystemNoInit,
      mockSystemFailInit,
      mockSystemGood2,
      mockSystemBadInitType,
      mockSystemNull,
    ]);

    // Instantiate SystemInitializer using object argument structure
    // This instance is used by the initializeAll tests below
    systemInitializer = new SystemInitializer({
      resolver: mockResolver,
      logger: mockLogger,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      initializationTag: testInitializationTag,
    });
  });

  // --- Constructor Tests ---
  describe('Constructor', () => {
    // Define expected error messages based on *actual* implementation
    const expectedResolverErrorMsg =
      "SystemInitializer requires a valid IServiceResolver with 'resolveByTag'."; // Used for missing resolver OR missing resolveByTag
    const expectedLoggerErrorMsg =
      'SystemInitializer requires an ILogger instance.';
    const expectedDispatcherErrorMsg =
      'SystemInitializer requires a valid ValidatedEventDispatcher.'; // Used for missing dispatcher OR missing dispatch
    const expectedTagErrorMsg =
      'SystemInitializer requires a non-empty string initializationTag.';

    it('should throw an error if IServiceResolver is not provided', () => {
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: null, // Test case: null resolver
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: testInitializationTag,
        });
      // Assert the correct error message
      expect(action).toThrow(expectedResolverErrorMsg);
      // Logger shouldn't be called if constructor throws early due to resolver
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error if ILogger is not provided', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      // Need a valid resolver for this test
      const tempResolver = { resolveByTag: jest.fn() };
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: tempResolver,
          logger: null, // Test case: null logger
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: testInitializationTag,
        });
      expect(action).toThrow(expectedLoggerErrorMsg);
      // Logger is null, should *not* use console.error (constructor throws first)
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      // The global mockLogger shouldn't have been used either.
      expect(mockLogger.error).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if ValidatedEventDispatcher is not provided', () => {
      // Added test
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: mockResolver,
          logger: mockLogger,
          validatedEventDispatcher: null, // Test case: null dispatcher
          initializationTag: testInitializationTag,
        });
      expect(action).toThrow(expectedDispatcherErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });

    it('should throw an error if IServiceResolver does not support resolveByTag', () => {
      const invalidResolver = { someOtherMethod: jest.fn() }; // Missing resolveByTag
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          // Cast to 'any' only to satisfy the compiler for the test setup
          resolver: /** @type {any} */ (invalidResolver), // Test case: invalid resolver shape
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: testInitializationTag,
        });
      // Assert the correct error message
      expect(action).toThrow(expectedResolverErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });

    it('should throw an error if ValidatedEventDispatcher does not support dispatch', () => {
      // Added test
      const invalidDispatcher = { someOtherMethod: jest.fn() }; // Missing dispatch
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: mockResolver,
          logger: mockLogger,
          // Cast to 'any' only to satisfy the compiler for the test setup
          validatedEventDispatcher: /** @type {any} */ (invalidDispatcher), // Test case: invalid dispatcher shape
          initializationTag: testInitializationTag,
        });
      // Assert the correct error message
      expect(action).toThrow(expectedDispatcherErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });

    // --- Tag Validation Tests ---
    // These tests require valid resolver, logger, and dispatcher

    it('should throw an error if initializationTag is not provided (null)', () => {
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: mockResolver,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: null, // Test case: null tag
        });
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });

    it('should throw an error if initializationTag is not provided (undefined)', () => {
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: mockResolver,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: undefined, // Test case: undefined tag
        });
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });

    it('should throw an error if initializationTag is not a string', () => {
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: mockResolver,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: /** @type {any} */ (123), // Test case: non-string tag
        });
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });

    it('should throw an error if initializationTag is an empty string', () => {
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: mockResolver,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: '', // Test case: empty string tag
        });
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });

    it('should throw an error if initializationTag is a string with only whitespace', () => {
      // Call constructor with object structure
      const action = () =>
        new SystemInitializer({
          resolver: mockResolver,
          logger: mockLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          initializationTag: '   ', // Test case: whitespace tag
        });
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Constructor throws before logging
    });
    // --- End Tag Validation Tests ---

    // *** CORRECTED TEST ***
    it('should create an instance and log debug message when valid dependencies are provided', () => {
      // Instance `systemInitializer` is already created in beforeEach after mocks are cleared.
      // We just need to verify its state and the mock calls resulting from its creation.
      expect(systemInitializer).toBeInstanceOf(SystemInitializer);

      // Check the log message includes the correct tag
      // This assertion runs *after* beforeEach has created the instance.
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `SystemInitializer instance created. Tag: '${testInitializationTag}'.`
      );

      // Since beforeEach clears mocks *then* creates the instance, there should be exactly one call.
      expect(mockLogger.debug).toHaveBeenCalledTimes(1); // <<< FIX: Verify the single call from beforeEach

      // Ensure no errors or warnings were logged during construction
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  // --- initializeAll Method Tests ---
  // These should now work correctly as they use the 'systemInitializer' instance
  // created in 'beforeEach' with the correct object structure.
  describe('initializeAll', () => {
    it('[Happy Path] should resolve by tag, call initialize() only on valid systems, dispatch events, and log correctly', async () => {
      // Reset the specific mock for this test case (using the default from beforeEach is fine here)
      // await systemInitializer.initializeAll(); // Already using default setup

      // Explicitly set the mock return value for clarity if preferred, though beforeEach does it
      mockResolver.resolveByTag.mockResolvedValue([
        mockSystemGood1,
        mockSystemNoInit, // Should be skipped silently (debug log)
        mockSystemFailInit, // Should call init, log error, dispatch fail event
        mockSystemGood2,
        mockSystemBadInitType, // Should be skipped (debug log)
        mockSystemNull, // Should be skipped (warn log)
      ]);

      await systemInitializer.initializeAll();

      // Check resolver call
      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(
        testInitializationTag
      );
      expect(mockResolver.resolveByTag).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `SystemInitializer: Found 6 systems tagged with '${testInitializationTag}'.`
      );

      // Check individual system initializations and logs/events
      // Good1
      expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);

      // NoInit
      expect(mockSystemNoInit.someOtherMethod).not.toHaveBeenCalled(); // Ensure its other methods aren't called
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "SystemInitializer: System 'SystemNoInit' has no initialize() method, skipping."
      );

      // FailInit
      expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error initializing system 'SystemFailInit'. Continuing. Error: ${initError.message}`
        ),
        initError
      );
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'system:initialization_failed',
        {
          systemName: 'SystemFailInit',
          error: initError.message,
          stack: initError.stack,
        },
        { allowSchemaNotFound: true }
      );

      // Good2
      expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);

      // BadInitType
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "SystemInitializer: System 'SystemBadInitType' has no initialize() method, skipping."
      ); // Correct check is for function type

      // Null
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SystemInitializer: Encountered null/undefined entry for tag '${testInitializationTag}', skipping.`
      );

      // Verify overall counts
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only from mockSystemFailInit
      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only from mockSystemNull
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    it('[Empty Result] should handle container returning an empty array for the tag gracefully', async () => {
      mockResolver.resolveByTag.mockResolvedValue([]); // Simulate empty array
      await systemInitializer.initializeAll();

      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(
        testInitializationTag
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`
      );

      // No systems to initialize
      expect(mockSystemGood1.initialize).not.toHaveBeenCalled();
      expect(mockSystemFailInit.initialize).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('[Non-Array Result] should handle resolver returning non-array gracefully', async () => {
      mockResolver.resolveByTag.mockResolvedValue({ not: 'an array' }); // Simulate non-array return
      await systemInitializer.initializeAll();

      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(
        testInitializationTag
      );
      // Warning about non-array result
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SystemInitializer: resolveByTag for tag '${testInitializationTag}' did not return an array. Treating as empty.`
      );
      // Should then proceed as if it were empty
      expect(mockLogger.info).toHaveBeenCalledWith(
        `SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`
      );

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only the non-array warning
      expect(mockSystemGood1.initialize).not.toHaveBeenCalled();
    });

    // *** CORRECTED TEST ***
    it('[Error during resolveByTag] should log the error, dispatch failed event, and re-throw', async () => {
      // resolveTagError is defined in the outer scope
      mockResolver.resolveByTag.mockRejectedValue(resolveTagError); // Simulate resolver error

      // Define the expected error message that the initializer *throws*
      const expectedThrownErrorMessage = `Failed to resolve initializable systems using tag '${testInitializationTag}': ${resolveTagError.message}`;

      // Expect the promise to reject with the wrapped error message
      await expect(systemInitializer.initializeAll()).rejects.toThrow(
        expectedThrownErrorMessage
      );

      // Check logs
      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(
        testInitializationTag
      );
      // Check that the *original* error was logged along with the message
      expect(mockLogger.error).toHaveBeenCalledWith(
        `SystemInitializer: Failed to resolve systems by tag '${testInitializationTag}'. Error: ${resolveTagError.message}`,
        resolveTagError // The original error object should be passed as the second arg to logger.error
      );

      // Complete event should NOT be called
      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        'initialization:system_initializer:completed',
        expect.anything(),
        expect.anything()
      );
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledTimes(0); // start, failed

      // Should not proceed to initialize
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Proceeding to initialize')
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'SystemInitializer: Initialization loop for tagged systems completed.'
      );
    });

    it('[Error during System Initialization] should log specific init error, dispatch events, and continue with others', async () => {
      // Setup specific systems for this test
      mockResolver.resolveByTag.mockResolvedValue([
        mockSystemGood1,
        mockSystemFailInit,
        mockSystemGood2,
      ]);
      await systemInitializer.initializeAll();

      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(
        testInitializationTag
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `SystemInitializer: Found 3 systems tagged with '${testInitializationTag}'.`
      );

      // Check initializations
      expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
      expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1);
      expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1); // Crucially, this should still run

      // Check logging for the failed system
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error initializing system 'SystemFailInit'. Continuing. Error: ${initError.message}`
        ),
        initError
      );

      // Check event dispatches
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'system:initialization_failed',
        {
          systemName: 'SystemFailInit',
          error: initError.message,
          stack: initError.stack,
        },
        { allowSchemaNotFound: true }
      );
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledTimes(1);

      // Should only have the one error from mockSystemFailInit
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No other warnings expected here
    });
  });
});

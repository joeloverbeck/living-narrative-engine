// src/tests/core/initializers/systemInitializer.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
// Adjust path as needed
import SystemInitializer from '../../../core/initializers/systemInitializer.js';
// Assuming INITIALIZABLE is still relevant for getting a test tag value
// If not, replace with a simple string constant.
import {INITIALIZABLE} from "../../../core/tags.js";

// --- Type Imports for Mocks ---
// Using correct interface types based on SystemInitializer's constructor
/** @typedef {import('../../../core/interfaces/container.js').IServiceResolver} IServiceResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
// Base interface for systems - adjust if you have a more specific one
/** @typedef {{ initialize?: () => Promise<void> | void }} IInitializable */


// --- Test Suite ---
describe('SystemInitializer (Tag-Based Refactor)', () => {

  // AC1: Use mocks for IServiceResolver and ILogger
  /** @type {jest.Mocked<IServiceResolver>} */ // Use IServiceResolver type
  let mockResolver;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {SystemInitializer} */
  let systemInitializer; // Instance for initializeAll tests
  /** @type {string} */
      // Define the tag value used consistently in tests
  const testInitializationTag = INITIALIZABLE && INITIALIZABLE[0] ? INITIALIZABLE[0] : 'testInitializableTag'; // Use imported tag or fallback

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
  /** @type {undefined} */
  let mockSystemUndefined; // Added for undefined check

  // Errors used in tests
  const initError = new Error('Mock initialization error');
  const resolveTagError = new Error('Mock container resolveByTag critical error');

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ILogger (AC1)
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock IServiceResolver (AC1)
    mockResolver = {
      resolveByTag: jest.fn(),
      // Add other IServiceResolver methods here if the interface defines them,
      // but only resolveByTag is used by SystemInitializer itself.
    };

    // --- Create Mock System Instances ---
    mockSystemGood1 = {
      initialize: jest.fn().mockResolvedValue(undefined),
      constructor: {name: 'SystemGood1'} // Assign name for better logging checks
    };
    mockSystemGood2 = {
      initialize: jest.fn().mockResolvedValue(undefined), // Can be sync or async
      constructor: {name: 'SystemGood2'}
    };
    mockSystemNoInit = {
      someOtherMethod: jest.fn(),
      constructor: {name: 'SystemNoInit'}
    };
    mockSystemFailInit = {
      initialize: jest.fn().mockRejectedValue(initError),
      constructor: {name: 'SystemFailInit'}
    };
    mockSystemBadInitType = {
      // has 'initialize' but it's not a function
      initialize: 'this is not a function',
      constructor: {name: 'SystemBadInitType'}
    };
    mockSystemNull = null;
    mockSystemUndefined = undefined;


    // Default setup for resolveByTag for most initializeAll tests
    // Includes various types of resolved "systems" to test different paths
    mockResolver.resolveByTag.mockReturnValue([
      mockSystemGood1,
      mockSystemNoInit,       // Scenario: No initialize method
      mockSystemFailInit,     // Scenario: initialize throws error
      mockSystemGood2,
      mockSystemBadInitType,  // Scenario: initialize is not a function
      mockSystemNull,         // Scenario: Resolved item is null
      mockSystemUndefined     // Scenario: Resolved item is undefined
    ]);

    // Instantiate SystemInitializer with all 3 required args for initializeAll tests
    // AC2: Instantiates SystemInitializer with its new constructor signature
    systemInitializer = new SystemInitializer(mockResolver, mockLogger, testInitializationTag);
  });

  // --- Constructor Tests ---
  describe('Constructor', () => {
    // Define expected error messages for clarity
    const expectedResolverErrorMsg = 'SystemInitializer requires an IServiceResolver instance.';
    const expectedLoggerErrorMsg = 'SystemInitializer requires an ILogger instance.';
    const expectedResolveByTagErrorMsg = "SystemInitializer requires an IServiceResolver instance that supports 'resolveByTag'.";
    const expectedTagErrorMsg = 'SystemInitializer requires a non-empty string initializationTag.';

    it('should throw an error if IServiceResolver is not provided (null)', () => {
      // Action: Pass null for resolver, valid logger and tag
      const action = () => new SystemInitializer(null, mockLogger, testInitializationTag);
      // Assert
      expect(action).toThrow(expectedResolverErrorMsg);
      // Logger is provided, so it should be called before throwing.
      expect(mockLogger.error).toHaveBeenCalledWith(expectedResolverErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if IServiceResolver is not provided (undefined)', () => {
      // Action: Pass undefined for resolver
      const action = () => new SystemInitializer(undefined, mockLogger, testInitializationTag);
      // Assert
      expect(action).toThrow(expectedResolverErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedResolverErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });


    it('should throw an error if ILogger is not provided (null)', () => {
      // Setup: Spy on console.error as logger is unavailable
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      // Need a valid resolver mock for this specific test
      const tempResolver = { resolveByTag: jest.fn() };
      // Action: Pass null for logger, valid resolver and tag
      const action = () => new SystemInitializer(tempResolver, null, testInitializationTag);
      // Assert
      expect(action).toThrow(expectedLoggerErrorMsg);
      // Check console.error was called (since logger was null)
      expect(consoleErrorSpy).toHaveBeenCalledWith(expectedLoggerErrorMsg);
      // Ensure our global mockLogger wasn't called (it was null)
      expect(mockLogger.error).not.toHaveBeenCalled();
      // Cleanup
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if ILogger is not provided (undefined)', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const tempResolver = { resolveByTag: jest.fn() };
      const action = () => new SystemInitializer(tempResolver, undefined, testInitializationTag);
      expect(action).toThrow(expectedLoggerErrorMsg);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expectedLoggerErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });


    it('should throw an error if IServiceResolver does not support resolveByTag', () => {
      // Setup: Create a mock object that is truthy but lacks the resolveByTag method
      const invalidResolver = { someOtherMethod: jest.fn() }; // Missing resolveByTag
      // Action: Pass invalid resolver, valid logger and tag
      // Cast to 'any' only to satisfy the compiler for the test setup
      const action = () => new SystemInitializer(/** @type {any} */ (invalidResolver), mockLogger, testInitializationTag);
      // Assert
      expect(action).toThrow(expectedResolveByTagErrorMsg);
      // Logger *is* provided, so it should be called with the correct error.
      expect(mockLogger.error).toHaveBeenCalledWith(expectedResolveByTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    // --- Tag Validation Tests ---
    // These tests require a valid resolver and logger to ensure the tag check is reached correctly.

    it('should throw an error if initializationTag is not provided (null)', () => {
      // Action: Pass null for the tag
      const action = () => new SystemInitializer(mockResolver, mockLogger, null);
      // Assert
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if initializationTag is not provided (undefined)', () => {
      // Action: Pass undefined for the tag
      const action = () => new SystemInitializer(mockResolver, mockLogger, undefined);
      // Assert
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if initializationTag is not a string', () => {
      // Action: Pass a number for the tag
      const action = () => new SystemInitializer(mockResolver, mockLogger, /** @type {any} */ (123));
      // Assert
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if initializationTag is an empty string', () => {
      // Action: Pass '' for the tag
      const action = () => new SystemInitializer(mockResolver, mockLogger, '');
      // Assert
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if initializationTag is a string with only whitespace', () => {
      // Action: Pass '   ' for the tag
      const action = () => new SystemInitializer(mockResolver, mockLogger, '   ');
      // Assert
      expect(action).toThrow(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });
    // --- End Tag Validation Tests ---

    it('should create an instance and log debug message when valid dependencies are provided', () => {
      // Action: Instantiate with valid mocks and tag (already done in beforeEach, but repeat for clarity)
      const instance = new SystemInitializer(mockResolver, mockLogger, testInitializationTag);
      // Assert
      expect(instance).toBeInstanceOf(SystemInitializer);
      // Check the specific debug log message includes the correct tag
      expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer instance created. Will initialize systems tagged with '${testInitializationTag}'.`);
      // Ensure no errors or warnings were logged during successful construction
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });


  // --- initializeAll Method Tests ---
  // These use the 'systemInitializer' instance created in 'beforeEach',
  // which correctly receives mockResolver, mockLogger, and testInitializationTag.
  describe('initializeAll', () => {

    // AC3: Test case covers successful initialization of multiple systems.
    it('[Success Scenario] should resolve by tag, call initialize() on valid systems, skip invalid ones, and log correctly', async () => {
      // --- Act ---
      await systemInitializer.initializeAll(); // Uses instance from beforeEach with default mock setup

      // --- Assert ---
      // Verify logging sequence
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${testInitializationTag}'...`);
      expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Querying resolver for tag '${testInitializationTag}'...`);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found 7 systems tagged with '${testInitializationTag}'.`)); // Matches default mock return length
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Proceeding to initialize 7 resolved systems sequentially...`));
      expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');

      // Verify resolver interaction
      expect(mockResolver.resolveByTag).toHaveBeenCalledTimes(1);
      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

      // Verify initialize calls for valid systems
      expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemGood1.constructor.name}...`);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood1.constructor.name} initialized successfully.`);

      expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemGood2.constructor.name}...`);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood2.constructor.name} initialized successfully.`);

      // AC3: Test case covers one system's initialize method throws an error.
      expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemFailInit.constructor.name}...`);
      expect(mockLogger.error).toHaveBeenCalledWith(
          `SystemInitializer: Error during initialization of system '${mockSystemFailInit.constructor.name}'. Continuing with others. Error: ${initError.message}`,
          initError // Ensure the original error object is logged as context
      );
      // Ensure success message wasn't logged for the failed one
      expect(mockLogger.info).not.toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemFailInit.constructor.name} initialized successfully.`);

      // Verify initialize was NOT called for systems lacking the method
      expect(mockSystemNoInit.someOtherMethod).not.toHaveBeenCalled(); // Ensure wrong method wasn't called

      // AC3: Test case covers a resolved system does not have an initialize method.
      expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Resolved system '${mockSystemNoInit.constructor.name}' has no initialize() method or is not a function, skipping call.`);

      // AC3: Test case covers a resolved system has 'initialize' but it's not a function.
      expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Resolved system '${mockSystemBadInitType.constructor.name}' has no initialize() method or is not a function, skipping call.`);

      // AC3: Test case covers a resolved system is null/undefined.
      expect(mockLogger.warn).toHaveBeenCalledWith(`SystemInitializer: Encountered a null or undefined entry in resolved systems for tag '${testInitializationTag}', skipping.`);
      // Should log this warning twice (once for null, once for undefined)
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);


      // Verify total errors/warnings logged
      expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only from mockSystemFailInit
      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Once for null, once for undefined

      // AC4: Assuming this test passes if the above assertions hold.
      // AC5: Coverage implicitly improved by testing new paths/logic.
    });

    // AC3: Test case covers no systems found for the tag.
    it('[Empty Result Scenario] should handle resolver returning an empty array gracefully', async () => {
      mockResolver.resolveByTag.mockReturnValue([]); // Override default setup

      await systemInitializer.initializeAll();

      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${testInitializationTag}'...`);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Proceeding to initialize 0 resolved systems sequentially...`));
      expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');

      // Ensure no initialize methods were attempted
      expect(mockSystemGood1.initialize).not.toHaveBeenCalled();
      expect(mockSystemFailInit.initialize).not.toHaveBeenCalled();

      // Ensure no unexpected errors or warnings were logged
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // AC3: Test case covers resolveByTag returns a non-array value.
    it('[Non-Array Result Scenario] should handle resolver returning non-array gracefully', async () => {
      // Simulate resolveByTag returning something unexpected but not throwing
      const nonArrayResult = { data: 'not an array' };
      mockResolver.resolveByTag.mockReturnValue(/** @type {any} */ (nonArrayResult));

      await systemInitializer.initializeAll(); // Use instance from beforeEach

      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

      // Check the specific warning about the non-array result includes the tag and type
      expect(mockLogger.warn).toHaveBeenCalledWith(`SystemInitializer: resolveByTag for tag '${testInitializationTag}' did not return an array. Received: ${typeof nonArrayResult}. Treating as empty.`);
      // It should log that 0 systems were found *after* handling the bad return type
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Proceeding to initialize 0 resolved systems sequentially...`));

      // Check the overall flow logging
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${testInitializationTag}'...`);
      expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');

      // Ensure no errors logged, only the specific warning
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only the non-array warning
    });


    // AC3: Test case covers resolveByTag throws a critical error.
    it('[Resolver Error Scenario] should log the resolution error and re-throw', async () => {
      // Simulate the resolver throwing during resolveByTag
      mockResolver.resolveByTag.mockImplementation(() => {
        throw resolveTagError;
      });

      // Assert that initializeAll rejects with an informative error
      await expect(systemInitializer.initializeAll())
          .rejects
          .toThrow(`Failed to resolve initializable systems using tag '${testInitializationTag}': ${resolveTagError.message}`);

      // Verify resolver was called
      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

      // Verify the critical error was logged, including the original error
      expect(mockLogger.error).toHaveBeenCalledWith(
          `SystemInitializer: Failed to resolve systems by tag '${testInitializationTag}'. Initialization cannot proceed. Error: ${resolveTagError.message}`,
          resolveTagError
      );

      // Ensure the process did not attempt to proceed or log completion
      expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Proceeding to initialize'));
      expect(mockLogger.info).not.toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');
      // Ensure no initialization attempts were made
      expect(mockSystemGood1.initialize).not.toHaveBeenCalled();
    });

    // AC3: Test case covers one system's initialize method throws an error (re-verified for clarity).
    it('[Individual Init Error Scenario] should log specific init error and continue with others', async () => {
      // Setup: Only return systems where one will fail init
      mockResolver.resolveByTag.mockReturnValue([mockSystemGood1, mockSystemFailInit, mockSystemGood2]);

      let didThrow = false;
      try {
        await systemInitializer.initializeAll();
      } catch (e) {
        didThrow = true; // Should not throw, errors should be caught
      }

      // Assert: Ensure initializeAll itself didn't throw
      expect(didThrow).toBe(false);

      // Verify resolver was called
      expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

      // Verify all initialize methods were *attempted*
      expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
      expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1); // Attempted
      expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);

      // Verify logging for the specific failure
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemFailInit.constructor.name}...`);
      expect(mockLogger.error).toHaveBeenCalledWith(
          `SystemInitializer: Error during initialization of system '${mockSystemFailInit.constructor.name}'. Continuing with others. Error: ${initError.message}`,
          initError
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemFailInit.constructor.name} initialized successfully.`);

      // Verify logging for successful ones (ensure continuation)
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood1.constructor.name} initialized successfully.`);
      expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood2.constructor.name} initialized successfully.`);

      // Verify only one error was logged
      expect(mockLogger.error).toHaveBeenCalledTimes(1);

      // Verify loop completion log was reached
      expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');
    });
  });
});
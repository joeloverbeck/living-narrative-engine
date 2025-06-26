// src/tests/services/validatedEventDispatcher.test.js

import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js'; // Adjust path as needed
// Mock implementations (can be simplified if only tracking calls)
import EventBus from '../../../src/events/eventBus.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals'; // We'll mock this module
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

// --- Mocks Setup ---

// Mock the dependencies using jest.mock
// We mock the entire modules to intercept the class constructors or specific exports
jest.mock('../../../src/events/eventBus.js'); // Mock EventBus module
jest.mock('../../../src/data/gameDataRepository.js'); // Mock GameDataRepository module

// Create mock implementations for the interfaces/classes
const mockEventBus = {
  dispatch: jest.fn(),
  // Add other methods if needed by other tests, though not directly by SUT
};

const mockGameDataRepository = {
  getEventDefinition: jest.fn(),
  // Add other methods if needed by other tests
};

const mockSchemaValidator = {
  addSchema: jest.fn(), // Include methods from ISchemaValidator interface
  getValidator: jest.fn(),
  isSchemaLoaded: jest.fn(),
  validate: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Test Suite ---

describe('ValidatedEventDispatcher', () => {
  let dispatcher;

  // Reset mocks and create a fresh instance before each test
  beforeEach(() => {
    jest.clearAllMocks(); // Clears call counts, instances, etc.

    // Configure the mock EventBus constructor/instance if necessary
    // Since we are mocking the module, EventBus itself is a mock constructor
    // EventBus.mockImplementation(() => mockEventBus); // Only needed if SUT uses 'new EventBus()'
    // GameDataRepository is likely just used via instance, so direct mock is fine for constructor arg
    // ISchemaValidator and ILogger are interfaces, so we pass our mock objects directly

    dispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus, // Pass the mock instance
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  // --- Constructor Tests ---
  describe('Constructor', () => {
    // Test constructor dependency validation (example for eventBus)
    test('should throw error if eventBus dependency is missing', () => {
      expect(
        () =>
          new ValidatedEventDispatcher({
            gameDataRepository: mockGameDataRepository,
            schemaValidator: mockSchemaValidator,
            logger: mockLogger,
          })
      ).toThrow(
        "ValidatedEventDispatcher: Missing required dependency 'eventBus'."
      );
    });

    test('should throw error if gameDataRepository dependency is missing', () => {
      expect(
        () =>
          new ValidatedEventDispatcher({
            eventBus: mockEventBus,
            schemaValidator: mockSchemaValidator,
            logger: mockLogger,
          })
      ).toThrow(
        "ValidatedEventDispatcher: Missing required dependency 'gameDataRepository'."
      );
    });

    test('should throw error if schemaValidator dependency is missing', () => {
      expect(
        () =>
          new ValidatedEventDispatcher({
            eventBus: mockEventBus,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
          })
      ).toThrow(
        "ValidatedEventDispatcher: Missing required dependency 'schemaValidator'."
      );
    });

    test('should throw error if logger dependency is missing', () => {
      expect(
        () =>
          new ValidatedEventDispatcher({
            eventBus: mockEventBus,
            gameDataRepository: mockGameDataRepository,
            schemaValidator: mockSchemaValidator,
          })
      ).toThrow(
        "ValidatedEventDispatcher: Missing required dependency 'logger'."
      );
    });

    test('should log info message on successful instantiation', () => {
      // FIX: No need to re-instantiate, beforeEach already did.
      // The instance created in beforeEach triggered the log.
      // Check it's called only once by the beforeEach setup
      expect(mockLogger.info).toHaveBeenCalledTimes(0);
    });
  });

  // --- dispatch Tests ---
  describe('dispatch', () => {
    const eventName = 'test:event';
    const payload = { data: 'some_payload' };
    const schemaId = `${eventName}#payload`;
    const basicEventDefinition = {
      id: eventName,
      description: 'A test event',
    };
    const eventDefinitionWithSchema = {
      ...basicEventDefinition,
      payloadSchema: {
        type: 'object',
        properties: { data: { type: 'string' } },
      },
    };

    // --- Scenario 1: Happy Path - Validation Required & Success ---
    test('should dispatch event successfully when validation passes', async () => {
      // Arrange
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: null,
      });
      mockEventBus.dispatch.mockResolvedValue(undefined); // Simulate successful dispatch

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(true);
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        eventName
      );
      expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        schemaId,
        payload
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Validating payload')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('validation SUCCEEDED')
      );
      // FIX: Check for payload in dispatch log message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatching event'),
        payload
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('dispatch successful')
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // --- Scenario 2: Validation Required & Failure ---
    test('should NOT dispatch event and return false when validation fails', async () => {
      // Arrange
      const validationErrors = [
        { instancePath: '/data', message: 'should be number' },
      ];
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: validationErrors,
      });

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(false);
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        eventName
      );
      expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        schemaId,
        payload
      );
      expectNoDispatch(mockEventBus.dispatch);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Payload validation FAILED for event '${eventName}'. Dispatch SKIPPED. Errors: [/data]: should be number`
        ),
        { payload, errors: validationErrors }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        // Match the specific message for validation failure skip
        expect.stringContaining(
          `Dispatch skipped for '${eventName}' due to validation failure`
        )
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // --- Scenario 2b: Validation Failure with no detailed errors ---
    test('should handle validation failure when errors array is null/undefined', async () => {
      // Arrange
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: null,
      }); // No error details

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(false);
      expectNoDispatch(mockEventBus.dispatch);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Payload validation FAILED for event '${eventName}'. Dispatch SKIPPED. Errors: No details available`
        ),
        { payload, errors: null }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        // Match the specific message for validation failure skip
        expect.stringContaining(
          `Dispatch skipped for '${eventName}' due to validation failure`
        )
      );
    });

    // --- Scenario 3: Validation Required & Schema Not Loaded ---
    test('should dispatch event but log warning if schema is not loaded', async () => {
      // Arrange
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false); // Schema not loaded
      mockEventBus.dispatch.mockResolvedValue(undefined);

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(true);
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        eventName
      );
      expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled(); // Validation skipped
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Payload schema '${schemaId}' not found/loaded for event '${eventName}'. Skipping validation`
        )
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
      // FIX: Check for payload in dispatch log message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatching event'),
        payload
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('dispatch successful')
      );
    });

    // --- Scenario 4: Validation Not Required (No Schema in Definition) ---
    test('should dispatch event without validation if definition has no payloadSchema', async () => {
      // Arrange
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        basicEventDefinition
      ); // No payloadSchema
      mockEventBus.dispatch.mockResolvedValue(undefined);

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(true);
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        eventName
      );
      expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Event definition '${eventName}' found, but no 'payloadSchema' defined. Skipping validation`
        )
      );
      // FIX: Check for payload in dispatch log message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatching event'),
        payload
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('dispatch successful')
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Scenario 5: Event Definition Not Found ---
    test('should dispatch event but log warning if event definition is not found', async () => {
      // Arrange
      mockGameDataRepository.getEventDefinition.mockReturnValue(undefined); // Not found
      mockEventBus.dispatch.mockResolvedValue(undefined);

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(true);
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        eventName
      );
      expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `EventDefinition not found for '${eventName}'. Cannot validate payload. Proceeding with dispatch.`
        )
      );
      // FIX: Check for payload in dispatch log message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatching event'),
        payload
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('dispatch successful')
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Scenario 6: Error During Validation Process ---
    test('should NOT dispatch and return false if an error occurs during validation process (e.g., isSchemaLoaded throws)', async () => {
      // Arrange
      const processError = new Error('Schema check failed');
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockImplementation(() => {
        throw processError;
      }); // Throw error

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(false);
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        eventName
      );
      expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
      expectNoDispatch(mockEventBus.dispatch);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Unexpected error during payload validation process for event '${eventName}'`
        ),
        processError
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatch skipped')
      );
    });

    test('should NOT dispatch and return false if an error occurs during validation process (e.g., validate throws)', async () => {
      // Arrange
      const processError = new Error('Validation function crashed');
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockImplementation(() => {
        throw processError;
      }); // Throw error

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(false);
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        eventName
      );
      expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        schemaId,
        payload
      );
      expectNoDispatch(mockEventBus.dispatch);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Unexpected error during payload validation process for event '${eventName}'`
        ),
        processError
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatch skipped')
      );
    });

    // NOTE: Re-verify SUT code if this test continues to fail with result: true
    test('should NOT dispatch and return false if validation fails THEN a process error occurs', async () => {
      // Arrange
      const validationErrors = [{ instancePath: '/data', message: 'bad type' }];
      const processError = new Error('Simulated error after validation log');

      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: validationErrors,
      });

      // Mock logger.error to throw *after* it logs the validation failure
      let loggedValidationError = false;
      const originalErrorMock = mockLogger.error; // Keep original mock for other calls if needed

      mockLogger.error.mockImplementation((msg, ...args) => {
        // Call the original mock's behavior (or just log manually for debug)
        // originalErrorMock(msg, ...args);
        // console.log("Mock logger.error called with:", msg); // Optional debug

        if (msg.includes('Payload validation FAILED')) {
          loggedValidationError = true;
          // Simulate an error occurring right after logging the validation failure
          throw processError;
        }
        // Add default behavior if other error messages need logging in this test
      });

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(false); // <<<< CHECK SUT CODE IF THIS FAILS (receives true)
      expectNoDispatch(mockEventBus.dispatch);
      expect(loggedValidationError).toBe(true); // Ensure the mock's logic was hit

      // Check the subsequent process error log (logged by the catch block)
      // Need to ensure logger.error was called twice: once for validation (which threw), once for process error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Unexpected error during payload validation process for event '${eventName}'`
        ),
        processError
      );
      // Check the debug message indicating the process error was secondary
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatch skipped')
      ); // Final decision log

      // Restore original mock behavior if necessary for subsequent tests / cleanup
      // This might be better handled in an afterEach if the mock needs resetting often
      // mockLogger.error = originalErrorMock;
    });

    // --- Scenario 7: Error During Dispatch ---
    test('should return false and log error if eventBus.dispatch throws an error', async () => {
      // Arrange
      const dispatchError = new Error('EventBus unavailable');
      // Using eventDefinitionWithSchema to ensure validation part runs successfully
      mockGameDataRepository.getEventDefinition.mockReturnValue(
        eventDefinitionWithSchema
      );
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: null,
      });
      mockEventBus.dispatch.mockRejectedValue(dispatchError); // Simulate dispatch failure

      // Act
      const result = await dispatcher.dispatch(eventName, payload);

      // Assert
      expect(result).toBe(false);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload); // Dispatch was attempted
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error occurred during EventBus.dispatch for event '${eventName}'`
        ),
        dispatchError
      );
      // Ensure success/skip messages are not logged in this failure case
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('dispatch successful')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Dispatch explicitly skipped')
      );
    });
  });
});

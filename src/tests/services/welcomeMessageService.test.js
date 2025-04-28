// src/tests/services/welcomeMessageService.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WelcomeMessageService from '../../services/welcomeMessageService.js'; // SUT

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').EventPayload} EventPayload */

// --- Test Suite ---
describe('WelcomeMessageService', () => {

  // --- Mock Dependencies (AC2) ---
  /** @type {jest.Mocked<EventBus>} */
  let mockEventBus;
  /** @type {jest.Mocked<GameDataRepository>} */
  let mockGameDataRepository;
  /** @type {jest.Mocked<ValidatedEventDispatcher>} */
  let mockvalidatedEventDispatcher;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;

  /** @type {WelcomeMessageService} */
  let service;
  /** @type {(event: EventPayload) => Promise<void>} */
  let capturedEventHandler; // To capture the handler passed to eventBus.subscribe

  beforeEach(() => {
    jest.clearAllMocks(); // Ensure clean slate for mocks

    // Create mock instances for all dependencies
    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      dispatch: jest.fn(),
      listenerCount: jest.fn(),
    };
    mockGameDataRepository = {
      // Mock only the methods used by the service
      getWorldName: jest.fn(),
      // Add mocks for other methods if they were used by WelcomeMessageService
    };
    mockvalidatedEventDispatcher = {
      // Mock only the methods used by the service
      dispatchValidated: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // --- Instantiate the Service Under Test ---
    // Capture the event handler during subscription in the init() call
    mockEventBus.subscribe.mockImplementation((eventName, handler) => {
      if (eventName === 'event:engine_initialized') {
        capturedEventHandler = handler; // Capture the handler
      }
    });

    service = new WelcomeMessageService({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      validatedEventDispatcher: mockvalidatedEventDispatcher,
      logger: mockLogger,
    });

    // Reset captured handler before each test that might use it
    capturedEventHandler = undefined;
  });

  // --- Test Cases ---

  it('AC1: should create a new instance successfully', () => {
    expect(service).toBeInstanceOf(WelcomeMessageService);
    expect(mockLogger.info).toHaveBeenCalledWith('WelcomeMessageService: Instance created successfully.');
  });

  describe('Constructor Dependency Validation', () => {
    // Test constructor validation logic (from Ticket 6.3 AC4)
    it('should throw error if eventBus is missing or invalid', () => {
      expect(() => new WelcomeMessageService({ gameDataRepository: mockGameDataRepository, validatedEventDispatcher: mockvalidatedEventDispatcher, logger: mockLogger }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'eventBus'.");
      expect(() => new WelcomeMessageService({ eventBus: {}, gameDataRepository: mockGameDataRepository, validatedEventDispatcher: mockvalidatedEventDispatcher, logger: mockLogger }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'eventBus'.");
    });

    it('should throw error if gameDataRepository is missing or invalid', () => {
      expect(() => new WelcomeMessageService({ eventBus: mockEventBus, validatedEventDispatcher: mockvalidatedEventDispatcher, logger: mockLogger }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'gameDataRepository'.");
      expect(() => new WelcomeMessageService({ eventBus: mockEventBus, gameDataRepository: {}, validatedEventDispatcher: mockvalidatedEventDispatcher, logger: mockLogger }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'gameDataRepository'.");
    });

    it('should throw error if validatedEventDispatcher is missing or invalid', () => {
      expect(() => new WelcomeMessageService({ eventBus: mockEventBus, gameDataRepository: mockGameDataRepository, logger: mockLogger }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'validatedEventDispatcher'.");
      expect(() => new WelcomeMessageService({ eventBus: mockEventBus, gameDataRepository: mockGameDataRepository, validatedEventDispatcher: {}, logger: mockLogger }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'validatedEventDispatcher'.");
    });

    it('should throw error if logger is missing or invalid', () => {
      expect(() => new WelcomeMessageService({ eventBus: mockEventBus, gameDataRepository: mockGameDataRepository, validatedEventDispatcher: mockvalidatedEventDispatcher }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'logger'.");
      expect(() => new WelcomeMessageService({ eventBus: mockEventBus, gameDataRepository: mockGameDataRepository, validatedEventDispatcher: mockvalidatedEventDispatcher, logger: { info: jest.fn() /* missing error */ } }))
        .toThrow("WelcomeMessageService: Missing or invalid dependency 'logger'.");
    });
  });

  describe('init()', () => {
    it('AC3: should subscribe to the "event:engine_initialized" event via EventBus', () => {
      // Act
      service.init();

      // Assert
      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'event:engine_initialized', // Correct event name
        expect.any(Function)        // Check that a function (the handler) was passed
      );
      expect(mockLogger.info).toHaveBeenCalledWith('WelcomeMessageService: Initializing (subscribing to events)...');
      expect(mockLogger.info).toHaveBeenCalledWith("WelcomeMessageService: Successfully subscribed to 'event:engine_initialized' event.");
      expect(capturedEventHandler).toBeDefined(); // Ensure the handler was captured
    });

    it('should log an error if subscription fails', () => {
      // Arrange
      const subscribeError = new Error('Subscription failed!');
      mockEventBus.subscribe.mockImplementation(() => {
        throw subscribeError;
      });

      // Act
      service.init(); // Call init which will now throw during subscribe

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "WelcomeMessageService: Failed to subscribe to 'event:engine_initialized' event during init.",
        subscribeError
      );
    });
  });

  describe('#handleEngineInitialized (Event Handling)', () => {
    const mockEventBase = {
      name: 'event:engine_initialized',
      timestamp: Date.now(),
    };

    beforeEach(() => {
      // Ensure the handler is registered and captured before each event handling test
      service.init();
      expect(capturedEventHandler).toBeDefined(); // Pre-check
    });

    it('AC4 & AC6 (Scenario A): should dispatch title and message using officialName when available', async () => {
      // Arrange
      const officialWorldName = 'Awesome World';
      const inputWorldName = 'input-world'; // Should be ignored
      const mockEvent = { ...mockEventBase, data: { inputWorldName } };

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true); // Assume dispatch succeeds

      // Act
      await capturedEventHandler(mockEvent);

      // Assert
      // Verify dependencies were called
      expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);

      // Verify dispatchValidated calls with correct arguments
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1,
        'event:set_title', // event name
        { text: officialWorldName } // payload
      );
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2,
        'textUI:display_message', // event name
        { text: `Welcome to ${officialWorldName}!`, type: 'info' } // payload (no fallback indicator)
      );

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith('WelcomeMessageService: Received \'event:engine_initialized\' event.');
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Received inputWorldName: '${inputWorldName}'`);
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Retrieved official world name from repository: '${officialWorldName}'`);
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Using official world name: '${officialWorldName}'`);
      expect(mockLogger.debug).toHaveBeenCalledWith(`WelcomeMessageService: Dispatching event:set_title with text: '${officialWorldName}'`);
      expect(mockLogger.debug).toHaveBeenCalledWith(`WelcomeMessageService: Dispatching textUI:display_message with text: 'Welcome to ${officialWorldName}!'`);
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Successfully dispatched welcome messages for world: '${officialWorldName}'.`);
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn about fallback
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('AC5 & AC6 (Scenario B): should dispatch title and message using inputWorldName (fallback) when officialName is null', async () => {
      // Arrange
      const officialWorldName = null; // Simulate missing official name
      const inputWorldName = 'My Input World';
      const mockEvent = { ...mockEventBase, data: { inputWorldName } };

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

      // Act
      await capturedEventHandler(mockEvent);

      // Assert
      // Verify dependencies were called
      expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);

      // Verify dispatchValidated calls with correct arguments (using inputWorldName)
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1,
        'event:set_title',
        { text: inputWorldName }
      );
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2,
        'textUI:display_message',
        { text: `Welcome to ${inputWorldName}! (Name from input)`, type: 'info' } // Note the fallback indicator
      );

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith('WelcomeMessageService: Received \'event:engine_initialized\' event.');
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Received inputWorldName: '${inputWorldName}'`);
      expect(mockLogger.info).toHaveBeenCalledWith('WelcomeMessageService: Retrieved official world name from repository: \'Not Found/Empty\''); // Reflects null return
      expect(mockLogger.warn).toHaveBeenCalledWith(`WelcomeMessageService: Official world name not available. Falling back to name: '${inputWorldName}'.`); // Fallback warning
      expect(mockLogger.debug).toHaveBeenCalledWith(`WelcomeMessageService: Dispatching event:set_title with text: '${inputWorldName}'`);
      expect(mockLogger.debug).toHaveBeenCalledWith(`WelcomeMessageService: Dispatching textUI:display_message with text: 'Welcome to ${inputWorldName}! (Name from input)'`);
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Successfully dispatched welcome messages for world: '${inputWorldName}'.`);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('AC5 & AC6 (Scenario B): should dispatch title and message using inputWorldName (fallback) when officialName is undefined', async () => {
      // Arrange
      const officialWorldName = undefined; // Simulate missing official name
      const inputWorldName = 'Another Input World';
      const mockEvent = { ...mockEventBase, data: { inputWorldName } };

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

      // Act
      await capturedEventHandler(mockEvent);

      // Assert
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1,
        'event:set_title',
        { text: inputWorldName }
      );
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2,
        'textUI:display_message',
        { text: `Welcome to ${inputWorldName}! (Name from input)`, type: 'info' } // Fallback indicator
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(`WelcomeMessageService: Official world name not available. Falling back to name: '${inputWorldName}'.`);
    });

    it('AC5 & AC6 (Scenario B): should dispatch title and message using inputWorldName (fallback) when officialName is an empty string', async () => {
      // Arrange
      const officialWorldName = '   '; // Simulate empty/whitespace official name
      const inputWorldName = 'Input Again';
      const mockEvent = { ...mockEventBase, data: { inputWorldName } };

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

      // Act
      await capturedEventHandler(mockEvent);

      // Assert
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1,
        'event:set_title',
        { text: inputWorldName }
      );
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2,
        'textUI:display_message',
        { text: `Welcome to ${inputWorldName}! (Name from input)`, type: 'info' } // Fallback indicator
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(`WelcomeMessageService: Official world name not available. Falling back to name: '${inputWorldName}'.`);
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Retrieved official world name from repository: '${officialWorldName}'`);
    });

    it('should use default name and log warning if officialName and inputWorldName are both missing/invalid', async () => {
      // Arrange
      const officialWorldName = null;
      const mockEventMissingInputName = { ...mockEventBase, data: { /* inputWorldName missing */ } };
      const defaultName = 'an Unnamed World';

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

      // Act
      await capturedEventHandler(mockEventMissingInputName);

      // Assert
      expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);

      // Verify dispatch uses default name
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1,
        'event:set_title',
        { text: defaultName }
      );
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2,
        'textUI:display_message',
        { text: `Welcome to ${defaultName}! (Name from input)`, type: 'info' } // Still indicates fallback
      );

      // Verify logging
      expect(mockLogger.warn).toHaveBeenCalledWith("WelcomeMessageService: 'event:engine_initialized' event received without 'inputWorldName' in payload. Using default.", mockEventMissingInputName);
      expect(mockLogger.warn).toHaveBeenCalledWith(`WelcomeMessageService: Official world name not available. Falling back to name: '${defaultName}'.`);
      expect(mockLogger.info).toHaveBeenCalledWith(`WelcomeMessageService: Successfully dispatched welcome messages for world: '${defaultName}'.`);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log warning if inputWorldName is explicitly null in payload, and fallback to default', async () => {
      // Arrange
      const officialWorldName = null;
      const mockEventNullInputName = { ...mockEventBase, data: { inputWorldName: null } };
      const defaultName = 'an Unnamed World';

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

      // Act
      await capturedEventHandler(mockEventNullInputName);

      // Assert
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1, 'event:set_title', { text: defaultName });
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2, 'textUI:display_message', { text: `Welcome to ${defaultName}! (Name from input)`, type: 'info' });

      expect(mockLogger.warn).toHaveBeenCalledWith("WelcomeMessageService: 'event:engine_initialized' event received without 'inputWorldName' in payload. Using default.", mockEventNullInputName); // Or similar warning
      expect(mockLogger.warn).toHaveBeenCalledWith(`WelcomeMessageService: Official world name not available. Falling back to name: '${defaultName}'.`);
    });

    it('should handle errors during GameDataRepository.getWorldName gracefully', async () => {
      // Arrange
      const repoError = new Error('Failed to access repo');
      const inputWorldName = 'FallbackDueToRepoError';
      const mockEvent = { ...mockEventBase, data: { inputWorldName } };

      mockGameDataRepository.getWorldName.mockImplementation(() => {
        throw repoError;
      });
      mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

      // Act
      await capturedEventHandler(mockEvent);

      // Assert
      expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith('WelcomeMessageService: Error retrieving world name from GameDataRepository.', repoError);

      // Should still proceed using the fallback name
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1,
        'event:set_title',
        { text: inputWorldName }
      );
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2,
        'textUI:display_message',
        { text: `Welcome to ${inputWorldName}! (Name from input)`, type: 'info' } // Fallback indicator
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(`WelcomeMessageService: Official world name not available. Falling back to name: '${inputWorldName}'.`);
    });

    it('AC7: should catch and log errors during dispatchValidated without crashing', async () => {
      // Arrange
      const officialWorldName = 'WorldWithError';
      const inputWorldName = 'input-ignored';
      const mockEvent = { ...mockEventBase, data: { inputWorldName } };
      const dispatchError = new Error('Dispatch Failed!');

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      // Configure dispatchValidated to throw an error ON THE FIRST CALL
      mockvalidatedEventDispatcher.dispatchValidated.mockRejectedValueOnce(dispatchError);

      // Act & Assert that the handler itself doesn't throw
      await expect(capturedEventHandler(mockEvent)).resolves.toBeUndefined(); // The handler should catch the error

      // Assert that the error was logged
      expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Only the first call happens
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('event:set_title', { text: officialWorldName });

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'WelcomeMessageService: Error occurred during handling of \'event:engine_initialized\' event:',
        dispatchError // Check that the original error was logged
      );

      // Check that the second dispatch didn't happen
      expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
        'textUI:display_message',
        expect.anything()
      );
      // Ensure success log wasn't called
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        `WelcomeMessageService: Successfully dispatched welcome messages for world: '${officialWorldName}'.`
      );
    });

    it('AC7: should catch and log errors during the second dispatchValidated call', async () => {
      // Arrange
      const officialWorldName = 'WorldWithSecondError';
      const inputWorldName = 'input-ignored';
      const mockEvent = { ...mockEventBase, data: { inputWorldName } };
      const dispatchError = new Error('Second Dispatch Failed!');

      mockGameDataRepository.getWorldName.mockReturnValue(officialWorldName);
      // Configure dispatchValidated to succeed on the first call, fail on the second
      mockvalidatedEventDispatcher.dispatchValidated
        .mockResolvedValueOnce(true) // First call (set_title) succeeds
        .mockRejectedValueOnce(dispatchError); // Second call (display_message) fails

      // Act & Assert that the handler itself doesn't throw
      await expect(capturedEventHandler(mockEvent)).resolves.toBeUndefined(); // The handler should catch the error

      // Assert that the error was logged
      expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2); // Both calls were attempted
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1, 'event:set_title', { text: officialWorldName });
      expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2, 'textUI:display_message', { text: `Welcome to ${officialWorldName}!`, type: 'info' });


      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'WelcomeMessageService: Error occurred during handling of \'event:engine_initialized\' event:',
        dispatchError // Check that the original error was logged
      );
      // Ensure success log wasn't called
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        `WelcomeMessageService: Successfully dispatched welcome messages for world: '${officialWorldName}'.`
      );
    });
  });

  // AC8: All unit tests pass (This is verified by running the test suite, e.g., `npm test`)
});
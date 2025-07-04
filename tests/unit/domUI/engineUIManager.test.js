// tests/domUI/engineUIManager.test.js

import {
  jest,
  describe,
  beforeEach,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import { EngineUIManager } from '../../../src/domUI'; // Adjusted path
import {
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../../src/constants/eventIds.js'; // Adjusted path

// Mock ILogger
let mockLogger;

// Mock ISafeEventDispatcher
let mockEventDispatcher;
let subscribedEventHandlers; // To capture { eventId: handlerFunction }

// Mock DomUiFacade
let mockDomUiFacade;

describe('EngineUIManager', () => {
  beforeEach(() => {
    // Reset mocks for each test
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    subscribedEventHandlers = {};
    mockEventDispatcher = {
      subscribe: jest.fn((eventId, handler) => {
        // Store the handler; if multiple handlers for one eventId are possible and needed for other tests, this should be an array.
        // For EngineUIManager, it subscribes one handler per event.
        subscribedEventHandlers[eventId] = handler;
      }),
    };

    mockDomUiFacade = {
      title: {
        set: jest.fn(),
      },
      input: {
        setEnabled: jest.fn(),
      },
      saveGame: {
        // Default state: component exists and has show method
        show: jest.fn(),
      },
      loadGame: {
        // Default state: component exists and has show method
        show: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restores any spied functions like console.error
  });

  describe('Constructor', () => {
    it('should instantiate and log success when all dependencies are provided', () => {
      const manager = new EngineUIManager({
        eventDispatcher: mockEventDispatcher,
        domUiFacade: mockDomUiFacade,
        logger: mockLogger,
      });
      expect(manager).toBeInstanceOf(EngineUIManager);
    });

    it('should throw an error if ISafeEventDispatcher is missing and not log an error message via the instance logger', () => {
      expect(
        () =>
          new EngineUIManager({
            // eventDispatcher: mockEventDispatcher, // Missing
            domUiFacade: mockDomUiFacade,
            logger: mockLogger, // mockLogger IS provided as an argument
          })
      ).toThrow(
        'EngineUIManager: ISafeEventDispatcher dependency is required.'
      );
      // this.#logger is undefined at the point of `this.#logger?.error` in SUT,
      // so the error method on the passed 'logger' (mockLogger) is not called via 'this.#logger'.
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error if DomUiFacade is missing and not log an error message via the instance logger', () => {
      expect(
        () =>
          new EngineUIManager({
            eventDispatcher: mockEventDispatcher,
            // domUiFacade: mockDomUiFacade, // Missing
            logger: mockLogger, // mockLogger IS provided as an argument
          })
      ).toThrow('EngineUIManager: DomUiFacade dependency is required.');
      // this.#logger is undefined at the point of `this.#logger?.error` in SUT,
      // so the error method on the passed 'logger' (mockLogger) is not called via 'this.#logger'.
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw an error if ILogger is missing and log to console.error', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error for this test
      expect(
        () =>
          new EngineUIManager({
            eventDispatcher: mockEventDispatcher,
            domUiFacade: mockDomUiFacade,
            // logger: mockLogger, // Missing
          })
      ).toThrow('EngineUIManager: ILogger dependency is required.');
      expect(console.error).toHaveBeenCalledWith(
        'EngineUIManager: ILogger dependency is required at construction.'
      );
    });
  });

  describe('initialize()', () => {
    let manager;

    beforeEach(() => {
      manager = new EngineUIManager({
        eventDispatcher: mockEventDispatcher,
        domUiFacade: mockDomUiFacade,
        logger: mockLogger,
      });
    });

    it('should subscribe to all designated UI events and log initialization steps', () => {
      manager.initialize();

      const expectedEventIds = [
        ENGINE_INITIALIZING_UI,
        ENGINE_READY_UI,
        ENGINE_OPERATION_IN_PROGRESS_UI,
        ENGINE_OPERATION_FAILED_UI,
        ENGINE_STOPPED_UI,
        REQUEST_SHOW_SAVE_GAME_UI,
        REQUEST_SHOW_LOAD_GAME_UI,
        CANNOT_SAVE_GAME_INFO,
      ];

      expectedEventIds.forEach((eventId) => {
        expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
          eventId,
          expect.any(Function)
        );
      });

      expect(mockEventDispatcher.subscribe).toHaveBeenCalledTimes(
        expectedEventIds.length
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EngineUIManager: Subscribed to all designated UI events.'
      );
    });
  });

  describe('Event Handlers', () => {
    let manager;

    beforeEach(() => {
      manager = new EngineUIManager({
        eventDispatcher: mockEventDispatcher,
        domUiFacade: mockDomUiFacade,
        logger: mockLogger,
      });
      manager.initialize(); // Initialize to set up subscriptions
    });

    describe('#handleEngineInitializingUI', () => {
      const handler = () => subscribedEventHandlers[ENGINE_INITIALIZING_UI];
      const worldName = 'Testopia';
      const validPayload = { worldName };
      const mockEvent = (payload) => ({
        eventId: ENGINE_INITIALIZING_UI,
        payload,
      });

      it('should set title and disable input with correct messages on valid payload', () => {
        handler()(mockEvent(validPayload));
        const expectedTitle = `Initializing ${worldName}...`;
        expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(expectedTitle);
        expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(
          false,
          expectedTitle
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `EngineUIManager: Received ${ENGINE_INITIALIZING_UI}`,
          validPayload
        );
      });

      it('should log warning and not interact with UI on missing payload', () => {
        handler()(mockEvent(null));
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: Invalid or missing payload for ${ENGINE_INITIALIZING_UI}.`,
          null
        );
        expect(mockDomUiFacade.title.set).not.toHaveBeenCalled();
        expect(mockDomUiFacade.input.setEnabled).not.toHaveBeenCalled();
      });

      it('should log warning and not interact with UI on invalid payload (missing worldName)', () => {
        const invalidPayload = { someOtherProp: 'value' };
        handler()(mockEvent(invalidPayload));
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: Invalid or missing payload for ${ENGINE_INITIALIZING_UI}.`,
          invalidPayload
        );
        expect(mockDomUiFacade.title.set).not.toHaveBeenCalled();
        expect(mockDomUiFacade.input.setEnabled).not.toHaveBeenCalled();
      });
    });

    describe('#handleEngineReadyUI', () => {
      const handler = () => subscribedEventHandlers[ENGINE_READY_UI];
      const message = 'Ready for input!';
      const activeWorld = 'TerraNova';
      const mockEvent = (payload) => ({ eventId: ENGINE_READY_UI, payload });

      it('should set title to activeWorld and enable input with message', () => {
        const payload = { activeWorld, message };
        handler()(mockEvent(payload));
        expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(activeWorld);
        expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(
          true,
          message
        );
      });

      it('should set title to "Game Ready" if activeWorld is null', () => {
        const payload = { activeWorld: null, message };
        handler()(mockEvent(payload));
        expect(mockDomUiFacade.title.set).toHaveBeenCalledWith('Game Ready');
        expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(
          true,
          message
        );
      });

      it('should log warning on missing payload', () => {
        handler()(mockEvent(null));
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: Invalid or missing payload for ${ENGINE_READY_UI}.`,
          null
        );
        expect(mockDomUiFacade.title.set).not.toHaveBeenCalled();
      });

      it('should log warning on invalid payload (missing message)', () => {
        const payload = { activeWorld }; // message is missing
        handler()(mockEvent(payload));
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: Invalid or missing payload for ${ENGINE_READY_UI}.`,
          payload
        );
      });
    });

    describe('#handleEngineOperationInProgressUI', () => {
      const handler = () =>
        subscribedEventHandlers[ENGINE_OPERATION_IN_PROGRESS_UI];
      const titleMessage = 'Processing...';
      const inputDisabledMessage = 'Please wait, operation in progress.';
      const validPayload = { titleMessage, inputDisabledMessage };
      const mockEvent = (payload) => ({
        eventId: ENGINE_OPERATION_IN_PROGRESS_UI,
        payload,
      });

      it('should set title and disable input with provided messages', () => {
        handler()(mockEvent(validPayload));
        expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(titleMessage);
        expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(
          false,
          inputDisabledMessage
        );
      });

      it('should log warning on invalid payload (e.g., missing titleMessage)', () => {
        const invalidPayload = { inputDisabledMessage };
        handler()(mockEvent(invalidPayload));
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: Invalid or missing payload for ${ENGINE_OPERATION_IN_PROGRESS_UI}.`,
          invalidPayload
        );
        expect(mockDomUiFacade.title.set).not.toHaveBeenCalled();
      });
    });

    describe('#handleEngineOperationFailedUI', () => {
      const handler = () => subscribedEventHandlers[ENGINE_OPERATION_FAILED_UI];
      const errorMessage = 'Critical meltdown!';
      const errorTitle = 'Operation Failed';
      const validPayload = { errorMessage, errorTitle };
      const mockEvent = (payload) => ({
        eventId: ENGINE_OPERATION_FAILED_UI,
        payload,
      });

      it('should disable input and set error title', () => {
        handler()(mockEvent(validPayload));
        expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(
          false,
          'Operation failed.'
        );
        expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(errorTitle);
        expect(mockLogger.error).toHaveBeenCalledWith(
          `EngineUIManager: Handled ${ENGINE_OPERATION_FAILED_UI}. Error Title: "${errorTitle}", Message: "${errorMessage}".`
        );
      });

      it('should log warning on invalid payload (e.g., missing errorMessage)', () => {
        const invalidPayload = { errorTitle };
        handler()(mockEvent(invalidPayload));
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: Invalid or missing payload for ${ENGINE_OPERATION_FAILED_UI}.`,
          invalidPayload
        );
      });
    });

    describe('#handleEngineStoppedUI', () => {
      const handler = () => subscribedEventHandlers[ENGINE_STOPPED_UI];
      const inputDisabledMessage = 'Game has ended.';
      const validPayload = { inputDisabledMessage };
      const mockEvent = (payload) => ({ eventId: ENGINE_STOPPED_UI, payload });

      it('should disable input and set title to "Game Stopped"', () => {
        handler()(mockEvent(validPayload));
        expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(
          false,
          inputDisabledMessage
        );
        expect(mockDomUiFacade.title.set).toHaveBeenCalledWith('Game Stopped');
      });

      it('should log warning on invalid payload (missing inputDisabledMessage)', () => {
        const invalidPayload = {};
        handler()(mockEvent(invalidPayload));
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: Invalid or missing payload for ${ENGINE_STOPPED_UI}.`,
          invalidPayload
        );
        expect(mockDomUiFacade.input.setEnabled).not.toHaveBeenCalled();
      });
    });

    describe('#handleRequestShowSaveGameUI', () => {
      const handler = () => subscribedEventHandlers[REQUEST_SHOW_SAVE_GAME_UI];
      const mockEvent = { eventId: REQUEST_SHOW_SAVE_GAME_UI, payload: {} };

      it('should call domUiFacade.saveGame.show() if available', () => {
        handler()(mockEvent);
        expect(mockDomUiFacade.saveGame.show).toHaveBeenCalledTimes(1);
      });

      it('should log warning if domUiFacade.saveGame is undefined', () => {
        mockDomUiFacade.saveGame = undefined;
        handler()(mockEvent);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: SaveGameUI component not available or 'show' method missing on DomUiFacade. Cannot show Save Game UI.`
        );
        // domUiFacade.saveGame.show would throw error if called, so it shouldn't be.
      });

      it('should log warning if domUiFacade.saveGame.show is not a function', () => {
        mockDomUiFacade.saveGame = { show: 'not-a-function' };
        handler()(mockEvent);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: SaveGameUI component not available or 'show' method missing on DomUiFacade. Cannot show Save Game UI.`
        );
      });
    });

    describe('#handleRequestShowLoadGameUI', () => {
      const handler = () => subscribedEventHandlers[REQUEST_SHOW_LOAD_GAME_UI];
      const mockEvent = { eventId: REQUEST_SHOW_LOAD_GAME_UI, payload: {} };

      it('should call domUiFacade.loadGame.show() if available', () => {
        handler()(mockEvent);
        expect(mockDomUiFacade.loadGame.show).toHaveBeenCalledTimes(1);
      });

      it('should log warning if domUiFacade.loadGame is undefined', () => {
        mockDomUiFacade.loadGame = undefined;
        handler()(mockEvent);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: LoadGameUI component not available or 'show' method missing on DomUiFacade. Cannot show Load Game UI.`
        );
      });

      it('should log warning if domUiFacade.loadGame.show is not a function', () => {
        mockDomUiFacade.loadGame = { show: 'not-a-function' };
        handler()(mockEvent);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `EngineUIManager: LoadGameUI component not available or 'show' method missing on DomUiFacade. Cannot show Load Game UI.`
        );
      });
    });

    describe('#handleCannotSaveGameInfo', () => {
      const handler = () => subscribedEventHandlers[CANNOT_SAVE_GAME_INFO];
      const mockEvent = { eventId: CANNOT_SAVE_GAME_INFO, payload: {} };

      it('should log an informational message', () => {
        handler()(mockEvent);
        const expectedMessage =
          'Cannot save at this moment (e.g. game not fully initialized or in a critical state).';
        expect(mockLogger.info).toHaveBeenCalledWith(
          `EngineUIManager: ${expectedMessage}`
        );
      });
    });
  });
});

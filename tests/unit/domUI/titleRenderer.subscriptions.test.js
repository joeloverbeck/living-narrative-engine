// tests/domUI/titleRenderer.subscriptions.test.js
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TitleRenderer } from '../../../src/domUI'; // Corrected import path if needed
import { RendererBase } from '../../../src/domUI';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js'; // Needed for checking super.dispose

// --- Mock Dependencies ---

// Mock ILogger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock IDocumentContext
const mockDocumentContext = {
  query: jest.fn(),
  create: jest.fn(),
  document: {}, // Provide a basic document object for RendererBase.dispose
};

// Mock IValidatedEventDispatcher and capture subscriptions
let capturedSubscriptions = {}; // To store { eventType: callback }
let unsubscribeSpies = []; // To store mock unsubscribe functions
const mockSafeEventDispatcher = {
  subscribe: jest.fn((eventType, callback) => {
    capturedSubscriptions[eventType] = callback;
    const mockUnsubscribe = jest.fn(() => {
      delete capturedSubscriptions[eventType];
    });
    const mockSubscription = {
      unsubscribe: mockUnsubscribe,
    };
    unsubscribeSpies.push(mockUnsubscribe);
    return mockSubscription;
  }),
  dispatch: jest.fn(),
};

// --- Helper to create mock elements ---
const createMockElement = (tagName = 'DIV') => ({
  nodeType: 1,
  tagName: tagName.toUpperCase(),
  textContent: '',
});

// --- Test Suite ---

describe('TitleRenderer', () => {
  let mockH1Element;
  let renderer;

  const simulateEvent = (eventType, payload = {}) => {
    const handler = capturedSubscriptions[eventType];
    if (handler) {
      handler(payload, eventType);
    } else {
      throw new Error(
        `Test setup error: No subscription captured for event type: ${eventType}`
      );
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedSubscriptions = {};
    unsubscribeSpies = [];
    mockH1Element = createMockElement('H1');
    mockH1Element.textContent = 'Initial Title';

    // Ensure mock subscribe returns the correct structure for RendererBase
    mockSafeEventDispatcher.subscribe.mockImplementation(
      (eventType, callback) => {
        capturedSubscriptions[eventType] = callback;
        const mockUnsubscribe = jest.fn(() => {
          delete capturedSubscriptions[eventType];
        });
        const mockSubscriptionObject = { unsubscribe: mockUnsubscribe };
        unsubscribeSpies.push(mockUnsubscribe); // Push the spy
        return mockSubscriptionObject; // Return the object for _addSubscription
      }
    );

    if (jest.isMockFunction(RendererBase.prototype.dispose)) {
      RendererBase.prototype.dispose.mockRestore();
    }
  });

  // --- Constructor Tests ---

  describe('Constructor', () => {
    it('should instantiate successfully and subscribe to events', () => {
      renderer = new TitleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        safeEventDispatcher: mockSafeEventDispatcher,
        titleElement: mockH1Element,
      });
      expect(renderer).toBeInstanceOf(TitleRenderer);
      expect(renderer).toBeInstanceOf(RendererBase);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TitleRenderer] Initialized.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TitleRenderer] Attached to H1 element.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Subscribed to VED events')
      );
      expect(mockSafeEventDispatcher.subscribe).toHaveBeenCalledTimes(14);
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    it('should throw if titleElement is missing or null', () => {
      expect(() => {
        new TitleRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          safeEventDispatcher: mockSafeEventDispatcher,
          titleElement: null,
        });
      }).toThrow(
        "[TitleRenderer] 'titleElement' dependency is missing or not a valid DOM element."
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'missing or not a valid DOM element'
          ),
        })
      );
    });

    it('should throw if titleElement is not an ELEMENT_NODE', () => {
      const notAnElement = { nodeType: 3, tagName: 'TEXT' };
      expect(() => {
        new TitleRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          safeEventDispatcher: mockSafeEventDispatcher,
          titleElement: notAnElement,
        });
      }).toThrow(
        "[TitleRenderer] 'titleElement' dependency is missing or not a valid DOM element."
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'missing or not a valid DOM element'
          ),
        })
      );
    });

    it('should throw if titleElement is not an H1 element', () => {
      const divElement = createMockElement('DIV');
      expect(() => {
        new TitleRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          safeEventDispatcher: mockSafeEventDispatcher,
          titleElement: divElement,
        });
      }).toThrow(
        "[TitleRenderer] 'titleElement' must be an H1 element, but received 'DIV'."
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('must be an H1 element'),
        })
      );
    });

    it('should throw if logger is missing', () => {
      expect(() => {
        new TitleRenderer({
          logger: null,
          documentContext: mockDocumentContext,
          safeEventDispatcher: mockSafeEventDispatcher,
          titleElement: mockH1Element,
        });
      }).toThrow('TitleRenderer: Logger dependency is missing or invalid.');
    });

    it('should throw if documentContext is missing', () => {
      expect(() => {
        new TitleRenderer({
          logger: mockLogger,
          documentContext: null,
          safeEventDispatcher: mockSafeEventDispatcher,
          titleElement: mockH1Element,
        });
      }).toThrow(
        'TitleRenderer: DocumentContext dependency is missing or invalid.'
      );
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(() => {
        new TitleRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          safeEventDispatcher: null,
          titleElement: mockH1Element,
        });
      }).toThrow(
        'TitleRenderer: ValidatedEventDispatcher dependency is missing or invalid.'
      );
    });
  });

  // --- set(text) API Tests ---

  describe('set(text)', () => {
    beforeEach(() => {
      mockLogger.debug.mockClear();
      renderer = new TitleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        safeEventDispatcher: mockSafeEventDispatcher,
        titleElement: mockH1Element,
      });
      mockLogger.debug.mockClear();
    });

    it('should set the textContent of the titleElement (happy path)', () => {
      const newTitle = 'New Game Title';
      renderer.set(newTitle);
      expect(mockH1Element.textContent).toBe(newTitle);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[TitleRenderer] Title set to: "${newTitle}"`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    it('should handle setting an empty string', () => {
      renderer.set('');
      expect(mockH1Element.textContent).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TitleRenderer] Title set to: ""'
      );
    });

    it('should not update or log update if the text is the same as the current title', () => {
      const currentTitle = 'Current Title';
      mockH1Element.textContent = currentTitle;

      renderer.set(currentTitle);

      expect(mockH1Element.textContent).toBe(currentTitle);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[TitleRenderer] Title already set to: "${currentTitle}", skipping update.`
      );

      const callsToSetTitle = mockLogger.debug.mock.calls.filter(
        (call) => call[0] === `[TitleRenderer] Title set to: "${currentTitle}"`
      );
      expect(callsToSetTitle.length).toBe(0);
    });

    it('should coerce non-string input to string and log a warning', () => {
      renderer.set(123);
      expect(mockH1Element.textContent).toBe('123');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[TitleRenderer] Received non-string value in set():',
        123
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TitleRenderer] Title set to: "123"'
      );

      mockLogger.warn.mockClear();
      mockLogger.debug.mockClear();

      renderer.set(null);
      expect(mockH1Element.textContent).toBe('null');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[TitleRenderer] Received non-string value in set():',
        null
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TitleRenderer] Title set to: "null"'
      );
    });

    it('should not affect scroll position or window properties', () => {
      const initialScrollTop = 100;
      const initialScrollHeight = 500;
      Object.defineProperty(mockH1Element, 'scrollTop', {
        value: initialScrollTop,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockH1Element, 'scrollHeight', {
        value: initialScrollHeight,
        writable: true,
        configurable: true,
      });
      const windowScrollY = window.scrollY;

      renderer.set('A New Title That Changes Content');

      expect(mockH1Element.scrollTop).toBe(initialScrollTop);
      expect(mockH1Element.scrollHeight).toBe(initialScrollHeight);
      expect(window.scrollY).toBe(windowScrollY);
    });
  });

  // --- Event Handler Tests ---

  describe('Event Handlers', () => {
    beforeEach(() => {
      renderer = new TitleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        safeEventDispatcher: mockSafeEventDispatcher,
        titleElement: mockH1Element,
      });
      jest.spyOn(renderer, 'set');
      mockLogger.debug.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      renderer.set.mockClear();
    });

    it('should handle "core:set_title" event', () => {
      const payload = { text: 'Title from Event' };
      simulateEvent('core:set_title', payload);
      expect(renderer.set).toHaveBeenCalledWith('Title from Event');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should warn on invalid "core:set_title" payload', () => {
      const invalidPayload = { message: 'Wrong property' };
      simulateEvent('core:set_title', invalidPayload);
      expect(renderer.set).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[TitleRenderer] Received 'core:set_title' with invalid payload structure or missing 'text' property:",
        invalidPayload
      );
    });

    it('should handle "initialization:initialization_service:completed" event', () => {
      simulateEvent('initialization:initialization_service:completed');
      expect(renderer.set).toHaveBeenCalledWith('Game Ready');
    });

    it('should handle "initialization:initialization_service:failed" event', () => {
      const payload = { error: 'Core failure', worldName: 'BrokenWorld' };
      const eventEnvelope = {
        type: 'initialization:initialization_service:failed',
        payload,
      };
      simulateEvent(
        'initialization:initialization_service:failed',
        eventEnvelope
      );
      expect(renderer.set).toHaveBeenCalledWith(
        'Initialization Failed (World: BrokenWorld)'
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Overall initialization failed'),
        })
      );
    });

    it('should handle "initialization:initialization_service:failed" event with undefined error', () => {
      const payload = { worldName: 'BrokenWorld' }; // Missing error property
      const eventEnvelope = {
        type: 'initialization:initialization_service:failed',
        payload,
      };
      simulateEvent(
        'initialization:initialization_service:failed',
        eventEnvelope
      );
      expect(renderer.set).toHaveBeenCalledWith(
        'Initialization Failed (World: BrokenWorld)'
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Overall initialization failed. Error: Unknown error occurred'
          ),
        })
      );
    });

    it('should handle "initialization:initialization_service:failed" event with null payload', () => {
      const eventEnvelope = {
        type: 'initialization:initialization_service:failed',
        payload: null,
      };
      simulateEvent(
        'initialization:initialization_service:failed',
        eventEnvelope
      );
      expect(renderer.set).toHaveBeenCalledWith('Initialization Failed');
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Overall initialization failed. Error: Unknown error occurred'
          ),
        })
      );
    });

    it('should handle "initialization:world_loader:started" step event', () => {
      simulateEvent('initialization:world_loader:started', {
        worldName: 'Terra',
      });
      expect(renderer.set).toHaveBeenCalledWith(
        "Loading world data for 'Terra'..."
      );
    });

    it('should handle "initialization:system_initializer:started" step event', () => {
      simulateEvent('initialization:system_initializer:started', {
        tag: 'gfx',
      });
      expect(renderer.set).toHaveBeenCalledWith(
        'Initializing core systems (tag: gfx)...'
      );
    });

    it('should handle "initialization:game_state_initializer:started" step event', () => {
      simulateEvent('initialization:game_state_initializer:started');
      expect(renderer.set).toHaveBeenCalledWith(
        'Setting up initial game state...'
      );
    });

    it('should handle "initialization:world_loader:failed" step event', () => {
      const payload = { error: 'File not found' };
      simulateEvent('initialization:world_loader:failed', payload);
      expect(renderer.set).toHaveBeenCalledWith('world loader Failed');
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'world loader Failed. Error: File not found'
          ),
        })
      );
    });

    it('should handle "initialization:input_setup_service:failed" step event', () => {
      const payload = { error: 'Keybindings conflict' };
      simulateEvent('initialization:input_setup_service:failed', payload);
      expect(renderer.set).toHaveBeenCalledWith('input setup service Failed');
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'input setup service Failed. Error: Keybindings conflict'
          ),
        })
      );
    });

    it('should handle SYSTEM_ERROR_OCCURRED_ID fatal event', () => {
      const payload = {
        message: 'Critical failure',
        error: new Error('Disk full'),
      };
      simulateEvent(SYSTEM_ERROR_OCCURRED_ID, payload);
      expect(renderer.set).toHaveBeenCalledWith('System Error');
    });

    it('should handle "initialization:initialization_service:failed" event with real error payload structure', () => {
      // Simulate the exact payload structure from the real error
      const payload = {
        worldName: 'demo',
        error:
          "ModManifestLoader.loadRequestedManifests: manifest for 'isekai' failed schema validation. See log for Ajv error details.",
        stack:
          "ModsLoaderPhaseError: ModManifestLoader.loadRequestedManifests: manifest for 'isekai' failed schema validation. See log for Ajv error details.\n    at ManifestPhase.execute (http://127.0.0.1:8080/bundle.js:21045:15)\n    at async ModsLoadSession.run (http://127.0.0.1:8080/bundle.js:9402:23)\n    at async ModsLoader.loadMods (http://127.0.0.1:8080/bundle.js:7436:34)\n    at async InitializationService.runInitializationSequence (http://127.0.0.1:8080/bundle.js:65269:28)\n    at async GameEngine._executeInitializationSequence (http://127.0.0.1:8080/bundle.js:66365:9)\n    at async GameEngine.startNewGame (http://127.0.0.1:8080/bundle.js:66483:28)\n    at async startGameStage (http://127.0.0.1:8080/bundle.js:67132:7)\n    at async beginGame (http://127.0.0.1:8080/bundle.js:67553:27)",
      };
      const eventEnvelope = {
        type: 'initialization:initialization_service:failed',
        payload,
      };
      simulateEvent(
        'initialization:initialization_service:failed',
        eventEnvelope
      );
      expect(renderer.set).toHaveBeenCalledWith(
        'Initialization Failed (World: demo)'
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            "Overall initialization failed. Error: ModManifestLoader.loadRequestedManifests: manifest for 'isekai' failed schema validation. See log for Ajv error details."
          ),
        })
      );
    });
  });

  // --- dispose() Tests ---

  describe('dispose()', () => {
    beforeEach(() => {
      renderer = new TitleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        safeEventDispatcher: mockSafeEventDispatcher,
        titleElement: mockH1Element,
      });
      jest.spyOn(RendererBase.prototype, 'dispose');
      mockLogger.debug.mockClear();
    });

    afterEach(() => {
      if (jest.isMockFunction(RendererBase.prototype.dispose)) {
        RendererBase.prototype.dispose.mockRestore();
      }
    });

    it('should call unsubscribe on all active subscriptions', () => {
      const initialSubscriptionCount = unsubscribeSpies.length;
      expect(initialSubscriptionCount).toBe(14);

      renderer.dispose();

      expect(unsubscribeSpies).toHaveLength(initialSubscriptionCount);
      unsubscribeSpies.forEach((spy) => {
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });

    it('should call super.dispose() and log appropriate messages from RendererBase', () => {
      renderer.dispose();
      expect(RendererBase.prototype.dispose).toHaveBeenCalledTimes(1);
      // Check for the actual log messages from RendererBase.dispose()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TitleRenderer] Starting disposal: Unsubscribing VED events and removing DOM listeners.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[TitleRenderer] Finished automated cleanup. Base dispose complete.'
      );
    });

    // REMOVED: This test is no longer valid as TitleRenderer.dispose() only calls super.dispose()
    // and does not have its own direct logging of "Disposing subscriptions."
    // it('should log disposal start', () => {
    //     renderer.dispose();
    //     expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Disposing subscriptions.');
    // });
  });
});

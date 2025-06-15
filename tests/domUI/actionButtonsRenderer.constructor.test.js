// tests/domUI/actionButtonsRenderer.constructor.test.js
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
// Import from specific file for clarity
import { ActionButtonsRenderer } from '../../src/domUI'; // Using index import
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../src/logging/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');
// Mock the factory module itself for constructor tests, but we'll use real instances later
jest.mock('../../src/domUI/domElementFactory.js');

describe('ActionButtonsRenderer', () => {
  let dom;
  let document;
  let docContext;
  let mockLogger;
  let mockVed;
  let mockDomElementFactoryInstance; // To hold instance used in most tests
  let actionButtonsContainer; // The specific container element for this renderer
  const ACTION_BUTTONS_CONTAINER_SELECTOR = '#action-buttons';

  // --- Mock Elements ---
  // Creates a mock element with spied methods, letting JSDOM handle implementation
  const createMockElement = (
    tagName = 'div',
    id = '',
    classes = [],
    textContent = ''
  ) => {
    const element = document.createElement(tagName); // Use JSDOM's createElement
    if (id) element.id = id;
    const classArray = Array.isArray(classes)
      ? classes
      : String(classes)
          .split(' ')
          .filter((c) => c);
    if (classArray.length > 0) {
      element.classList.add(...classArray);
    }
    element.textContent = textContent;

    // Event listener mock store
    element._listeners = {};
    element.addEventListener = jest.fn((event, cb) => {
      if (!element._listeners[event]) {
        element._listeners[event] = [];
      }
      element._listeners[event].push(cb);
    });
    element.removeEventListener = jest.fn(); // Add basic mock

    // Simulate click
    element.click = jest.fn(async () => {
      if (element._listeners['click']) {
        for (const listener of element._listeners['click']) {
          await listener();
        }
      }
    });

    // Spy on native methods we might want to check calls for
    jest.spyOn(element, 'setAttribute');
    jest.spyOn(element, 'remove');

    return element;
  };

  beforeEach(() => {
    // Reset DOM with the *correct* ID for the container
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><div id="game-container"><div id="${ACTION_BUTTONS_CONTAINER_SELECTOR.substring(1)}"></div></div></body></html>`
    );
    document = dom.window.document;
    global.document = document; // Ensure global document is set for DocumentContext
    global.HTMLElement = dom.window.HTMLElement; // Ensure global HTMLElement is set
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;
    // Note: global.Document is not explicitly set here from dom.window.Document,
    // but DocumentContext tries to grab it from global or use a fallback if needed.

    docContext = new DocumentContext(); // Let it pick up global.document

    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher({
      eventBus: {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        dispatch: jest.fn().mockResolvedValue(undefined),
      },
      gameDataRepository: { getEventDefinition: jest.fn() },
      schemaValidator: {
        isSchemaLoaded: jest.fn().mockReturnValue(true),
        validate: jest.fn().mockReturnValue({ isValid: true }),
      },
      logger: mockLogger,
    });

    // Create an *actual* factory instance for most tests, using the real constructor
    mockDomElementFactoryInstance = new DomElementFactory(docContext);
    jest
      .spyOn(mockDomElementFactoryInstance, 'button')
      .mockImplementation((text, cls) => {
        const classes = cls
          ? Array.isArray(cls)
            ? cls
            : cls.split(' ').filter((c) => c)
          : [];
        return createMockElement('button', '', classes, text);
      });

    actionButtonsContainer = document.getElementById(
      ACTION_BUTTONS_CONTAINER_SELECTOR.substring(1)
    );

    if (!actionButtonsContainer) {
      throw new Error(
        `Test setup failed: ${ACTION_BUTTONS_CONTAINER_SELECTOR} container not found in JSDOM.`
      );
    }

    // Logger spies
    jest.spyOn(mockLogger, 'info').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'warn').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'error').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'debug').mockImplementation(() => {});

    // VED spies
    jest.spyOn(mockVed, 'subscribe').mockReturnValue(jest.fn()); // Returns the unsubscribe function
    jest.spyOn(mockVed, 'dispatch').mockResolvedValue(true);
    jest.spyOn(mockVed, 'unsubscribe');

    // Spy on container's methods
    jest.spyOn(actionButtonsContainer, 'appendChild');
    jest.spyOn(actionButtonsContainer, 'removeChild');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.document;
    delete global.HTMLElement;
    delete global.HTMLButtonElement;
    delete global.HTMLInputElement;
    if (document && document.body) {
      document.body.innerHTML = '';
    }
  });

  // Helper to create renderer with overridable parameters
  const createRenderer = (options = {}) => {
    const defaultParams = {
      logger: mockLogger,
      documentContext: docContext,
      validatedEventDispatcher: mockVed,
      domElementFactory: mockDomElementFactoryInstance,
      actionButtonsContainerSelector: ACTION_BUTTONS_CONTAINER_SELECTOR,
      sendButtonSelector: '#player-confirm-turn-button',
      speechInputSelector: '#speech-input',
    };
    return new ActionButtonsRenderer({ ...defaultParams, ...options });
  };

  // --- Test Scenarios ---

  describe('Constructor', () => {
    it('should throw if actionButtonsContainerSelector is missing (null) or not a string', () => {
      // FIXED: Updated expectedErrorMsg to match the SUT's actual error message
      const expectedErrorMsg =
        "[ActionButtonsRenderer] 'actionButtonsContainerSelector' is required and must be a non-empty string.";

      // Test with null selector
      expect(() =>
        createRenderer({ actionButtonsContainerSelector: null })
      ).toThrow(expectedErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
      mockLogger.error.mockClear();

      // Test with a number (not a string)
      expect(() =>
        createRenderer({ actionButtonsContainerSelector: 123 })
      ).toThrow(expectedErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
      mockLogger.error.mockClear();

      // Test with an empty string selector
      expect(() =>
        createRenderer({ actionButtonsContainerSelector: '' })
      ).toThrow(expectedErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    it('should not throw if domElementFactory is missing or invalid', () => {
      expect(() => createRenderer({ domElementFactory: null })).not.toThrow();
      expect(() => createRenderer({ domElementFactory: {} })).not.toThrow();
    });

    it('should subscribe to VED event core:update_available_actions', () => {
      createRenderer();
      expect(mockVed.subscribe).toHaveBeenCalledTimes(1);
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'core:update_available_actions',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "[ActionButtonsRenderer] Subscribed to VED event 'core:update_available_actions' via _subscribe."
        )
      );
    });
  }); // End Constructor describe
}); // End ActionButtonsRenderer describe

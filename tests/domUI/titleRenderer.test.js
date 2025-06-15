// tests/domUI/titleRenderer.test.js
import { beforeEach, describe, expect, it, jest } from '@jest/globals'; // Use if needed for mocking
import { TitleRenderer } from '../../src/domUI/index.js'; // Adjust path as necessary
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

// Mock dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockDocumentContext = {
  query: jest.fn(),
  create: jest.fn(),
  document: {
    // Mock document properties if TitleRenderer's dispose or other methods try to access them
    // For example, if it tries to remove a global event listener from document
  },
};

const mockSafeEventDispatcher = {
  subscribe: jest.fn(() => jest.fn()), // Ensure subscribe returns a mock unsubscribe function
  dispatch: jest.fn(),
};

// Helper to create mock elements with tagName property
const createMockElement = (tagName = 'DIV') => ({
  nodeType: 1, // ELEMENT_NODE
  tagName: tagName.toUpperCase(),
  textContent: '',
  // Add other properties/methods if needed by tests
});

describe('TitleRenderer', () => {
  let mockH1Element;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockH1Element = createMockElement('H1');
    mockH1Element.textContent = 'Initial Title'; // Give it an initial value

    // Reset VED mock to return a new unsubscribe mock for each subscription
    mockSafeEventDispatcher.subscribe.mockImplementation(() => jest.fn());
  });

  // --- Constructor Tests ---

  it('should instantiate successfully with valid dependencies', () => {
    const renderer = new TitleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      titleElement: mockH1Element,
    });
    expect(renderer).toBeInstanceOf(TitleRenderer);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[TitleRenderer] Initialized.')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[TitleRenderer] Attached to H1 element.')
    );
    expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.any(Object)
    );
  });

  it('should throw if titleElement is missing', () => {
    expect(() => {
      new TitleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        safeEventDispatcher: mockSafeEventDispatcher,
        titleElement: null, // Missing element
      });
    }).toThrow(
      "'titleElement' dependency is missing or not a valid DOM element."
    );
    expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({
        message: expect.stringContaining('missing or not a valid DOM element'),
      })
    );
  });

  it('should throw if titleElement is not an ELEMENT_NODE', () => {
    const notAnElement = { nodeType: 3, tagName: 'TEXT' }; // Text node example
    expect(() => {
      new TitleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        safeEventDispatcher: mockSafeEventDispatcher,
        titleElement: notAnElement,
      });
    }).toThrow(
      "'titleElement' dependency is missing or not a valid DOM element."
    );
    expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({
        message: expect.stringContaining('missing or not a valid DOM element'),
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
    }).toThrow("'titleElement' must be an H1 element, but received 'DIV'.");
    expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({
        message: expect.stringContaining('must be an H1 element'),
      })
    );
  });

  // Test base class dependency validation (delegated, but good practice)
  it('should throw if logger is missing', () => {
    expect(() => {
      new TitleRenderer({
        logger: null, // Invalid logger
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
        documentContext: null, // Invalid context
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
        safeEventDispatcher: null, // Invalid dispatcher
        titleElement: mockH1Element,
      });
    }).toThrow(
      'TitleRenderer: ValidatedEventDispatcher dependency is missing or invalid.'
    );
  });

  // --- set(text) API Tests ---

  it('should set the textContent of the titleElement', () => {
    const renderer = new TitleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      titleElement: mockH1Element,
    });
    const newTitle = 'New Game Title';

    renderer.set(newTitle);

    expect(mockH1Element.textContent).toBe(newTitle);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[TitleRenderer] Title set to: "${newTitle}"`
    );
  });

  it('should handle setting an empty string', () => {
    const renderer = new TitleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      titleElement: mockH1Element,
    });
    renderer.set('');
    expect(mockH1Element.textContent).toBe('');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[TitleRenderer] Title set to: ""'
    );
  });

  it('should not update or log if the text is the same as the current title', () => {
    const currentTitle = 'Current Title';
    mockH1Element.textContent = currentTitle;
    const renderer = new TitleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      titleElement: mockH1Element,
    });

    renderer.set(currentTitle); // Set the same title

    expect(mockH1Element.textContent).toBe(currentTitle); // Still the same
    // Check it logged the "skipping update" message
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[TitleRenderer] Title already set to: "${currentTitle}", skipping update.`
    );
    // Ensure it did NOT log the "Title set to" message again for this call during the .set() operation
    const setCalls = mockLogger.debug.mock.calls.filter(
      (call) => call[0] === `[TitleRenderer] Title set to: "${currentTitle}"`
    );
    expect(setCalls.length).toBe(0); // Or 1 if it was set before and this call didn't re-trigger
  });

  it('should coerce non-string input to string and log a warning', () => {
    const renderer = new TitleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      titleElement: mockH1Element,
    });
    renderer.set(123); // Pass a number
    expect(mockH1Element.textContent).toBe('123'); // Coerced to string
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[TitleRenderer] Received non-string value in set():',
      123
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[TitleRenderer] Title set to: "123"'
    ); // Logged the update

    renderer.set(null); // Pass null
    expect(mockH1Element.textContent).toBe('null'); // Coerced to string
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[TitleRenderer] Received non-string value in set():',
      null
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[TitleRenderer] Title set to: "null"'
    );
  });

  // --- dispose() Tests ---

  it('should call super.dispose and log appropriate messages from RendererBase', () => {
    const renderer = new TitleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockSafeEventDispatcher,
      titleElement: mockH1Element,
    });
    renderer.dispose();
    // Check for the initial log message from RendererBase.dispose()
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[TitleRenderer] Starting disposal: Unsubscribing VED events and removing DOM listeners.'
    );
    // Optionally, check for the final log message from RendererBase.dispose()
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[TitleRenderer] Finished automated cleanup. Base dispose complete.'
    );
  });
});

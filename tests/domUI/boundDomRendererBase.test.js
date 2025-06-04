// tests/domUI/boundDomRendererBase.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BoundDomRendererBase } from '../../src/domUI/boundDomRendererBase.js'; // Adjust path as needed

// --- Mocking RendererBase and its dependencies ---

jest.mock('../../src/domUI/rendererBase.js', () => {
  const RendererBaseMock = jest.fn().mockImplementation(function (params) {
    this.logger = params.logger;
    this.documentContext = params.documentContext;
    this.validatedEventDispatcher = params.validatedEventDispatcher;

    if (params.logPrefixOverride) {
      this._logPrefix = params.logPrefixOverride;
    } else {
      this._logPrefix = `[${this.constructor.name}]`;
    }

    this._managedValidatedEventSubscriptions = [];
    this._managedDomListeners = [];
    this._addSubscription = jest.fn((fn) =>
      this._managedValidatedEventSubscriptions.push(fn)
    );
    this._addDomListener = jest.fn((listener) =>
      this._managedDomListeners.push(listener)
    );
  });

  RendererBaseMock.prototype.dispose = jest.fn(function () {
    this.logger.debug(`${this._logPrefix} MockedRendererBase dispose called.`);
  });

  // No longer assigning to an outer scope variable here
  return { RendererBase: RendererBaseMock };
});

// --- Helper to create mock dependencies ---
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockDocumentContext = () => ({
  query: jest.fn(),
  create: jest.fn(),
});

const createMockValidatedEventDispatcher = () => ({
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
  dispatchValidated: jest.fn(),
});

describe('BoundDomRendererBase', () => {
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let ConcreteBoundRenderer;

  // Get the *actual* mock constructor after jest.mock has done its work.
  // This will be the RendererBaseMock function from the jest.mock factory.
  // This is done once for the entire describe block.
  const MockedRendererBaseActual =
    require('../../src/domUI/rendererBase.js').RendererBase;

  beforeEach(() => {
    jest.clearAllMocks(); // Clears call counts etc. on the mock functions, including those on MockedRendererBaseActual.prototype

    mockLogger = createMockLogger();
    mockDocumentContext = createMockDocumentContext();
    mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

    ConcreteBoundRenderer = class extends BoundDomRendererBase {
      constructor(params) {
        super(params);
      }
    };
  });

  it('should throw error if elementsConfig is missing or not an object in constructor', () => {
    const expectedPrefixForLogError = '[ConcreteBoundRenderer]';

    expect(
      () =>
        new ConcreteBoundRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
        })
    ).toThrow("'elementsConfig' must be provided as an object.");
    expect(mockLogger.error).toHaveBeenCalledWith(
      `${expectedPrefixForLogError} 'elementsConfig' must be provided as an object.`
    );

    expect(
      () =>
        new ConcreteBoundRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          elementsConfig: null,
        })
    ).toThrow("'elementsConfig' must be provided as an object.");
    expect(mockLogger.error).toHaveBeenCalledWith(
      `${expectedPrefixForLogError} 'elementsConfig' must be provided as an object.`
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(2);
  });

  it('should initialize elements object even with empty elementsConfig', () => {
    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig: {},
    });
    expect(renderer.elements).toEqual({});
  });

  it('should bind required elements successfully using shorthand and full config', () => {
    const mockTitleElement = {
      nodeType: 1,
      tagName: 'H1',
      constructor: { name: 'HTMLHeadingElement' },
    };
    const mockContainerElement = {
      nodeType: 1,
      tagName: 'DIV',
      constructor: { name: 'HTMLDivElement' },
    };
    mockDocumentContext.query.mockImplementation((selector) => {
      if (selector === '#title') return mockTitleElement;
      if (selector === '.container') return mockContainerElement;
      return null;
    });

    const elementsConfig = {
      title: '#title',
      mainContainer: { selector: '.container', required: true },
    };

    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
    });

    expect(renderer.elements.title).toBe(mockTitleElement);
    expect(renderer.elements.mainContainer).toBe(mockContainerElement);
    expect(mockDocumentContext.query).toHaveBeenCalledWith('#title');
    expect(mockDocumentContext.query).toHaveBeenCalledWith('.container');
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Successfully bound element 'title' to selector '#title'."
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Successfully bound element 'mainContainer' to selector '.container'."
    );
  });

  it('should log an error if a required element (default) is not found', () => {
    mockDocumentContext.query.mockReturnValue(null);
    const elementsConfig = {
      missingRequired: { selector: '#missing' },
    };
    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
    });
    expect(renderer.elements.missingRequired).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Element 'missingRequired' with selector '#missing' not found. (Required)"
    );
  });

  it('should log an error if a required element (explicit) is not found', () => {
    mockDocumentContext.query.mockReturnValue(null);
    const elementsConfig = {
      anotherMissing: { selector: '#another', required: true },
    };
    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
    });
    expect(renderer.elements.anotherMissing).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Element 'anotherMissing' with selector '#another' not found. (Required)"
    );
  });

  it('should log a warning if an optional element is not found', () => {
    mockDocumentContext.query.mockReturnValue(null);
    const elementsConfig = {
      missingOptional: { selector: '#optional', required: false },
    };
    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
    });
    expect(renderer.elements.missingOptional).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Element 'missingOptional' with selector '#optional' not found. (Optional)"
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should handle invalid entry in elementsConfig gracefully and log a warning', () => {
    const elementsConfig = {
      validEntry: '#valid-selector',
      invalidEntry: { notASelectorKey: 'foo' },
    };
    mockDocumentContext.query.mockImplementation((selector) => {
      if (selector === '#valid-selector') return { nodeType: 1 };
      return null;
    });

    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
    });
    expect(renderer.elements.invalidEntry).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Invalid configuration for element key 'invalidEntry'. Skipping.",
      { configValue: { notASelectorKey: 'foo' } }
    );
  });

  it('should log a warning if element type does not match expectedType', () => {
    const mockDivElement = document.createElement('div');
    mockDocumentContext.query.mockReturnValue(mockDivElement);
    const elementsConfig = {
      typedElement: {
        selector: '#div-as-button',
        expectedType: HTMLButtonElement,
      },
    };
    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
    });
    expect(renderer.elements.typedElement).toBe(mockDivElement);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Element 'typedElement' (selector: '#div-as-button') was found but is not of expected type 'HTMLButtonElement'. Found type: 'HTMLDivElement'.",
      { element: mockDivElement }
    );
  });

  it('should correctly bind element if expectedType matches', () => {
    const mockButtonElement = document.createElement('button');
    mockDocumentContext.query.mockReturnValue(mockButtonElement);
    const elementsConfig = {
      correctlyTypedElement: {
        selector: '#real-button',
        expectedType: HTMLButtonElement,
      },
    };
    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
    });
    expect(renderer.elements.correctlyTypedElement).toBe(mockButtonElement);
    const warnCalls = mockLogger.warn.mock.calls;
    const typeMismatchWarning = warnCalls.find((call) =>
      call[0].includes('not of expected type')
    );
    expect(typeMismatchWarning).toBeUndefined();
  });

  it('should log an error if documentContext.query throws an error for a required element', () => {
    const queryError = new Error('Query failed');
    mockDocumentContext.query.mockImplementation((selector) => {
      if (selector === '#failing-selector') {
        throw queryError;
      }
      return null;
    });
    const elementsConfig = {
      failingElement: { selector: '#failing-selector', required: true },
    };
    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
      logPrefixOverride: '[QueryFailTest]',
    });
    expect(renderer.elements.failingElement).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Error querying for element 'failingElement' with selector '#failing-selector':",
      queryError
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      "[ConcreteBoundRenderer] Element 'failingElement' with selector '#failing-selector' not found. (Required)"
    );
  });

  it('dispose method should clear elements object and call super.dispose', () => {
    const mockElement = document.createElement('div'); // Use JSDOM element
    mockDocumentContext.query.mockReturnValue(mockElement);
    const elementsConfig = { anElement: '#some-selector' };

    const renderer = new ConcreteBoundRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      elementsConfig,
      logPrefixOverride: '[TestDispose]',
    });
    expect(renderer.elements.anElement).toBe(mockElement);

    // MockedRendererBaseActual is now available from the describe scope
    const superDisposeSpy = jest.spyOn(
      MockedRendererBaseActual.prototype,
      'dispose'
    );

    renderer.dispose();

    expect(superDisposeSpy).toHaveBeenCalledTimes(1);
    expect(renderer.elements).toEqual({});
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[ConcreteBoundRenderer] Bound DOM elements cleared.'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[ConcreteBoundRenderer] MockedRendererBase dispose called.'
    );

    superDisposeSpy.mockRestore();
  });
});

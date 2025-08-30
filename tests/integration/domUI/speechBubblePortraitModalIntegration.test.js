/**
 * @file Integration test to verify SpeechBubbleRenderer and PortraitModalRenderer work together
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { SpeechBubbleRenderer } from '../../../src/domUI/speechBubbleRenderer.js';
import { PortraitModalRenderer } from '../../../src/domUI/portraitModalRenderer.js';

describe('SpeechBubbleRenderer and PortraitModalRenderer Integration', () => {
  let container;
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockEntityManager;
  let mockDomElementFactory;
  let mockEntityDisplayDataProvider;

  beforeEach(() => {
    container = new AppContainer();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Setup mock document context
    mockDocumentContext = {
      document: {
        body: {
          contains: jest.fn(() => true),
          appendChild: jest.fn(),
        },
        activeElement: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      query: jest.fn((selector) => {
        // Return mock elements for required selectors
        const mockElement = {
          style: { display: 'none' },
          classList: { add: jest.fn(), remove: jest.fn() },
          setAttribute: jest.fn(),
          focus: jest.fn(),
          textContent: '',
          src: '',
          alt: '',
        };
        return mockElement;
      }),
      create: jest.fn((elementType) => {
        // Mock create method for document context
        const mockElement = {
          style: {},
          classList: { add: jest.fn(), remove: jest.fn() },
          setAttribute: jest.fn(),
          textContent: '',
          appendChild: jest.fn(),
        };
        return mockElement;
      }),
    };

    // Setup mock event dispatcher
    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getEntity: jest.fn(),
      hasEntity: jest.fn(),
      createEntity: jest.fn(),
      deleteEntity: jest.fn(),
    };

    // Setup mock DOM element factory
    mockDomElementFactory = {
      create: jest.fn(() => ({
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() },
        setAttribute: jest.fn(),
        textContent: '',
      })),
      div: jest.fn(() => ({
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() },
        setAttribute: jest.fn(),
        className: '',
        appendChild: jest.fn(),
        parentNode: { removeChild: jest.fn() },
      })),
      img: jest.fn(() => ({
        style: { width: '', height: '' },
        classList: { add: jest.fn(), remove: jest.fn() },
        setAttribute: jest.fn(),
        src: '',
        alt: '',
      })),
      button: jest.fn(() => ({
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() },
        setAttribute: jest.fn(),
        focus: jest.fn(),
      })),
      span: jest.fn(() => ({
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() },
        textContent: '',
      })),
    };

    // Setup mock entity display data provider
    mockEntityDisplayDataProvider = {
      getDisplayData: jest.fn(() => ({
        name: 'Test Entity',
        description: 'Test Description',
      })),
    };

    // Register dependencies
    container.register('ILogger', mockLogger);
    container.register('IDocumentContext', mockDocumentContext);
    container.register(
      'IValidatedEventDispatcher',
      mockValidatedEventDispatcher
    );
    container.register('IEntityManager', mockEntityManager);
    container.register('DomElementFactory', mockDomElementFactory);
    container.register(
      'EntityDisplayDataProvider',
      mockEntityDisplayDataProvider
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Dependency Validation', () => {
    it('should successfully create PortraitModalRenderer with required methods', () => {
      // Create PortraitModalRenderer instance
      const portraitModalRenderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      // Verify it has both showModal and hideModal methods
      expect(typeof portraitModalRenderer.showModal).toBe('function');
      expect(typeof portraitModalRenderer.hideModal).toBe('function');
      expect(typeof portraitModalRenderer.hide).toBe('function');
    });

    it('should successfully create SpeechBubbleRenderer with PortraitModalRenderer', () => {
      // Create PortraitModalRenderer instance
      const portraitModalRenderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      // This should not throw an error about missing hideModal method
      expect(() => {
        const speechBubbleRenderer = new SpeechBubbleRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          entityManager: mockEntityManager,
          domElementFactory: mockDomElementFactory,
          entityDisplayDataProvider: mockEntityDisplayDataProvider,
          portraitModalRenderer: portraitModalRenderer,
        });
      }).not.toThrow();
    });

    it('should validate that hideModal method works correctly', () => {
      // Create PortraitModalRenderer instance
      const portraitModalRenderer = new PortraitModalRenderer({
        documentContext: mockDocumentContext,
        domElementFactory: mockDomElementFactory,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      // Create SpeechBubbleRenderer with the portraitModalRenderer
      const speechBubbleRenderer = new SpeechBubbleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        entityManager: mockEntityManager,
        domElementFactory: mockDomElementFactory,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        portraitModalRenderer: portraitModalRenderer,
      });

      // Show the modal
      const mockElement = { focus: jest.fn(), offsetParent: {} };
      portraitModalRenderer.showModal(
        '/test/portrait.jpg',
        'Test Speaker',
        mockElement
      );
      expect(portraitModalRenderer.isVisible).toBe(true);

      // Hide using hideModal method
      portraitModalRenderer.hideModal();
      expect(portraitModalRenderer.isVisible).toBe(false);
    });

    it('should work with DI container registration', () => {
      // Register PortraitModalRenderer in container with proper class registration
      container.register('PortraitModalRenderer', PortraitModalRenderer, {
        lifecycle: 'singleton',
        dependencies: ['IDocumentContext', 'DomElementFactory', 'ILogger', 'IValidatedEventDispatcher']
      });

      // Register SpeechBubbleRenderer that depends on PortraitModalRenderer
      container.register('SpeechBubbleRenderer', SpeechBubbleRenderer, {
        lifecycle: 'singleton',
        dependencies: [
          'ILogger',
          'IDocumentContext',
          'IValidatedEventDispatcher',
          'IEntityManager',
          'DomElementFactory',
          'EntityDisplayDataProvider',
          'PortraitModalRenderer'
        ]
      });

      // This should successfully resolve without errors
      expect(() => {
        const speechBubbleRenderer = container.resolve('SpeechBubbleRenderer');
        expect(speechBubbleRenderer).toBeInstanceOf(SpeechBubbleRenderer);
      }).not.toThrow();
    });
  });

  describe('Fallback Behavior', () => {
    it('should handle null portraitModalRenderer gracefully in SpeechBubbleRenderer', () => {
      // SpeechBubbleRenderer should work even without portraitModalRenderer
      expect(() => {
        const speechBubbleRenderer = new SpeechBubbleRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          entityManager: mockEntityManager,
          domElementFactory: mockDomElementFactory,
          entityDisplayDataProvider: mockEntityDisplayDataProvider,
          portraitModalRenderer: null, // Explicitly null
        });
      }).not.toThrow();

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('PortraitModalRenderer not available')
      );
    });
  });
});

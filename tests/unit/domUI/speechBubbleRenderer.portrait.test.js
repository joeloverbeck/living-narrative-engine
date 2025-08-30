/**
 * @file Unit tests for SpeechBubbleRenderer portrait click feature
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { SpeechBubbleRenderer } from '../../../src/domUI/speechBubbleRenderer.js';
import { PORTRAIT_CLICKED } from '../../../src/constants/eventIds.js';

describe('SpeechBubbleRenderer - Portrait Click Feature', () => {
  let testBed;
  let mockPortraitModalRenderer;
  let speechBubbleRenderer;
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockEntityManager;
  let mockDomElementFactory;
  let mockEntityDisplayDataProvider;

  beforeEach(() => {
    testBed = createTestBed();

    // Setup mocks
    mockLogger = testBed.createMockLogger();
    mockValidatedEventDispatcher = testBed.createMock('eventDispatcher', [
      'dispatch',
      'subscribe',
    ]);
    mockEntityManager = testBed.createMock('entityManager', [
      'getEntityInstance',
      'hasComponent',
    ]);
    mockEntityDisplayDataProvider = testBed.createMock(
      'entityDisplayDataProvider',
      ['getEntityName', 'getEntityPortraitPath']
    );

    // Setup portrait modal renderer mock
    mockPortraitModalRenderer = testBed.createMock('portraitModalRenderer', [
      'showModal',
      'hideModal',
    ]);

    // Setup document context mock
    const mockOutputDiv = testBed.createMockElement('div');
    mockOutputDiv.scrollHeight = 100;
    const mockMessageList = testBed.createMockElement('div');

    mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === '#outputDiv') return mockOutputDiv;
        if (selector === '#message-list') return mockMessageList;
        return null;
      }),
      create: jest.fn((tagName) => testBed.createMockElement(tagName)),
      document: {
        createDocumentFragment: jest.fn(() => {
          const frag = testBed.createMockElement('fragment');
          frag.nodeType = 11;
          return frag;
        }),
        createTextNode: jest.fn((text) => ({
          nodeType: 3,
          textContent: String(text),
          data: String(text),
          parentNode: null,
        })),
      },
    };

    // Setup DOM element factory mock
    mockDomElementFactory = {
      create: jest.fn((tagName, options = {}) => {
        const el = testBed.createMockElement(tagName);
        if (options.cls) {
          const classes = Array.isArray(options.cls)
            ? options.cls
            : options.cls.split(' ');
          classes.forEach((c) => el.classList.add(c));
        }
        return el;
      }),
      span: jest.fn((cls) => {
        const el = testBed.createMockElement('span');
        if (cls) el.classList.add(cls);
        return el;
      }),
      img: jest.fn((src, alt, cls) => {
        const el = testBed.createMockElement('img');
        el.src = src;
        el.alt = alt;
        el.setAttribute('src', src);
        el.setAttribute('alt', alt);
        if (cls) el.classList.add(cls);
        return el;
      }),
      div: jest.fn((cls) => {
        const el = testBed.createMockElement('div');
        if (cls) el.classList.add(cls);
        return el;
      }),
      button: jest.fn((cls) => {
        const el = testBed.createMockElement('button');
        if (cls) el.classList.add(cls);
        return el;
      }),
    };

    // Create SpeechBubbleRenderer instance
    speechBubbleRenderer = new SpeechBubbleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      entityManager: mockEntityManager,
      domElementFactory: mockDomElementFactory,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      portraitModalRenderer: mockPortraitModalRenderer,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Portrait Click Handler', () => {
    let mockPortraitImg;
    let eventHandlers;

    beforeEach(() => {
      mockPortraitImg = testBed.createMockElement('img');
      mockPortraitImg.style = { cursor: '' };
      mockPortraitImg.setAttribute = jest.fn();
      mockPortraitImg.click = jest.fn();

      // Capture event handlers when _addDomListener is called
      eventHandlers = {};
      jest
        .spyOn(speechBubbleRenderer, '_addDomListener')
        .mockImplementation((element, event, handler) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push({ element, handler });
        });

      mockDomElementFactory.img.mockReturnValue(mockPortraitImg);
      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/path.jpg'
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');
    });

    it('should make portraits clickable with cursor pointer', () => {
      // Render speech with portrait
      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      expect(mockPortraitImg.style.cursor).toBe('pointer');
    });

    it('should add ARIA attributes for accessibility', () => {
      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'role',
        'button'
      );
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'tabindex',
        '0'
      );
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'aria-label',
        'View full portrait of Character'
      );
    });

    it('should attach click event listener', () => {
      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      // Verify click handler was attached
      const clickHandlers = eventHandlers.click;
      expect(clickHandlers).toBeDefined();
      expect(clickHandlers.length).toBeGreaterThan(0);

      // Find the handler for the portrait image
      const portraitClickHandler = clickHandlers.find(
        (h) => h.element === mockPortraitImg
      );
      expect(portraitClickHandler).toBeDefined();

      // Trigger the click handler
      portraitClickHandler.handler();

      expect(mockPortraitModalRenderer.showModal).toHaveBeenCalled();
    });

    it('should attach keyboard event listener for Enter/Space', () => {
      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      // Verify keydown handler was attached
      const keydownHandlers = eventHandlers.keydown;
      expect(keydownHandlers).toBeDefined();
      expect(keydownHandlers.length).toBeGreaterThan(0);

      // Find the handler for the portrait image
      const portraitKeyHandler = keydownHandlers.find(
        (h) => h.element === mockPortraitImg
      );
      expect(portraitKeyHandler).toBeDefined();

      // Test Enter key
      const enterEvent = { key: 'Enter', preventDefault: jest.fn() };
      portraitKeyHandler.handler(enterEvent);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(mockPortraitImg.click).toHaveBeenCalled();

      // Reset mock
      mockPortraitImg.click.mockClear();

      // Test Space key
      const spaceEvent = { key: ' ', preventDefault: jest.fn() };
      portraitKeyHandler.handler(spaceEvent);
      expect(spaceEvent.preventDefault).toHaveBeenCalled();
      expect(mockPortraitImg.click).toHaveBeenCalled();
    });

    it('should not trigger on other keys', () => {
      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      const keydownHandlers = eventHandlers.keydown;
      const portraitKeyHandler = keydownHandlers.find(
        (h) => h.element === mockPortraitImg
      );

      // Test other key
      const tabEvent = { key: 'Tab', preventDefault: jest.fn() };
      portraitKeyHandler.handler(tabEvent);
      expect(tabEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockPortraitImg.click).not.toHaveBeenCalled();
    });

    it('should call modal showModal with correct parameters on click', () => {
      const portraitPath = '/path.jpg';
      const speakerName = 'Character';

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      const clickHandlers = eventHandlers.click;
      const portraitClickHandler = clickHandlers.find(
        (h) => h.element === mockPortraitImg
      );

      // Trigger click
      portraitClickHandler.handler();

      expect(mockPortraitModalRenderer.showModal).toHaveBeenCalledWith(
        portraitPath,
        speakerName,
        mockPortraitImg
      );
    });

    it('should log debug message when portrait is clicked', () => {
      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      const clickHandlers = eventHandlers.click;
      const portraitClickHandler = clickHandlers.find(
        (h) => h.element === mockPortraitImg
      );

      // Trigger click
      portraitClickHandler.handler();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Portrait clicked for Character'
      );
    });
  });

  describe('#addPortrait Method Parameters', () => {
    it('should accept three parameters: container, portraitPath, and speakerName', () => {
      const container = testBed.createMockElement('div');
      const portraitPath = '/path.jpg';
      const speakerName = 'Character';

      // Access private method through renderSpeech
      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        portraitPath
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue(speakerName);

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // Verify img was created with correct parameters
      expect(mockDomElementFactory.img).toHaveBeenCalledWith(
        portraitPath,
        `Portrait of ${speakerName}`,
        'speech-portrait'
      );
    });

    it('should make all portraits clickable by default', () => {
      // Test with any character type - all should be clickable
      const testCases = [
        { name: 'Human Character', path: '/human.jpg' },
        { name: 'AI Character', path: '/ai.jpg' },
        { name: 'Any Character', path: '/any.jpg' },
      ];

      testCases.forEach((testCase) => {
        // Reset mocks
        mockDomElementFactory.img.mockClear();
        const mockImg = testBed.createMockElement('img');
        mockImg.style = { cursor: '' };
        mockDomElementFactory.img.mockReturnValue(mockImg);

        mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
          testCase.path
        );
        mockEntityDisplayDataProvider.getEntityName.mockReturnValue(
          testCase.name
        );

        speechBubbleRenderer.renderSpeech({
          entityId: 'test-entity',
          speechContent: 'Test',
        });

        expect(mockImg.style.cursor).toBe('pointer');
      });
    });

    it('should return true when portrait is successfully added', () => {
      const mockImg = testBed.createMockElement('img');
      mockImg.style = { cursor: '' };
      mockDomElementFactory.img.mockReturnValue(mockImg);

      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/path.jpg'
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // The portrait was added successfully (has-portrait class added)
      const speechEntryCall = mockDomElementFactory.create.mock.calls.find(
        (call) => call[1]?.cls === 'speech-entry'
      );
      expect(speechEntryCall).toBeDefined();
      const speechEntry = mockDomElementFactory.create.mock.results.find(
        (result) =>
          result.value && result.value.classList.contains('speech-entry')
      )?.value;

      expect(speechEntry?.classList.add).toHaveBeenCalledWith('has-portrait');
    });

    it('should return false when portrait path is null', () => {
      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // The portrait was not added (no-portrait class added)
      const speechEntry = mockDomElementFactory.create.mock.results.find(
        (result) =>
          result.value && result.value.classList.contains('speech-entry')
      )?.value;

      expect(speechEntry?.classList.add).toHaveBeenCalledWith('no-portrait');
    });
  });

  describe('Error Handling', () => {
    it('should handle modal renderer not available gracefully', () => {
      // Create renderer without portraitModalRenderer
      const speechBubbleRendererNoModal = new SpeechBubbleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        entityManager: mockEntityManager,
        domElementFactory: mockDomElementFactory,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        portraitModalRenderer: null, // Not provided
      });

      // Setup event handler tracking
      const eventHandlers = {};
      jest
        .spyOn(speechBubbleRendererNoModal, '_addDomListener')
        .mockImplementation((element, event, handler) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push({ element, handler });
        });

      const mockImg = testBed.createMockElement('img');
      mockImg.style = { cursor: '' };
      mockDomElementFactory.img.mockReturnValue(mockImg);

      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/path.jpg'
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      speechBubbleRendererNoModal.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // Find and trigger click handler
      const clickHandlers = eventHandlers.click;
      const portraitClickHandler = clickHandlers.find(
        (h) => h.element === mockImg
      );
      portraitClickHandler.handler();

      // Should fall back to event dispatch
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: PORTRAIT_CLICKED,
        payload: {
          portraitPath: '/path.jpg',
          speakerName: 'Character',
          originalElement: mockImg,
        },
      });
    });

    it('should handle modal renderer showModal throwing error', () => {
      const mockImg = testBed.createMockElement('img');
      mockImg.style = { cursor: '' };
      mockDomElementFactory.img.mockReturnValue(mockImg);

      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/path.jpg'
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      // Make showModal throw an error
      mockPortraitModalRenderer.showModal.mockImplementation(() => {
        throw new Error('Modal error');
      });

      // Setup event handler tracking
      const eventHandlers = {};
      jest
        .spyOn(speechBubbleRenderer, '_addDomListener')
        .mockImplementation((element, event, handler) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push({ element, handler });
        });

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // Find and trigger click handler
      const clickHandlers = eventHandlers.click;
      const portraitClickHandler = clickHandlers.find(
        (h) => h.element === mockImg
      );
      portraitClickHandler.handler();

      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Failed to show portrait modal directly',
        expect.any(Error)
      );

      // Should fall back to event dispatch
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: PORTRAIT_CLICKED,
        payload: {
          portraitPath: '/path.jpg',
          speakerName: 'Character',
          originalElement: mockImg,
        },
      });
    });

    it('should handle missing portrait path gracefully', () => {
      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // Should not create an image
      expect(mockDomElementFactory.img).not.toHaveBeenCalled();

      // Should add no-portrait class
      const speechEntry = mockDomElementFactory.create.mock.results.find(
        (result) =>
          result.value && result.value.classList.contains('speech-entry')
      )?.value;

      expect(speechEntry?.classList.add).toHaveBeenCalledWith('no-portrait');
    });

    it('should handle img factory returning null', () => {
      mockDomElementFactory.img.mockReturnValue(null);
      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/path.jpg'
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Failed to create portraitImg element.'
      );

      // Should add no-portrait class
      const speechEntry = mockDomElementFactory.create.mock.results.find(
        (result) =>
          result.value && result.value.classList.contains('speech-entry')
      )?.value;

      expect(speechEntry?.classList.add).toHaveBeenCalledWith('no-portrait');
    });
  });

  describe('Integration with Portrait Modal', () => {
    it('should use direct modal integration when available', () => {
      const mockImg = testBed.createMockElement('img');
      mockImg.style = { cursor: '' };
      mockDomElementFactory.img.mockReturnValue(mockImg);

      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/path.jpg'
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      // Setup event handler tracking
      const eventHandlers = {};
      jest
        .spyOn(speechBubbleRenderer, '_addDomListener')
        .mockImplementation((element, event, handler) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push({ element, handler });
        });

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // Find and trigger click handler
      const clickHandlers = eventHandlers.click;
      const portraitClickHandler = clickHandlers.find(
        (h) => h.element === mockImg
      );
      portraitClickHandler.handler();

      // Should call showModal directly
      expect(mockPortraitModalRenderer.showModal).toHaveBeenCalledWith(
        '/path.jpg',
        'Character',
        mockImg
      );

      // Should NOT dispatch event
      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should attach load and error event handlers for portrait images', () => {
      const mockImg = testBed.createMockElement('img');
      mockImg.style = { cursor: '' };
      mockDomElementFactory.img.mockReturnValue(mockImg);

      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/path.jpg'
      );
      mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Character');

      // Setup event handler tracking
      const eventHandlers = {};
      jest
        .spyOn(speechBubbleRenderer, '_addDomListener')
        .mockImplementation((element, event, handler, options) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push({ element, handler, options });
        });

      // Mock scrollToBottom
      jest
        .spyOn(speechBubbleRenderer, 'scrollToBottom')
        .mockImplementation(() => {});

      speechBubbleRenderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Test',
      });

      // Verify load handler was attached with once: true
      const loadHandlers = eventHandlers.load;
      expect(loadHandlers).toBeDefined();
      const portraitLoadHandler = loadHandlers.find(
        (h) => h.element === mockImg
      );
      expect(portraitLoadHandler).toBeDefined();
      expect(portraitLoadHandler.options).toEqual({ once: true });

      // Trigger load handler
      portraitLoadHandler.handler();
      expect(speechBubbleRenderer.scrollToBottom).toHaveBeenCalled();

      // Verify error handler was attached with once: true
      const errorHandlers = eventHandlers.error;
      expect(errorHandlers).toBeDefined();
      const portraitErrorHandler = errorHandlers.find(
        (h) => h.element === mockImg
      );
      expect(portraitErrorHandler).toBeDefined();
      expect(portraitErrorHandler.options).toEqual({ once: true });

      // Trigger error handler
      speechBubbleRenderer.scrollToBottom.mockClear();
      portraitErrorHandler.handler();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Portrait image failed to load for Character. Scrolling anyway.'
      );
      expect(speechBubbleRenderer.scrollToBottom).toHaveBeenCalled();
    });
  });

  describe('Warning and Validation', () => {
    it('should warn when portraitModalRenderer is not provided', () => {
      // Create renderer without portraitModalRenderer
      const speechBubbleRendererNoModal = new SpeechBubbleRenderer({
        logger: mockLogger,
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        entityManager: mockEntityManager,
        domElementFactory: mockDomElementFactory,
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        // portraitModalRenderer is undefined
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] PortraitModalRenderer not available - using event dispatch fallback'
      );
    });

    it('should validate portraitModalRenderer has required methods', () => {
      // Create a mock with missing methods
      const invalidModalRenderer = {
        showModal: jest.fn(),
        // hideModal is missing
      };

      expect(() => {
        new SpeechBubbleRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          entityManager: mockEntityManager,
          domElementFactory: mockDomElementFactory,
          entityDisplayDataProvider: mockEntityDisplayDataProvider,
          portraitModalRenderer: invalidModalRenderer,
        });
      }).toThrow();
    });
  });
});

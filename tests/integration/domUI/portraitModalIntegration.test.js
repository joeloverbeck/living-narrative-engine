/**
 * @file Integration tests for portrait modal functionality between SpeechBubbleRenderer and PortraitModalRenderer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { SpeechBubbleRenderer } from '../../../src/domUI/speechBubbleRenderer.js';
import { PortraitModalRenderer } from '../../../src/domUI/portraitModalRenderer.js';
import { DISPLAY_SPEECH_ID } from '../../../src/constants/eventIds.js';

describe('Portrait Modal Integration', () => {
  let testBed, renderer, portraitModalRenderer;
  let mockOutputDiv, mockMessageList, mockPortraitImg;

  beforeEach(() => {
    testBed = createTestBed();

    // Set up DOM elements
    mockOutputDiv = testBed.createMockElement('div');
    mockOutputDiv.scrollHeight = 100;
    mockMessageList = testBed.createMockElement('div');
    mockPortraitImg = testBed.createMockElement('img');

    // Override addEventListener to capture click handler
    const originalAddEventListener = mockPortraitImg.addEventListener;
    mockPortraitImg.addEventListener = jest.fn(
      (eventType, handler, options) => {
        originalAddEventListener.call(
          mockPortraitImg,
          eventType,
          handler,
          options
        );
        if (eventType === 'click') {
          mockPortraitImg._clickHandler = handler;
        }
      }
    );

    // Add click method to portrait image mock
    mockPortraitImg.click = jest.fn(() => {
      // Simulate click event
      const clickEvent = { type: 'click', preventDefault: jest.fn() };
      if (mockPortraitImg._clickHandler) {
        mockPortraitImg._clickHandler(clickEvent);
      }
    });

    const mockDocumentContext = {
      query: (selector) => {
        if (selector === '#outputDiv') return mockOutputDiv;
        if (selector === '#message-list') return mockMessageList;
        return null;
      },
      create: jest.fn(),
      document: {
        createTextNode: jest
          .fn()
          .mockReturnValue(testBed.createMockElement('text')),
        body: testBed.createMockElement('body'),
      },
    };

    const mockDomElementFactory = {
      img: jest.fn().mockReturnValue(mockPortraitImg),
      create: jest
        .fn()
        .mockImplementation((tag, options) => testBed.createMockElement(tag)),
      span: jest
        .fn()
        .mockImplementation((className) => testBed.createMockElement('span')),
      div: jest
        .fn()
        .mockImplementation((className) => testBed.createMockElement('div')),
      button: jest
        .fn()
        .mockImplementation((className) => testBed.createMockElement('button')),
    };

    const mockEntityDisplayDataProvider = {
      getEntityName: testBed.createMock('getEntityName', []),
      getEntityPortraitPath: testBed.createMock('getEntityPortraitPath', []),
    };

    // Create PortraitModalRenderer instance
    portraitModalRenderer = new PortraitModalRenderer({
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      logger: testBed.logger,
      validatedEventDispatcher: testBed.eventDispatcher,
    });

    // Add missing hideModal method that SpeechBubbleRenderer validates for
    if (!portraitModalRenderer.hideModal) {
      portraitModalRenderer.hideModal = jest.fn();
    }

    // Create SpeechBubbleRenderer with PortraitModalRenderer dependency
    renderer = new SpeechBubbleRenderer({
      logger: testBed.logger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: testBed.eventDispatcher,
      entityManager: testBed.entityManager,
      domElementFactory: mockDomElementFactory,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      portraitModalRenderer: portraitModalRenderer,
    });
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should integrate portrait modal renderer correctly with dependency injection', () => {
    expect(renderer).toBeDefined();
    expect(portraitModalRenderer).toBeDefined();

    // Verify that the renderer received the modal renderer dependency
    expect(testBed.logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('PortraitModalRenderer not available')
    );
  });

  it('should complete full workflow from speech display to modal rendering', () => {
    // Set up entity data - recreate renderer with proper mock entity display data provider
    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn().mockReturnValue('Test Speaker'),
      getEntityPortraitPath: jest.fn().mockReturnValue('/test-portrait.jpg'),
    };

    // Recreate renderer with the mock entity display data provider
    renderer = new SpeechBubbleRenderer({
      logger: testBed.logger,
      documentContext: {
        query: (selector) => {
          if (selector === '#outputDiv') return mockOutputDiv;
          if (selector === '#message-list') return mockMessageList;
          return null;
        },
        create: jest.fn(),
        document: {
          createTextNode: jest
            .fn()
            .mockReturnValue(testBed.createMockElement('text')),
          body: testBed.createMockElement('body'),
        },
      },
      validatedEventDispatcher: testBed.eventDispatcher,
      entityManager: testBed.entityManager,
      domElementFactory: {
        img: jest.fn().mockReturnValue(mockPortraitImg),
        create: jest
          .fn()
          .mockImplementation((tag, options) => testBed.createMockElement(tag)),
        span: jest
          .fn()
          .mockImplementation((className) => testBed.createMockElement('span')),
        div: jest
          .fn()
          .mockImplementation((className) => testBed.createMockElement('div')),
        button: jest
          .fn()
          .mockImplementation((className) =>
            testBed.createMockElement('button')
          ),
      },
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      portraitModalRenderer: portraitModalRenderer,
    });

    // Mock the portrait modal renderer methods
    const showModalSpy = testBed.createMock('showModal', []);
    portraitModalRenderer.showModal = showModalSpy;

    // Trigger speech rendering first
    renderer.renderSpeech({
      entityId: 'test-entity',
      speechContent: 'Hello world',
    });

    // Verify portrait image was created
    expect(renderer.domElementFactory.img).toHaveBeenCalled();
    expect(mockPortraitImg.style.cursor).toBe('pointer');
    expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith('tabindex', '0');
    expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith('role', 'button');

    // Simulate portrait click by calling the click handler directly
    // Since we can't easily spy on _addDomListener, we'll trigger the click event
    mockPortraitImg.click();

    // Verify modal renderer was called directly
    expect(showModalSpy).toHaveBeenCalledWith(
      '/test-portrait.jpg',
      'Test Speaker',
      mockPortraitImg
    );

    // Verify event dispatcher was NOT used (direct modal integration worked)
    expect(testBed.eventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should gracefully handle modal renderer failure and fallback to events', () => {
    // Set up entity data - recreate renderer with proper mock entity display data provider
    const mockEntityDisplayDataProvider = {
      getEntityName: jest.fn().mockReturnValue('Test Speaker'),
      getEntityPortraitPath: jest.fn().mockReturnValue('/test-portrait.jpg'),
    };

    // Recreate renderer with the mock entity display data provider
    renderer = new SpeechBubbleRenderer({
      logger: testBed.logger,
      documentContext: {
        query: (selector) => {
          if (selector === '#outputDiv') return mockOutputDiv;
          if (selector === '#message-list') return mockMessageList;
          return null;
        },
        create: jest.fn(),
        document: {
          createTextNode: jest
            .fn()
            .mockReturnValue(testBed.createMockElement('text')),
          body: testBed.createMockElement('body'),
        },
      },
      validatedEventDispatcher: testBed.eventDispatcher,
      entityManager: testBed.entityManager,
      domElementFactory: {
        img: jest.fn().mockReturnValue(mockPortraitImg),
        create: jest
          .fn()
          .mockImplementation((tag, options) => testBed.createMockElement(tag)),
        span: jest
          .fn()
          .mockImplementation((className) => testBed.createMockElement('span')),
        div: jest
          .fn()
          .mockImplementation((className) => testBed.createMockElement('div')),
        button: jest
          .fn()
          .mockImplementation((className) =>
            testBed.createMockElement('button')
          ),
      },
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      portraitModalRenderer: portraitModalRenderer,
    });

    // Mock modal renderer to fail
    const showModalSpy = testBed.createMock('showModal', []);
    showModalSpy.mockImplementation(() => {
      throw new Error('Modal renderer failed');
    });
    portraitModalRenderer.showModal = showModalSpy;

    // Trigger speech rendering
    renderer.renderSpeech({
      entityId: 'test-entity',
      speechContent: 'Hello world',
    });

    // Trigger portrait click
    mockPortraitImg.click();

    // Verify modal renderer was attempted
    expect(showModalSpy).toHaveBeenCalled();

    // Verify error was logged
    expect(testBed.logger.error).toHaveBeenCalledWith(
      '[SpeechBubbleRenderer] Failed to show portrait modal directly',
      expect.any(Error)
    );

    // Verify fallback to event dispatch occurred
    expect(testBed.eventDispatcher.dispatch).toHaveBeenCalled();
  });
});

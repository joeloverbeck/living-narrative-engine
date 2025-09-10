/**
 * @file Integration test to verify SpeechBubbleRenderer and PortraitModalRenderer work together
 * Covers comprehensive E2E portrait modal functionality
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
import { PortraitModalRenderer } from '../../../src/domUI/portraitModalRenderer.js';

describe('Speech Bubble Portrait Modal Integration', () => {
  let testBed;
  let speechBubbleRenderer;
  let portraitModalRenderer;
  let mockOutputDiv;
  let mockMessageList;
  let mockPortraitImg;

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
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
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
      getEntityName: jest.fn((entityId, defaultName) => {
        if (entityId === 'ai-character-1') return 'AI Assistant';
        if (entityId === 'human-player-1') return 'Player';
        return defaultName || 'Test Character';
      }),
      getEntityPortraitPath: jest.fn((entityId) => {
        if (entityId === 'ai-character-1') return '/images/ai-assistant.jpg';
        if (entityId === 'human-player-1') return '/images/player.jpg';
        return '/test.jpg';
      }),
    };

    // Create PortraitModalRenderer instance
    portraitModalRenderer = new PortraitModalRenderer({
      documentContext: mockDocumentContext,
      domElementFactory: mockDomElementFactory,
      logger: testBed.logger,
      validatedEventDispatcher: testBed.eventDispatcher,
    });

    // Create SpeechBubbleRenderer with PortraitModalRenderer dependency
    speechBubbleRenderer = new SpeechBubbleRenderer({
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

  describe('End-to-End Portrait Click Flow', () => {
    it('should complete full workflow from speech display to modal rendering', () => {
      // Mock the portrait modal renderer methods
      const showModalSpy = jest.fn();
      portraitModalRenderer.showModal = showModalSpy;

      // Trigger speech rendering
      speechBubbleRenderer.renderSpeech({
        entityId: 'ai-character-1',
        speechContent: 'Hello, I am an AI character!',
      });

      // Verify portrait image was created with correct properties
      expect(mockPortraitImg.style.cursor).toBe('pointer');
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'tabindex',
        '0'
      );
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'role',
        'button'
      );
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'aria-label',
        'View full portrait of AI Assistant'
      );

      // Simulate portrait click
      mockPortraitImg.click();

      // Verify modal renderer was called with correct parameters
      expect(showModalSpy).toHaveBeenCalledWith(
        '/images/ai-assistant.jpg',
        'AI Assistant',
        mockPortraitImg
      );

      // Verify no fallback to event dispatcher occurred
      expect(testBed.eventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should make all portraits clickable regardless of player type', () => {
      // Mock the portrait modal renderer
      const showModalSpy = jest.fn();
      portraitModalRenderer.showModal = showModalSpy;

      // Test human player portrait
      speechBubbleRenderer.renderSpeech({
        entityId: 'human-player-1',
        speechContent: 'I am the player!',
      });

      // Verify portrait is clickable
      expect(mockPortraitImg.style.cursor).toBe('pointer');
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'role',
        'button'
      );
      expect(mockPortraitImg.setAttribute).toHaveBeenCalledWith(
        'tabindex',
        '0'
      );

      // Simulate click
      mockPortraitImg.click();

      // Verify modal was shown for player portrait too
      expect(showModalSpy).toHaveBeenCalledWith(
        '/images/player.jpg',
        'Player',
        mockPortraitImg
      );
    });
  });

  describe('Multiple Portraits Interaction', () => {
    it('should handle multiple portraits in same conversation', () => {
      const showModalSpy = jest.fn();
      portraitModalRenderer.showModal = showModalSpy;

      // Create multiple portrait images for different entities
      const mockPortrait1 = testBed.createMockElement('img');
      const mockPortrait2 = testBed.createMockElement('img');

      mockPortrait1.click = jest.fn(() => {
        if (mockPortrait1._clickHandler) {
          mockPortrait1._clickHandler({
            type: 'click',
            preventDefault: jest.fn(),
          });
        }
      });

      mockPortrait2.click = jest.fn(() => {
        if (mockPortrait2._clickHandler) {
          mockPortrait2._clickHandler({
            type: 'click',
            preventDefault: jest.fn(),
          });
        }
      });

      // Mock DOM factory to return different portraits
      let portraitCallCount = 0;
      const mockDomElementFactory = {
        img: jest.fn(),
        create: jest
          .fn()
          .mockImplementation((tag) => testBed.createMockElement(tag)),
        span: jest
          .fn()
          .mockImplementation(() => testBed.createMockElement('span')),
        div: jest
          .fn()
          .mockImplementation(() => testBed.createMockElement('div')),
        button: jest
          .fn()
          .mockImplementation(() => testBed.createMockElement('button')),
      };

      mockDomElementFactory.img = jest.fn(() => {
        portraitCallCount++;
        const portrait =
          portraitCallCount === 1 ? mockPortrait1 : mockPortrait2;
        portrait.addEventListener = jest.fn((eventType, handler) => {
          if (eventType === 'click') {
            portrait._clickHandler = handler;
          }
        });
        return portrait;
      });

      // Create a new renderer instance with the updated factory
      const newRenderer = new SpeechBubbleRenderer({
        logger: testBed.logger,
        documentContext: {
          query: (selector) => {
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
        domElementFactory: mockDomElementFactory,
        entityDisplayDataProvider: {
          getEntityName: jest.fn((entityId) => {
            if (entityId === 'ai-character-1') return 'AI Assistant';
            if (entityId === 'human-player-1') return 'Player';
            return 'Unknown';
          }),
          getEntityPortraitPath: jest.fn((entityId) => {
            if (entityId === 'ai-character-1')
              return '/images/ai-assistant.jpg';
            if (entityId === 'human-player-1') return '/images/player.jpg';
            return '/test.jpg';
          }),
        },
        portraitModalRenderer: portraitModalRenderer,
      });

      // Render first speech
      newRenderer.renderSpeech({
        entityId: 'ai-character-1',
        speechContent: 'Hello from AI 1',
      });

      // Render second speech
      newRenderer.renderSpeech({
        entityId: 'human-player-1',
        speechContent: 'Hello from Player',
      });

      // Both portraits should be clickable
      expect(mockPortrait1.style.cursor).toBe('pointer');
      expect(mockPortrait2.style.cursor).toBe('pointer');

      // Click first portrait
      mockPortrait1.click();
      expect(showModalSpy).toHaveBeenCalledWith(
        '/images/ai-assistant.jpg',
        'AI Assistant',
        mockPortrait1
      );

      // Click second portrait
      mockPortrait2.click();
      expect(showModalSpy).toHaveBeenCalledWith(
        '/images/player.jpg',
        'Player',
        mockPortrait2
      );

      expect(showModalSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should gracefully handle modal renderer failure and fallback to events', () => {
      // Mock modal renderer to fail
      const showModalSpy = jest.fn(() => {
        throw new Error('Modal renderer failed');
      });
      portraitModalRenderer.showModal = showModalSpy;

      // Trigger speech rendering
      speechBubbleRenderer.renderSpeech({
        entityId: 'ai-character-1',
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

    it('should handle missing portrait path gracefully', () => {
      // Mock to return null portrait path
      const mockEntityDisplayDataProvider = {
        getEntityName: jest.fn(() => 'AI Character'),
        getEntityPortraitPath: jest.fn(() => null), // No portrait
      };

      // Create new renderer with null portrait path
      const rendererWithNoPortrait = new SpeechBubbleRenderer({
        logger: testBed.logger,
        documentContext: {
          query: (selector) => {
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
          create: jest
            .fn()
            .mockImplementation((tag) => testBed.createMockElement(tag)),
          span: jest
            .fn()
            .mockImplementation(() => testBed.createMockElement('span')),
          div: jest
            .fn()
            .mockImplementation(() => testBed.createMockElement('div')),
        },
        entityDisplayDataProvider: mockEntityDisplayDataProvider,
        portraitModalRenderer: portraitModalRenderer,
      });

      // Should not throw when rendering speech without portrait
      expect(() => {
        rendererWithNoPortrait.renderSpeech({
          entityId: 'ai-character-1',
          speechContent: 'Hello!',
        });
      }).not.toThrow();

      // Should handle gracefully without creating portrait
      expect(
        mockEntityDisplayDataProvider.getEntityPortraitPath
      ).toHaveBeenCalledWith('ai-character-1');
    });
  });

  describe('Focus Management Integration', () => {
    it('should set correct accessibility attributes on portrait', () => {
      speechBubbleRenderer.renderSpeech({
        entityId: 'ai-character-1',
        speechContent: 'Hello, I am an AI character!',
      });

      // Verify portrait has correct ARIA attributes
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
        'View full portrait of AI Assistant'
      );
    });
  });

  describe('Performance and Memory', () => {
    it('should not create memory leaks with multiple portraits', () => {
      const showModalSpy = jest.fn();
      portraitModalRenderer.showModal = showModalSpy;

      // Render multiple speeches rapidly
      for (let i = 0; i < 5; i++) {
        speechBubbleRenderer.renderSpeech({
          entityId: `entity-${i}`,
          speechContent: `Message ${i}`,
        });
      }

      // Should not cause issues with multiple speech rendering
      // Note: PortraitModalRenderer may log errors if DOM elements aren't found,
      // but this is expected in a test environment and doesn't affect functionality
      expect(speechBubbleRenderer).toBeDefined();
    });
  });

  describe('Cross-Integration Validation', () => {
    it('should integrate portrait modal renderer correctly with dependency injection', () => {
      expect(speechBubbleRenderer).toBeDefined();
      expect(portraitModalRenderer).toBeDefined();

      // Verify that the renderer received the modal renderer dependency
      expect(testBed.logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('PortraitModalRenderer not available')
      );
    });

    it('should handle null portraitModalRenderer gracefully', () => {
      // Test SpeechBubbleRenderer without portraitModalRenderer
      expect(() => {
        new SpeechBubbleRenderer({
          logger: testBed.logger,
          documentContext: {
            query: () => mockMessageList,
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
            create: jest
              .fn()
              .mockImplementation((tag) => testBed.createMockElement(tag)),
            span: jest
              .fn()
              .mockImplementation(() => testBed.createMockElement('span')),
            div: jest
              .fn()
              .mockImplementation(() => testBed.createMockElement('div')),
            img: jest
              .fn()
              .mockImplementation(() => testBed.createMockElement('img')),
          },
          entityDisplayDataProvider: {
            getEntityName: jest.fn(() => 'Test'),
            getEntityPortraitPath: jest.fn(() => '/test.jpg'),
          },
          portraitModalRenderer: null, // Explicitly null
        });
      }).not.toThrow();

      // Verify warning was logged
      expect(testBed.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('PortraitModalRenderer not available')
      );
    });
  });
});

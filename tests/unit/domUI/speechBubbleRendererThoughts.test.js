/**
 * @file Tests for SpeechBubbleRenderer thought functionality
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SpeechBubbleRenderer } from '../../../src/domUI/speechBubbleRenderer.js';
import {
  DISPLAY_THOUGHT_ID,
  PORTRAIT_CLICKED,
} from '../../../src/constants/eventIds.js';
import { PLAYER_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// Mock the dependencies
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockDocumentContext = {
  document: {
    createDocumentFragment: jest.fn(),
    createTextNode: jest.fn(),
    getElementById: jest.fn(),
    querySelector: jest.fn(),
  },
  query: jest.fn(),
  create: jest.fn(),
};

const mockValidatedEventDispatcher = {
  subscribe: jest.fn().mockReturnValue(() => {}), // Return a mock unsubscribe function
  dispatch: jest.fn(),
};

const mockEntityManager = {
  getEntityInstance: jest.fn(),
};

const mockDomElementFactory = {
  create: jest.fn(),
  span: jest.fn(),
  img: jest.fn(),
};

const mockEntityDisplayDataProvider = {
  getEntityName: jest.fn(),
  getEntityPortraitPath: jest.fn(),
};

const mockPortraitModalRenderer = {
  showModal: jest.fn(),
  hideModal: jest.fn(),
};

// Mock the buildSpeechMeta helper
jest.mock('../../../src/domUI/helpers/buildSpeechMeta.js', () => ({
  buildSpeechMeta: jest.fn(),
}));

import { buildSpeechMeta } from '../../../src/domUI/helpers/buildSpeechMeta.js';

// Helper function to create mock elements
/**
 *
 * @param tag
 */
function createMockElement(tag) {
  return {
    appendChild: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
    },
    style: {
      setProperty: jest.fn(),
      cursor: '',
    },
    setAttribute: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    textContent: '',
    innerHTML: '',
    click: jest.fn(),
  };
}

describe('SpeechBubbleRenderer - Thought Functionality', () => {
  let renderer;
  let mockOutputDiv;
  let mockMessageList;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DOM elements
    mockOutputDiv = {
      appendChild: jest.fn(),
      classList: { add: jest.fn() },
    };

    mockMessageList = {
      appendChild: jest.fn(),
    };

    // Setup DocumentContext query method (used by RendererBase validation and BoundDomRendererBase)
    mockDocumentContext.query.mockImplementation((selector) => {
      if (selector === '#outputDiv') return mockOutputDiv;
      if (selector === '#message-list') return mockMessageList;
      return null;
    });

    // Setup DocumentContext create method (used by RendererBase validation)
    mockDocumentContext.create.mockImplementation((tagName) =>
      createMockElement(tagName)
    );

    // Setup document methods for backward compatibility
    mockDocumentContext.document.getElementById = jest.fn((id) => {
      if (id === 'outputDiv') return mockOutputDiv;
      if (id === 'message-list') return mockMessageList;
      return null;
    });

    mockDocumentContext.document.querySelector = jest.fn((selector) => {
      if (selector === '#outputDiv') return mockOutputDiv;
      if (selector === '#message-list') return mockMessageList;
      return null;
    });

    mockDocumentContext.document.createDocumentFragment = jest
      .fn()
      .mockReturnValue({
        appendChild: jest.fn(),
      });

    // Mock DOM element creation using the helper function

    mockDomElementFactory.create.mockImplementation((tag) =>
      createMockElement(tag)
    );
    mockDomElementFactory.span.mockImplementation(() =>
      createMockElement('span')
    );
    mockDomElementFactory.img.mockImplementation(() =>
      createMockElement('img')
    );

    // Setup entity display data provider
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue(
      'Test Character'
    );
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
      '/path/to/portrait.jpg'
    );

    // Setup entity manager
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn(),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    // Create the renderer instance
    renderer = new SpeechBubbleRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      entityManager: mockEntityManager,
      domElementFactory: mockDomElementFactory,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      portraitModalRenderer: mockPortraitModalRenderer,
    });

    // Mock the scroll method
    renderer.scrollToBottom = jest.fn();
  });

  describe('DISPLAY_THOUGHT_ID event handling', () => {
    it('should subscribe to DISPLAY_THOUGHT_ID event', () => {
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        DISPLAY_THOUGHT_ID,
        expect.any(Function)
      );
    });

    it('should handle valid DISPLAY_THOUGHT_ID event', () => {
      const payload = {
        entityId: 'test-entity-123',
        thoughts: 'I wonder what they are thinking...',
      };

      const eventObject = {
        type: DISPLAY_THOUGHT_ID,
        payload,
      };

      // Get the subscription callback
      const subscriptionCalls =
        mockValidatedEventDispatcher.subscribe.mock.calls;
      const thoughtSubscription = subscriptionCalls.find(
        (call) => call[0] === DISPLAY_THOUGHT_ID
      );
      const thoughtHandler = thoughtSubscription[1];

      // Spy on renderThought method
      jest.spyOn(renderer, 'renderThought');

      // Call the handler
      thoughtHandler(eventObject);

      expect(renderer.renderThought).toHaveBeenCalledWith(payload);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should warn on invalid DISPLAY_THOUGHT_ID event object', () => {
      const subscriptionCalls =
        mockValidatedEventDispatcher.subscribe.mock.calls;
      const thoughtSubscription = subscriptionCalls.find(
        (call) => call[0] === DISPLAY_THOUGHT_ID
      );
      const thoughtHandler = thoughtSubscription[1];

      thoughtHandler(null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received invalid DISPLAY_THOUGHT_ID event object'
        ),
        null
      );
    });

    it('should warn on missing payload', () => {
      const subscriptionCalls =
        mockValidatedEventDispatcher.subscribe.mock.calls;
      const thoughtSubscription = subscriptionCalls.find(
        (call) => call[0] === DISPLAY_THOUGHT_ID
      );
      const thoughtHandler = thoughtSubscription[1];

      const eventObject = { type: DISPLAY_THOUGHT_ID };

      thoughtHandler(eventObject);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received invalid DISPLAY_THOUGHT_ID event object'
        ),
        eventObject
      );
    });

    it('should warn on invalid payload fields', () => {
      const subscriptionCalls =
        mockValidatedEventDispatcher.subscribe.mock.calls;
      const thoughtSubscription = subscriptionCalls.find(
        (call) => call[0] === DISPLAY_THOUGHT_ID
      );
      const thoughtHandler = thoughtSubscription[1];

      const eventObject = {
        type: DISPLAY_THOUGHT_ID,
        payload: {
          entityId: '', // Invalid empty string
          thoughts: 'Valid thoughts',
        },
      };

      thoughtHandler(eventObject);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid payload for DISPLAY_THOUGHT_ID'),
        eventObject.payload
      );
    });
  });

  describe('renderThought method', () => {
    it('should render thought bubble with basic content', () => {
      const payload = {
        entityId: 'test-entity-123',
        thoughts: 'I should be careful here...',
      };

      renderer.renderThought(payload);

      expect(mockDomElementFactory.create).toHaveBeenCalledWith('div', {
        cls: 'thought-entry',
      });
      expect(mockDomElementFactory.create).toHaveBeenCalledWith('div', {
        cls: 'thought-bubble',
      });
      expect(mockDomElementFactory.span).toHaveBeenCalledWith(
        'thought-speaker-intro'
      );
      expect(mockDomElementFactory.span).toHaveBeenCalledWith(
        'thought-content'
      );
      expect(mockEntityDisplayDataProvider.getEntityName).toHaveBeenCalledWith(
        'test-entity-123',
        'Unknown Character'
      );
    });

    it('should render thought bubble with notes', () => {
      const payload = {
        entityId: 'test-entity-123',
        thoughts: 'This is suspicious...',
        notes: [
          {
            text: 'Noticed something odd',
            subject: 'observation',
            subjectType: 'event',
          },
        ],
      };

      const mockMetaFragment = { appendChild: jest.fn() };
      buildSpeechMeta.mockReturnValue(mockMetaFragment);

      renderer.renderThought(payload);

      expect(buildSpeechMeta).toHaveBeenCalledWith(
        mockDocumentContext.document,
        mockDomElementFactory,
        expect.objectContaining({
          notes: payload.notes,
          thoughts: payload.thoughts,
          speakerName: 'Test Character',
          copyAll: expect.objectContaining({
            bubbleType: 'thought',
            isPlayer: false,
            notes: payload.notes,
            thoughts: payload.thoughts,
          }),
        })
      );
    });

    it('should handle player thoughts differently', () => {
      const payload = {
        entityId: 'player-entity',
        thoughts: 'What should I do next?',
      };

      // Mock a player entity
      const mockPlayerEntity = {
        hasComponent: jest.fn().mockImplementation((componentId) => {
          return componentId === 'core:player_type';
        }),
        getComponentData: jest.fn().mockReturnValue({ type: 'human' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockPlayerEntity);

      const mockThoughtEntry = createMockElement('div');
      mockDomElementFactory.create.mockImplementation((tag, options) => {
        if (options?.cls === 'thought-entry') {
          return mockThoughtEntry;
        }
        return createMockElement(tag);
      });

      renderer.renderThought(payload);

      expect(mockThoughtEntry.classList.add).toHaveBeenCalledWith(
        'player-thought'
      );
    });

    it('should error when effectiveSpeechContainer is missing', () => {
      renderer.effectiveSpeechContainer = null;

      const payload = {
        entityId: 'test-entity',
        thoughts: 'Testing thoughts...',
      };

      renderer.renderThought(payload);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot render thought: effectiveSpeechContainer, domElementFactory, or entityManager missing'
        )
      );
    });

    it('should log error and exit when required DOM nodes cannot be created', () => {
      const payload = {
        entityId: 'test-entity',
        thoughts: 'Unlucky thought.',
      };

      mockDomElementFactory.create
        .mockImplementationOnce(() => null)
        .mockImplementation((tag) => createMockElement(tag));

      renderer.renderThought(payload);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create thought entry or bubble div.')
      );
      expect(mockMessageList.appendChild).not.toHaveBeenCalled();
    });

    it('should mark legacy player entities as player thoughts', () => {
      const mockLegacyPlayerEntity = {
        hasComponent: jest.fn(
          (componentId) => componentId === PLAYER_COMPONENT_ID
        ),
        getComponentData: jest.fn(),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(
        mockLegacyPlayerEntity
      );

      const mockThoughtEntry = createMockElement('div');
      mockDomElementFactory.create.mockImplementation((tag, options) => {
        if (options?.cls === 'thought-entry') {
          return mockThoughtEntry;
        }
        return createMockElement(tag);
      });

      renderer.renderThought({
        entityId: 'legacy-player',
        thoughts: 'Legacy players count too.',
      });

      expect(mockThoughtEntry.classList.add).toHaveBeenCalledWith(
        'player-thought'
      );
    });

    it('should scroll when no portrait element can be created', () => {
      const payload = {
        entityId: 'scroll-entity',
        thoughts: 'We have no portrait today.',
      };

      mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/missing/portrait.png'
      );
      mockDomElementFactory.img.mockReturnValue(null);

      renderer.renderThought(payload);

      expect(renderer.scrollToBottom).toHaveBeenCalled();
    });

    it('should log an error when portrait fallback dispatch fails', () => {
      const payload = {
        entityId: 'portrait-entity',
        thoughts: 'Portrait troubles abound.',
      };

      const portraitElement = createMockElement('img');
      mockDomElementFactory.img.mockReturnValue(portraitElement);
      mockPortraitModalRenderer.showModal.mockImplementation(() => {
        throw new Error('modal failure');
      });
      const dispatchError = new Error('dispatch failure');
      mockValidatedEventDispatcher.dispatch.mockImplementation(() => {
        throw dispatchError;
      });

      const addListenerSpy = jest.spyOn(renderer, '_addDomListener');

      renderer.renderThought(payload);

      const clickListenerCall = addListenerSpy.mock.calls.find(
        ([, eventType]) => eventType === 'click'
      );
      expect(clickListenerCall).toBeDefined();

      const clickHandler = clickListenerCall[2];
      clickHandler();

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PORTRAIT_CLICKED,
          payload: expect.objectContaining({
            portraitPath: '/path/to/portrait.jpg',
            speakerName: 'Test Character',
            originalElement: portraitElement,
          }),
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to dispatch PORTRAIT_CLICKED event'),
        dispatchError
      );

      addListenerSpy.mockRestore();
    });
  });
});

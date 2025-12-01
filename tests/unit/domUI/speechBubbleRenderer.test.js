// tests/domUI / speechBubbleRenderer.test.js;

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { SpeechBubbleRenderer } from '../../../src/domUI';
import { BoundDomRendererBase } from '../../../src/domUI';
import {
  DISPLAY_SPEECH_ID,
  PORTRAIT_CLICKED,
} from '../../../src/constants/eventIds';
import {
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
} from '../../../src/constants/componentIds';

const DEFAULT_SPEAKER_NAME_IN_TEST = 'Unknown Speaker';

// Mock buildSpeechMeta
jest.mock('../../../src/domUI/helpers/buildSpeechMeta.js', () => ({
  buildSpeechMeta: jest.fn(),
}));

// --- Fully Mocked Factories ---
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createGenericMockElement = (tagName) => {
  const element = {
    tagName,
    classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
    style: { setProperty: jest.fn() },
    _attributes: {},
    _childNodes: [],
    parentNode: null,
    _debug_id: Math.random().toString(36).substr(2, 5),
    _rawHtmlSet: '',

    setAttribute: jest.fn(function (name, value) {
      this._attributes[name] = value;
    }),
    getAttribute: jest.fn(function (name) {
      return this._attributes[name];
    }),
    appendChild: jest.fn(function (child) {
      if (!child) return child;
      if (
        child.parentNode &&
        child.parentNode !== this &&
        typeof child.parentNode.removeChild === 'function'
      ) {
        child.parentNode.removeChild(child);
      }
      this._childNodes.push(child);
      if (typeof child === 'object' && child !== null) {
        child.parentNode = this;
      }
      return child;
    }),
    removeChild: jest.fn(function (child) {
      const index = this._childNodes.indexOf(child);
      if (index > -1) {
        const removedNode = this._childNodes.splice(index, 1)[0];
        if (typeof removedNode === 'object' && removedNode !== null) {
          removedNode.parentNode = null;
        }
        return removedNode;
      }
      return null;
    }),
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(() => null),

    get innerHTML() {
      return this._rawHtmlSet;
    },
    set innerHTML(html) {
      this._rawHtmlSet = String(html);
      this._childNodes = []; // Clear previous children
      // Simulate that setting innerHTML populates childNodes
      if (html) {
        const mockChild = {
          nodeType: 1, // Represents a mock element containing the HTML
          textContent: html,
          parentNode: this,
          // When the SUT does `while (tempSpan.firstChild)`, this needs to work.
          get firstChild() {
            // This is a simplified mock; a real implementation is complex.
            // For the SUT's loop, we just need to return something once, then null.
            if (this.parentNode?._childNodes.length > 0) {
              return this.parentNode._childNodes.shift();
            }
            return null;
          },
        };
        // The SUT's `while` loop will consume this.
        this._childNodes.push(mockChild);
      }
    },
    get firstChild() {
      return this._childNodes.length > 0 ? this._childNodes[0] : null;
    },
    set textContent(text) {
      this._childNodes = [];
      this._rawHtmlSet = '';
      if (text !== '' && text !== null && text !== undefined) {
        this.appendChild({
          nodeType: 3,
          textContent: String(text),
          data: String(text),
          parentNode: this,
        });
      }
    },
    get textContent() {
      let text = '';
      const getTextRecursive = (nodes) => {
        for (const node of nodes) {
          if (!node) continue;
          if (node.nodeType === 3) {
            text += node.textContent || '';
          } else if (node.nodeType === 1 && node._childNodes) {
            getTextRecursive(node._childNodes);
          }
        }
      };
      getTextRecursive(this._childNodes);
      return text;
    },
  };
  return element;
};

const createMockDocumentContext = () => {
  const mockOutputDivElement = createGenericMockElement('div');
  mockOutputDivElement.scrollTop = 0;
  mockOutputDivElement.scrollHeight = 0;
  const mockMessageListElement = createGenericMockElement('div');
  return {
    query: jest.fn((selector) =>
      selector === '#outputDiv'
        ? mockOutputDivElement
        : selector === '#message-list'
          ? mockMessageListElement
          : null
    ),
    create: jest.fn((tagName) => createGenericMockElement(tagName)),
    document: {
      createDocumentFragment: jest.fn(() => {
        const frag = createGenericMockElement('#document-fragment');
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
    _mockOutputDivElement: mockOutputDivElement,
    _mockMessageListElement: mockMessageListElement,
  };
};

const createMockValidatedEventDispatcher = () => ({
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
  dispatch: jest.fn(),
});

const createMockEntityManager = () => ({
  getEntityInstance: jest.fn(),
  hasComponent: jest.fn(),
});

const createMockDomElementFactory = () => {
  const factory = {
    document: createMockDocumentContext().document, // For buildSpeechMeta
    create: jest.fn((tagName, attributes = {}) => {
      const el = createGenericMockElement(tagName);
      if (attributes.cls) {
        const classes = Array.isArray(attributes.cls)
          ? attributes.cls
          : attributes.cls.split(' ');
        classes.forEach((c) => el.classList.add(c));
      }
      Object.keys(attributes).forEach((key) => {
        if (key !== 'cls') {
          el.setAttribute(key, attributes[key]);
        }
      });
      return el;
    }),
  };
  factory.span = jest.fn((cls) => factory.create('span', { cls }));
  factory.img = jest.fn((src, alt, cls) => {
    const el = factory.create('img', { cls });
    el.src = src;
    el.alt = alt;
    el.setAttribute('src', src);
    el.setAttribute('alt', alt);
    return el;
  });
  return factory;
};

const createMockEntityDisplayDataProvider = () => ({
  getEntityName: jest.fn().mockReturnValue(DEFAULT_SPEAKER_NAME_IN_TEST),
  getEntityPortraitPath: jest.fn().mockReturnValue(null),
});

const createMockPortraitModalRenderer = () => ({
  showModal: jest.fn(),
  hideModal: jest.fn(),
});

describe('SpeechBubbleRenderer', () => {
  let logger,
    docContext,
    eventDispatcher,
    entityManager,
    domFactory,
    entityDisplayDataProvider,
    portraitModalRenderer,
    renderer;
  let mockOutputDiv, mockMessageList;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createMockLogger();
    docContext = createMockDocumentContext();
    eventDispatcher = createMockValidatedEventDispatcher();
    entityManager = createMockEntityManager();
    domFactory = createMockDomElementFactory();
    entityDisplayDataProvider = createMockEntityDisplayDataProvider();
    portraitModalRenderer = createMockPortraitModalRenderer();
    mockOutputDiv = docContext._mockOutputDivElement;
    mockMessageList = docContext._mockMessageListElement;
    mockOutputDiv.scrollHeight = 100;
    renderer = new SpeechBubbleRenderer({
      logger,
      documentContext: docContext,
      validatedEventDispatcher: eventDispatcher,
      entityManager,
      domElementFactory: domFactory,
      entityDisplayDataProvider,
      portraitModalRenderer,
    });
  });

  describe('constructor', () => {
    it('should throw error when entityManager is missing', () => {
      const deps = {
        logger,
        documentContext: docContext,
        validatedEventDispatcher: eventDispatcher,
        domElementFactory: domFactory,
        entityDisplayDataProvider,
        portraitModalRenderer,
        // entityManager is missing
      };

      expect(() => new SpeechBubbleRenderer(deps)).toThrow(
        '[SpeechBubbleRenderer] EntityManager dependency is required.'
      );
    });

    it('should throw error when entityDisplayDataProvider is missing', () => {
      const deps = {
        logger,
        documentContext: docContext,
        validatedEventDispatcher: eventDispatcher,
        entityManager,
        domElementFactory: domFactory,
        portraitModalRenderer,
        // entityDisplayDataProvider is missing
      };

      expect(() => new SpeechBubbleRenderer(deps)).toThrow(
        '[SpeechBubbleRenderer] EntityDisplayDataProvider dependency is required.'
      );
    });

    it('should warn and fallback to outputDiv when message-list is not found', () => {
      // Mock documentContext to return null for #message-list
      const customDocContext = createMockDocumentContext();
      customDocContext.query = jest.fn((selector) =>
        selector === '#outputDiv'
          ? customDocContext._mockOutputDivElement
          : null
      );

      const testRenderer = new SpeechBubbleRenderer({
        logger,
        documentContext: customDocContext,
        validatedEventDispatcher: eventDispatcher,
        entityManager,
        domElementFactory: domFactory,
        entityDisplayDataProvider,
        portraitModalRenderer,
      });

      // Should have been called with our expected message
      expect(logger.warn.mock.calls).toContainEqual([
        '[SpeechBubbleRenderer] #message-list not found. Speech will be appended to #outputDiv.',
      ]);
      expect(testRenderer.effectiveSpeechContainer).toBe(
        customDocContext._mockOutputDivElement
      );
    });

    it('should error when neither message-list nor outputDiv are available', () => {
      // Mock documentContext to return null for both selectors
      const customDocContext = createMockDocumentContext();
      customDocContext.query = jest.fn(() => null);

      const testRenderer = new SpeechBubbleRenderer({
        logger,
        documentContext: customDocContext,
        validatedEventDispatcher: eventDispatcher,
        entityManager,
        domElementFactory: domFactory,
        entityDisplayDataProvider,
        portraitModalRenderer,
      });

      // Should have been called with our expected message
      expect(logger.error.mock.calls).toContainEqual([
        '[SpeechBubbleRenderer] Critical: Effective speech container (#message-list or #outputDiv) could not be determined as #outputDiv was also not found or bound.',
      ]);
      expect(testRenderer.effectiveSpeechContainer).toBeNull();
    });

    it('should warn when portraitModalRenderer is not provided and set to null', () => {
      const deps = {
        logger,
        documentContext: docContext,
        validatedEventDispatcher: eventDispatcher,
        entityManager,
        domElementFactory: domFactory,
        entityDisplayDataProvider,
        // portraitModalRenderer is missing (null/undefined)
      };

      new SpeechBubbleRenderer(deps);

      expect(logger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] PortraitModalRenderer not available - using event dispatch fallback'
      );
    });
  });

  describe('portrait modal integration', () => {
    let mockPortraitImg, eventHandlers;

    beforeEach(() => {
      mockPortraitImg = createGenericMockElement('img');
      eventHandlers = {};
      domFactory.img.mockReturnValue(mockPortraitImg);
      entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/test-portrait.jpg'
      );
      entityDisplayDataProvider.getEntityName.mockReturnValue('TestSpeaker');

      // Mock _addDomListener to capture event handlers
      jest
        .spyOn(renderer, '_addDomListener')
        .mockImplementation((element, event, handler) => {
          eventHandlers[event] = handler;
        });
    });

    it('should use modal renderer directly when available', () => {
      renderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      // Trigger the click event
      expect(eventHandlers.click).toBeDefined();
      eventHandlers.click();

      expect(portraitModalRenderer.showModal).toHaveBeenCalledWith(
        '/test-portrait.jpg',
        'TestSpeaker',
        mockPortraitImg
      );
      expect(eventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should fallback to event dispatch when modal renderer fails', () => {
      portraitModalRenderer.showModal.mockImplementation(() => {
        throw new Error('Modal renderer error');
      });

      renderer.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      // Trigger the click event
      expect(eventHandlers.click).toBeDefined();
      eventHandlers.click();

      expect(portraitModalRenderer.showModal).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Failed to show portrait modal directly',
        expect.any(Error)
      );
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: PORTRAIT_CLICKED,
        payload: {
          portraitPath: '/test-portrait.jpg',
          speakerName: 'TestSpeaker',
          originalElement: mockPortraitImg,
        },
      });
    });

    it('should use event dispatch fallback when modal renderer unavailable', () => {
      // Create renderer without portraitModalRenderer
      const rendererWithoutModal = new SpeechBubbleRenderer({
        logger,
        documentContext: docContext,
        validatedEventDispatcher: eventDispatcher,
        entityManager,
        domElementFactory: domFactory,
        entityDisplayDataProvider,
        // portraitModalRenderer is null
      });

      const noModalEventHandlers = {};
      jest
        .spyOn(rendererWithoutModal, '_addDomListener')
        .mockImplementation((element, event, handler) => {
          noModalEventHandlers[event] = handler;
        });

      rendererWithoutModal.renderSpeech({
        entityId: 'test-entity',
        speechContent: 'Hello world',
      });

      // Trigger the click event
      expect(noModalEventHandlers.click).toBeDefined();
      noModalEventHandlers.click();

      expect(eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: PORTRAIT_CLICKED,
        payload: {
          portraitPath: '/test-portrait.jpg',
          speakerName: 'TestSpeaker',
          originalElement: mockPortraitImg,
        },
      });
    });
  });

  describe('event handling', () => {
    it('should handle DISPLAY_SPEECH_ID event and render speech', () => {
      const mockRenderSpeech = jest.spyOn(renderer, 'renderSpeech');

      // Get the event handler that was registered
      const subscribeCall = eventDispatcher.subscribe.mock.calls.find(
        (call) => call[0] === DISPLAY_SPEECH_ID
      );
      expect(subscribeCall).toBeDefined();
      const eventHandler = subscribeCall[1];

      const payload = {
        entityId: 'test-entity',
        speechContent: 'Hello world',
      };

      // Trigger the event
      eventHandler({ type: DISPLAY_SPEECH_ID, payload });

      expect(mockRenderSpeech).toHaveBeenCalledWith(payload);
    });

    it('should warn on invalid event object', () => {
      const subscribeCall = eventDispatcher.subscribe.mock.calls.find(
        (call) => call[0] === DISPLAY_SPEECH_ID
      );
      const eventHandler = subscribeCall[1];

      // Test with null event
      eventHandler(null);
      expect(logger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Received invalid DISPLAY_SPEECH_ID event object.',
        null
      );

      // Test with missing payload
      eventHandler({ type: DISPLAY_SPEECH_ID });
      expect(logger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Received invalid DISPLAY_SPEECH_ID event object.',
        { type: DISPLAY_SPEECH_ID }
      );
    });

    it('should warn on invalid payload data', () => {
      const subscribeCall = eventDispatcher.subscribe.mock.calls.find(
        (call) => call[0] === DISPLAY_SPEECH_ID
      );
      const eventHandler = subscribeCall[1];

      // Test with invalid entityId
      eventHandler({
        type: DISPLAY_SPEECH_ID,
        payload: { entityId: null, speechContent: 'test' },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Invalid payload for DISPLAY_SPEECH_ID.',
        { entityId: null, speechContent: 'test' }
      );

      // Test with invalid speechContent
      eventHandler({
        type: DISPLAY_SPEECH_ID,
        payload: { entityId: 'test', speechContent: 123 },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        '[SpeechBubbleRenderer] Invalid payload for DISPLAY_SPEECH_ID.',
        { entityId: 'test', speechContent: 123 }
      );
    });
  });

  describe('renderSpeech method', () => {
    describe('DOM element creation failures', () => {
      it('should handle failure to create speech entry div', () => {
        domFactory.create = jest.fn((tagName, options) => {
          if (options?.cls === 'speech-entry') return null;
          return createGenericMockElement(tagName);
        });

        renderer.renderSpeech({
          entityId: 'test-entity',
          speechContent: 'Test speech',
        });

        expect(logger.error).toHaveBeenCalledWith(
          '[SpeechBubbleRenderer] Failed to create speech entry or bubble div.'
        );
        // Should not append anything
        expect(mockMessageList.appendChild).not.toHaveBeenCalled();
      });

      it('should handle failure to create speech bubble div', () => {
        domFactory.create = jest.fn((tagName, options) => {
          if (options?.cls === 'speech-bubble') return null;
          return createGenericMockElement(tagName);
        });

        renderer.renderSpeech({
          entityId: 'test-entity',
          speechContent: 'Test speech',
        });

        expect(logger.error).toHaveBeenCalledWith(
          '[SpeechBubbleRenderer] Failed to create speech entry or bubble div.'
        );
        expect(mockMessageList.appendChild).not.toHaveBeenCalled();
      });
    });

    describe('error conditions', () => {
      it('should error when effectiveSpeechContainer is null', () => {
        renderer.effectiveSpeechContainer = null;

        renderer.renderSpeech({
          entityId: 'test-entity',
          speechContent: 'Test speech',
        });

        expect(logger.error).toHaveBeenCalledWith(
          '[SpeechBubbleRenderer] Cannot render speech: effectiveSpeechContainer, domElementFactory, or entityManager missing.'
        );
      });
    });

    describe('player detection', () => {
      it('should detect player with PLAYER_COMPONENT_ID only', () => {
        const mockEntity = {
          hasComponent: jest.fn(
            (componentId) => componentId === PLAYER_COMPONENT_ID
          ),
          getComponentData: jest.fn(),
        };
        entityManager.getEntityInstance.mockReturnValue(mockEntity);

        renderer.renderSpeech({
          entityId: 'player-entity',
          speechContent: 'Player speech',
        });

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).toHaveBeenCalledWith(
          'player-speech'
        );
      });

      it('should detect player with PLAYER_TYPE_COMPONENT_ID and type=human', () => {
        const mockEntity = {
          hasComponent: jest.fn(
            (componentId) => componentId === PLAYER_TYPE_COMPONENT_ID
          ),
          getComponentData: jest.fn(() => ({ type: 'human' })),
        };
        entityManager.getEntityInstance.mockReturnValue(mockEntity);

        renderer.renderSpeech({
          entityId: 'player-entity',
          speechContent: 'Player speech',
        });

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).toHaveBeenCalledWith(
          'player-speech'
        );
      });

      it('should not detect player when entity not found', () => {
        entityManager.getEntityInstance.mockReturnValue(null);

        renderer.renderSpeech({
          entityId: 'unknown-entity',
          speechContent: 'Unknown speech',
        });

        expect(logger.debug).toHaveBeenCalledWith(
          "[SpeechBubbleRenderer] Speaker entity with ID 'unknown-entity' not found for player check."
        );

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).not.toHaveBeenCalledWith(
          'player-speech'
        );
      });

      it('should not detect player when type is not human', () => {
        const mockEntity = {
          hasComponent: jest.fn(
            (componentId) => componentId === PLAYER_TYPE_COMPONENT_ID
          ),
          getComponentData: jest.fn(() => ({ type: 'npc' })),
        };
        entityManager.getEntityInstance.mockReturnValue(mockEntity);

        renderer.renderSpeech({
          entityId: 'npc-entity',
          speechContent: 'NPC speech',
        });

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).not.toHaveBeenCalledWith(
          'player-speech'
        );
      });

      it('should handle player type data without type field', () => {
        const mockEntity = {
          hasComponent: jest.fn(
            (componentId) => componentId === PLAYER_TYPE_COMPONENT_ID
          ),
          getComponentData: jest.fn(() => ({})), // No type field
        };
        entityManager.getEntityInstance.mockReturnValue(mockEntity);

        renderer.renderSpeech({
          entityId: 'entity-without-type',
          speechContent: 'Speech',
        });

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).not.toHaveBeenCalledWith(
          'player-speech'
        );
      });
    });

    const getQuotedTextSpanFromDomFactory = () => {
      const spanCalls = domFactory.span.mock.calls;
      const quotedTextSpanCallIndex = spanCalls.findIndex(
        (callArgs) => callArgs[0] === 'speech-quoted-text'
      );
      expect(quotedTextSpanCallIndex).not.toBe(-1);
      return domFactory.span.mock.results[quotedTextSpanCallIndex].value;
    };
    // ... other tests ...
    describe('speaker intro span', () => {
      it('should handle failure to create speaker intro span', () => {
        // Mock span to return null for speaker intro
        const originalSpan = domFactory.span;
        domFactory.span = jest.fn((cls) => {
          if (cls === 'speech-speaker-intro') return null;
          return originalSpan(cls);
        });

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Test speech',
        });

        // Should still complete rendering
        expect(mockMessageList.appendChild).toHaveBeenCalled();

        domFactory.span = originalSpan;
      });
    });

    describe('action text', () => {
      it('should handle failure to create action span', () => {
        // Mock span to return null for action text
        const originalSpan = domFactory.span;
        domFactory.span = jest.fn((cls) => {
          if (cls === 'speech-action-text') return null;
          return originalSpan(cls);
        });

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Normal text *action text* more text',
          allowHtml: false,
        });

        // Should still complete rendering
        expect(mockMessageList.appendChild).toHaveBeenCalled();

        domFactory.span = originalSpan;
      });
    });

    describe('allowHtml flag', () => {
      const getQuotedTextSpan = getQuotedTextSpanFromDomFactory;

      beforeEach(() => {
        entityDisplayDataProvider.getEntityName.mockReturnValue(
          DEFAULT_SPEAKER_NAME_IN_TEST
        );
        entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
      });

      it('should use createTextNode for non-action parts when allowHtml is false', () => {
        const speech = 'Text with <b>bold</b> and *action* part.';
        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: speech,
          allowHtml: false,
        });

        expect(docContext.document.createTextNode).toHaveBeenCalledWith(
          'Text with <b>bold</b> and '
        );
        expect(docContext.document.createTextNode).toHaveBeenCalledWith(
          ' part.'
        );

        const qts = getQuotedTextSpan();
        const children = qts._childNodes;
        expect(children.length).toBe(5);
        expect(children[1].textContent).toBe('Text with <b>bold</b> and ');
        expect(children[2].textContent).toBe('*action*');
        expect(children[3].textContent).toBe(' part.');
      });

      it('should use innerHTML for non-action parts via temporary spans when allowHtml is true', () => {
        const speech = 'Text <b>1</b> and *action* then <span>2</span>.';
        const tempSpanHtmlPart1 = createGenericMockElement('span');
        const tempSpanHtmlPart2 = createGenericMockElement('span');
        let tempSpanCallCount = 0;

        const originalSpanFn = domFactory.span;
        domFactory.span = jest.fn((cls) => {
          if (
            cls === 'speech-speaker-intro' ||
            cls === 'speech-quoted-text' ||
            cls === 'speech-action-text'
          ) {
            // Use the original factory method for specific spans
            const realSpan = createGenericMockElement('span');
            realSpan.classList.add(cls);
            return realSpan;
          }
          // This mock is for the temporary spans for innerHTML
          tempSpanCallCount++;
          if (tempSpanCallCount === 1) return tempSpanHtmlPart1;
          if (tempSpanCallCount === 2) return tempSpanHtmlPart2;
          return createGenericMockElement('span');
        });

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: speech,
          allowHtml: true,
        });

        expect(domFactory.span).toHaveBeenCalledWith(); // Called for temp spans
        expect(tempSpanCallCount).toBe(2);

        expect(tempSpanHtmlPart1.innerHTML).toBe('Text <b>1</b> and ');
        expect(tempSpanHtmlPart2.innerHTML).toBe(' then <span>2</span>.');

        const quotedTextSpan = getQuotedTextSpanFromDomFactory();
        const appendedChildren = quotedTextSpan.appendChild.mock.calls.map(
          (c) => c[0]
        );

        // --- FIX START ---
        // Verify that the nodes created from the innerHTML of the temp spans were appended
        // by checking their content, not their object reference (which becomes null).
        const appendedHtmlNode1 = appendedChildren.find(
          (node) => node && node.textContent === 'Text <b>1</b> and '
        );
        const appendedHtmlNode2 = appendedChildren.find(
          (node) => node && node.textContent === ' then <span>2</span>.'
        );

        expect(appendedHtmlNode1).toBeDefined();
        expect(appendedHtmlNode2).toBeDefined();
        // --- FIX END ---

        domFactory.span = originalSpanFn;
      });

      it('should handle null temporary span with allowHtml=true', () => {
        const originalSpan = domFactory.span;
        let spanCallCount = 0;
        domFactory.span = jest.fn((cls) => {
          if (cls === undefined) {
            // Return null for temporary span
            return null;
          }
          return originalSpan(cls);
        });

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Text <b>with HTML</b>',
          allowHtml: true,
        });

        // Should still complete rendering
        expect(mockMessageList.appendChild).toHaveBeenCalled();

        domFactory.span = originalSpan;
      });

      it('should handle empty string with allowHtml=true', () => {
        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: '',
          allowHtml: true,
        });

        const qts = getQuotedTextSpan();
        expect(qts.innerHTML).toBe('""');
      });

      it('should handle null with allowHtml=true', () => {
        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: null,
          allowHtml: true,
        });

        const qts = getQuotedTextSpan();
        expect(qts.innerHTML).toBe('""');
      });

      it('should handle undefined with allowHtml=true', () => {
        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: undefined,
          allowHtml: true,
        });

        const qts = getQuotedTextSpan();
        expect(qts.innerHTML).toBe('""');
      });

      it('should handle empty string with allowHtml=false', () => {
        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: '',
          allowHtml: false,
        });

        const qts = getQuotedTextSpan();
        expect(qts.textContent).toBe('""');
      });
    });

    describe('portrait handling', () => {
      beforeEach(() => {
        entityDisplayDataProvider.getEntityName.mockReturnValue('Test Speaker');
      });

      it('should add portrait and handle load event', () => {
        entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
          '/path/to/portrait.jpg'
        );

        const mockPortraitImg = createGenericMockElement('img');
        const eventHandlers = {};

        // Mock _addDomListener to capture event handlers
        jest
          .spyOn(renderer, '_addDomListener')
          .mockImplementation((element, event, handler) => {
            eventHandlers[event] = handler;
          });

        domFactory.img.mockReturnValue(mockPortraitImg);
        jest.spyOn(renderer, 'scrollToBottom').mockImplementation(() => {});

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Test',
        });

        expect(domFactory.img).toHaveBeenCalledWith(
          '/path/to/portrait.jpg',
          'Portrait of Test Speaker',
          'speech-portrait'
        );

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).toHaveBeenCalledWith(
          'has-portrait'
        );
        expect(speechEntryDiv.appendChild).toHaveBeenCalledWith(
          mockPortraitImg
        );

        // Should not scroll immediately
        expect(renderer.scrollToBottom).not.toHaveBeenCalled();

        // Trigger load event
        eventHandlers.load();
        expect(renderer.scrollToBottom).toHaveBeenCalledTimes(1);
      });

      it('should handle portrait load error', () => {
        entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
          '/path/to/portrait.jpg'
        );

        const mockPortraitImg = createGenericMockElement('img');
        const eventHandlers = {};

        // Mock _addDomListener to capture event handlers
        jest
          .spyOn(renderer, '_addDomListener')
          .mockImplementation((element, event, handler) => {
            eventHandlers[event] = handler;
          });

        domFactory.img.mockReturnValue(mockPortraitImg);
        jest.spyOn(renderer, 'scrollToBottom').mockImplementation(() => {});

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Test',
        });

        // Trigger error event
        eventHandlers.error();

        expect(logger.warn).toHaveBeenCalledWith(
          '[SpeechBubbleRenderer] Portrait image failed to load for Test Speaker. Scrolling anyway.'
        );
        expect(renderer.scrollToBottom).toHaveBeenCalledTimes(1);
      });

      it('should handle portrait element creation failure', () => {
        entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
          '/path/to/portrait.jpg'
        );
        domFactory.img.mockReturnValue(null);

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Test',
        });

        expect(logger.warn).toHaveBeenCalledWith(
          '[SpeechBubbleRenderer] Failed to create portraitImg element.'
        );

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).toHaveBeenCalledWith(
          'no-portrait'
        );
      });

      it('should add no-portrait class when no portrait path', () => {
        entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
        jest.spyOn(renderer, 'scrollToBottom').mockImplementation(() => {});

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Test',
        });

        const speechEntryDiv = mockMessageList.appendChild.mock.calls[0][0];
        expect(speechEntryDiv.classList.add).toHaveBeenCalledWith(
          'no-portrait'
        );
        expect(renderer.scrollToBottom).toHaveBeenCalledTimes(1);
      });
    });

    describe('speech meta', () => {
      it('should add meta fragment when thoughts and notes are provided', () => {
        // Mock buildSpeechMeta to return a fragment
        const mockFragment = createGenericMockElement('#document-fragment');
        mockFragment.nodeType = 11;

        // Import the mocked module
        const {
          buildSpeechMeta,
        } = require('../../../src/domUI/helpers/buildSpeechMeta.js');
        buildSpeechMeta.mockReturnValue(mockFragment);

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Test',
          thoughts: 'Inner thoughts',
          notes: 'Private notes',
        });

        expect(buildSpeechMeta).toHaveBeenCalledWith(
          docContext.document,
          domFactory,
          expect.objectContaining({
            thoughts: 'Inner thoughts',
            notes: 'Private notes',
            speakerName: 'Unknown Speaker',
            copyAll: expect.objectContaining({
              allowHtml: false,
              bubbleType: 'speech',
              isPlayer: false,
              notes: 'Private notes',
              speechContent: 'Test',
              thoughts: 'Inner thoughts',
            }),
          })
        );

        const speechBubbleDiv = domFactory.create.mock.results.find(
          (r) =>
            r.value &&
            domFactory.create.mock.calls[
              domFactory.create.mock.results.indexOf(r)
            ][1]?.cls === 'speech-bubble'
        ).value;

        expect(speechBubbleDiv.classList.add).toHaveBeenCalledWith('has-meta');
        expect(speechBubbleDiv.appendChild).toHaveBeenCalledWith(mockFragment);
      });

      it('should not add meta when buildSpeechMeta returns null', () => {
        const {
          buildSpeechMeta,
        } = require('../../../src/domUI/helpers/buildSpeechMeta.js');
        buildSpeechMeta.mockReturnValue(null);

        renderer.renderSpeech({
          entityId: 'speaker',
          speechContent: 'Test',
        });

        expect(buildSpeechMeta).toHaveBeenCalledWith(
          docContext.document,
          domFactory,
          expect.objectContaining({
            thoughts: undefined,
            notes: undefined,
            speakerName: 'Unknown Speaker',
            copyAll: expect.objectContaining({
              allowHtml: false,
              bubbleType: 'speech',
              isPlayer: false,
              notes: undefined,
              speechContent: 'Test',
              thoughts: undefined,
            }),
          })
        );

        const speechBubbleDiv = domFactory.create.mock.results.find(
          (r) =>
            r.value &&
            domFactory.create.mock.calls[
              domFactory.create.mock.results.indexOf(r)
            ][1]?.cls === 'speech-bubble'
        ).value;

        expect(speechBubbleDiv.classList.add).not.toHaveBeenCalledWith(
          'has-meta'
        );
      });
    });

    describe('disposal', () => {
      it('should properly dispose and clean up resources', () => {
        const disposeSpyBase = jest.spyOn(
          BoundDomRendererBase.prototype,
          'dispose'
        );

        renderer.dispose();

        expect(logger.debug).toHaveBeenCalledWith(
          '[SpeechBubbleRenderer] Disposing.'
        );
        expect(disposeSpyBase).toHaveBeenCalled();
        expect(renderer.effectiveSpeechContainer).toBeNull();
        expect(logger.debug).toHaveBeenCalledWith(
          '[SpeechBubbleRenderer] Disposed.'
        );

        disposeSpyBase.mockRestore();
      });
    });
  });
});

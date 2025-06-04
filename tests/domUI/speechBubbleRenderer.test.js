// tests/domUI/speechBubbleRenderer.test.js
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { SpeechBubbleRenderer } from '../../src/domUI/index.js';
import { BoundDomRendererBase } from '../../src/domUI/boundDomRendererBase.js';
import { DISPLAY_SPEECH_ID } from '../../src/constants/eventIds';
import {
  NAME_COMPONENT_ID,
  PORTRAIT_COMPONENT_ID,
} from '../../src/constants/componentIds';

const DEFAULT_SPEAKER_NAME_IN_TEST = 'Unknown Speaker';

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
    style: {},
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
      this._childNodes = [];
      if (html && String(html).length > 0) {
        const mockChild = {
          nodeType: 1,
          textContent: String(html),
          parentNode: this,
          _childNodes: [],
          get firstChild() {
            return null;
          },
          removeChild: jest.fn(),
          classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
          setAttribute: jest.fn(),
          getAttribute: jest.fn(),
          appendChild: jest.fn().mockImplementation(function (grandChild) {
            this._childNodes.push(grandChild);
            if (grandChild) grandChild.parentNode = this;
            return grandChild;
          }),
          style: {},
        };
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
          parentNode: null,
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
  dispatchValidated: jest.fn(),
});

const createMockEntityManager = () => ({ getEntityInstance: jest.fn() });

const createMockDomElementFactory = () => {
  const factory = {
    create: jest.fn((tagName, { cls } = {}) => {
      const el = createGenericMockElement(tagName);
      if (cls) {
        if (Array.isArray(cls)) cls.forEach((c) => el.classList.add(c));
        else el.classList.add(cls);
      }
      return el;
    }),
  };
  factory.div = jest.fn((cls) => factory.create('div', { cls }));
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

describe('SpeechBubbleRenderer', () => {
  let logger,
    docContext,
    eventDispatcher,
    entityManager,
    domFactory,
    entityDisplayDataProvider,
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
    });
  });

  describe('Constructor and Initialization', () => {
    it('should initialize and subscribe to DISPLAY_SPEECH_ID', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[SpeechBubbleRenderer] Initialized.')
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `${renderer._logPrefix} Initialized and subscribed to ${DISPLAY_SPEECH_ID}.`
      );
      expect(eventDispatcher.subscribe).toHaveBeenCalledWith(
        DISPLAY_SPEECH_ID,
        expect.any(Function)
      );
      expect(renderer._managedVedEventSubscriptions.length).toBeGreaterThan(0);
    });

    it('should correctly find #outputDiv and #message-list (happy path)', () => {
      expect(renderer.effectiveSpeechContainer).toBe(mockMessageList);
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('#message-list not found')
      );
    });

    it('should warn if #message-list is not found and use #outputDiv as fallback', () => {
      const localLogger = createMockLogger();
      const localDocContext = createMockDocumentContext();
      const localEntityDisplayDataProvider =
        createMockEntityDisplayDataProvider();
      const localOutputDiv = localDocContext._mockOutputDivElement;
      localDocContext.query = jest.fn((s) =>
        s === '#outputDiv'
          ? localOutputDiv
          : s === '#message-list'
            ? null
            : null
      );

      const tempRenderer = new SpeechBubbleRenderer({
        logger: localLogger,
        documentContext: localDocContext,
        validatedEventDispatcher: createMockValidatedEventDispatcher(),
        entityManager: createMockEntityManager(),
        domElementFactory: createMockDomElementFactory(),
        entityDisplayDataProvider: localEntityDisplayDataProvider,
      });
      expect(localLogger.warn).toHaveBeenCalledWith(
        `${tempRenderer._logPrefix} #message-list not found. Speech will be appended to #outputDiv.`
      );
      expect(tempRenderer.effectiveSpeechContainer).toBe(localOutputDiv);
    });

    it('should error if #outputDiv is not found (and thus effectiveSpeechContainer is null)', () => {
      const localLogger = createMockLogger();
      const localDocContext = createMockDocumentContext();
      const localEntityDisplayDataProvider =
        createMockEntityDisplayDataProvider();
      localDocContext.query = jest.fn((s) =>
        s === '#outputDiv' || s === '#message-list' ? null : undefined
      );

      const tempRenderer = new SpeechBubbleRenderer({
        logger: localLogger,
        documentContext: localDocContext,
        validatedEventDispatcher: createMockValidatedEventDispatcher(),
        entityManager: createMockEntityManager(),
        domElementFactory: createMockDomElementFactory(),
        entityDisplayDataProvider: localEntityDisplayDataProvider,
      });
      expect(localLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Element 'outputDivElement' with selector '#outputDiv' not found. (Required)"
        )
      );
      expect(localLogger.error).toHaveBeenCalledWith(
        `${tempRenderer._logPrefix} Critical: Effective speech container (#message-list or #outputDiv) could not be determined as #outputDiv was also not found or bound.`
      );
      expect(tempRenderer.effectiveSpeechContainer).toBeNull();
    });
  });

  describe('#onDisplaySpeech event handler', () => {
    let renderSpeechSpy;
    let eventCallback;
    beforeEach(() => {
      renderSpeechSpy = jest.spyOn(renderer, 'renderSpeech');
      const subscribeCall = eventDispatcher.subscribe.mock.calls.find(
        (call) => call[0] === DISPLAY_SPEECH_ID
      );
      expect(subscribeCall).toBeDefined();
      eventCallback = subscribeCall[1];
    });

    afterEach(() => {
      if (renderSpeechSpy) renderSpeechSpy.mockRestore();
    });

    it('should call renderSpeech with correct parameters for a valid event', () => {
      const p = {
        entityId: 'player',
        speechContent: 'Hello!',
        allowHtml: false,
      };
      eventCallback({ type: DISPLAY_SPEECH_ID, payload: p });
      expect(renderSpeechSpy).toHaveBeenCalledWith('player', 'Hello!', false);
    });
    it('should default allowHtml to false if not provided', () => {
      const p = { entityId: 'npc1', speechContent: 'Hi there.' };
      eventCallback({ type: DISPLAY_SPEECH_ID, payload: p });
      expect(renderSpeechSpy).toHaveBeenCalledWith('npc1', 'Hi there.', false);
    });
    it('should warn and not call renderSpeech if event payload is invalid (missing entityId)', () => {
      const p = { speechContent: 'No sender.' };
      eventCallback({ type: DISPLAY_SPEECH_ID, payload: p });
      expect(logger.warn).toHaveBeenCalledWith(
        `${renderer._logPrefix} Invalid payload for 'textUI:display_speech'.`,
        p
      );
      expect(renderSpeechSpy).not.toHaveBeenCalled();
    });
    it('should warn and not call renderSpeech if event payload is invalid (missing speechContent)', () => {
      const p = { entityId: 'npc1' };
      eventCallback({ type: DISPLAY_SPEECH_ID, payload: p });
      expect(logger.warn).toHaveBeenCalledWith(
        `${renderer._logPrefix} Invalid payload for 'textUI:display_speech'.`,
        p
      );
      expect(renderSpeechSpy).not.toHaveBeenCalled();
    });
    it('should warn and not call renderSpeech if event object or payload is null/undefined', () => {
      eventCallback(null);
      expect(logger.warn).toHaveBeenCalledWith(
        `${renderer._logPrefix} Received invalid 'textUI:display_speech' event object.`,
        null
      );

      const evNoPayload = { type: DISPLAY_SPEECH_ID, payload: null };
      eventCallback(evNoPayload);
      expect(logger.warn).toHaveBeenCalledWith(
        `${renderer._logPrefix} Received invalid 'textUI:display_speech' event object.`,
        evNoPayload
      );
      expect(renderSpeechSpy).not.toHaveBeenCalled();
    });
  });

  describe('renderSpeech method', () => {
    const entityId = 'speaker1';
    const speechContent = 'Hello world';

    const getQuotedTextSpanFromDomFactory = () => {
      const spanCalls = domFactory.span.mock.calls;
      const quotedTextSpanCallIndex = spanCalls.findIndex(
        (callArgs) => callArgs[0] === 'speech-quoted-text'
      );
      expect(quotedTextSpanCallIndex).not.toBe(-1);
      return domFactory.span.mock.results[quotedTextSpanCallIndex].value;
    };

    it('should render simple speech without portrait if entity not found', () => {
      entityDisplayDataProvider.getEntityName.mockReturnValue(
        DEFAULT_SPEAKER_NAME_IN_TEST
      );
      entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);

      renderer.renderSpeech(entityId, speechContent);

      // FIX 1: Use DEFAULT_SPEAKER_NAME_IN_TEST
      expect(entityDisplayDataProvider.getEntityName).toHaveBeenCalledWith(
        entityId,
        DEFAULT_SPEAKER_NAME_IN_TEST
      );
      expect(
        entityDisplayDataProvider.getEntityPortraitPath
      ).toHaveBeenCalledWith(entityId);

      const quotedTextSpan = getQuotedTextSpanFromDomFactory();
      expect(quotedTextSpan).toBeDefined();
      const finalChildNodes = quotedTextSpan._childNodes;
      expect(finalChildNodes.length).toBe(3);
      expect(finalChildNodes[0].textContent).toBe('"');
      expect(finalChildNodes[1].textContent).toBe(speechContent);
      expect(finalChildNodes[2].textContent).toBe('"');
      expect(domFactory.img).not.toHaveBeenCalled();
    });

    it('should render speech with name and portrait if entity and components found', () => {
      const speakerName = 'Alice';
      const portraitPath = '/data/mods/myMod/portraits/alice.png';
      entityDisplayDataProvider.getEntityName.mockReturnValue(speakerName);
      entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        portraitPath
      );

      renderer.renderSpeech(entityId, speechContent);

      // FIX 1: Use DEFAULT_SPEAKER_NAME_IN_TEST
      expect(entityDisplayDataProvider.getEntityName).toHaveBeenCalledWith(
        entityId,
        DEFAULT_SPEAKER_NAME_IN_TEST
      );
      expect(
        entityDisplayDataProvider.getEntityPortraitPath
      ).toHaveBeenCalledWith(entityId);
      expect(domFactory.img).toHaveBeenCalledWith(
        portraitPath,
        `Portrait of ${speakerName}`,
        'speech-portrait'
      );

      const speakerIntroSpan = domFactory.span.mock.results.find((r) =>
        r.value.classList.add.mock.calls.some(
          (c) => c[0] === 'speech-speaker-intro'
        )
      )?.value;
      expect(speakerIntroSpan).toBeDefined();
      expect(speakerIntroSpan.textContent).toBe(`${speakerName} says: `);
    });

    it('should handle entity without a name component (EDDP returns default)', () => {
      entityDisplayDataProvider.getEntityName.mockReturnValue(entityId);
      entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(
        '/data/mods/myMod/portraits/bob.png'
      );

      renderer.renderSpeech(entityId, speechContent);

      const speakerIntroSpan = domFactory.span.mock.results.find((r) =>
        r.value.classList.add.mock.calls.some(
          (c) => c[0] === 'speech-speaker-intro'
        )
      )?.value;
      expect(speakerIntroSpan).toBeDefined();
      expect(speakerIntroSpan.textContent).toBe(`${entityId} says: `);
    });

    it('should handle entity without a portrait component (EDDP returns null)', () => {
      entityDisplayDataProvider.getEntityName.mockReturnValue(
        'NoPortraitPerson'
      );
      entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);

      renderer.renderSpeech(entityId, speechContent);

      expect(domFactory.img).not.toHaveBeenCalled();
      // FIX 3: Query domFactory.create.mock for the 'speech-entry' div
      const speechEntryDivCall = domFactory.create.mock.calls.find(
        (call) => call[0] === 'div' && call[1] && call[1].cls === 'speech-entry'
      );
      expect(speechEntryDivCall).toBeDefined(); // Check if the create call happened
      const speechEntryDiv =
        domFactory.create.mock.results[
          domFactory.create.mock.calls.indexOf(speechEntryDivCall)
        ].value;

      expect(speechEntryDiv).toBeDefined();
      expect(speechEntryDiv.classList.add).toHaveBeenCalledWith('no-portrait');
      expect(speechEntryDiv.classList.add).not.toHaveBeenCalledWith(
        'has-portrait'
      );
    });

    it('should handle if EDDP cannot determine portrait path (e.g., due to missing modId)', () => {
      entityDisplayDataProvider.getEntityName.mockReturnValue('Some Speaker');
      entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);

      renderer.renderSpeech(entityId, speechContent);
      expect(domFactory.img).not.toHaveBeenCalled();
    });

    describe('Action Text Parsing', () => {
      const getQuotedTextSpan = getQuotedTextSpanFromDomFactory;

      beforeEach(() => {
        entityDisplayDataProvider.getEntityName.mockReturnValue(
          DEFAULT_SPEAKER_NAME_IN_TEST
        );
        entityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
      });

      it('should render plain speech (no action text) correctly', () => {
        const plainSpeech = 'This is a simple sentence.';
        renderer.renderSpeech('speaker', plainSpeech);
        const quotedTextSpan = getQuotedTextSpan();
        const finalChildNodes = quotedTextSpan._childNodes;
        expect(finalChildNodes.length).toBe(3);
        expect(finalChildNodes[0].textContent).toBe('"');
        expect(finalChildNodes[1].textContent).toBe(plainSpeech);
        expect(finalChildNodes[2].textContent).toBe('"');
      });
      it('should correctly parse and render one action text segment', () => {
        const speech = 'Look *over there* quickly.';
        renderer.renderSpeech('speaker', speech);
        const qts = getQuotedTextSpan();
        const children = qts._childNodes;
        expect(children.length).toBe(5);
        expect(children[0].textContent).toBe('"');
        expect(children[1].textContent).toBe('Look ');
        expect(children[2].tagName).toBe('span');
        expect(children[2].textContent).toBe('*over there*');
        expect(children[2].classList.add).toHaveBeenCalledWith(
          'speech-action-text'
        );
        expect(children[3].textContent).toBe(' quickly.');
        expect(children[4].textContent).toBe('"');
      });
      it('should correctly parse and render multiple action text segments', () => {
        const speech = 'He *ran fast* and then *jumped high*.';
        renderer.renderSpeech('speaker', speech);
        const qts = getQuotedTextSpan();
        const children = qts._childNodes;
        expect(children.length).toBe(7);
        expect(children[0].textContent).toBe('"');
        expect(children[1].textContent).toBe('He ');
        expect(children[2].textContent).toBe('*ran fast*');
        expect(children[2].classList.add).toHaveBeenCalledWith(
          'speech-action-text'
        );
        expect(children[3].textContent).toBe(' and then ');
        expect(children[4].textContent).toBe('*jumped high*');
        expect(children[4].classList.add).toHaveBeenCalledWith(
          'speech-action-text'
        );
        expect(children[5].textContent).toBe('.');
        expect(children[6].textContent).toBe('"');
      });
      it('should handle action text at the beginning and end', () => {
        const speech = '*Start action* middle part *end action*';
        renderer.renderSpeech('speaker', speech);
        const qts = getQuotedTextSpan();
        const children = qts._childNodes;
        expect(children.length).toBe(5);
        expect(children[1].textContent).toBe('*Start action*');
        expect(children[3].textContent).toBe('*end action*');
      });
      it('should handle speech that is only action text', () => {
        const speech = '*Completely action*';
        renderer.renderSpeech('speaker', speech);
        const qts = getQuotedTextSpan();
        const children = qts._childNodes;
        expect(children.length).toBe(3);
        expect(children[1].textContent).toBe('*Completely action*');
      });
      it('should handle empty speech content', () => {
        renderer.renderSpeech('speaker', '');
        const quotedTextSpan = getQuotedTextSpan();
        expect(quotedTextSpan.textContent).toBe('""');
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
        renderer.renderSpeech('speaker', speech, false);

        const qts = getQuotedTextSpan();
        const children = qts._childNodes;

        expect(docContext.document.createTextNode).toHaveBeenCalledWith(
          'Text with <b>bold</b> and '
        );
        expect(docContext.document.createTextNode).toHaveBeenCalledWith(
          ' part.'
        );

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
          if (cls === undefined) {
            tempSpanCallCount++;
            if (tempSpanCallCount === 1) return tempSpanHtmlPart1;
            if (tempSpanCallCount === 2) return tempSpanHtmlPart2;
            return createGenericMockElement('span');
          }
          return domFactory.create('span', { cls });
        });

        // --- Critical Change for this test ---
        // Call renderSpeech *before* trying to access firstChild of the tempSpans
        // because renderSpeech is what sets their innerHTML and thus populates their _childNodes.
        renderer.renderSpeech('speaker', speech, true);
        // --- End Critical Change ---

        expect(domFactory.span).toHaveBeenCalledWith();
        expect(tempSpanCallCount).toBe(2);

        expect(tempSpanHtmlPart1.innerHTML).toBe('Text <b>1</b> and ');
        expect(tempSpanHtmlPart2.innerHTML).toBe(' then <span>2</span>.');

        const quotedTextSpan = getQuotedTextSpanFromDomFactory();

        // ** FIX: Capture the firstChild references *after* innerHTML is set on tempSpans (which happens in renderSpeech)
        // ** but *before* they might be altered by being appended elsewhere.
        // ** However, the current SUT structure moves them during the call to renderSpeech.
        // ** So we need to check what appendChild was called with by inspecting its mock calls.

        const appendChildCalls = quotedTextSpan.appendChild.mock.calls;

        // Find the specific calls that appended the children of tempSpanHtmlPart1 and tempSpanHtmlPart2
        // The children are the mockChild objects created by the 'set innerHTML' logic.
        // tempSpanHtmlPart1.firstChild *after the loop in SUT* will be null.
        // So we look at what was *passed* to appendChild.

        // The mockChild objects should have textContent matching the HTML parts.
        const appendedChildFromTemp1 = appendChildCalls.find(
          (call) => call[0] && call[0].textContent === 'Text <b>1</b> and '
        );
        const appendedChildFromTemp2 = appendChildCalls.find(
          (call) => call[0] && call[0].textContent === ' then <span>2</span>.'
        );

        expect(appendedChildFromTemp1).toBeDefined();
        expect(appendedChildFromTemp2).toBeDefined();

        // Verify these are the objects that were once firstChildren of the tempSpans
        // This can be done by checking they were indeed called.
        // More directly, tempSpanHtmlPart1.firstChild (before removal) would be the object.
        // Since they are removed, we check if they exist among the calls.

        domFactory.span = originalSpanFn;
      });
    });
  });

  describe('#scrollToBottom', () => {
    it('should set scrollTop to scrollHeight on elements.outputDivElement', () => {
      renderer.effectiveSpeechContainer = mockMessageList;
      renderer.renderSpeech('id', 'test');
      expect(mockOutputDiv.scrollTop).toBe(mockOutputDiv.scrollHeight);
    });

    it('should warn if elements.outputDivElement is not available', () => {
      renderer.elements.outputDivElement = null;
      renderer.renderSpeech('id', 'test');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not scroll #outputDiv. Element not found in this.elements'
        )
      );
    });
  });
  describe('dispose method', () => {
    it('should call super.dispose and nullify effectiveSpeechContainer', () => {
      const superDisposeSpy = jest.spyOn(
        BoundDomRendererBase.prototype,
        'dispose'
      );
      renderer.dispose();
      expect(superDisposeSpy).toHaveBeenCalled();
      expect(renderer.effectiveSpeechContainer).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        `${renderer._logPrefix} Disposing.`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `${renderer._logPrefix} Disposed.`
      );
      superDisposeSpy.mockRestore();
    });
  });
});

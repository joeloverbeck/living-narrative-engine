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
import { DISPLAY_SPEECH_ID } from '../../../src/constants/eventIds';

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

  // ... other tests ...

  describe('renderSpeech method', () => {
    // ... other tests ...
    const getQuotedTextSpanFromDomFactory = () => {
      const spanCalls = domFactory.span.mock.calls;
      const quotedTextSpanCallIndex = spanCalls.findIndex(
        (callArgs) => callArgs[0] === 'speech-quoted-text'
      );
      expect(quotedTextSpanCallIndex).not.toBe(-1);
      return domFactory.span.mock.results[quotedTextSpanCallIndex].value;
    };
    // ... other tests ...
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
    });
  });
});

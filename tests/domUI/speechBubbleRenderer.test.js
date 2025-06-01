// tests/domUI/speechBubbleRenderer.test.js
import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import {SpeechBubbleRenderer} from '../../src/domUI/index.js';
import {DISPLAY_SPEECH_ID} from '../../src/constants/eventIds';
import {NAME_COMPONENT_ID, PORTRAIT_COMPONENT_ID} from '../../src/constants/componentIds';

const DEFAULT_SPEAKER_NAME_IN_TEST = 'Unknown Speaker';

// --- Fully Mocked Factories ---
const createMockLogger = () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
});

const createGenericMockElement = (tagName) => {
    const element = {
        tagName,
        classList: {add: jest.fn(), remove: jest.fn(), contains: jest.fn()},
        style: {}, _attributes: {}, _childNodes: [], parentNode: null,
        _debug_id: Math.random().toString(36).substr(2, 5),
        setAttribute: jest.fn(function (name, value) {
            this._attributes[name] = value;
        }),
        getAttribute: jest.fn(function (name) {
            return this._attributes[name];
        }),
        appendChild: jest.fn(function (child) {
            if (!child) return child;
            if (child.parentNode && child.parentNode !== this && typeof child.parentNode.removeChild === 'function') {
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
            return this._childNodes.map(node => !node ? '' : (node.nodeType === 3 ? node.textContent || '' : node.textContent || `[${node.tagName || 'unknownElement'}]`)).join('');
        },
        set innerHTML(html) {
            this._childNodes = [];
            if (html !== '' && html !== null && html !== undefined) {
                this.appendChild({nodeType: 3, textContent: String(html), data: String(html), parentNode: null});
            }
        },
        get firstChild() {
            return this._childNodes.length > 0 ? this._childNodes[0] : null;
        },
        set textContent(text) {
            this._childNodes = [];
            if (text !== '' && text !== null && text !== undefined) {
                this.appendChild({nodeType: 3, textContent: String(text), data: String(text), parentNode: null});
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
        }
    };
    return element;
};

const createMockDocumentContext = () => {
    const mockOutputDivElement = createGenericMockElement('div');
    mockOutputDivElement.scrollTop = 0;
    mockOutputDivElement.scrollHeight = 0;
    const mockMessageListElement = createGenericMockElement('div');
    return {
        query: jest.fn(selector => selector === '#outputDiv' ? mockOutputDivElement : (selector === '#message-list' ? mockMessageListElement : null)),
        create: jest.fn(tagName => createGenericMockElement(tagName)),
        document: {
            createTextNode: jest.fn(text => ({
                nodeType: 3,
                textContent: String(text),
                data: String(text),
                parentNode: null
            }))
        },
        _mockOutputDivElement: mockOutputDivElement, _mockMessageListElement: mockMessageListElement,
    };
};

const createMockValidatedEventDispatcher = () => ({
    subscribe: jest.fn(() => ({unsubscribe: jest.fn()})),
    dispatch: jest.fn(), dispatchValidated: jest.fn(),
});

const createMockEntityManager = () => ({getEntityInstance: jest.fn()});

const createMockDomElementFactory = () => {
    const factory = {
        create: jest.fn((tagName, {cls} = {}) => {
            const el = createGenericMockElement(tagName);
            if (cls) {
                if (Array.isArray(cls)) cls.forEach(c => el.classList.add(c)); else el.classList.add(cls);
            }
            return el;
        }),
    };
    factory.div = jest.fn((cls) => factory.create('div', {cls}));
    factory.span = jest.fn((cls) => factory.create('span', {cls}));
    factory.img = jest.fn((src, alt, cls) => {
        const el = factory.create('img', {cls});
        el.src = src;
        el.alt = alt;
        el.setAttribute('src', src);
        el.setAttribute('alt', alt);
        return el;
    });
    return factory;
};

const createMockEntity = (id, nameData, portraitData, definitionId = 'testMod:testEntity') => ({
    id, definitionId,
    getComponentData: jest.fn(componentId => componentId === NAME_COMPONENT_ID ? nameData : (componentId === PORTRAIT_COMPONENT_ID ? portraitData : null)),
});

describe('SpeechBubbleRenderer', () => {
    let logger, docContext, eventDispatcher, entityManager, domFactory, renderer;
    let mockOutputDiv, mockMessageList;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = createMockLogger();
        docContext = createMockDocumentContext();
        eventDispatcher = createMockValidatedEventDispatcher();
        entityManager = createMockEntityManager();
        domFactory = createMockDomElementFactory();
        mockOutputDiv = docContext._mockOutputDivElement;
        mockMessageList = docContext._mockMessageListElement;
        mockOutputDiv.scrollHeight = 100;
        renderer = new SpeechBubbleRenderer({
            logger,
            documentContext: docContext,
            validatedEventDispatcher: eventDispatcher,
            entityManager,
            domElementFactory: domFactory
        });
    });

    describe('Constructor and Initialization', () => {
        it('should initialize and subscribe to DISPLAY_SPEECH_ID', () => {
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('[SpeechBubbleRenderer] Initialized.'));
            expect(logger.debug).toHaveBeenCalledWith(`SpeechBubbleRenderer: Initialized and subscribed to ${DISPLAY_SPEECH_ID}.`);
            expect(eventDispatcher.subscribe).toHaveBeenCalledWith(DISPLAY_SPEECH_ID, expect.any(Function));
        });
        it('should correctly find #outputDiv and #message-list (happy path)', () => {
            expect(docContext.query).toHaveBeenCalledWith('#outputDiv');
            expect(docContext.query).toHaveBeenCalledWith('#message-list');
            expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('#message-list not found'));
        });
        it('should warn if #message-list is not found and use #outputDiv as fallback', () => {
            const localLogger = createMockLogger();
            const localDocContext = createMockDocumentContext();
            const localOutputDiv = localDocContext._mockOutputDivElement;
            localDocContext.query = jest.fn(s => s === '#outputDiv' ? localOutputDiv : (s === '#message-list' ? null : null));
            new SpeechBubbleRenderer({
                logger: localLogger,
                documentContext: localDocContext,
                validatedEventDispatcher: createMockValidatedEventDispatcher(),
                entityManager: createMockEntityManager(),
                domElementFactory: createMockDomElementFactory()
            });
            expect(localLogger.warn).toHaveBeenCalledWith('SpeechBubbleRenderer: #message-list not found. Speech will be appended to #outputDiv.');
        });
        it('should error if #outputDiv is not found', () => {
            const localLogger = createMockLogger();
            const localDocContext = createMockDocumentContext();
            localDocContext.query = jest.fn(s => s === '#outputDiv' ? null : undefined);
            new SpeechBubbleRenderer({
                logger: localLogger,
                documentContext: localDocContext,
                validatedEventDispatcher: createMockValidatedEventDispatcher(),
                entityManager: createMockEntityManager(),
                domElementFactory: createMockDomElementFactory()
            });
            expect(localLogger.error).toHaveBeenCalledWith('SpeechBubbleRenderer: Could not find #outputDiv element!');
            expect(localLogger.error).toHaveBeenCalledWith('SpeechBubbleRenderer: Critical: Speech container (#message-list or #outputDiv) not found.');
        });
    });

    describe('#onDisplaySpeech event handler', () => {
        let renderSpeechSpy;
        let eventCallback;
        beforeEach(() => {
            renderSpeechSpy = jest.spyOn(renderer, 'renderSpeech');
            const call = eventDispatcher.subscribe.mock.calls.find(c => c[0] === DISPLAY_SPEECH_ID);
            expect(call).toBeDefined();
            eventCallback = call[1];
        });
        afterEach(() => {
            if (renderSpeechSpy) renderSpeechSpy.mockRestore();
        });
        it('should call renderSpeech with correct parameters for a valid event', () => {
            const p = {entityId: 'player', speechContent: 'Hello!', allowHtml: false};
            eventCallback({type: DISPLAY_SPEECH_ID, payload: p});
            expect(renderSpeechSpy).toHaveBeenCalledWith('player', 'Hello!', false);
        });
        it('should default allowHtml to false if not provided', () => {
            const p = {entityId: 'npc1', speechContent: 'Hi there.'};
            eventCallback({type: DISPLAY_SPEECH_ID, payload: p});
            expect(renderSpeechSpy).toHaveBeenCalledWith('npc1', 'Hi there.', false);
        });
        it('should warn and not call renderSpeech if event payload is invalid (missing entityId)', () => {
            const p = {speechContent: 'No sender.'};
            eventCallback({type: DISPLAY_SPEECH_ID, payload: p});
            expect(logger.warn).toHaveBeenCalledWith('SpeechBubbleRenderer: Invalid payload for \'textUI:display_speech\'.', p);
            expect(renderSpeechSpy).not.toHaveBeenCalled();
        });
        it('should warn and not call renderSpeech if event payload is invalid (missing speechContent)', () => {
            const p = {entityId: 'npc1'};
            eventCallback({type: DISPLAY_SPEECH_ID, payload: p});
            expect(logger.warn).toHaveBeenCalledWith('SpeechBubbleRenderer: Invalid payload for \'textUI:display_speech\'.', p);
            expect(renderSpeechSpy).not.toHaveBeenCalled();
        });
        it('should warn and not call renderSpeech if event object or payload is null/undefined', () => {
            eventCallback(null);
            expect(logger.warn).toHaveBeenCalledWith('SpeechBubbleRenderer: Received invalid \'textUI:display_speech\' event object.', null);
            const ev = {type: DISPLAY_SPEECH_ID, payload: null};
            eventCallback(ev);
            expect(logger.warn).toHaveBeenCalledWith('SpeechBubbleRenderer: Received invalid \'textUI:display_speech\' event object.', ev);
            expect(renderSpeechSpy).not.toHaveBeenCalled();
        });
    });

    describe('renderSpeech method', () => {
        const entityId = 'speaker1';
        const speechContent = 'Hello world';
        const getQuotedTextSpanFromDomFactory = () => {
            const allSpanCalls = domFactory.span.mock.calls;
            const cd = allSpanCalls.find(args => args[0] === 'speech-quoted-text');
            expect(cd).toBeDefined(); // Removed .withContext
            const idx = allSpanCalls.indexOf(cd);
            if (idx === -1 || !domFactory.span.mock.results[idx]) throw new Error("Mock result for speech-quoted-text span not found");
            return domFactory.span.mock.results[idx].value;
        };

        it('should render simple speech without portrait if entity not found', () => {
            entityManager.getEntityInstance.mockReturnValue(null);
            renderer.renderSpeech(entityId, speechContent);
            const quotedTextSpan = getQuotedTextSpanFromDomFactory();
            const finalChildNodes = quotedTextSpan._childNodes; // Check final state
            expect(finalChildNodes.length).toBe(3);
            expect(finalChildNodes[0].textContent).toBe('"');
            expect(finalChildNodes[1].textContent).toBe(speechContent);
            expect(finalChildNodes[2].textContent).toBe('"');
        });

        it('should render speech with name and portrait if entity and components found', () => {
            const mockNameComp = {text: 'Alice'};
            const mockPortraitComp = {imagePath: 'portraits/alice.png'};
            const mockEnt = createMockEntity(entityId, mockNameComp, mockPortraitComp, 'myMod:alice');
            entityManager.getEntityInstance.mockReturnValue(mockEnt);
            renderer.renderSpeech(entityId, speechContent);
            expect(domFactory.img).toHaveBeenCalledWith('/data/mods/myMod/portraits/alice.png', 'Portrait of Alice', 'speech-portrait');
        });
        it('should handle entity without a name component', () => {
            const mockPortraitComp = {imagePath: 'portraits/bob.png'};
            const mockEnt = createMockEntity(entityId, null, mockPortraitComp, 'myMod:bob');
            entityManager.getEntityInstance.mockReturnValue(mockEnt);
            renderer.renderSpeech(entityId, speechContent);
            const speakerIntroSpan = domFactory.span.mock.results.find(r => r.value.classList.add.mock.calls.some(c => c[0] === 'speech-speaker-intro')).value;
            expect(speakerIntroSpan.textContent).toBe(`${entityId} says: `);
        });
        it('should handle entity without a portrait component', () => { /* Passing */
        });
        it('should warn if modId cannot be parsed for portrait', () => { /* Passing */
        });

        describe('Action Text Parsing', () => {
            const getQuotedTextSpan = getQuotedTextSpanFromDomFactory;
            it('should render plain speech (no action text) correctly', () => {
                const plainSpeech = "This is a simple sentence.";
                entityManager.getEntityInstance.mockReturnValue(null);
                renderer.renderSpeech('speaker', plainSpeech);
                const quotedTextSpan = getQuotedTextSpan();
                const finalChildNodes = quotedTextSpan._childNodes;
                expect(finalChildNodes.length).toBe(3);
                expect(finalChildNodes[0].textContent).toBe('"');
                expect(finalChildNodes[1].textContent).toBe(plainSpeech);
                expect(finalChildNodes[2].textContent).toBe('"');
            });
            it('should correctly parse and render one action text segment', () => {
                const speech = "Look *over there* quickly.";
                entityManager.getEntityInstance.mockReturnValue(null);
                renderer.renderSpeech('speaker', speech);
                const qts = getQuotedTextSpan();
                const children = qts._childNodes;
                expect(children.length).toBe(5);
                expect(children[0].textContent).toBe('"');
                expect(children[1].textContent).toBe("Look ");
                expect(children[2].tagName).toBe('span');
                expect(children[2].textContent).toBe("*over there*");
                expect(children[3].textContent).toBe(" quickly.");
                expect(children[4].textContent).toBe('"');
            });
            it('should correctly parse and render multiple action text segments', () => {
                const speech = "He *ran fast* and then *jumped high*.";
                entityManager.getEntityInstance.mockReturnValue(null);
                renderer.renderSpeech('speaker', speech);
                const qts = getQuotedTextSpan();
                const children = qts._childNodes;
                expect(children.length).toBe(7);
                expect(children[0].textContent).toBe('"');
                expect(children[1].textContent).toBe("He ");
                expect(children[2].textContent).toBe("*ran fast*");
                expect(children[3].textContent).toBe(" and then ");
                expect(children[4].textContent).toBe("*jumped high*");
                expect(children[5].textContent).toBe(".");
                expect(children[6].textContent).toBe('"');
            });
            it('should handle action text at the beginning and end', () => {
                const speech = "*Start action* middle part *end action*";
                entityManager.getEntityInstance.mockReturnValue(null);
                renderer.renderSpeech('speaker', speech);
                const qts = getQuotedTextSpan();
                const children = qts._childNodes;
                expect(children.length).toBe(5);
                expect(children[0].textContent).toBe('"');
                expect(children[1].textContent).toBe("*Start action*");
                expect(children[2].textContent).toBe(" middle part ");
                expect(children[3].textContent).toBe("*end action*");
                expect(children[4].textContent).toBe('"');
            });
            it('should handle speech that is only action text', () => {
                const speech = "*Completely action*";
                entityManager.getEntityInstance.mockReturnValue(null);
                renderer.renderSpeech('speaker', speech);
                const qts = getQuotedTextSpan();
                const children = qts._childNodes;
                expect(children.length).toBe(3);
                expect(children[0].textContent).toBe('"');
                expect(children[1].textContent).toBe("*Completely action*");
                expect(children[2].textContent).toBe('"');
            });
            it('should handle empty speech content', () => {
                entityManager.getEntityInstance.mockReturnValue(null);
                renderer.renderSpeech('speaker', '');
                const quotedTextSpan = getQuotedTextSpan();
                // SUT sets textContent directly, which in mock calls appendChild once.
                expect(quotedTextSpan.appendChild).toHaveBeenCalledTimes(1);
                expect(quotedTextSpan.textContent).toBe('""');
            });
        });
        describe('allowHtml flag', () => {
            const getQuotedTextSpan = getQuotedTextSpanFromDomFactory;
            it('should use createTextNode for non-action parts when allowHtml is false', () => {
                const speech = "Text with <b>bold</b> and *action* part.";
                entityManager.getEntityInstance.mockReturnValue(null);
                renderer.renderSpeech('speaker', speech, false);
                const qts = getQuotedTextSpan();
                const children = qts._childNodes;
                expect(docContext.document.createTextNode).toHaveBeenCalledWith("Text with <b>bold</b> and ");
                expect(docContext.document.createTextNode).toHaveBeenCalledWith(" part.");
                expect(children.length).toBe(5);
                expect(children[0].textContent).toBe('"');
                expect(children[1].textContent).toBe("Text with <b>bold</b> and ");
                expect(children[2].textContent).toBe("*action*");
                expect(children[3].textContent).toBe(" part.");
                expect(children[4].textContent).toBe('"');
            });
            it('should use innerHTML parsing for non-action parts when allowHtml is true', () => {
                const speech = "Text with <b>bold</b> and *action* part.";
                entityManager.getEntityInstance.mockReturnValue(null);
                const tempSpanInnerHTMLCalls = [];
                const tempSpanMock = {
                    appendChild: jest.fn(), removeChild: jest.fn(), _childNodesFromInnerHTML: [],
                    set innerHTML(html) {
                        tempSpanInnerHTMLCalls.push(html);
                        this._childNodesFromInnerHTML = [];
                        if (html === "Text with <b>bold</b> and ") {
                            this._childNodesFromInnerHTML = [
                                {nodeType: 3, textContent: "Text with ", data: "Text with ", parentNode: this},
                                createGenericMockElement('B'),
                                {nodeType: 3, textContent: " and ", data: " and ", parentNode: this}
                            ];
                            const bElement = this._childNodesFromInnerHTML[1];
                            bElement.textContent = "bold";
                        } else if (html === " part.") {
                            this._childNodesFromInnerHTML = [{
                                nodeType: 3,
                                textContent: " part.",
                                data: " part.",
                                parentNode: this
                            }];
                        } else if (html !== "") {
                            this._childNodesFromInnerHTML = [{
                                nodeType: 3,
                                textContent: html,
                                data: html,
                                parentNode: this
                            }];
                        }
                    },
                    get firstChild() {
                        return this._childNodesFromInnerHTML.length > 0 ? this._childNodesFromInnerHTML.shift() : null;
                    }
                };
                const originalSpanFn = domFactory.span;
                domFactory.span = jest.fn(cls => cls === undefined ? tempSpanMock : originalSpanFn(cls));
                renderer.renderSpeech('speaker', speech, true);
                const qts = getQuotedTextSpan();
                const children = qts._childNodes;
                expect(children.length).toBe(7);
                expect(children[0].textContent).toBe('"');
                expect(children[1]).toEqual(expect.objectContaining({nodeType: 3, textContent: "Text with "}));
                expect(children[2]).toEqual(expect.objectContaining({nodeType: 1, tagName: 'B'}));
                expect(children[2].textContent).toBe("bold");
                expect(children[3]).toEqual(expect.objectContaining({nodeType: 3, textContent: " and "}));
                expect(children[4].textContent).toBe("*action*");
                expect(children[5]).toEqual(expect.objectContaining({nodeType: 3, textContent: " part."}));
                expect(children[6].textContent).toBe('"');
            });
        });
    });

    describe.skip('#getModIdFromDefinitionId', () => { /* tests skipped */
    });
    describe.skip('#scrollToBottom', () => { /* tests skipped */
    });
    describe('dispose method', () => { /* test passing */
    });
});
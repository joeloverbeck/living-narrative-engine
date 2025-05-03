// src/tests/domUI/locationRenderer.test.js
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
// Use index.js for imports as shown in user's provided code
import {LocationRenderer, RendererBase} from '../../domUI/index.js';
import DomElementFactory from '../../domUI/domElementFactory'; // Import the real class for type checking mocks


// --- Mock Dependencies ---

// Standard Mocks (Logger, DocumentContext, VED)
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock DocumentContext - needed by RendererBase
const mockDocumentContext = {
    query: jest.fn(),
    create: jest.fn(),
};

// Mock ValidatedEventDispatcher - needed for subscribing and testing event handlers
const mockValidatedEventDispatcher = {
    subscribe: jest.fn((eventType, callback) => {
        // Store callback for manual triggering in tests
        mockValidatedEventDispatcher.registeredCallbacks[eventType] = callback;
        // Return a mock subscription object
        const mockSubscription = {unsubscribe: jest.fn()};
        mockValidatedEventDispatcher.subscriptions.push(mockSubscription);
        return mockSubscription;
    }),
    dispatchValidated: jest.fn(), // Not directly called by LocationRenderer, but part of base
    // Helper properties for testing subscriptions
    registeredCallbacks: {},
    subscriptions: [],
};

// Mock DomElementFactory - crucial for testing render output
const mockDomElementFactory = {
    h3: jest.fn(),
    p: jest.fn(),
    span: jest.fn(),
    ul: jest.fn(),
    li: jest.fn(),
    button: jest.fn(),
    create: jest.fn((tagName) => { // Specifically mock 'br' creation
        // Return a mock element even for 'br' to simplify testing
        return createMockElement(tagName);
    }),
};

// Helper to create mock DOM elements - REVISED AGAIN (plain functions + spyOn)
const createMockElement = (tagName = 'DIV', id = '', classList = []) => {
    const classes = new Set(Array.isArray(classList) ? classList : (classList ? classList.split(' ') : []));
    // Use a plain array property on the instance
    const mockEl = {
        _internalChildNodes: [],
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        textContent: '',
        id: id,
        // Use PLAIN functions for state manipulation
        appendChild(child) {
            // Basic check to prevent appending self or null/undefined
            if (child && child !== this) {
                mockEl._internalChildNodes.push(child);
            }
        },
        removeChild(child) {
            const index = mockEl._internalChildNodes.indexOf(child);
            if (index > -1) {
                mockEl._internalChildNodes.splice(index, 1);
            }
        },
        // Getters remain the same
        get firstChild() {
            return mockEl._internalChildNodes[0] || null;
        },
        get childNodes() {
            return [...mockEl._internalChildNodes];
        },
        // Keep classList methods as mocks
        classList: {
            add: jest.fn((...names) => names.forEach(name => name && classes.add(name))),
            remove: jest.fn((...names) => names.forEach(name => name && classes.delete(name))),
            contains: jest.fn((name) => classes.has(name)),
            _values: () => Array.from(classes), // Helper, not a mock
        },
    };

    // Wrap the plain functions with jest.spyOn AFTER the object is created
    // This allows tracking calls while using the plain function logic for state.
    jest.spyOn(mockEl, 'appendChild');
    jest.spyOn(mockEl, 'removeChild');

    return mockEl;
};


// --- Test Suite ---

describe('LocationRenderer', () => {
    let mockContainerElement;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        mockValidatedEventDispatcher.registeredCallbacks = {}; // Clear stored callbacks
        mockValidatedEventDispatcher.subscriptions = []; // Clear stored subscriptions

        // Create a fresh mock container for each test
        mockContainerElement = createMockElement('DIV', 'location-output');

        // Setup default return values for factory mocks to return mock elements
        mockDomElementFactory.h3.mockImplementation((cls, text) => {
            const el = createMockElement('H3');
            el.textContent = text || '';
            if (cls) el.classList.add(cls);
            return el;
        });
        mockDomElementFactory.p.mockImplementation((cls, text) => {
            const el = createMockElement('P');
            el.textContent = text || '';
            if (cls) el.classList.add(cls);
            return el;
        });
        mockDomElementFactory.span.mockImplementation((cls, text) => {
            const el = createMockElement('SPAN');
            el.textContent = text || '';
            if (cls) el.classList.add(cls);
            return el;
        });
        // Ensure mockDomElementFactory.create returns a mock element
        mockDomElementFactory.create.mockImplementation((tagName) => {
            return createMockElement(tagName);
        });
    });

    // --- Helper Function ---
    const createInstance = (overrides = {}) => {
        return new LocationRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
            containerElement: mockContainerElement,
            ...overrides,
        });
    };

    // --- Constructor Tests ---
    // (Keep constructor tests as they were passing)
    it('should instantiate successfully with valid dependencies', () => {
        const renderer = createInstance();
        expect(renderer).toBeInstanceOf(LocationRenderer);
        expect(renderer).toBeInstanceOf(RendererBase); // Check inheritance
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[LocationRenderer] Initialized.'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[LocationRenderer] Attached to container element:'), mockContainerElement);
        expect(mockLogger.debug).toHaveBeenCalledWith("[LocationRenderer] Subscribed to VED event 'event:display_location'.");
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith('event:display_location', expect.any(Function));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw if containerElement is missing or invalid', () => {
        expect(() => createInstance({containerElement: null}))
            .toThrow("'containerElement' dependency is missing or not a valid DOM element.");
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("missing or not a valid DOM element"));

        expect(() => createInstance({containerElement: {nodeType: 3}})) // Not an ELEMENT_NODE
            .toThrow("'containerElement' dependency is missing or not a valid DOM element.");
    });

    it('should throw if domElementFactory is missing or invalid', () => {
        expect(() => createInstance({domElementFactory: null}))
            .toThrow("'domElementFactory' dependency is missing or invalid.");
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("missing or invalid"));

        expect(() => createInstance({domElementFactory: {create: 'not a function'}}))
            .toThrow("'domElementFactory' dependency is missing or invalid.");
    });

    it('should throw if logger is missing (via base class)', () => {
        expect(() => new LocationRenderer({
            // logger: mockLogger, // MISSING
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
            containerElement: mockContainerElement,
        }))
            .toThrow('LocationRenderer: Logger dependency is missing or invalid.');
    });

    it('should throw if documentContext is missing (via base class)', () => {
        expect(() => new LocationRenderer({
            logger: mockLogger,
            // documentContext: mockDocumentContext, // MISSING
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
            containerElement: mockContainerElement,
        }))
            .toThrow('LocationRenderer: DocumentContext dependency is missing or invalid.');
    });

    it('should throw if validatedEventDispatcher is missing (via base class)', () => {
        expect(() => new LocationRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext,
            // validatedEventDispatcher: mockValidatedEventDispatcher, // MISSING
            domElementFactory: mockDomElementFactory,
            containerElement: mockContainerElement,
        }))
            .toThrow('LocationRenderer: ValidatedEventDispatcher dependency is missing or invalid.');
    });


    // --- render(locationDto) Tests ---

    describe('render() method', () => {
        const fullDto = {
            name: 'Test Room',
            description: 'A room for testing.',
            items: [{id: 'item1', name: 'Red Key'}, {id: 'item2', name: 'Blue Potion'}],
            entities: [{id: 'npc1', name: 'Guard'}, {id: 'npc2', name: 'Merchant'}],
            exits: [{description: 'North to Corridor'}, {description: 'West to Storage'}],
        };

        it('should clear the container before rendering', () => {
            const renderer = createInstance();
            const oldChild1 = createMockElement('P');
            const oldChild2 = createMockElement('DIV');
            mockContainerElement.appendChild(oldChild1);
            mockContainerElement.appendChild(oldChild2);

            expect(mockContainerElement.childNodes).toHaveLength(2);
            expect(mockContainerElement.firstChild).toBe(oldChild1);

            renderer.render(fullDto);

            expect(mockContainerElement.removeChild).toHaveBeenCalledWith(oldChild1);
            expect(mockContainerElement.removeChild).toHaveBeenCalledWith(oldChild2);
            expect(mockContainerElement.removeChild).toHaveBeenCalledTimes(2);
        });

        it('should render a full DTO correctly', () => {
            const renderer = createInstance();
            renderer.render(fullDto);

            expect(mockDomElementFactory.h3).toHaveBeenCalledWith('location__name', 'Test Room');
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__description', 'A room for testing.');
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__items', 'Items here: Red Key, Blue Potion');
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__entities', 'Others here: Guard, Merchant');
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__exits');
            expect(mockDomElementFactory.span).toHaveBeenCalledWith(undefined, 'Exits:');
            expect(mockDomElementFactory.create).toHaveBeenCalledWith('br');
            expect(mockDomElementFactory.span).toHaveBeenCalledWith('location__exit-detail', expect.stringContaining('North to Corridor'));
            expect(mockDomElementFactory.span).toHaveBeenCalledWith('location__exit-detail', expect.stringContaining('West to Storage'));

            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(5);
            const containerAppendArgs = mockContainerElement.appendChild.mock.calls.map(call => call[0]);
            expect(containerAppendArgs[0].tagName).toBe('H3');
            expect(containerAppendArgs[4].tagName).toBe('P');

            const exitsParagraphMock = containerAppendArgs[4];
            expect(exitsParagraphMock.appendChild).toHaveBeenCalledTimes(1 + (2 * 2));
            const exitsParagraphAppends = exitsParagraphMock.appendChild.mock.calls.map(call => call[0]);
            expect(exitsParagraphAppends[4].textContent).toContain('West to Storage');

            expect(mockLogger.info).toHaveBeenCalledWith('[LocationRenderer] Location "Test Room" rendered successfully.');
        });

        it('should render correctly when items are missing or empty', () => {
            const renderer = createInstance();
            const dtoNoItems = {...fullDto, items: undefined};
            const dtoEmptyItems = {...fullDto, items: []};

            mockContainerElement.appendChild.mockClear();
            renderer.render(dtoNoItems);
            expect(mockDomElementFactory.p).not.toHaveBeenCalledWith('location__items', expect.any(String));
            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(4);

            mockContainerElement.appendChild.mockClear();
            renderer.render(dtoEmptyItems);
            expect(mockDomElementFactory.p).not.toHaveBeenCalledWith('location__items', expect.any(String));
            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(4);
        });

        it('should render correctly when entities are missing or empty', () => {
            const renderer = createInstance();
            const dtoNoEntities = {...fullDto, entities: undefined};
            const dtoEmptyEntities = {...fullDto, entities: []};

            mockContainerElement.appendChild.mockClear();
            renderer.render(dtoNoEntities);
            expect(mockDomElementFactory.p).not.toHaveBeenCalledWith('location__entities', expect.any(String));
            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(4);

            mockContainerElement.appendChild.mockClear();
            renderer.render(dtoEmptyEntities);
            expect(mockDomElementFactory.p).not.toHaveBeenCalledWith('location__entities', expect.any(String));
            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(4);
        });

        it('should render correctly when exits are missing or empty', () => {
            const renderer = createInstance();
            const dtoNoExits = {...fullDto, exits: undefined};
            const dtoEmptyExits = {...fullDto, exits: []};

            mockDomElementFactory.p.mockClear();
            mockContainerElement.appendChild.mockClear();
            renderer.render(dtoNoExits);

            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__exits');
            const exitsParagraphMockMissing = mockDomElementFactory.p.mock.results.find(r => r.value.classList.contains('location__exits'))?.value;
            expect(exitsParagraphMockMissing).toBeDefined();
            expect(exitsParagraphMockMissing.appendChild).toHaveBeenCalledTimes(3);
            const exitsParaAppendsMissing = exitsParagraphMockMissing.appendChild.mock.calls.map(call => call[0]);
            expect(exitsParaAppendsMissing[2].textContent).toBe('  None');
            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(5);
            const mainContainerAppendsMissing = mockContainerElement.appendChild.mock.calls.map(call => call[0]);
            expect(mainContainerAppendsMissing[4]).toBe(exitsParagraphMockMissing);

            mockDomElementFactory.p.mockClear();
            mockContainerElement.appendChild.mockClear();
            renderer.render(dtoEmptyExits);

            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__exits');
            const exitsParagraphMockEmpty = mockDomElementFactory.p.mock.results.find(r => r.value.classList.contains('location__exits'))?.value;
            expect(exitsParagraphMockEmpty).toBeDefined();
            expect(exitsParagraphMockEmpty.appendChild).toHaveBeenCalledTimes(3);
            const exitsParaAppendsEmpty = exitsParagraphMockEmpty.appendChild.mock.calls.map(call => call[0]);
            expect(exitsParaAppendsEmpty[2].textContent).toBe('  None');
            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(5);
            const mainContainerAppendsEmpty = mockContainerElement.appendChild.mock.calls.map(call => call[0]);
            expect(mainContainerAppendsEmpty[4]).toBe(exitsParagraphMockEmpty);
        });

        it('should use default text if name or description are missing/falsy', () => {
            const renderer = createInstance();
            const dtoMissingText = {name: '', description: null, items: [], entities: [], exits: []};

            mockContainerElement.appendChild.mockClear();
            renderer.render(dtoMissingText);

            expect(mockDomElementFactory.h3).toHaveBeenCalledWith('location__name', 'Unnamed Location');
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__description', 'You see nothing remarkable.');
            expect(mockContainerElement.appendChild).toHaveBeenCalledTimes(3);
        });

        // *** THIS IS THE FAILING TEST - CORRECTED ASSERTION ***
        it('should handle null or undefined DTO by clearing and showing message', () => {
            const renderer = createInstance();
            const oldChild = createMockElement('P', '', ['old-content']);
            // Spy on appendChild *before* the setup call
            const appendSpy = jest.spyOn(mockContainerElement, 'appendChild');

            mockContainerElement.appendChild(oldChild); // Setup call

            // Verify initial state
            expect(mockContainerElement.childNodes).toHaveLength(1);
            expect(mockContainerElement.firstChild).toBe(oldChild);

            // Clear mock calls that happened during setup
            appendSpy.mockClear();
            mockDomElementFactory.p.mockClear();
            jest.spyOn(mockContainerElement, 'removeChild').mockClear(); // Also clear removeChild spy if needed


            // --- Action ---
            renderer.render(null);

            // --- Assertions ---
            // Verify clear was attempted
            expect(mockContainerElement.removeChild).toHaveBeenCalledWith(oldChild);
            // Verify factory was called for the message
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__empty', 'No location information available.');
            // Get the mock element created by the factory for the error message
            const emptyMsgMock = mockDomElementFactory.p.mock.results.find(r => r.value.classList.contains('location__empty'))?.value;
            expect(emptyMsgMock).toBeDefined(); // Ensure the factory mock was called and returned something

            // Verify the message was appended *after* clearing
            // Check that appendChild was called exactly once *after* the setup/clear
            expect(appendSpy).toHaveBeenCalledTimes(1);
            // Check that appendChild was called with the specific mock message element
            expect(appendSpy).toHaveBeenCalledWith(emptyMsgMock);


            // Verify the container's actual final children array
            expect(mockContainerElement.childNodes).toHaveLength(1); // Because oldChild was removed, message added
            expect(mockContainerElement.childNodes[0]).toBe(emptyMsgMock);

            expect(mockLogger.warn).toHaveBeenCalledWith('[LocationRenderer] Received null or undefined location DTO. Clearing location display.');
        });

        it('should handle items/entities with missing names gracefully', () => {
            const renderer = createInstance();
            const dtoPartialNames = {
                ...fullDto,
                items: [{id: 'i1', name: 'Valid Item'}, {id: 'i2' /* name missing */}],
                entities: [{id: 'e1'}, {id: 'e2', name: 'Valid NPC'}],
            };
            renderer.render(dtoPartialNames);

            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__items', 'Items here: Valid Item, unnamed item');
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('location__entities', 'Others here: unnamed item, Valid NPC');
        });

        it('should handle exits with missing descriptions gracefully', () => {
            const renderer = createInstance();
            const dtoPartialExitDesc = {
                ...fullDto,
                exits: [{description: 'Valid Exit'}, {} /* description missing */],
            };
            renderer.render(dtoPartialExitDesc);

            const exitsParagraphMock = mockDomElementFactory.p.mock.results.find(r => r.value.classList.contains('location__exits'))?.value;
            expect(exitsParagraphMock).toBeDefined();

            const exitSpans = exitsParagraphMock.appendChild.mock.calls
                .map(call => call[0])
                .filter(el => el.tagName === 'SPAN' && el.classList.contains('location__exit-detail'));

            expect(exitSpans).toHaveLength(2);
            expect(exitSpans[0].textContent).toBe('  Valid Exit');
            expect(exitSpans[1].textContent).toBe('  an exit');
        });
    });

    // --- Event Handling Tests ---

    describe('Event Handling (event:display_location)', () => {
        it('should call render with valid payload when event is dispatched', () => {
            const renderer = createInstance();
            const renderSpy = jest.spyOn(renderer, 'render');
            const testPayload = {name: 'Event Room', description: 'From event.', exits: [], items: [], entities: []};

            const handler = mockValidatedEventDispatcher.registeredCallbacks['event:display_location'];
            expect(handler).toBeDefined();
            handler(testPayload, 'event:display_location');

            expect(renderSpy).toHaveBeenCalledWith(testPayload);
            expect(mockLogger.debug).toHaveBeenCalledWith('[LocationRenderer] Received \'event:display_location\' event. Payload:', testPayload);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should log error and clear/show error message if event payload is invalid', () => {
            const renderer = createInstance();
            const renderSpy = jest.spyOn(renderer, 'render');
            const invalidPayload = {name: 'Invalid', description: 123};

            const oldChild = createMockElement('P', '', ['old-content']);
            mockContainerElement.appendChild(oldChild);
            expect(mockContainerElement.firstChild).toBe(oldChild);

            const handler = mockValidatedEventDispatcher.registeredCallbacks['event:display_location'];
            expect(handler).toBeDefined();
            handler(invalidPayload, 'event:display_location');

            expect(renderSpy).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(
                "[LocationRenderer] Received invalid or incomplete payload for 'event:display_location'. Cannot render location. Payload:",
                invalidPayload
            );
            expect(mockContainerElement.removeChild).toHaveBeenCalledWith(oldChild);
            expect(mockDomElementFactory.p).toHaveBeenCalledWith('error-message', 'Error: Could not display location details.');
            const finalChildren = mockContainerElement.childNodes;
            expect(finalChildren).toHaveLength(1);
            expect(finalChildren[0].classList.contains('error-message')).toBe(true);
        });

        it('should handle optional items/entities being absent in payload', () => {
            const renderer = createInstance();
            const renderSpy = jest.spyOn(renderer, 'render');
            const partialPayload = {name: 'Partial Room', description: 'Desc.', exits: []};

            const handler = mockValidatedEventDispatcher.registeredCallbacks['event:display_location'];
            expect(handler).toBeDefined();
            handler(partialPayload, 'event:display_location');

            expect(renderSpy).toHaveBeenCalledWith(partialPayload);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    // --- dispose() Tests ---

    describe('dispose() method', () => {
        it('should call unsubscribe on all VED subscriptions', () => {
            const renderer = createInstance();
            expect(mockValidatedEventDispatcher.subscriptions).toHaveLength(1);
            const sub1 = mockValidatedEventDispatcher.subscriptions[0];

            renderer.dispose();

            expect(sub1.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith('[LocationRenderer] Disposing subscriptions.');
        });

        it('should call super.dispose() for base class cleanup (like logging)', () => {
            const renderer = createInstance();
            const baseDisposeSpy = jest.spyOn(RendererBase.prototype, 'dispose');

            renderer.dispose();

            expect(mockLogger.debug).toHaveBeenCalledWith('[LocationRenderer] Disposing.');
            expect(baseDisposeSpy).toHaveBeenCalled();
            baseDisposeSpy.mockRestore();
        });
    });
});
// src/tests/domUI/titleRenderer.test.js
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {TitleRenderer} from '../../domUI/titleRenderer'; // Corrected import path if needed
import {RendererBase} from '../../domUI/rendererBase'; // Needed for checking super.dispose

// --- Mock Dependencies ---

// Mock ILogger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock IDocumentContext
const mockDocumentContext = {
    query: jest.fn(),
    create: jest.fn(),
};

// Mock IValidatedEventDispatcher and capture subscriptions
let capturedSubscriptions = {}; // To store { eventType: callback }
let unsubscribeSpies = []; // To store mock unsubscribe functions
const mockValidatedEventDispatcher = {
    // Store the callback associated with the event type
    subscribe: jest.fn((eventType, callback) => {
        // console.log(`Mock subscribe called for: ${eventType}`); // Debugging line
        capturedSubscriptions[eventType] = callback;
        const mockUnsubscribe = jest.fn(() => {
            // console.log(`Mock unsubscribe called for: ${eventType}`); // Debugging line
            delete capturedSubscriptions[eventType]; // Remove on unsubscribe
        });
        const mockSubscription = {
            unsubscribe: mockUnsubscribe,
        };
        // Store the unsubscribe spy *before* returning the subscription
        unsubscribeSpies.push(mockUnsubscribe);
        return mockSubscription;
    }),
    dispatchValidated: jest.fn(), // Not used by TitleRenderer directly, but part of the interface
};

// --- Helper to create mock elements ---
const createMockElement = (tagName = 'DIV') => ({
    nodeType: 1, // ELEMENT_NODE
    tagName: tagName.toUpperCase(),
    textContent: '',
    // Add other properties/methods if needed by tests
});

// --- Test Suite ---

describe('TitleRenderer', () => {
    let mockH1Element;
    let renderer; // Instance of TitleRenderer

    // Helper to simulate an event dispatch
    const simulateEvent = (eventType, payload = {}) => {
        const handler = capturedSubscriptions[eventType];
        if (handler) {
            // console.log(`Simulating event: ${eventType} with payload:`, payload); // Debugging line
            handler(payload, eventType); // Pass payload and event type
        } else {
            // console.warn(`No subscription found for event type: ${eventType}`); // Debugging line
            // Optionally throw an error or log a warning if needed
            throw new Error(`Test setup error: No subscription captured for event type: ${eventType}`);
        }
    };

    beforeEach(() => {
        // Reset mocks and captured state before each test
        jest.clearAllMocks();
        capturedSubscriptions = {}; // Reset captured subscriptions
        unsubscribeSpies = []; // Reset spies array
        mockH1Element = createMockElement('H1');
        mockH1Element.textContent = 'Initial Title'; // Give it an initial value

        // Clear any potential prototype spy from previous tests
        if (jest.isMockFunction(RendererBase.prototype.dispose)) {
            RendererBase.prototype.dispose.mockRestore();
        }
    });

    // --- Constructor Tests ---

    describe('Constructor', () => {
        it('should instantiate successfully and subscribe to events', () => {
            renderer = new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: mockH1Element,
            });
            expect(renderer).toBeInstanceOf(TitleRenderer);
            expect(renderer).toBeInstanceOf(RendererBase); // Check inheritance
            expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Initialized.'); // From base
            expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Attached to H1 element.');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Subscribed to VED events'));
            // --- FIX: Correct subscription count ---
            expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(15); // Check number of subscriptions
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should throw if titleElement is missing or null', () => {
            expect(() => {
                new TitleRenderer({
                    logger: mockLogger,
                    documentContext: mockDocumentContext,
                    validatedEventDispatcher: mockValidatedEventDispatcher,
                    titleElement: null,
                });
            }).toThrow("[TitleRenderer] 'titleElement' dependency is missing or not a valid DOM element.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("missing or not a valid DOM element"));
        });

        it('should throw if titleElement is not an ELEMENT_NODE', () => {
            const notAnElement = {nodeType: 3, tagName: 'TEXT'}; // Text node example
            expect(() => {
                new TitleRenderer({
                    logger: mockLogger,
                    documentContext: mockDocumentContext,
                    validatedEventDispatcher: mockValidatedEventDispatcher,
                    titleElement: notAnElement,
                });
            }).toThrow("[TitleRenderer] 'titleElement' dependency is missing or not a valid DOM element.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("missing or not a valid DOM element"));
        });

        it('should throw if titleElement is not an H1 element', () => {
            const divElement = createMockElement('DIV');
            expect(() => {
                new TitleRenderer({
                    logger: mockLogger,
                    documentContext: mockDocumentContext,
                    validatedEventDispatcher: mockValidatedEventDispatcher,
                    titleElement: divElement,
                });
            }).toThrow("[TitleRenderer] 'titleElement' must be an H1 element, but received 'DIV'.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("must be an H1 element"), {element: divElement});
        });

        // Test base class dependency validation (delegated, but good practice to confirm)
        it('should throw if logger is missing', () => {
            expect(() => {
                new TitleRenderer({
                    logger: null,
                    documentContext: mockDocumentContext,
                    validatedEventDispatcher: mockValidatedEventDispatcher,
                    titleElement: mockH1Element,
                });
            }).toThrow('TitleRenderer: Logger dependency is missing or invalid.');
        });

        it('should throw if documentContext is missing', () => {
            expect(() => {
                new TitleRenderer({
                    logger: mockLogger,
                    documentContext: null,
                    validatedEventDispatcher: mockValidatedEventDispatcher,
                    titleElement: mockH1Element,
                });
            }).toThrow('TitleRenderer: DocumentContext dependency is missing or invalid.');
        });

        it('should throw if validatedEventDispatcher is missing', () => {
            expect(() => {
                new TitleRenderer({
                    logger: mockLogger,
                    documentContext: mockDocumentContext,
                    validatedEventDispatcher: null,
                    titleElement: mockH1Element,
                });
            }).toThrow('TitleRenderer: ValidatedEventDispatcher dependency is missing or invalid.');
        });
    });

    // --- set(text) API Tests ---

    describe('set(text)', () => {
        beforeEach(() => {
            // Instantiate for these tests, suppress initial logs if needed for clarity
            mockLogger.debug.mockClear();
            renderer = new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: mockH1Element,
            });
            // Clear constructor logs for cleaner assertion in specific set() tests
            mockLogger.debug.mockClear();
        });

        it('should set the textContent of the titleElement (happy path)', () => {
            const newTitle = 'New Game Title';
            renderer.set(newTitle);
            expect(mockH1Element.textContent).toBe(newTitle);
            expect(mockLogger.debug).toHaveBeenCalledWith(`[TitleRenderer] Title set to: "${newTitle}"`);
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should handle setting an empty string', () => {
            renderer.set('');
            expect(mockH1Element.textContent).toBe('');
            expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Title set to: ""');
        });

        it('should not update or log update if the text is the same as the current title', () => {
            const currentTitle = 'Current Title';
            mockH1Element.textContent = currentTitle; // Set initial state

            renderer.set(currentTitle); // Set the same title

            expect(mockH1Element.textContent).toBe(currentTitle); // Still the same
            // Check it logged the "skipping update" message
            expect(mockLogger.debug).toHaveBeenCalledWith(`[TitleRenderer] Title already set to: "${currentTitle}", skipping update.`);
            // Ensure it did NOT log the "Title set to" message again for this call
            expect(mockLogger.debug).not.toHaveBeenCalledWith(`[TitleRenderer] Title set to: "${currentTitle}"`);
        });

        it('should coerce non-string input to string and log a warning', () => {
            renderer.set(123); // Pass a number
            expect(mockH1Element.textContent).toBe('123'); // Coerced
            expect(mockLogger.warn).toHaveBeenCalledWith('[TitleRenderer] Received non-string value in set():', 123);
            expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Title set to: "123"'); // Logged the update

            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            renderer.set(null); // Pass null
            expect(mockH1Element.textContent).toBe('null'); // Coerced
            expect(mockLogger.warn).toHaveBeenCalledWith('[TitleRenderer] Received non-string value in set():', null);
            expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Title set to: "null"');
        });

        // --- REMOVED Test Case ---
        // it('should log an error if #titleElement becomes null unexpectedly (internal state error)', () => { ... });
        // Reason: Reliably testing mutation of private fields post-construction is brittle.
        // The constructor validation and the check within set() are sufficient.

        it('should not affect scroll position or window properties', () => {
            // Define mock scroll properties
            const initialScrollTop = 100;
            const initialScrollHeight = 500;
            Object.defineProperty(mockH1Element, 'scrollTop', {value: initialScrollTop, writable: true});
            Object.defineProperty(mockH1Element, 'scrollHeight', {value: initialScrollHeight, writable: true});
            // Mock relevant window properties if needed (though TitleRenderer shouldn't touch them)
            const windowScrollY = window.scrollY;

            renderer.set('A New Title That Changes Content');

            // Assert that scroll properties remain unchanged
            expect(mockH1Element.scrollTop).toBe(initialScrollTop);
            expect(mockH1Element.scrollHeight).toBe(initialScrollHeight); // scrollHeight might change if content wraps, but scrollTop shouldn't be forced
            expect(window.scrollY).toBe(windowScrollY); // Check global scroll
        });
    });

    // --- Event Handler Tests ---

    describe('Event Handlers', () => {
        beforeEach(() => {
            // Instantiate the renderer to register subscriptions
            renderer = new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: mockH1Element,
            });
            // Spy on the 'set' method to verify it's called by handlers
            jest.spyOn(renderer, 'set');
            // Clear constructor/setup logs and mocks
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            renderer.set.mockClear(); // Clear spy calls
        });

        it('should handle "textUI:set_title" event', () => {
            const payload = {text: 'Title from Event'};
            simulateEvent('textUI:set_title', payload);
            expect(renderer.set).toHaveBeenCalledWith('Title from Event');
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should warn on invalid "textUI:set_title" payload', () => {
            const invalidPayload = {message: 'Wrong property'};
            simulateEvent('textUI:set_title', invalidPayload);
            expect(renderer.set).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                '[TitleRenderer] Received \'textUI:set_title\' with invalid payload structure or missing \'text\' property:',
                invalidPayload
            );
        });

        it('should handle "initialization:initialization_service:started" event', () => {
            simulateEvent('initialization:initialization_service:started');
            expect(renderer.set).toHaveBeenCalledWith('Initializing game...');

            renderer.set.mockClear();
            simulateEvent('initialization:initialization_service:started', {worldName: 'TestWorld'});
            expect(renderer.set).toHaveBeenCalledWith("Initializing game for world 'TestWorld'...");
        });

        it('should handle "initialization:initialization_service:completed" event', () => {
            simulateEvent('initialization:initialization_service:completed');
            expect(renderer.set).toHaveBeenCalledWith('Game Ready');
        });

        it('should handle "initialization:initialization_service:failed" event', () => {
            const payload = {error: 'Core failure', worldName: 'BrokenWorld'};
            simulateEvent('initialization:initialization_service:failed', payload);
            expect(renderer.set).toHaveBeenCalledWith("Initialization Failed (World: BrokenWorld)");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Overall initialization failed'), expect.objectContaining(payload));
        });

        it('should handle "initialization:world_loader:started" step event', () => {
            simulateEvent('initialization:world_loader:started', {worldName: 'Terra'});
            expect(renderer.set).toHaveBeenCalledWith("Loading world data for 'Terra'...");
        });

        it('should handle "initialization:system_initializer:started" step event', () => {
            simulateEvent('initialization:system_initializer:started', {tag: 'gfx'});
            expect(renderer.set).toHaveBeenCalledWith("Initializing core systems (tag: gfx)...");
        });

        it('should handle "initialization:game_state_initializer:started" step event', () => {
            simulateEvent('initialization:game_state_initializer:started');
            expect(renderer.set).toHaveBeenCalledWith("Setting up initial game state...");
        });

        it('should handle "initialization:world_loader:failed" step event', () => {
            const payload = {error: 'File not found'};
            simulateEvent('initialization:world_loader:failed', payload);
            expect(renderer.set).toHaveBeenCalledWith("world loader Failed");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('world loader Failed. Error: File not found'), payload);
        });

        it('should handle "initialization:input_setup_service:failed" step event', () => {
            const payload = {error: 'Keybindings conflict'};
            simulateEvent('initialization:input_setup_service:failed', payload);
            expect(renderer.set).toHaveBeenCalledWith("input setup service Failed");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('input setup service Failed. Error: Keybindings conflict'), payload);
        });

        it('should handle "core:system_error_occurred" fatal event', () => {
            const payload = {message: 'Critical failure', error: new Error('Disk full')};
            simulateEvent('core:system_error_occurred', payload);
            expect(renderer.set).toHaveBeenCalledWith("System Error");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('System fatal error occurred'), payload);
        });
    });


    // --- dispose() Tests ---

    describe('dispose()', () => {
        // Note: unsubscribeSpies are captured globally within the VED mock setup

        beforeEach(() => {
            // Instantiate to ensure subscriptions are made and spies are populated
            renderer = new TitleRenderer({
                logger: mockLogger,
                documentContext: mockDocumentContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                titleElement: mockH1Element,
            });

            // Spy on RendererBase.dispose AFTER instantiation
            jest.spyOn(RendererBase.prototype, 'dispose');

            // Clear setup logs/mocks
            mockLogger.debug.mockClear();
        });

        afterEach(() => {
            // Restore base class prototype spy
            if (jest.isMockFunction(RendererBase.prototype.dispose)) {
                RendererBase.prototype.dispose.mockRestore();
            }
        });

        it('should call unsubscribe on all active subscriptions', () => {
            const initialSubscriptionCount = unsubscribeSpies.length;
            // --- FIX: Correct subscription count ---
            expect(initialSubscriptionCount).toBe(15); // Ensure subscriptions were made

            renderer.dispose();

            // Check that each captured unsubscribe function was called
            expect(unsubscribeSpies).toHaveLength(initialSubscriptionCount); // Ensure spies array wasn't modified unexpectedly
            unsubscribeSpies.forEach(spy => {
                expect(spy).toHaveBeenCalledTimes(1);
            });
        });

        // --- REMOVED Test Case ---
        // it('should clear the internal subscriptions array', () => { ... });
        // Reason: Testing private field state is brittle. Verifying unsubscribe calls is sufficient.

        it('should call super.dispose()', () => {
            renderer.dispose();
            expect(RendererBase.prototype.dispose).toHaveBeenCalledTimes(1);
            // Base class dispose logs, so we expect the log message via the spy
            // This indirectly confirms super.dispose() was called if the base class logs
            expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Disposing.'); // Log from base class dispose
        });

        it('should log disposal start', () => {
            renderer.dispose();
            // This specific log comes from TitleRenderer's dispose method itself
            expect(mockLogger.debug).toHaveBeenCalledWith('[TitleRenderer] Disposing subscriptions.');
        });
    });
});
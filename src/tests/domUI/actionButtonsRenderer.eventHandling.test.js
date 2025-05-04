// src/tests/domUI/actionButtonsRenderer.eventHandling.test.js
import {ActionButtonsRenderer} from '../../domUI/index.js'; // Adjust path if needed
import DomElementFactory from '../../domUI/domElementFactory';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// *** FIXED: Provide required methods ***
const mockDocumentContext = {
    query: jest.fn(), // Method required by RendererBase check
    create: jest.fn(), // Method required by RendererBase check
};
// *** END FIX ***

// Mock the VED subscribe/dispatchValidated methods
let capturedEventHandler = null;
const mockSubscription = {unsubscribe: jest.fn()};
const mockValidatedEventDispatcher = {
    subscribe: jest.fn((eventType, handler) => {
        if (eventType === 'textUI:update_available_actions') {
            capturedEventHandler = handler; // Capture the handler passed to subscribe
        }
        return mockSubscription; // Return a mock subscription object
    }),
    dispatchValidated: jest.fn().mockResolvedValue(true), // Simulate successful dispatch
    listenerCount: jest.fn(), // If needed by VED mock details
    unsubscribe: jest.fn(), // Add mock for unsubscribe if needed by dispose tests indirectly
};

// Mock DomElementFactory
const mockButtonProto = { // Use a prototype-like object for the mock button behavior
    textContent: '',
    setAttribute: jest.fn(),
    getAttribute: jest.fn(attr => { // Simple getAttribute mock needed for empty click log
        if (attr === 'data-action-id') return mockButtonProto._actionId;
        return undefined;
    }),
    addEventListener: jest.fn((event, handler) => {
        if (event === 'click') {
            mockButtonProto._clickHandlers = mockButtonProto._clickHandlers || [];
            mockButtonProto._clickHandlers.push(handler);
        }
    }),
    _clickHandlers: [], // Initialize click handlers array
    _actionId: '', // Store action id for getAttribute
    // Helper function to simulate click
    _simulateClick: async function () {
        if (this._clickHandlers) {
            for (const handler of this._clickHandlers) {
                await handler(); // Assuming handler might be async
            }
        }
    },
    // Helper to reset mocks on the button prototype itself
    _resetMocks: function () {
        this.setAttribute.mockClear();
        this.addEventListener.mockClear();
        this.getAttribute.mockClear();
        this._clickHandlers = [];
        this.textContent = '';
        this._actionId = '';
    }
};

const mockDomElementFactory = {
    create: jest.fn(), // Method required by ActionButtonsRenderer constructor check
    button: jest.fn((text, className) => {
        // Return a NEW object based on the prototype each time
        const newButton = Object.create(mockButtonProto);
        // Reset/initialize properties for this specific instance
        newButton.textContent = text;
        newButton.setAttribute = jest.fn();
        newButton.getAttribute = jest.fn(attr => {
            if (attr === 'data-action-id') return newButton._actionId;
            return undefined;
        });
        newButton.addEventListener = jest.fn((event, handler) => {
            if (event === 'click') {
                newButton._clickHandlers = newButton._clickHandlers || [];
                newButton._clickHandlers.push(handler);
            }
        });
        // Set actionId on creation based on expected usage in render()
        newButton.setAttribute.mockImplementation((attr, value) => {
            if (attr === 'data-action-id') {
                newButton._actionId = value;
            }
        });

        return newButton;
    })
};

// Mock Container Element
const mockContainer = {
    nodeType: 1, // Makes it look like an element
    children: [],
    firstChild: null,
    appendChild: jest.fn(child => {
        mockContainer.children.push(child);
        mockContainer.firstChild = mockContainer.children[0]; // Simplistic update
    }),
    removeChild: jest.fn(child => {
        mockContainer.children = mockContainer.children.filter(c => c !== child);
        mockContainer.firstChild = mockContainer.children.length > 0 ? mockContainer.children[0] : null; // Simplistic update
    }),
    // Helper to reset container state
    _reset: function () {
        this.children = [];
        this.firstChild = null;
        this.appendChild.mockClear();
        this.removeChild.mockClear();
    }
};

// --- Reset Mocks Before Each Test ---
beforeEach(() => {
    jest.clearAllMocks(); // Clears call counts etc. for all mocks
    mockContainer._reset();
    mockButtonProto._resetMocks(); // Reset the prototype's mocks
    capturedEventHandler = null; // Reset captured handler

    // Reset specific mocks if needed (jest.clearAllMocks might cover this)
    mockValidatedEventDispatcher.subscribe.mockClear();
    mockValidatedEventDispatcher.dispatchValidated.mockClear().mockResolvedValue(true); // Reset and restore default behavior
    mockDomElementFactory.button.mockClear();
});

// --- Test Suite ---
describe('ActionButtonsRenderer', () => {

    const CLASS_PREFIX = '[ActionButtonsRenderer]'; // Define prefix

    // Helper function to create instance with standard mocks
    const createInstance = (containerOverride = mockContainer, factoryOverride = mockDomElementFactory) => {
        return new ActionButtonsRenderer({
            logger: mockLogger,
            documentContext: mockDocumentContext, // Now provides required methods
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: factoryOverride, // Use override if provided
            actionButtonsContainer: containerOverride, // Use override if provided
        });
    };

    // --- Constructor Tests ---
    it('should throw error if logger is missing or invalid', () => {
        // This test actually applies to RendererBase, but good to have
        expect(() => new ActionButtonsRenderer({
            logger: null, // Invalid logger
            documentContext: mockDocumentContext,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            domElementFactory: mockDomElementFactory,
            actionButtonsContainer: mockContainer,
        })).toThrow(/Logger dependency is missing or invalid/); // Check RendererBase error
    });

    it('should throw error if actionButtonsContainer is missing or not an element', () => {
        // *** UPDATED: Use plain string in toThrow ***
        const expectedErrorString = '[ActionButtonsRenderer] \'actionButtonsContainer\' dependency is missing or not a valid DOM element.';
        // *** Pass valid dependencies EXCEPT the one being tested ***
        expect(() => createInstance(null)).toThrow(expectedErrorString);
        expect(() => createInstance({nodeType: 3})).toThrow(expectedErrorString); // Text node
        expect(() => createInstance({})).toThrow(expectedErrorString); // Plain object
        // *** END UPDATE ***
    });

    it('should throw error if domElementFactory is missing or invalid', () => {
        // *** UPDATED: Use plain string in toThrow ***
        const expectedErrorString = '[ActionButtonsRenderer] \'domElementFactory\' dependency is missing or invalid.';
        // Test with null factory
        expect(() => createInstance(mockContainer, null)).toThrow(expectedErrorString);
        // Test with factory missing 'create' method
        expect(() => createInstance(mockContainer, {button: jest.fn()})).toThrow(expectedErrorString);
        // *** END UPDATE ***
    });


    it('should subscribe to "textUI:update_available_actions" on construction', () => {
        createInstance(); // Create instance with valid mocks
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
            'textUI:update_available_actions',
            expect.any(Function) // Check that a function (the bound handler) was passed
        );
        expect(capturedEventHandler).toBeInstanceOf(Function); // Ensure handler was captured
    });

    // --- Event Handling (#handleUpdateActions via simulated dispatch) ---
    describe('Event Handling (#handleUpdateActions)', () => {

        const eventType = 'textUI:update_available_actions'; // Define for consistency
        const warningBase = `${CLASS_PREFIX} Received invalid or incomplete event object structure for '${eventType}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons. Received object:`; // Base warning message


        beforeEach(() => {
            // Ensure an instance is created and the handler is captured before each event handling test
            createInstance();
            if (!capturedEventHandler) {
                throw new Error("Test setup error: event handler not captured");
            }
            // Clear mocks that might be called during instance creation
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();
        });

        it('should call render with valid actions when receiving a valid event object', () => {
            const instance = createInstance(); // Already created in beforeEach, re-create if needed for spy
            const renderSpy = jest.spyOn(instance, 'render');
            const validActions = [{id: 'core:wait', command: 'wait'}]; // Already trimmed
            const validEventObject = {
                type: eventType,
                payload: {actions: validActions}
            };

            capturedEventHandler(validEventObject); // Simulate dispatch with the *event object*

            expect(renderSpy).toHaveBeenCalledTimes(1);
            // Check that the *inner* actions were extracted correctly
            expect(renderSpy).toHaveBeenCalledWith(validActions); // Should pass the exact valid actions array
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), validEventObject);
        });

        it('should filter invalid actions from the nested array and call render with valid ones', () => {
            const instance = createInstance(); // Already created
            const renderSpy = jest.spyOn(instance, 'render');
            const mixedActions = [
                {id: 'core:go', command: 'go north'}, null, {id: 'core:look', command: ' look '}, // Will be trimmed LATER
                {id: '', command: 'invalid_id'}, {id: 'core:take', command: '   '}, // Invalid command
                {id: 'core:inv', command: 'inventory'}
            ];
            const mixedEventObject = {
                type: eventType,
                payload: {actions: mixedActions}
            };
            // *** Expect the command as it is passed to render (untrimmed) ***
            const expectedValidActions = [ // Filtered by the handler's logic
                {id: 'core:go', command: 'go north'},
                {id: 'core:look', command: ' look '}, // Kept as is by handler
                {id: 'core:inv', command: 'inventory'}
            ];
            // *** END UPDATE ***


            capturedEventHandler(mixedEventObject);

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith(expectedValidActions); // Check with correctly filtered actions
            // *** UPDATED: Check warning log with prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Received '${eventType}' with some invalid items in the nested actions array`),
                mixedEventObject // Log the original *event object*
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), mixedEventObject);
        });

        it('should call render with empty array for event object missing inner "payload"', () => {
            const instance = createInstance();
            const renderSpy = jest.spyOn(instance, 'render');
            const invalidEventObject = {type: eventType, /* payload missing */};

            capturedEventHandler(invalidEventObject);

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith([]);
            // *** UPDATED: Check warning log with prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(warningBase), // Use base warning
                invalidEventObject
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), invalidEventObject);

        });

        it('should call render with empty array for event object where inner "payload" is not an object', () => {
            const instance = createInstance();
            const renderSpy = jest.spyOn(instance, 'render');
            const invalidEventObject = {type: eventType, payload: "not an object"};

            capturedEventHandler(invalidEventObject);

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith([]);
            // *** UPDATED: Check warning log with prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(warningBase), // Use base warning
                invalidEventObject
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), invalidEventObject);
        });

        it('should call render with empty array for event object missing inner "actions" array', () => {
            const instance = createInstance();
            const renderSpy = jest.spyOn(instance, 'render');
            const invalidEventObject = {type: eventType, payload: { /* actions missing */}};

            capturedEventHandler(invalidEventObject);

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith([]);
            // *** UPDATED: Check warning log with prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(warningBase), // Use base warning
                invalidEventObject
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), invalidEventObject);
        });

        it('should call render with empty array for event object where inner "actions" is not an array', () => {
            const instance = createInstance();
            const renderSpy = jest.spyOn(instance, 'render');
            const invalidEventObject = {type: eventType, payload: {actions: "not an array"}};

            capturedEventHandler(invalidEventObject);

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith([]);
            // *** UPDATED: Check warning log with prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(warningBase), // Use base warning
                invalidEventObject
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), invalidEventObject);
        });

        it('should call render with empty array for null event object', () => {
            const instance = createInstance();
            const renderSpy = jest.spyOn(instance, 'render');
            const input = null;

            capturedEventHandler(input); // Pass null

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith([]);
            // *** UPDATED: Check warning log with prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(warningBase), // Use base warning
                input
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), input);
        });

        it('should call render with empty array for non-object event data', () => {
            const instance = createInstance();
            const renderSpy = jest.spyOn(instance, 'render');
            const input = "a string";

            capturedEventHandler(input); // Pass something other than an object

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(renderSpy).toHaveBeenCalledWith([]);
            // *** UPDATED: Check warning log with prefix ***
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(warningBase), // Use base warning
                input
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Received event object for '${eventType}'`), input);
        });
    });

    // --- Rendering Logic (Direct call to render) ---
    describe('Rendering Logic (render)', () => {

        beforeEach(() => {
            // Clear logs before each render test
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();
        });

        it('should clear the container before rendering', () => {
            // Add a dummy child first using the mock's method
            const dummyDiv = {nodeType: 1, textContent: 'dummy'}; // Mock element
            mockContainer.appendChild(dummyDiv);
            expect(mockContainer.children.length).toBe(1);
            mockContainer.appendChild.mockClear(); // Clear setup call

            const instance = createInstance();
            instance.render([{id: 'core:wait', command: 'wait'}]); // Render something

            // Check removeChild was called (robust check for clearing)
            expect(mockContainer.removeChild).toHaveBeenCalledWith(dummyDiv); // Should remove the specific child
            // Check appendChild was called *after* potential clearing
            expect(mockContainer.appendChild).toHaveBeenCalled(); // Should append the new button
            expect(mockContainer.children.length).toBe(1); // Should have 1 new button
        });

        it('should create and append buttons for each valid action', () => {
            const instance = createInstance();
            const actions = [
                {id: 'core:wait', command: 'wait'},
                {id: 'core:look', command: 'look around'}
            ];

            instance.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(2);
            expect(mockDomElementFactory.button).toHaveBeenCalledWith('wait', 'action-button');
            expect(mockDomElementFactory.button).toHaveBeenCalledWith('look around', 'action-button');

            expect(mockContainer.appendChild).toHaveBeenCalledTimes(2);
            expect(mockContainer.children.length).toBe(2);

            // Check button configuration (using the mocks)
            const firstButtonMock = mockContainer.children[0];
            expect(firstButtonMock.textContent).toBe('wait');
            expect(firstButtonMock.setAttribute).toHaveBeenCalledWith('title', 'Click to wait');
            expect(firstButtonMock.setAttribute).toHaveBeenCalledWith('data-action-id', 'core:wait');
            expect(firstButtonMock.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

            const secondButtonMock = mockContainer.children[1];
            expect(secondButtonMock.textContent).toBe('look around');
            expect(secondButtonMock.setAttribute).toHaveBeenCalledWith('title', 'Click to look around');
            expect(secondButtonMock.setAttribute).toHaveBeenCalledWith('data-action-id', 'core:look');
            expect(secondButtonMock.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            // *** UPDATED: Check info log ***
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered 2 action buttons into container.`));
        });

        it('should clear the container and render nothing if actions array is empty', () => {
            const dummyDiv = {nodeType: 1, textContent: 'dummy'}; // Mock element
            mockContainer.appendChild(dummyDiv);
            expect(mockContainer.children.length).toBe(1);
            mockContainer.appendChild.mockClear(); // Clear setup call

            const instance = createInstance();
            instance.render([]); // Render empty array

            expect(mockContainer.removeChild).toHaveBeenCalledWith(dummyDiv); // Should have cleared
            expect(mockContainer.appendChild).not.toHaveBeenCalled(); // Should not append anything
            expect(mockContainer.children.length).toBe(0); // Container should be empty
            // *** UPDATED: Check debug log ***
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} No actions provided to render, container cleared.`));
        });

        it('should log error and clear container if actions argument is not an array', () => {
            const dummyDiv = {nodeType: 1, textContent: 'dummy'}; // Mock element
            mockContainer.appendChild(dummyDiv);
            mockContainer.appendChild.mockClear(); // Clear setup call

            const instance = createInstance();
            const input = "not an array";
            instance.render(input);

            // *** UPDATED: Check error log ***
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Invalid actions argument received in render(). Expected array, got:`), input);
            expect(mockContainer.removeChild).toHaveBeenCalledWith(dummyDiv); // Should clear
            expect(mockContainer.children.length).toBe(0);
            expect(mockContainer.appendChild).not.toHaveBeenCalled(); // Should not append
        });

        it('should skip rendering invalid action objects within the array and log warning', () => {
            const instance = createInstance();
            const actions = [
                {id: 'core:valid', command: 'do valid'},
                null, // Invalid
                {id: 'core:valid2', command: '  '}, // Invalid command
                {command: 'missing id'}, // Invalid
                {id: 'core:final', command: 'last one'}
            ];
            const expectedValidCount = 2;
            const expectedInvalidCount = 3;

            instance.render(actions);

            expect(mockDomElementFactory.button).toHaveBeenCalledTimes(expectedValidCount); // Only for valid ones
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(expectedValidCount);
            expect(mockContainer.children.length).toBe(expectedValidCount);
            expect(mockContainer.children[0].textContent).toBe('do valid');
            expect(mockContainer.children[1].textContent).toBe('last one');

            expect(mockLogger.warn).toHaveBeenCalledTimes(expectedInvalidCount); // 3 invalid items
            // *** UPDATED: Check warning log ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Skipping invalid action object during render: `), expect.anything()); // Check general format
            // *** UPDATED: Check info log ***
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Rendered ${expectedValidCount} action buttons into container.`));
        });
    });

    // --- Button Click Behavior ---
    describe('Button Click Behavior', () => {

        beforeEach(() => {
            // Clear logs before each click test
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.info.mockClear();
        });

        it('should dispatch "core:submit_command" with correct command on button click', async () => {
            const instance = createInstance();
            const commandText = 'test command';
            const actionId = 'core:test';
            const actions = [{id: actionId, command: commandText}];
            instance.render(actions); // This calls factory.button which creates the mock with simulateClick

            expect(mockContainer.children.length).toBe(1);
            const buttonMock = mockContainer.children[0];
            expect(buttonMock._simulateClick).toBeDefined(); // Ensure helper exists
            buttonMock._actionId = actionId; // Ensure ID is set for later tests

            // Simulate the click
            await buttonMock._simulateClick();

            // Verify dispatchValidated call
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:submit_command',
                {command: commandText} // Ensure it uses the command text
            );
            // *** UPDATED: Check info log ***
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Event 'core:submit_command' for "${commandText}" dispatched successfully.`));
        });

        it('should handle button click even if command has leading/trailing spaces initially', async () => {
            const instance = createInstance();
            const actionId = 'core:spaced';
            // Command has spaces
            const actions = [{id: actionId, command: '  spaced command  '}];
            const expectedTrimmedCommand = 'spaced command';
            instance.render(actions);

            expect(mockContainer.children.length).toBe(1);
            const buttonMock = mockContainer.children[0];
            // Assume factory/render trimmed it for textContent (mock factory does this)
            expect(buttonMock.textContent).toBe(expectedTrimmedCommand);
            buttonMock._actionId = actionId; // Set ID

            await buttonMock._simulateClick();

            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:submit_command',
                {command: expectedTrimmedCommand} // Dispatch the trimmed button text
            );
        });

        it('should log warning and not dispatch if button textContent is empty at click time', async () => {
            const instance = createInstance();
            const actionId = 'core:empty';
            const actions = [{id: actionId, command: 'will be emptied'}];
            instance.render(actions);

            expect(mockContainer.children.length).toBe(1);
            const buttonMock = mockContainer.children[0];
            buttonMock._actionId = actionId; // Set ID for log message
            buttonMock.textContent = '   '; // Set to empty/whitespace just before click

            await buttonMock._simulateClick();

            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            // *** UPDATED: Check warning log ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Action button clicked, but its textContent is unexpectedly empty or whitespace. ID: ${actionId}`));
        });

        it('should log warning if dispatchValidated fails (returns false)', async () => {
            mockValidatedEventDispatcher.dispatchValidated.mockResolvedValueOnce(false); // Simulate failed dispatch

            const instance = createInstance();
            const commandText = 'fail dispatch';
            const actionId = 'core:fail';
            const actions = [{id: actionId, command: commandText}];
            instance.render(actions);

            const buttonMock = mockContainer.children[0];
            buttonMock._actionId = actionId;
            await buttonMock._simulateClick();

            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            // *** UPDATED: Check warning log ***
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Event 'core:submit_command' for "${commandText}" was NOT dispatched`));
        });

        it('should log error if dispatchValidated throws an error', async () => {
            const testError = new Error("Dispatch Failed!");
            mockValidatedEventDispatcher.dispatchValidated.mockRejectedValueOnce(testError); // Simulate thrown error

            const instance = createInstance();
            const commandText = 'throw error';
            const actionId = 'core:throw';
            const actions = [{id: actionId, command: commandText}];
            instance.render(actions);

            const buttonMock = mockContainer.children[0];
            buttonMock._actionId = actionId;
            await buttonMock._simulateClick();

            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            // *** UPDATED: Check error log ***
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`${CLASS_PREFIX} Error occurred during dispatch of 'core:submit_command' for "${commandText}"`),
                testError
            );
        });
    });

    // --- Dispose Method ---
    describe('Dispose Method', () => {
        it('should unsubscribe from VED event', () => {
            const instance = createInstance();
            // Ensure subscription happened and we have the mock object
            expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalled();
            expect(mockSubscription.unsubscribe).not.toHaveBeenCalled();

            instance.dispose();

            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`${CLASS_PREFIX} Disposing subscriptions.`));
        });

        it('should handle disposing multiple times gracefully', () => {
            const instance = createInstance();
            instance.dispose();
            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);

            // Call dispose again
            instance.dispose();
            // Unsubscribe should not be called again because the internal array is cleared
            expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
        });

        it('should handle case where subscription might be undefined (robustness)', () => {
            const instance = createInstance();
            // Clear the VED mock return value *after* construction but *before* dispose
            mockValidatedEventDispatcher.subscribe.mockReturnValueOnce(undefined); // Simulate subscribe failing or returning undefined
            // Recreate instance to get the undefined subscription internally
            const instance2 = createInstance();

            // Reset the mock for subsequent tests
            mockValidatedEventDispatcher.subscribe.mockReturnValue(mockSubscription);

            expect(() => instance2.dispose()).not.toThrow();
            expect(mockSubscription.unsubscribe).not.toHaveBeenCalled(); // Because the specific subscription was undefined
        });
    });
});
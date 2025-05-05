// src/tests/domUI/inputStateController.test.js
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {JSDOM} from 'jsdom';
import {InputStateController} from '../../domUI/index.js'; // Assuming index exports it
import DocumentContext from '../../domUI/documentContext.js';
import ConsoleLogger from '../../core/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../core/services/consoleLogger');
jest.mock('../../services/validatedEventDispatcher');

describe('InputStateController', () => {
    let dom;
    let document;
    let docContext;
    let mockLogger;
    let mockVed;
    let inputElement;
    let mockSubscriptions;

    // Helper to get the handler function passed to ved.subscribe
    const getVedHandler = (eventType) => {
        // Find the call to subscribe for the specific eventType
        const call = mockVed.subscribe.mock.calls.find(callArgs => callArgs[0] === eventType);
        // Return the second argument, which is the handler function
        return call ? call[1] : null;
    };


    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><input id="player-input" type="text" placeholder="initial"/></body></html>`); // Start with placeholder
        document = dom.window.document;
        docContext = new DocumentContext(document.body);
        inputElement = document.getElementById('player-input');
        inputElement.disabled = false; // Start enabled

        // --- Mock Creation ---
        // Create instances of the mocked classes
        mockLogger = new ConsoleLogger();
        // ValidatedEventDispatcher requires a dispatcher (like EventBus) and a logger
        // For this test, we don't need a real underlying dispatcher, so null is fine for the first arg if VED handles it.
        // If VED requires a valid dispatcher, we'd mock EventBus too. Assuming it's tolerant for this test.
        mockVed = new ValidatedEventDispatcher(null, mockLogger);

        // --- Mock VED's subscribe method ---
        mockSubscriptions = []; // Store mock subscription objects
        // Replace the actual subscribe method with a Jest mock function
        mockVed.subscribe = jest.fn((_eventType, _handler) => {
            // When subscribe is called, create a mock subscription object with a mock unsubscribe method
            const subscription = {unsubscribe: jest.fn()};
            mockSubscriptions.push(subscription); // Keep track of it for the dispose test
            return subscription; // Return the mock subscription
        });

        // --- Mock Logger Methods ---
        // Replace logger methods with Jest mock functions
        mockLogger.info = jest.fn();
        mockLogger.warn = jest.fn();
        mockLogger.error = jest.fn();
        mockLogger.debug = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (document && document.body) {
            document.body.innerHTML = '';
        }
        mockSubscriptions = []; // Reset subscriptions array
    });

    // Helper to create controller instance
    const createController = (element = inputElement) => {
        return new InputStateController({
            logger: mockLogger,
            documentContext: docContext,
            validatedEventDispatcher: mockVed,
            inputElement: element,
        });
    };

    describe('Constructor', () => {
        it('should initialize successfully with valid dependencies', () => {
            const controller = createController();
            expect(controller).toBeInstanceOf(InputStateController);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Initialized.')); // From base class
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Attached to INPUT element.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Subscribed to VED events'));
            // Constructor logs 3 debug messages total
            expect(mockLogger.debug).toHaveBeenCalledTimes(3);
        });

        it('should throw error if inputElement is missing or null', () => {
            expect(() => createController(null)).toThrow("'inputElement' dependency is missing or not a valid DOM element.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("'inputElement' dependency is missing or not a valid DOM element."));
        });

        it('should throw error if inputElement is not a DOM node', () => {
            // Pass an object that isn't a node
            expect(() => createController({
                nodeType: undefined,
                tagName: 'FAKE'
            })).toThrow("'inputElement' dependency is missing or not a valid DOM element.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("'inputElement' dependency is missing or not a valid DOM element."));

        });

        it('should throw error if inputElement is not an <input> element', () => {
            const divElement = document.createElement('div');
            expect(() => createController(divElement)).toThrow("'inputElement' must be an HTMLInputElement (<input>), but received 'DIV'.");
            // Check error log includes the element details
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("'inputElement' must be an HTMLInputElement (<input>), but received 'DIV'."),
                {element: divElement} // Check that the element was logged
            );
        });

        it('should subscribe to VED events on construction', () => {
            createController();
            expect(mockVed.subscribe).toHaveBeenCalledTimes(2);
            expect(mockVed.subscribe).toHaveBeenCalledWith('textUI:disable_input', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('textUI:enable_input', expect.any(Function));
        });
    });

    describe('setEnabled(enabled, placeholderText)', () => {
        // Tests remain largely the same as they test the public method directly
        it('should enable the input and clear the placeholder', () => {
            const controller = createController();
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'testing'; // Start with placeholder
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(true); // Enable with default empty placeholder

            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('');
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed from false to true
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: ""')); // Changed from 'testing' to ''
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both state and placeholder changed
        });

        it('should disable the input and clear the placeholder', () => {
            const controller = createController();
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'testing'; // Start with placeholder
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(false); // Disable with default empty placeholder

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('');
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed from true to false
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: ""')); // Changed from 'testing' to ''
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both state and placeholder changed
        });

        it('should enable the input and set the specified placeholder', () => {
            const controller = createController();
            const placeholder = 'Enter your command here...';
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = ''; // Start empty
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(true, placeholder);

            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe(placeholder);
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Input placeholder set to: "${placeholder}"`)); // Changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both changed
        });

        it('should disable the input and set the specified placeholder', () => {
            const controller = createController();
            const placeholder = 'Please wait...';
            inputElement.disabled = false; // Start enabled (default from beforeEach)
            inputElement.placeholder = 'initial'; // Default from beforeEach
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(false, placeholder);

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe(placeholder);
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Input placeholder set to: "${placeholder}"`)); // Changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both changed
        });

        it('should only log placeholder change if disabled state is unchanged', () => {
            const controller = createController();
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'old';
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(false, 'new'); // Keep disabled, change placeholder

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('new');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Did not change
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Did not change
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "new"')); // Did change
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only one log expected
        });

        it('should only log disabled change if placeholder is unchanged', () => {
            const controller = createController();
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'same';
            jest.clearAllMocks(); // Clear constructor logs

            // Call with same enabled state (true) but different placeholder
            controller.setEnabled(true, 'different');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // State didn't change from enabled
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "different"')); // Placeholder changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            mockLogger.debug.mockClear(); // Clear for next step

            // Now, disable but keep the placeholder
            inputElement.placeholder = 'keep_this'; // Set placeholder
            controller.setEnabled(false, 'keep_this'); // Disable, keep placeholder

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('keep_this');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Did change state
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to:')); // Did not change placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only one log expected
        });


        it('should handle null placeholder by converting it to "null" string', () => {
            const controller = createController();
            // Note: beforeEach sets disabled = false, placeholder = 'initial'
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(true, null); // Keep enabled, set null placeholder

            expect(inputElement.disabled).toBe(false); // Still false
            expect(inputElement.placeholder).toBe('null'); // String coercion
            // Check logs specifically for this call's changes
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // State didn't change
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "null"')); // Placeholder changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only placeholder log
        });

        it('should handle undefined placeholder by setting it to empty string (default)', () => {
            const controller = createController();
            // Note: beforeEach sets disabled = false, placeholder = 'initial'
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(true, undefined); // Keep enabled, set undefined placeholder

            expect(inputElement.disabled).toBe(false); // Still false
            expect(inputElement.placeholder).toBe(''); // Default value for placeholderText
            // Check logs specifically for this call's changes
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input enabled.'));// State didn't change
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: ""')); // Placeholder changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only placeholder log
        });

        it('should handle multiple toggles correctly', () => {
            const controller = createController();
            inputElement.disabled = true; // Ensure start disabled
            inputElement.placeholder = 'zero';
            jest.clearAllMocks(); // Clear constructor logs

            controller.setEnabled(true, 'Start'); // enable, change placeholder
            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('Start');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Start"'));
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
            mockLogger.debug.mockClear(); // Clear calls for next step

            controller.setEnabled(false, 'Wait'); // disable, change placeholder
            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('Wait');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Wait"'));
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
            mockLogger.debug.mockClear(); // Clear calls for next step

            controller.setEnabled(true, 'Ready'); // enable, change placeholder
            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('Ready');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Ready"'));
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        });

        it('should not log if state does not change', () => {
            const controller = createController();
            // Set initial state matching beforeEach
            inputElement.disabled = false;
            inputElement.placeholder = 'initial';
            jest.clearAllMocks(); // Clear constructor logs

            // Call setEnabled with the *exact same* state
            controller.setEnabled(false, 'initial'); // Disable, keep 'initial' placeholder
            expect(inputElement.disabled).toBe(true); // State changed
            expect(inputElement.placeholder).toBe('initial'); // Placeholder did NOT change
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Log state change
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to:')); // NO log placeholder change
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            jest.clearAllMocks(); // Clear log calls

            // Call again with the *new* current state (disabled, 'initial')
            controller.setEnabled(false, 'initial');
            expect(inputElement.disabled).toBe(true); // Still true
            expect(inputElement.placeholder).toBe('initial'); // Still 'initial'
            // No new logs should have been generated because nothing changed
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        it('should handle boolean coercion for enabled flag', () => {
            const controller = createController();
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'Before';
            jest.clearAllMocks(); // Clear constructor logs

            // Truthy value (1) -> should enable
            controller.setEnabled(1, 'Truthy');
            expect(inputElement.disabled).toBe(false); // Enabled
            expect(inputElement.placeholder).toBe('Truthy');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Truthy"')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
            mockLogger.debug.mockClear(); // Clear for next step

            // Falsy value (0) -> should disable
            controller.setEnabled(0, 'Falsy');
            expect(inputElement.disabled).toBe(true); // Disabled
            expect(inputElement.placeholder).toBe('Falsy');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Falsy"')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        });
    });

    describe('Event Handling (VED)', () => {
        // These tests now simulate the VED/EventBus calling the handler with a single event object

        it('should handle valid textUI:disable_input event object', () => {
            const controller = createController();
            const disableHandler = getVedHandler('textUI:disable_input');
            expect(disableHandler).toBeInstanceOf(Function); // Verify we got the handler

            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'start';
            jest.clearAllMocks(); // Clear constructor logs

            const event = {type: 'textUI:disable_input', payload: {message: 'System busy...'}};
            disableHandler(event); // Simulate VED dispatching the event object

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('System busy...');
            // Check logs for setEnabled called by handler
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "System busy..."')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning expected
        });

        it('should handle textUI:disable_input with missing payload (use default message)', () => {
            const controller = createController();
            const disableHandler = getVedHandler('textUI:disable_input');
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'start';
            jest.clearAllMocks();

            const event = {type: 'textUI:disable_input', payload: null}; // Missing payload
            disableHandler(event); // Calls setEnabled(false, 'Input disabled.')

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('Input disabled.'); // Default message set
            // Check logs
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Received 'textUI:disable_input' without valid 'message' string in payload"), // Correct warning message
                {receivedEvent: event} // Log the whole event object
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Input disabled."')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both changed
        });

        it('should handle textUI:disable_input with payload missing message property (use default message)', () => {
            const controller = createController();
            const disableHandler = getVedHandler('textUI:disable_input');
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'start';
            jest.clearAllMocks();

            const event = {type: 'textUI:disable_input', payload: {otherProp: true}}; // Payload lacks 'message'
            disableHandler(event); // Calls setEnabled(false, 'Input disabled.')

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('Input disabled.'); // Default message set
            // Check logs
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Received 'textUI:disable_input' without valid 'message' string in payload"), // Correct warning
                {receivedEvent: event}
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Input disabled."')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both changed
        });


        it('should handle valid textUI:enable_input event object', () => {
            const controller = createController();
            const enableHandler = getVedHandler('textUI:enable_input');
            expect(enableHandler).toBeInstanceOf(Function); // Verify we got the handler

            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'Initial';
            jest.clearAllMocks(); // Clear constructor logs

            const event = {type: 'textUI:enable_input', payload: {placeholder: 'Ready for input!'}};
            enableHandler(event); // Simulate VED dispatching the event object

            expect(inputElement.disabled).toBe(false); // Should be enabled
            expect(inputElement.placeholder).toBe('Ready for input!');
            // Check logs
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Ready for input!"')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning expected
        });

        it('should handle textUI:enable_input with missing payload (use default placeholder)', () => {
            const controller = createController();
            const enableHandler = getVedHandler('textUI:enable_input');
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'Initial';
            jest.clearAllMocks();

            const event = {type: 'textUI:enable_input', payload: undefined}; // Missing payload
            enableHandler(event); // Calls setEnabled(true, 'Enter command...')

            expect(inputElement.disabled).toBe(false); // Enabled
            expect(inputElement.placeholder).toBe('Enter command...'); // Default placeholder set
            // Check logs
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Received 'textUI:enable_input' without valid 'placeholder' string in payload"), // Correct warning
                {receivedEvent: event}
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Enter command..."')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both changed
        });

        it('should handle textUI:enable_input with payload missing placeholder property (use default placeholder)', () => {
            const controller = createController();
            const enableHandler = getVedHandler('textUI:enable_input');
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'Initial';
            jest.clearAllMocks();

            const event = {type: 'textUI:enable_input', payload: {message: 'hello'}}; // Payload lacks 'placeholder'
            enableHandler(event); // Calls setEnabled(true, 'Enter command...')

            expect(inputElement.disabled).toBe(false); // Enabled
            expect(inputElement.placeholder).toBe('Enter command...'); // Default placeholder set
            // Check logs
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Received 'textUI:enable_input' without valid 'placeholder' string in payload"), // Correct warning
                {receivedEvent: event}
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed state
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Enter command..."')); // Changed placeholder
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both changed
        });

        it('should not log state changes if event handler does not change state', () => {
            const controller = createController();
            const disableHandler = getVedHandler('textUI:disable_input');
            // Setup: disable the input manually first
            inputElement.disabled = true;
            inputElement.placeholder = "Already Disabled";
            jest.clearAllMocks(); // Clear constructor/setup logs

            // Act: Dispatch disable event again with different message
            const event = {type: 'textUI:disable_input', payload: {message: 'Still Disabled...'}};
            disableHandler(event);

            // Assert: State remains disabled, placeholder changes
            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('Still Disabled...');
            // Check logs: Only placeholder change should be logged
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // State didn't change
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Still Disabled..."')); // Placeholder changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning
        });
    });

    describe('dispose()', () => {
        it('should unsubscribe from all VED events and log', () => {
            const controller = createController();
            // Verify subscriptions were made (tracked in beforeEach)
            expect(mockSubscriptions.length).toBe(2);
            // Ensure each subscription object has the mock unsubscribe function
            expect(mockSubscriptions[0].unsubscribe).toBeDefined();
            expect(mockSubscriptions[1].unsubscribe).toBeDefined();
            jest.clearAllMocks(); // Clear constructor logs

            controller.dispose();

            // Check that unsubscribe was called on each tracked subscription
            expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
            // Check logs
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.')); // Log from InputStateController
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Disposing.')); // Log from base class dispose()
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        });

        it('should be safe to call dispose multiple times', () => {
            const controller = createController();
            expect(mockSubscriptions.length).toBe(2); // Initial subscriptions
            jest.clearAllMocks(); // Clear constructor logs

            controller.dispose(); // First call
            expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Disposing.'));
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);

            // Clear mocks to check second call effects
            mockSubscriptions[0].unsubscribe.mockClear();
            mockSubscriptions[1].unsubscribe.mockClear();
            mockLogger.debug.mockClear();

            controller.dispose(); // Second call

            // Unsubscribe should NOT be called again because the #subscriptions array is cleared
            expect(mockSubscriptions[0].unsubscribe).not.toHaveBeenCalled();
            expect(mockSubscriptions[1].unsubscribe).not.toHaveBeenCalled();
            // Dispose logs might be called again
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.')); // Logged again
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Disposing.')); // Logged again
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Logs called again
        });
    });
});
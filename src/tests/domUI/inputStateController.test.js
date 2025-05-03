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

    const getVedHandler = (eventType) => {
        const call = mockVed.subscribe.mock.calls.find(call => call[0] === eventType);
        return call ? call[1] : null;
    };

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><input id="player-input" type="text" placeholder="initial"/></body></html>`); // Start with placeholder
        document = dom.window.document;
        docContext = new DocumentContext(document.body);
        inputElement = document.getElementById('player-input');
        inputElement.disabled = false; // Start enabled

        mockLogger = new ConsoleLogger();
        mockVed = new ValidatedEventDispatcher(null, mockLogger);

        mockSubscriptions = [];
        const mockSubscribe = jest.fn((_eventType, _handler) => {
            const subscription = {unsubscribe: jest.fn()};
            mockSubscriptions.push(subscription);
            return subscription;
        });
        mockVed.subscribe = mockSubscribe;

        // Ensure mock implementations are set up
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
        mockSubscriptions = [];
    });

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
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Initialized.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Attached to INPUT element.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Subscribed to VED events'));
        });

        it('should throw error if inputElement is missing or null', () => {
            expect(() => createController(null)).toThrow("'inputElement' dependency is missing or not a valid DOM element.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("'inputElement' dependency is missing or not a valid DOM element."));
        });

        it('should throw error if inputElement is not a DOM node', () => {
            expect(() => createController({nodeType: undefined})).toThrow("'inputElement' dependency is missing or not a valid DOM element.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("'inputElement' dependency is missing or not a valid DOM element."));
        });

        it('should throw error if inputElement is not an <input> element', () => {
            const divElement = document.createElement('div');
            expect(() => createController(divElement)).toThrow("'inputElement' must be an HTMLInputElement (<input>), but received 'DIV'.");
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("'inputElement' must be an HTMLInputElement (<input>), but received 'DIV'."), expect.anything());
        });

        it('should subscribe to VED events on construction', () => {
            createController();
            expect(mockVed.subscribe).toHaveBeenCalledTimes(2);
            expect(mockVed.subscribe).toHaveBeenCalledWith('event:disable_input', expect.any(Function));
            expect(mockVed.subscribe).toHaveBeenCalledWith('textUI:enable_input', expect.any(Function));
        });
    });

    describe('setEnabled(enabled, placeholderText)', () => {
        it('should enable the input and clear the placeholder', () => {
            const controller = createController();
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'testing'; // Start with placeholder
            jest.clearAllMocks();

            controller.setEnabled(true); // Enable with default empty placeholder

            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('');
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed from false to true
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: ""')); // Changed from 'testing' to ''
        });

        it('should disable the input and clear the placeholder', () => {
            const controller = createController();
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'testing'; // Start with placeholder
            jest.clearAllMocks();

            controller.setEnabled(false); // Disable with default empty placeholder

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('');
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed from true to false
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: ""')); // Changed from 'testing' to ''
        });

        it('should enable the input and set the specified placeholder', () => {
            const controller = createController();
            const placeholder = 'Enter your command here...';
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = ''; // Start empty
            jest.clearAllMocks();

            controller.setEnabled(true, placeholder);

            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe(placeholder);
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Input placeholder set to: "${placeholder}"`)); // Changed
        });

        it('should disable the input and set the specified placeholder', () => {
            const controller = createController();
            const placeholder = 'Please wait...';
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = ''; // Start empty
            jest.clearAllMocks();

            controller.setEnabled(false, placeholder);

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe(placeholder);
            // Assert logs for changes that happened
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Input placeholder set to: "${placeholder}"`)); // Changed
        });

        it('should only log placeholder change if disabled state is unchanged', () => {
            const controller = createController();
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'old';
            jest.clearAllMocks();

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
            jest.clearAllMocks();

            controller.setEnabled(true, 'same'); // Keep enabled, keep placeholder

            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('same');
            // No change, so no logs
            expect(mockLogger.debug).not.toHaveBeenCalled();
            jest.clearAllMocks(); // Clear for next step

            controller.setEnabled(false, 'same'); // Disable, keep placeholder

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('same');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Did change
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to:')); // Did not change
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only one log expected
        });


        it('should handle null placeholder by converting it to "null"', () => {
            const controller = createController();
            // Note: beforeEach sets disabled = false, placeholder = 'initial'
            jest.clearAllMocks();

            controller.setEnabled(true, null); // Keep enabled, set null placeholder

            expect(inputElement.disabled).toBe(false); // Still false
            expect(inputElement.placeholder).toBe('null'); // String coercion
            // Check logs specifically for this call's changes
            // --- FIX: disabled state did NOT change from beforeEach ---
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input enabled.'));
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input disabled.'));
            // --- FIX: placeholder state DID change ---
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "null"')); // Placeholder changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only placeholder log
        });

        it('should handle undefined placeholder by setting it to empty string', () => {
            const controller = createController();
            // Note: beforeEach sets disabled = false, placeholder = 'initial'
            jest.clearAllMocks();

            controller.setEnabled(true, undefined); // Keep enabled, set undefined placeholder

            expect(inputElement.disabled).toBe(false); // Still false
            expect(inputElement.placeholder).toBe(''); // Default value
            // Check logs specifically for this call's changes
            // --- FIX: disabled state did NOT change from beforeEach ---
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input enabled.'));
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input disabled.'));
            // --- FIX: placeholder state DID change ---
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: ""')); // Placeholder changed
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only placeholder log
        });

        it('should handle multiple toggles correctly', () => {
            const controller = createController();
            inputElement.disabled = true; // Ensure start disabled
            inputElement.placeholder = 'zero';
            jest.clearAllMocks();

            controller.setEnabled(true, 'Start'); // enable, change placeholder
            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('Start');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Start"'));
            mockLogger.debug.mockClear(); // Clear calls for next step

            controller.setEnabled(false, 'Wait'); // disable, change placeholder
            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('Wait');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Wait"'));
            mockLogger.debug.mockClear(); // Clear calls for next step

            controller.setEnabled(true, 'Ready'); // enable, change placeholder
            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('Ready');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Ready"'));
        });

        it('should not log if state does not change', () => {
            const controller = createController();
            // Set initial state matching beforeEach
            inputElement.disabled = false;
            inputElement.placeholder = 'initial';
            jest.clearAllMocks();

            // Call again with the same state
            controller.setEnabled(false, 'initial'); // Should change disabled, log that
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.'));
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to:'));
            jest.clearAllMocks(); // Clear log

            controller.setEnabled(false, 'initial'); // Call again - NO change
            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('initial');
            // No new logs should have been generated
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        it('should handle boolean coercion for enabled flag', () => {
            const controller = createController();
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'Before';
            jest.clearAllMocks();

            // Truthy value (1)
            controller.setEnabled(1, 'Truthy');
            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('Truthy');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Truthy"')); // Changed
            mockLogger.debug.mockClear(); // Clear for next step

            // Falsy value (0)
            controller.setEnabled(0, 'Falsy');
            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('Falsy');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Falsy"')); // Changed
        });
    });

    describe('Event Handling (VED)', () => {
        it('should handle valid event:disable_input event', () => {
            const controller = createController();
            const disableHandler = getVedHandler('event:disable_input');
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'start';
            jest.clearAllMocks();

            const payload = {message: 'System busy...'};
            disableHandler(payload, 'event:disable_input'); // Should call setEnabled(false, 'System busy...')

            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('System busy...');
            // Check logs for setEnabled called by handler
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "System busy..."')); // Changed
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should handle event:disable_input event with missing/invalid payload (use default message)', () => {
            const controller = createController();
            const disableHandler = getVedHandler('event:disable_input');
            inputElement.disabled = false; // Start enabled
            inputElement.placeholder = 'start';
            jest.clearAllMocks();

            disableHandler(null, 'event:disable_input'); // Calls setEnabled(false, 'Input disabled.')
            expect(inputElement.disabled).toBe(true);
            expect(inputElement.placeholder).toBe('Input disabled.'); // Default message set
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received 'event:disable_input' without specific message"), null);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input disabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Input disabled."')); // Changed
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            // Call again with different invalid payload - state should NOT change
            disableHandler({someOtherProp: true}, 'event:disable_input'); // Calls setEnabled(false, 'Input disabled.') again
            expect(inputElement.disabled).toBe(true); // Still true
            expect(inputElement.placeholder).toBe('Input disabled.'); // Still same placeholder
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received 'event:disable_input' without specific message"), {someOtherProp: true});
            // --- FIX: Assert that debug was NOT called because state didn't change ---
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });


        it('should handle valid textUI:enable_input event', () => {
            const controller = createController();
            const enableHandler = getVedHandler('textUI:enable_input');
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'Initial';
            jest.clearAllMocks();

            const payload = {placeholder: 'Ready for input!'};
            enableHandler(payload, 'textUI:enable_input'); // Calls setEnabled(true, 'Ready for input!')

            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('Ready for input!');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Ready for input!"')); // Changed
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should handle textUI:enable_input event with missing/invalid payload (use default placeholder)', () => {
            const controller = createController();
            const enableHandler = getVedHandler('textUI:enable_input');
            inputElement.disabled = true; // Start disabled
            inputElement.placeholder = 'Initial';
            jest.clearAllMocks();

            enableHandler({}, 'textUI:enable_input'); // Calls setEnabled(true, 'Enter command...')
            expect(inputElement.disabled).toBe(false);
            expect(inputElement.placeholder).toBe('Enter command...'); // Default placeholder set
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received 'textUI:enable_input' without specific placeholder"), {});
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input enabled.')); // Changed
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Input placeholder set to: "Enter command..."')); // Changed
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            // Call again with different invalid payload - state should NOT change
            enableHandler({placeholder: 123}, 'textUI:enable_input'); // Calls setEnabled(true, 'Enter command...') again
            expect(inputElement.disabled).toBe(false); // Still false
            expect(inputElement.placeholder).toBe('Enter command...'); // Still same placeholder
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Received 'textUI:enable_input' without specific placeholder"), {placeholder: 123});
            // --- FIX: Assert that debug was NOT called because state didn't change ---
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('dispose()', () => {
        it('should unsubscribe from all VED events and log', () => {
            const controller = createController();
            expect(mockSubscriptions.length).toBe(2);
            jest.clearAllMocks();

            controller.dispose();

            expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Disposing.')); // From base class
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        });

        it('should be safe to call dispose multiple times', () => {
            const controller = createController();
            expect(mockSubscriptions.length).toBe(2);
            jest.clearAllMocks();

            controller.dispose(); // First call
            expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Disposing.'));

            // Clear mocks to check second call effects
            mockSubscriptions[0].unsubscribe.mockClear();
            mockSubscriptions[1].unsubscribe.mockClear();
            mockLogger.debug.mockClear();

            controller.dispose(); // Second call

            // Unsubscribe should NOT be called again
            expect(mockSubscriptions[0].unsubscribe).not.toHaveBeenCalled();
            expect(mockSubscriptions[1].unsubscribe).not.toHaveBeenCalled();
            // Logs might be called again depending on base class implementation, focus on unsubscribe
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Disposing subscriptions.')); // Logged again
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[InputStateController] Disposing.')); // Logged again
        });
    });
});
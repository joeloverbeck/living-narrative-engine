// tests/domUI/inputStateController.test.js
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { InputStateController } from '../../src/domUI'; // Assuming index exports it
import DocumentContext from '../../src/domUI/documentContext.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

// Mock dependencies
jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/events/validatedEventDispatcher.js');

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
    const call = mockVed.subscribe.mock.calls.find(
      (callArgs) => callArgs[0] === eventType
    );
    // Return the second argument, which is the handler function
    return call ? call[1] : null;
  };

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body><input id="player-input" type="text" placeholder="initial"/></body></html>`
    ); // Start with placeholder
    document = dom.window.document;
    docContext = new DocumentContext(document.body);
    inputElement = document.getElementById('player-input');
    inputElement.disabled = false; // Start enabled

    // --- Mock Creation ---
    mockLogger = new ConsoleLogger();
    mockVed = new ValidatedEventDispatcher(null, mockLogger); // Assuming VED can handle null dispatcher for tests

    // --- Mock VED's subscribe method ---
    mockSubscriptions = [];
    mockVed.subscribe = jest.fn((_eventType, _handler) => {
      const subscription = { unsubscribe: jest.fn() };
      mockSubscriptions.push(subscription);
      return subscription;
    });

    // --- Mock Logger Methods ---
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
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[InputStateController] Initialized.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[InputStateController] Attached to INPUT element.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "[InputStateController] Added keydown listener in capturing phase to input element to intercept 'Enter' key."
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Subscribed to VED events')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(5); // Adjusted from 4 to 5
    });

    it('should throw error if inputElement is missing or null', () => {
      expect(() => createController(null)).toThrow(
        "'inputElement' dependency is missing or not a valid DOM element."
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "'inputElement' dependency is missing or not a valid DOM element."
        )
      );
    });

    it('should throw error if inputElement is not a DOM node', () => {
      expect(() =>
        createController({
          nodeType: undefined,
          tagName: 'FAKE',
        })
      ).toThrow(
        "'inputElement' dependency is missing or not a valid DOM element."
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "'inputElement' dependency is missing or not a valid DOM element."
        )
      );
    });

    it('should throw error if inputElement is not an <input> element', () => {
      const divElement = document.createElement('div');
      expect(() => createController(divElement)).toThrow(
        "'inputElement' must be an HTMLInputElement (<input>), but received 'DIV'."
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "'inputElement' must be an HTMLInputElement (<input>), but received 'DIV'."
        ),
        { element: divElement }
      );
    });

    it('should subscribe to VED events on construction', () => {
      createController();
      expect(mockVed.subscribe).toHaveBeenCalledTimes(2);
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'textUI:disable_input',
        expect.any(Function)
      );
      expect(mockVed.subscribe).toHaveBeenCalledWith(
        'textUI:enable_input',
        expect.any(Function)
      );
    });
  });

  describe('setEnabled(enabled, placeholderText)', () => {
    it('should enable the input and clear the placeholder', () => {
      const controller = createController();
      inputElement.disabled = true;
      inputElement.placeholder = 'testing';
      jest.clearAllMocks();

      controller.setEnabled(true);

      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: ""')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should disable the input and clear the placeholder', () => {
      const controller = createController();
      inputElement.disabled = false;
      inputElement.placeholder = 'testing';
      jest.clearAllMocks();

      controller.setEnabled(false);

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: ""')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should enable the input and set the specified placeholder', () => {
      const controller = createController();
      const placeholder = 'Enter your command here...';
      inputElement.disabled = true;
      inputElement.placeholder = '';
      jest.clearAllMocks();

      controller.setEnabled(true, placeholder);

      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe(placeholder);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Input placeholder set to: "${placeholder}"`)
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should disable the input and set the specified placeholder', () => {
      const controller = createController();
      const placeholder = 'Please wait...';
      inputElement.disabled = false;
      inputElement.placeholder = 'initial';
      jest.clearAllMocks();

      controller.setEnabled(false, placeholder);

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe(placeholder);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Input placeholder set to: "${placeholder}"`)
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should only log placeholder change if disabled state is unchanged', () => {
      const controller = createController();
      inputElement.disabled = true;
      inputElement.placeholder = 'old';
      jest.clearAllMocks();

      controller.setEnabled(false, 'new');

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('new');
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "new"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should only log disabled change if placeholder is unchanged', () => {
      const controller = createController();
      inputElement.disabled = false;
      inputElement.placeholder = 'same';
      jest.clearAllMocks();

      controller.setEnabled(true, 'different');
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "different"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      mockLogger.debug.mockClear();

      inputElement.placeholder = 'keep_this';
      controller.setEnabled(false, 'keep_this');

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('keep_this');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to:')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should handle null placeholder by converting it to "null" string', () => {
      const controller = createController();
      jest.clearAllMocks();

      controller.setEnabled(true, null);

      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('null');
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "null"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined placeholder by setting it to empty string (default)', () => {
      const controller = createController();
      jest.clearAllMocks();

      controller.setEnabled(true, undefined);

      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('');
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: ""')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple toggles correctly', () => {
      const controller = createController();
      inputElement.disabled = true;
      inputElement.placeholder = 'zero';
      jest.clearAllMocks();

      controller.setEnabled(true, 'Start');
      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('Start');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Start"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      mockLogger.debug.mockClear();

      controller.setEnabled(false, 'Wait');
      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('Wait');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Wait"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      mockLogger.debug.mockClear();

      controller.setEnabled(true, 'Ready');
      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('Ready');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Ready"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should not log if state does not change', () => {
      const controller = createController();
      inputElement.disabled = false;
      inputElement.placeholder = 'initial';
      jest.clearAllMocks();

      controller.setEnabled(false, 'initial');
      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('initial');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to:')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      controller.setEnabled(false, 'initial');
      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('initial');
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should handle boolean coercion for enabled flag', () => {
      const controller = createController();
      inputElement.disabled = true;
      inputElement.placeholder = 'Before';
      jest.clearAllMocks();

      controller.setEnabled(1, 'Truthy');
      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('Truthy');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Truthy"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      mockLogger.debug.mockClear();

      controller.setEnabled(0, 'Falsy');
      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('Falsy');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Falsy"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Handling (VED)', () => {
    it('should handle valid textUI:disable_input event object', () => {
      const controller = createController();
      const disableHandler = getVedHandler('textUI:disable_input');
      expect(disableHandler).toBeInstanceOf(Function);

      inputElement.disabled = false;
      inputElement.placeholder = 'start';
      jest.clearAllMocks();

      const event = {
        type: 'textUI:disable_input',
        payload: { message: 'System busy...' },
      };
      disableHandler(event);

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('System busy...');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "System busy..."')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle textUI:disable_input with missing payload (use default message)', () => {
      const controller = createController();
      const disableHandler = getVedHandler('textUI:disable_input');
      inputElement.disabled = false;
      inputElement.placeholder = 'start';
      jest.clearAllMocks();

      const event = { type: 'textUI:disable_input', payload: null };
      disableHandler(event);

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('Input disabled.');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Received 'textUI:disable_input' without valid 'message' string in payload, using default: \"Input disabled.\""
        ),
        { receivedEvent: event }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Input disabled."')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should handle textUI:disable_input with payload missing message property (use default message)', () => {
      const controller = createController();
      const disableHandler = getVedHandler('textUI:disable_input');
      inputElement.disabled = false;
      inputElement.placeholder = 'start';
      jest.clearAllMocks();

      const event = {
        type: 'textUI:disable_input',
        payload: { otherProp: true },
      };
      disableHandler(event);

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('Input disabled.');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Received 'textUI:disable_input' without valid 'message' string in payload, using default: \"Input disabled.\""
        ),
        { receivedEvent: event }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Input disabled."')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should handle valid textUI:enable_input event object', () => {
      const controller = createController();
      const enableHandler = getVedHandler('textUI:enable_input');
      expect(enableHandler).toBeInstanceOf(Function);

      inputElement.disabled = true;
      inputElement.placeholder = 'Initial';
      jest.clearAllMocks();

      const event = {
        type: 'textUI:enable_input',
        payload: { placeholder: 'Ready for input!' },
      };
      enableHandler(event);

      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('Ready for input!');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Ready for input!"')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Ticket 3.1: Test updated for new default placeholder
    it('should handle textUI:enable_input with missing payload (use default placeholder)', () => {
      const controller = createController();
      const enableHandler = getVedHandler('textUI:enable_input');
      inputElement.disabled = true;
      inputElement.placeholder = 'Initial';
      jest.clearAllMocks();

      const event = { type: 'textUI:enable_input', payload: undefined };
      enableHandler(event);

      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('Enter speech (optional)...'); // Updated default
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Received 'textUI:enable_input' without valid 'placeholder' string in payload, using default placeholder: \"Enter speech (optional)...\""
        ), // Updated warning message
        { receivedEvent: event }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Input placeholder set to: "Enter speech (optional)..."'
        )
      ); // Updated debug message
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    // Ticket 3.1: Test updated for new default placeholder
    it('should handle textUI:enable_input with payload missing placeholder property (use default placeholder)', () => {
      const controller = createController();
      const enableHandler = getVedHandler('textUI:enable_input');
      inputElement.disabled = true;
      inputElement.placeholder = 'Initial';
      jest.clearAllMocks();

      const event = {
        type: 'textUI:enable_input',
        payload: { message: 'hello' },
      };
      enableHandler(event);

      expect(inputElement.disabled).toBe(false);
      expect(inputElement.placeholder).toBe('Enter speech (optional)...'); // Updated default
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Received 'textUI:enable_input' without valid 'placeholder' string in payload, using default placeholder: \"Enter speech (optional)...\""
        ), // Updated warning message
        { receivedEvent: event }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input enabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Input placeholder set to: "Enter speech (optional)..."'
        )
      ); // Updated debug message
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should not log state changes if event handler does not change state', () => {
      const controller = createController();
      const disableHandler = getVedHandler('textUI:disable_input');
      inputElement.disabled = true;
      inputElement.placeholder = 'Already Disabled';
      jest.clearAllMocks();

      const event = {
        type: 'textUI:disable_input',
        payload: { message: 'Still Disabled...' },
      };
      disableHandler(event);

      expect(inputElement.disabled).toBe(true);
      expect(inputElement.placeholder).toBe('Still Disabled...');
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Input disabled.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input placeholder set to: "Still Disabled..."')
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('dispose()', () => {
    it('should unsubscribe from all VED events and log', () => {
      const controller = createController();
      expect(mockSubscriptions.length).toBe(2);
      expect(mockSubscriptions[0].unsubscribe).toBeDefined();
      expect(mockSubscriptions[1].unsubscribe).toBeDefined();
      jest.clearAllMocks();

      controller.dispose();

      expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[InputStateController] Disposing.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Starting disposal: Unsubscribing VED events and removing DOM listeners.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Unsubscribing 2 VED event subscriptions.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Removing 1 DOM event listeners.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Finished automated cleanup. Base dispose complete.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(5); // Adjusted
    });

    it('should be safe to call dispose multiple times', () => {
      const controller = createController();
      expect(mockSubscriptions.length).toBe(2);
      jest.clearAllMocks();

      controller.dispose();
      expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
      // Check all 5 expected logs for the first dispose call
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[InputStateController] Disposing.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Starting disposal: Unsubscribing VED events and removing DOM listeners.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Unsubscribing 2 VED event subscriptions.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Removing 1 DOM event listeners.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Finished automated cleanup. Base dispose complete.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(5); // Adjusted

      mockSubscriptions[0].unsubscribe.mockClear();
      mockSubscriptions[1].unsubscribe.mockClear();
      mockLogger.debug.mockClear();

      controller.dispose();

      expect(mockSubscriptions[0].unsubscribe).not.toHaveBeenCalled();
      expect(mockSubscriptions[1].unsubscribe).not.toHaveBeenCalled();
      // Check logs for the second dispose call
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[InputStateController] Disposing.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Starting disposal: Unsubscribing VED events and removing DOM listeners.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No VED event subscriptions to unsubscribe.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No DOM event listeners to remove.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Finished automated cleanup. Base dispose complete.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(5); // Adjusted
    });
  });
});

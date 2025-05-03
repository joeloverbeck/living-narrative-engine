// src/tests/logic/operationHandlers/appendUiMessageHandler.test.js
// --- REFACTORED for UiMessageRenderer dependency ---

import {describe, it, expect, jest, beforeEach} from '@jest/globals';

// --- Mock dependencies ---
// Mock UiMessageRenderer directly for unit testing
const mockUiRenderMethod = jest.fn(); // Mock the render method specifically
const mockUiMessageRenderer = {
    render: mockUiRenderMethod,
    // Add any other methods if the handler starts using them
};

// Mock logger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Import the class under test ---
import AppendUiMessageHandler from '../../../logic/operationHandlers/appendUiMessageHandler.js';


// --- Test Suite ---
describe('AppendUiMessageHandler (Unit Tests)', () => {

    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        // Instantiate the handler with mocks for the NEW dependencies
        handler = new AppendUiMessageHandler({
            logger: mockLogger,
            uiMessageRenderer: mockUiMessageRenderer // Inject the mock UiMessageRenderer
        });
    });

    it('should construct with logger and uiMessageRenderer', () => {
        expect(handler).toBeDefined();
        // Check if constructor logged initialization with the correct dependency name
        expect(mockLogger.debug).toHaveBeenCalledWith("AppendUiMessageHandler initialized with UiMessageRenderer.");
    });

    it('should throw error if logger is missing or invalid', () => {
        // Logger missing
        expect(() => new AppendUiMessageHandler({uiMessageRenderer: mockUiMessageRenderer}))
            .toThrow('AppendUiMessageHandler requires a valid ILogger instance.');
        // Logger invalid
        expect(() => new AppendUiMessageHandler({logger: {}, uiMessageRenderer: mockUiMessageRenderer}))
            .toThrow('AppendUiMessageHandler requires a valid ILogger instance.');
    });

    // Updated test for the new dependency
    it('should throw error if uiMessageRenderer is missing or invalid', () => {
        // uiMessageRenderer missing
        expect(() => new AppendUiMessageHandler({logger: mockLogger}))
            .toThrow('AppendUiMessageHandler requires a valid UiMessageRenderer instance.');
        // uiMessageRenderer invalid (missing render method)
        expect(() => new AppendUiMessageHandler({logger: mockLogger, uiMessageRenderer: {}}))
            .toThrow('AppendUiMessageHandler requires a valid UiMessageRenderer instance.');
        // uiMessageRenderer invalid (render is not a function)
        expect(() => new AppendUiMessageHandler({logger: mockLogger, uiMessageRenderer: {render: 'not-a-function'}}))
            .toThrow('AppendUiMessageHandler requires a valid UiMessageRenderer instance.');
    });


    it('execute() should call uiMessageRenderer.render with correct parameters (defaults)', () => {
        const params = {text: 'Test message'};
        const executionContext = {logger: mockLogger}; // Provide context logger

        handler.execute(params, executionContext);

        // Assert uiMessageRenderer.render was called once
        expect(mockUiMessageRenderer.render).toHaveBeenCalledTimes(1);

        // Assert arguments passed to render (text, type, allowHtml)
        expect(mockUiMessageRenderer.render).toHaveBeenCalledWith(
            'Test message', // text
            'info',         // default type
            false           // default allowHtml
        );

        // Assert logs
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer',
            // Note: selector is logged even if ignored by the renderer itself
            {text: 'Test message', type: 'info', allowHtml: false, originalSelector: '#outputDiv'}
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No selector warning with default selector
    });

    it('execute() should call uiMessageRenderer.render with provided type and allowHtml=true', () => {
        const params = {
            text: '<h1>Html Message</h1>',
            message_type: 'warning',
            allow_html: true
            // No selector needed for this check
        };
        const executionContext = {logger: mockLogger};

        handler.execute(params, executionContext);

        expect(mockUiMessageRenderer.render).toHaveBeenCalledTimes(1);
        expect(mockUiMessageRenderer.render).toHaveBeenCalledWith(
            '<h1>Html Message</h1>', // text
            'warning',              // type
            true                    // allowHtml
        );

        // Assert logs
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer',
            {text: '<h1>Html Message</h1>', type: 'warning', allowHtml: true, originalSelector: '#outputDiv'} // Default selector logged
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No selector warning expected
    });

    it('execute() should log warning if non-default selector is provided (and still call render)', () => {
        const params = {
            text: 'Selector Warning Test',
            selector: '#some-other-area', // Non-default selector
            message_type: 'debug'
        };
        const executionContext = {logger: mockLogger};

        handler.execute(params, executionContext);

        // Check render was still called correctly
        expect(mockUiMessageRenderer.render).toHaveBeenCalledTimes(1);
        expect(mockUiMessageRenderer.render).toHaveBeenCalledWith(
            'Selector Warning Test', // text
            'debug',                 // type
            false                    // default allowHtml
        );

        // Check the attempt log includes the original selector
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer',
            {text: 'Selector Warning Test', type: 'debug', allowHtml: false, originalSelector: '#some-other-area'}
        );
        // --- Check the specific warning log ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `APPEND_UI_MESSAGE: The 'selector' parameter ("#some-other-area") is provided but ignored. UiMessageRenderer always targets the default message list.`
        );
        // Check success log
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    it('execute() should use default logger if executionContext logger is missing', () => {
        const params = {text: 'Another message'};

        handler.execute(params); // No execution context

        expect(mockUiMessageRenderer.render).toHaveBeenCalledTimes(1);
        expect(mockUiMessageRenderer.render).toHaveBeenCalledWith(
            'Another message',
            'info',
            false
        );
        // Check if the *handler's* logger was used (mockLogger in this setup)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer'), expect.anything()
        );
        // Check success log is also called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.'
        );
    });

    it('execute() should log error and return if params are missing or invalid', () => {
        const executionContext = {logger: mockLogger};

        // Test null params
        handler.execute(null, executionContext);
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: null});
        expect(mockUiMessageRenderer.render).not.toHaveBeenCalled(); // Check new mock
        mockLogger.error.mockClear(); // Clear just error mock for next sub-test

        // Test undefined params
        handler.execute(undefined, executionContext);
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: undefined});
        expect(mockUiMessageRenderer.render).not.toHaveBeenCalled();
        mockLogger.error.mockClear();

        // Test missing text
        handler.execute({message_type: 'info'}, executionContext);
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: {message_type: 'info'}});
        expect(mockUiMessageRenderer.render).not.toHaveBeenCalled();
        mockLogger.error.mockClear();

        // Test empty text
        handler.execute({text: '  '}, executionContext); // Whitespace only
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: {text: '  '}});
        expect(mockUiMessageRenderer.render).not.toHaveBeenCalled();
    });

    // This test is no longer relevant as render() doesn't return boolean status
    // it('execute() should log error if domRenderer.renderMessage returns false', () => { ... });

    it('execute() should log error if uiMessageRenderer.render throws', () => {
        const params = {text: 'Exception case'};
        const executionContext = {logger: mockLogger};
        const testError = new Error('Renderer exploded');

        // Configure mock render method to throw specifically for this test
        mockUiRenderMethod.mockImplementationOnce(() => {
            throw testError;
        });

        handler.execute(params, executionContext);

        expect(mockUiMessageRenderer.render).toHaveBeenCalledTimes(1); // Verify it was called
        // Check the specific error log from the handler's catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            `APPEND_UI_MESSAGE: Error occurred while calling UiMessageRenderer.render.`,
            {
                error: testError, // Check the specific error object
                params: { // Check the parameters passed to render
                    text: params.text,
                    type: 'info', // Default type
                    allowHtml: false // Default allowHtml
                }
            }
        );
        // Check the "attempt" log was still called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer'), expect.anything()
        );
        // Check the success log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining('Successfully delegated message rendering')
        );
    });
});
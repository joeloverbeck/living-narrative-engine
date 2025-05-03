// src/tests/logic/operationHandlers/appendUiMessageHandler.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';

// Mock the dependency BEFORE importing the class under test
const mockRenderMessage = jest.fn().mockReturnValue(true); // *** MODIFIED: Return true by default ***
const mockDomRenderer = {
    renderMessage: mockRenderMessage,
};

// Mock the entire module
jest.mock('../../../core/domRenderer.js', () => {
    // Return a constructor function that returns our specific mock instance
    return jest.fn().mockImplementation(() => mockDomRenderer);
});


// Import the class under test AFTER mocking
import AppendUiMessageHandler from '../../../logic/operationHandlers/appendUiMessageHandler.js';

// Mock logger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Test Suite ---
describe('AppendUiMessageHandler (Unit Tests)', () => {

    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the mock's default behavior in case a test changed it with mockReturnValueOnce etc.
        mockRenderMessage.mockReturnValue(true);
        // Instantiate the handler with mocks
        handler = new AppendUiMessageHandler({logger: mockLogger, domRenderer: mockDomRenderer});
    });

    it('should construct with logger and domRenderer', () => {
        expect(handler).toBeDefined();
        // Check if constructor logged initialization (optional)
        expect(mockLogger.debug).toHaveBeenCalledWith("AppendUiMessageHandler initialized with DomRenderer.");
    });

    it('should throw error if logger is missing or invalid', () => {
        expect(() => new AppendUiMessageHandler({domRenderer: mockDomRenderer})).toThrow('AppendUiMessageHandler requires a valid ILogger instance.');
        expect(() => new AppendUiMessageHandler({
            logger: {},
            domRenderer: mockDomRenderer
        })).toThrow('AppendUiMessageHandler requires a valid ILogger instance.');
    });

    it('should throw error if domRenderer is missing', () => {
        expect(() => new AppendUiMessageHandler({logger: mockLogger})).toThrow('DomRenderer required');
    });


    it('execute() should call domRenderer.renderMessage with correct parameters (defaults)', () => {
        const params = {text: 'Test message'};
        const executionContext = {logger: mockLogger}; // Provide context logger

        handler.execute(params, executionContext);

        // Assert domRenderer.renderMessage was called once
        expect(mockDomRenderer.renderMessage).toHaveBeenCalledTimes(1);

        // Assert arguments passed to renderMessage
        expect(mockDomRenderer.renderMessage).toHaveBeenCalledWith(
            'Test message',      // text
            'info',              // default type
            {selector: '#outputDiv', allowHtml: false} // default options object
        );

        // Assert logs
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "#outputDiv"',
            {text: 'Test message', type: 'info', allowHtml: false}
        );
        // *** MODIFIED: Made assertion more specific to match the code's output ***
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Successfully rendered message via DomRenderer to "#outputDiv".'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('execute() should call domRenderer.renderMessage with provided type, selector, and allowHtml=true', () => {
        const params = {
            text: '<h1>Html Message</h1>',
            message_type: 'warning',
            selector: '#specific-area',
            allow_html: true
        };
        const executionContext = {logger: mockLogger};

        handler.execute(params, executionContext);

        expect(mockDomRenderer.renderMessage).toHaveBeenCalledTimes(1);
        expect(mockDomRenderer.renderMessage).toHaveBeenCalledWith(
            '<h1>Html Message</h1>', // text
            'warning',              // type
            {selector: '#specific-area', allowHtml: true} // options object
        );

        // Assert logs
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "#specific-area"',
            {text: '<h1>Html Message</h1>', type: 'warning', allowHtml: true}
        );
        // *** NOTE: This assertion was already correct and specific ***
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Successfully rendered message via DomRenderer to "#specific-area".'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('execute() should use default logger if executionContext logger is missing', () => {
        const params = {text: 'Another message'};

        handler.execute(params); // No execution context

        expect(mockDomRenderer.renderMessage).toHaveBeenCalledTimes(1);
        expect(mockDomRenderer.renderMessage).toHaveBeenCalledWith(
            'Another message',
            'info',
            {selector: '#outputDiv', allowHtml: false}
        );
        // Check if the *handler's* logger was used (mockLogger in this setup)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('APPEND_UI_MESSAGE: Attempting to append message'), expect.anything()
        );
        // Check success log is also called now
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'APPEND_UI_MESSAGE: Successfully rendered message via DomRenderer to "#outputDiv".'
        );
    });

    it('execute() should log error and return if params are missing or invalid', () => {
        const executionContext = {logger: mockLogger};

        // Test null params
        handler.execute(null, executionContext);
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: null});
        expect(mockDomRenderer.renderMessage).not.toHaveBeenCalled();
        jest.clearAllMocks(); // Reset mocks for next case
        mockRenderMessage.mockReturnValue(true); // Re-establish default mock behavior if needed after clear

        // Test undefined params
        handler.execute(undefined, executionContext);
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: undefined});
        expect(mockDomRenderer.renderMessage).not.toHaveBeenCalled();
        jest.clearAllMocks();
        mockRenderMessage.mockReturnValue(true);

        // Test missing text
        handler.execute({message_type: 'info'}, executionContext);
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: {message_type: 'info'}});
        expect(mockDomRenderer.renderMessage).not.toHaveBeenCalled();
        jest.clearAllMocks();
        mockRenderMessage.mockReturnValue(true);

        // Test empty text
        handler.execute({text: '  '}, executionContext); // Whitespace only
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params: {text: '  '}});
        expect(mockDomRenderer.renderMessage).not.toHaveBeenCalled();
        jest.clearAllMocks();
        mockRenderMessage.mockReturnValue(true);
    });

    it('execute() should log error if domRenderer.renderMessage returns false', () => {
        const params = {text: 'Failure case'};
        const executionContext = {logger: mockLogger};

        // Configure mock to return false specifically for this test
        mockRenderMessage.mockReturnValueOnce(false); // Override default for this call

        handler.execute(params, executionContext);

        expect(mockDomRenderer.renderMessage).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith('APPEND_UI_MESSAGE: Failed to render via DomRenderer.');
        // Check the "attempt" log was still called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('APPEND_UI_MESSAGE: Attempting to append message'), expect.anything()
        );
        // Check the success log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining('Successfully rendered message')
        );
    });

    it('execute() should log error if domRenderer.renderMessage throws', () => {
        const params = {text: 'Exception case'};
        const executionContext = {logger: mockLogger};
        const testError = new Error('Renderer exploded');

        // Configure mock to throw specifically for this test
        mockRenderMessage.mockImplementationOnce(() => { // Use mockImplementationOnce for throwing
            throw testError;
        });

        handler.execute(params, executionContext);

        expect(mockDomRenderer.renderMessage).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `APPEND_UI_MESSAGE: Error occurred while calling DomRenderer for selector "#outputDiv".`,
            {error: testError, params: params}
        );
        // Check the "attempt" log was still called
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('APPEND_UI_MESSAGE: Attempting to append message'), expect.anything()
        );
        // Check the success log was NOT called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining('Successfully rendered message')
        );
    });

    // Implicit test: Assert that 'document' or 'window' are never accessed directly
    // This is guaranteed by mocking DomRenderer, as the handler only interacts with the mock.
    // No specific assertion needed unless the handler *itself* tried to access document.
});
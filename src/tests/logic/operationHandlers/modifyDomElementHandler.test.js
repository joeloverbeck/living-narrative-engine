// src/tests/logic/operationHandlers/modifyDomElementHandler.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';

// Mock the dependency BEFORE importing the class under test
const mockMutate = jest.fn();
const mockDomRenderer = {
    mutate: mockMutate,
    // Add other methods if ModifyDomElementHandler constructor checks them
};

// Mock the entire module
jest.mock('../../../core/domRenderer.js', () => {
    // Return a constructor function that returns our specific mock instance
    return jest.fn().mockImplementation(() => mockDomRenderer);
});


// Import the class under test AFTER mocking
import ModifyDomElementHandler from '../../../logic/operationHandlers/modifyDomElementHandler.js';

// Mock logger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Test Suite ---
describe('ModifyDomElementHandler (Unit Tests)', () => {

    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock return value before each test
        mockMutate.mockReturnValue({count: 1, failed: 0, modified: 1}); // Default success
        // Instantiate the handler with mocks
        handler = new ModifyDomElementHandler({logger: mockLogger, domRenderer: mockDomRenderer});
    });

    it('should construct with logger and domRenderer', () => {
        expect(handler).toBeDefined();
        // Optionally check constructor logs if any
    });

    it('should throw error if logger is missing or invalid', () => {
        expect(() => new ModifyDomElementHandler({domRenderer: mockDomRenderer})).toThrow('ModifyDomElementHandler requires a valid ILogger instance.');
        expect(() => new ModifyDomElementHandler({
            logger: {},
            domRenderer: mockDomRenderer
        })).toThrow('ModifyDomElementHandler requires a valid ILogger instance.');
    });

    it('should throw error if domRenderer is missing or invalid', () => {
        expect(() => new ModifyDomElementHandler({logger: mockLogger})).toThrow('ModifyDomElementHandler requires a valid IDomRenderer instance.');
        const invalidRenderer = {
            someOtherMethod: () => {
            }
        };
        expect(() => new ModifyDomElementHandler({
            logger: mockLogger,
            domRenderer: invalidRenderer
        })).toThrow('ModifyDomElementHandler requires a valid IDomRenderer instance.');
    });


    it('execute() should call domRenderer.mutate with correct parameters', () => {
        const params = {selector: '#my-element', property: 'textContent', value: 'New Text'};
        const executionContext = {logger: mockLogger}; // Provide context logger

        handler.execute(params, executionContext);

        // Assert domRenderer.mutate was called once
        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);

        // Assert arguments passed to mutate
        expect(mockDomRenderer.mutate).toHaveBeenCalledWith(
            '#my-element',      // selector
            'textContent',      // property
            'New Text'          // value
        );

        // Assert logs
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            JSON.stringify(params)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: Modified property "textContent" on 1 element(s) matching selector "#my-element" with value:`,
            'New Text'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('execute() should trim selector and property before calling mutate', () => {
        const params = {selector: '  #my-element  ', property: '  style.display ', value: 'block'};
        const executionContext = {logger: mockLogger};

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        expect(mockDomRenderer.mutate).toHaveBeenCalledWith(
            '#my-element',      // trimmed selector
            'style.display',    // trimmed property
            'block'             // value
        );
    });

    it('execute() should use default logger if executionContext logger is missing', () => {
        const params = {selector: 'div', property: 'className', value: 'active'};

        handler.execute(params); // No execution context

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        expect(mockDomRenderer.mutate).toHaveBeenCalledWith('div', 'className', 'active');
        // Check if the *handler's* logger was used (mockLogger in this setup)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'MODIFY_DOM_ELEMENT: Handler executing with params:', expect.any(String)
        );
    });

    it('execute() should log error and return if params are missing or invalid', () => {
        const executionContext = {logger: mockLogger};
        const testCases = [
            null,
            undefined,
            {},
            {selector: '#id'},
            {selector: '#id', property: 'prop'}, // Missing value (undefined is invalid)
            {selector: '', property: 'prop', value: 'v'}, // Empty selector
            {selector: '  ', property: 'prop', value: 'v'}, // Whitespace selector
            {selector: '#id', property: '', value: 'v'}, // Empty property
            {selector: '#id', property: '  ', value: 'v'}, // Whitespace property
        ];

        testCases.forEach((params) => {
            jest.clearAllMocks();
            handler.execute(params, executionContext);
            expect(mockLogger.error).toHaveBeenCalledWith('MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.', {params});
            expect(mockDomRenderer.mutate).not.toHaveBeenCalled();
        });
    });

    it('execute() should allow null/false/0 as valid values', () => {
        const testValues = [null, false, 0];
        const executionContext = {logger: mockLogger};

        testValues.forEach(value => {
            jest.clearAllMocks();
            const params = {selector: '#el', property: 'prop', value: value};
            handler.execute(params, executionContext);
            expect(mockDomRenderer.mutate).toHaveBeenCalledWith('#el', 'prop', value);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });


    it('execute() should log warning if domRenderer.mutate returns zero modified elements', () => {
        const params = {selector: '#not-found', property: 'textContent', value: 'Wont appear'};
        const executionContext = {logger: mockLogger};

        // Configure mock to return 0 modified
        mockMutate.mockReturnValueOnce({count: 0, failed: 0, modified: 0});

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(`MODIFY_DOM_ELEMENT: No elements found or modified for selector "#not-found".`);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Modified property')); // Success log should not be called
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('execute() should log error if domRenderer.mutate returns failures', () => {
        const params = {selector: '.multiple', property: 'dataset.value', value: 123};
        const executionContext = {logger: mockLogger};

        // Configure mock to return some failures
        mockMutate.mockReturnValueOnce({count: 5, failed: 2, modified: 3});

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        // Check for success log for the modified elements
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: Modified property "dataset.value" on 3 element(s) matching selector ".multiple" with value:`,
            123
        );
        // Check for error log about the failures
        expect(mockLogger.error).toHaveBeenCalledWith(`MODIFY_DOM_ELEMENT: Failed to modify property "dataset.value" for 2 element(s) matching selector ".multiple".`);
        expect(mockLogger.warn).not.toHaveBeenCalled(); // Should be error, not warning for failures
    });


    it('execute() should log error if domRenderer.mutate throws', () => {
        const params = {selector: '#el', property: 'prop', value: 'bad'};
        const executionContext = {logger: mockLogger};
        const testError = new Error('Mutation exploded');

        // Configure mock to throw
        mockMutate.mockImplementationOnce(() => {
            throw testError;
        });

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: Error during DOM mutation via DomRenderer for selector "#el":`,
            testError
        );
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Modified property')); // Success log should not be called
    });

    // Implicit test: Assert that 'document' or 'window' are never accessed directly
    // This is guaranteed by mocking DomRenderer, as the handler only interacts with the mock.
});
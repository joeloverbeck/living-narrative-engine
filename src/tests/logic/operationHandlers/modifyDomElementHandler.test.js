// src/tests/logic/operationHandlers/modifyDomElementHandler.test.js

import {describe, it, expect, jest, beforeEach, test} from '@jest/globals';

import ModifyDomElementHandler from '../../../logic/operationHandlers/modifyDomElementHandler.js';
// Correctly import createMockLogger and createMockDomRenderer
import {createMockLogger, createMockDomRenderer} from '../../testUtils.js';

describe('ModifyDomElementHandler (Unit Tests)', () => {
    let mockLogger;
    let mockDomRenderer;
    let handler;
    let executionContext;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockDomRenderer = createMockDomRenderer(); // Uses the corrected default mock from testUtils
        handler = new ModifyDomElementHandler({
            logger: mockLogger,
            domRenderer: mockDomRenderer
        });
        executionContext = {
            logger: mockLogger,
            variables: new Map(),
        };
    });

    test('should construct with logger and domRenderer', () => {
        const testHandler = new ModifyDomElementHandler({logger: mockLogger, domRenderer: mockDomRenderer});
        expect(testHandler).toBeDefined();
    });

    test('should throw error if logger is missing or invalid', () => {
        const invalidLoggers = [null, undefined, {}];
        invalidLoggers.forEach(invalidLogger => {
            expect(() => new ModifyDomElementHandler({logger: invalidLogger, domRenderer: mockDomRenderer}))
                .toThrow('ModifyDomElementHandler requires a valid ILogger instance.');
        });
        expect(() => new ModifyDomElementHandler({logger: {debug: jest.fn()}, domRenderer: mockDomRenderer}))
            .toThrow('ModifyDomElementHandler requires a valid ILogger instance.'); // Missing 'info'

    });

    test('should throw error if domRenderer is missing or invalid', () => {
        const invalidRenderers = [null, undefined, {}];
        invalidRenderers.forEach(invalidRenderer => {
            expect(() => new ModifyDomElementHandler({logger: mockLogger, domRenderer: invalidRenderer}))
                .toThrow('ModifyDomElementHandler requires a valid IDomRenderer instance.');
        });
        expect(() => new ModifyDomElementHandler({logger: mockLogger, domRenderer: {renderMessage: jest.fn()}}))
            .toThrow('ModifyDomElementHandler requires a valid IDomRenderer instance.'); // Missing 'mutate'
    });


    // --- Test Case 1: Correct Parameters ---
    test('execute() should call domRenderer.mutate with correct parameters', () => {
        const params = {
            selector: '#my-element',
            property: 'textContent',
            value: 'New Text',
        };
        // ****** CORRECTION: Use count, modified, failed ******
        const expectedResult = {count: 1, modified: 1, failed: 0};
        mockDomRenderer.mutate.mockReturnValue(expectedResult);

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        expect(mockDomRenderer.mutate).toHaveBeenCalledWith(
            '#my-element',
            'textContent',
            'New Text'
        );

        // Assert logs
        expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Initial, Result, Success
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params
        );
        // ****** CORRECTION: Check the 2nd debug log (result) ******
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "#my-element": Found 1, Modified 1, Failed 0.'
        );
        // ****** CORRECTION: Check the 3rd debug log (success) ******
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('Modified property "textContent" on 1 element(s) matching selector "#my-element" with value:'), // Uses 'modified' count
            'New Text'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute() should trim selector and property before calling mutate', () => {
        const params = {
            selector: '  #padded-id   ',
            property: '  data-trimmed ',
            value: 'Trimmed Value',
        };
        // ****** CORRECTION: Use count, modified, failed ******
        const expectedResult = {count: 1, modified: 1, failed: 0};
        mockDomRenderer.mutate.mockReturnValue(expectedResult);

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledWith(
            '#padded-id', // Trimmed
            'data-trimmed', // Trimmed
            'Trimmed Value'
        );
        expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Initial, Result, Success
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params // Original params are logged first
        );
        // ****** CORRECTION: Check the 2nd debug log (result) ******
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "#padded-id": Found 1, Modified 1, Failed 0.'
        );
        // ****** CORRECTION: Check the 3rd debug log (success) ******
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('Modified property "data-trimmed" on 1 element(s) matching selector "#padded-id" with value:'),
            'Trimmed Value' // Success log uses trimmed values implicitly
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // --- Test Case 2: Default Logger ---
    test('execute() should use default logger if executionContext logger is missing', () => {
        const params = {
            selector: 'div',
            property: 'className',
            value: 'active',
        };
        const executionContextNoLogger = {variables: new Map()};
        // ****** CORRECTION: Use count, modified, failed ******
        const expectedResult = {count: 1, modified: 1, failed: 0};
        mockDomRenderer.mutate.mockReturnValue(expectedResult);

        // Create a new handler instance for this test to ensure the default logger is used
        // Note: This assumes the default logger passed during construction is mockLogger
        const handlerWithDefaultLogger = new ModifyDomElementHandler({
            logger: mockLogger, // The 'default' logger for this test setup
            domRenderer: mockDomRenderer
        });

        handlerWithDefaultLogger.execute(params, executionContextNoLogger); // Use context without logger

        expect(mockDomRenderer.mutate).toHaveBeenCalledWith('div', 'className', 'active');

        // Check if the *handler's* logger was used (mockLogger in this setup)
        expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Initial, Result, Success
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params
        );
        // ****** CORRECTION: Check the 2nd debug log (result) ******
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "div": Found 1, Modified 1, Failed 0.'
        );
        // ****** CORRECTION: Check the 3rd debug log (success) ******
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('Modified property "className" on 1 element(s) matching selector "div" with value:'),
            'active'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute() should log error and return if params are missing or invalid', () => {
        const invalidParamsList = [
            null, undefined, {}, {selector: '#el'}, {selector: '#el', property: 'prop'},
            {property: 'prop', value: 'val'}, {selector: '', property: 'prop', value: 'val'},
            {selector: '  ', property: 'prop', value: 'val'}, {selector: '#el', property: '', value: 'val'},
            {selector: '#el', property: '  ', value: 'val'}, {selector: 123, property: 'prop', value: 'val'},
            {selector: '#el', property: true, value: 'val'}, {selector: '#el', property: 'prop', value: undefined},
        ];

        invalidParamsList.forEach((invalidParams, index) => {
            mockDomRenderer.mutate.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear(); // Clear debug for isolation

            const result = handler.execute(invalidParams, executionContext);

            expect(result).toBeUndefined();
            // Initial debug log *is* expected before validation failure
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'MODIFY_DOM_ELEMENT: Handler executing with params:', invalidParams
            );
            // Error log *is* expected
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.'),
                {params: invalidParams}
            );
            expect(mockDomRenderer.mutate).not.toHaveBeenCalled();
        });
    });


    test('execute() should allow null/false/0 as valid values', () => {
        const validValues = [null, false, 0, ''];
        validValues.forEach((value, index) => {
            const params = {selector: '#test', property: 'data-val', value};
            // ****** CORRECTION: Use count, modified, failed ******
            const expectedResult = {count: 1, modified: 1, failed: 0};

            // ****** CORRECTION: Clear and set mock *inside* the loop ******
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockDomRenderer.mutate.mockClear();
            mockDomRenderer.mutate.mockReturnValue(expectedResult); // Set return value for THIS iteration

            handler.execute(params, executionContext);

            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn if modified > 0
            expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
            expect(mockDomRenderer.mutate).toHaveBeenCalledWith('#test', 'data-val', value);

            expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Initial + Result + Success
            expect(mockLogger.debug).toHaveBeenNthCalledWith(1, 'MODIFY_DOM_ELEMENT: Handler executing with params:', params);
            expect(mockLogger.debug).toHaveBeenNthCalledWith(
                2,
                'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "#test": Found 1, Modified 1, Failed 0.'
            );
            expect(mockLogger.debug).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining('Modified property "data-val" on 1 element(s) matching selector "#test" with value:'),
                value
            );
        });
    });

    test('execute() should log warning if domRenderer.mutate returns zero modified elements', () => {
        const params = {selector: '.non-existent', property: 'display', value: 'none'};
        // ****** CORRECTION: Use count, modified, failed - scenario where 0 found ******
        const resultZeroFound = {count: 0, modified: 0, failed: 0};
        mockDomRenderer.mutate.mockReturnValue(resultZeroFound);
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.error.mockClear();

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledWith('.non-existent', 'display', 'none');
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // ****** CORRECTION: Match the exact warning message from handler ******
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: No elements found or modified for selector ".non-existent".`
        );
        // ****** CORRECTION: Expect 2 debug logs (Initial + Result) ******
        expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        expect(mockLogger.debug).toHaveBeenNthCalledWith(1, 'MODIFY_DOM_ELEMENT: Handler executing with params:', params);
        // ****** CORRECTION: Check the content of the second debug log ******
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector ".non-existent": Found 0, Modified 0, Failed 0.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should not error
    });


    // --- Test Case 3: Mutate Returns Failures ---
    test('execute() should log error if domRenderer.mutate returns failures', () => {
        const params = {
            selector: '.multiple',
            property: 'dataset.value',
            value: 123,
        };
        const failureDetails = [ // Handler doesn't log these details yet, but mock can provide them
            {selector: '.multiple:nth-child(2)', error: 'Invalid state'},
            {selector: '.multiple:nth-child(4)', error: 'Could not apply'}
        ];
        // ****** CORRECTION: Use count, modified, failed ******
        // Scenario: 5 found, 3 modified successfully, 2 failed
        const mutationResultWithFailures = {
            count: 5,
            modified: 3,
            failed: 2,
            // failures: failureDetails // Can include details if handler uses them
        };
        mockDomRenderer.mutate.mockReturnValue(mutationResultWithFailures);
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);

        // Check logs: Initial, Result, Success (for modified > 0), Error (for failed > 0)
        expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Initial + Result + Success
        expect(mockLogger.debug).toHaveBeenNthCalledWith(1, 'MODIFY_DOM_ELEMENT: Handler executing with params:', params);
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector ".multiple": Found 5, Modified 3, Failed 2.' // Uses correct counts
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            3,
            // Uses 'modified' count
            expect.stringContaining('Modified property "dataset.value" on 3 element(s) matching selector ".multiple" with value:'),
            123
        );

        // Expect an ERROR log detailing the failures
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        // ****** CORRECTION: Match the exact error message from handler ******
        expect(mockLogger.error).toHaveBeenCalledWith(
            // Uses 'failed' and 'count'
            `MODIFY_DOM_ELEMENT: Failed to modify property "dataset.value" on 2 out of 5 element(s) matching selector ".multiple".`,
            // The current handler doesn't log the details array, just the message
            // If it did, the assertion would be: mutationResultWithFailures.failures
        );
        expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn if failures occurred
    });

    test('execute() should log error if domRenderer.mutate throws', () => {
        const params = {
            selector: '#throws',
            property: 'innerHTML',
            value: '<p>Error</p>',
        };
        const error = new Error('DOM mutation failed');
        mockDomRenderer.mutate.mockImplementation(() => {
            throw error;
        });
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();


        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith( // Message from the code
            `MODIFY_DOM_ELEMENT: Error during DOM mutation via DomRenderer for selector "#throws":`,
            error
        );
        // Ensure success/warning logs weren't called
        expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only initial debug log
        expect(mockLogger.debug).toHaveBeenCalledWith('MODIFY_DOM_ELEMENT: Handler executing with params:', params);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });
});
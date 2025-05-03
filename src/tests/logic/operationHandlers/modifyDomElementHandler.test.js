// src/tests/logic/operationHandlers/modifyDomElementHandler.test.js

import {describe, it, expect, jest, beforeEach, test} from '@jest/globals';

import ModifyDomElementHandler from '../../../logic/operationHandlers/modifyDomElementHandler.js';
// Correctly import createMockLogger
// *** REMOVE: No longer need createMockDomRenderer ***
// import {createMockLogger, createMockDomRenderer} from '../../testUtils.js';
import {createMockLogger} from '../../testUtils.js';

describe('ModifyDomElementHandler (Unit Tests)', () => {
    let mockLogger;
    // *** CHANGE: Use mock for the new service ***
    let mockDomMutationService;
    let handler;
    let executionContext;

    beforeEach(() => {
        mockLogger = createMockLogger();
        // *** CHANGE: Create a simple mock for the new service ***
        mockDomMutationService = {
            mutate: jest.fn()
        };
        // *** CHANGE: Inject the new mock service ***
        handler = new ModifyDomElementHandler({
            logger: mockLogger,
            domMutationService: mockDomMutationService // Pass the new mock
        });
        executionContext = {
            logger: mockLogger,
            variables: new Map(),
        };
    });

    // *** CHANGE: Update constructor test name ***
    test('should construct with logger and domMutationService', () => {
        // *** CHANGE: Pass the new mock service ***
        const testHandler = new ModifyDomElementHandler({
            logger: mockLogger,
            domMutationService: mockDomMutationService
        });
        expect(testHandler).toBeDefined();
    });

    test('should throw error if logger is missing or invalid', () => {
        const invalidLoggers = [null, undefined, {}];
        invalidLoggers.forEach(invalidLogger => {
            // *** CHANGE: Pass the new mock service ***
            expect(() => new ModifyDomElementHandler({
                logger: invalidLogger,
                domMutationService: mockDomMutationService
            }))
                .toThrow('ModifyDomElementHandler requires a valid ILogger instance.');
        });
        // *** CHANGE: Pass the new mock service ***
        expect(() => new ModifyDomElementHandler({
            logger: {debug: jest.fn()},
            domMutationService: mockDomMutationService
        }))
            .toThrow('ModifyDomElementHandler requires a valid ILogger instance.'); // Missing 'info'

    });

    // *** CHANGE: Update test name and validation logic ***
    test('should throw error if domMutationService is missing or invalid', () => {
        const invalidServices = [null, undefined, {}];
        invalidServices.forEach(invalidService => {
            expect(() => new ModifyDomElementHandler({logger: mockLogger, domMutationService: invalidService}))
                .toThrow('ModifyDomElementHandler requires a valid IDomMutationService instance.');
        });
        // Check for missing 'mutate' method
        expect(() => new ModifyDomElementHandler({
            logger: mockLogger,
            domMutationService: {someOtherMethod: jest.fn()}
        }))
            .toThrow('ModifyDomElementHandler requires a valid IDomMutationService instance.');
    });


    // --- Test Case 1: Correct Parameters ---
    // *** CHANGE: Update test name slightly ***
    test('execute() should call domMutationService.mutate with correct parameters', () => {
        const params = {
            selector: '#my-element',
            property: 'textContent',
            value: 'New Text',
        };
        // Return value structure remains the same
        const expectedResult = {count: 1, modified: 1, failed: 0};
        // *** CHANGE: Mock the new service's mutate method ***
        mockDomMutationService.mutate.mockReturnValue(expectedResult);

        handler.execute(params, executionContext);

        // *** CHANGE: Expect call on the new service's mock ***
        expect(mockDomMutationService.mutate).toHaveBeenCalledTimes(1);
        expect(mockDomMutationService.mutate).toHaveBeenCalledWith(
            '#my-element',
            'textContent',
            'New Text'
        );

        // Assert logs (Adjust expected log counts/messages based on handler changes)
        expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Initial, Result, Success
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            // *** CHANGE: Update expected log message slightly based on handler output ***
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "#my-element": Found 1, Modified 1, Failed/Unchanged 0.'
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('Modified property "textContent" on 1 element(s) matching selector "#my-element" with value:'),
            'New Text'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // *** CHANGE: Update test name slightly ***
    test('execute() should trim selector and property before calling mutate', () => {
        const params = {
            selector: '  #padded-id   ',
            property: '  data-trimmed ',
            value: 'Trimmed Value',
        };
        const expectedResult = {count: 1, modified: 1, failed: 0};
        // *** CHANGE: Mock the new service's mutate method ***
        mockDomMutationService.mutate.mockReturnValue(expectedResult);

        handler.execute(params, executionContext);

        // *** CHANGE: Expect call on the new service's mock ***
        expect(mockDomMutationService.mutate).toHaveBeenCalledWith(
            '#padded-id', // Trimmed
            'data-trimmed', // Trimmed
            'Trimmed Value'
        );
        // Log checks remain similar, adjust message text
        expect(mockLogger.debug).toHaveBeenCalledTimes(3);
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "#padded-id": Found 1, Modified 1, Failed/Unchanged 0.'
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('Modified property "data-trimmed" on 1 element(s) matching selector "#padded-id" with value:'),
            'Trimmed Value'
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
        const expectedResult = {count: 1, modified: 1, failed: 0};
        // *** CHANGE: Mock the new service's mutate method ***
        mockDomMutationService.mutate.mockReturnValue(expectedResult);

        // Create a new handler instance for this test to ensure the default logger is used
        const handlerWithDefaultLogger = new ModifyDomElementHandler({
            logger: mockLogger,
            // *** CHANGE: Pass the new mock service ***
            domMutationService: mockDomMutationService
        });

        handlerWithDefaultLogger.execute(params, executionContextNoLogger);

        // *** CHANGE: Expect call on the new service's mock ***
        expect(mockDomMutationService.mutate).toHaveBeenCalledWith('div', 'className', 'active');

        // Log checks remain similar, adjust message text
        expect(mockLogger.debug).toHaveBeenCalledTimes(3);
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "div": Found 1, Modified 1, Failed/Unchanged 0.'
        );
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
            // *** CHANGE: Clear the new mock ***
            mockDomMutationService.mutate.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear(); // Clear debug for isolation

            const result = handler.execute(invalidParams, executionContext);

            expect(result).toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Initial debug still happens
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'MODIFY_DOM_ELEMENT: Handler executing with params:', invalidParams
            );
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Error log expected
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.'),
                {params: invalidParams}
            );
            // *** CHANGE: Check the new mock ***
            expect(mockDomMutationService.mutate).not.toHaveBeenCalled();
        });
    });


    test('execute() should allow null/false/0 as valid values', () => {
        const validValues = [null, false, 0, ''];
        validValues.forEach((value, index) => {
            const params = {selector: '#test', property: 'data-val', value};
            const expectedResult = {count: 1, modified: 1, failed: 0};

            // Clear and set mock *inside* the loop
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            // *** CHANGE: Clear and mock the new service ***
            mockDomMutationService.mutate.mockClear();
            mockDomMutationService.mutate.mockReturnValue(expectedResult);

            handler.execute(params, executionContext);

            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            // *** CHANGE: Check the new mock ***
            expect(mockDomMutationService.mutate).toHaveBeenCalledTimes(1);
            expect(mockDomMutationService.mutate).toHaveBeenCalledWith('#test', 'data-val', value);

            // Log checks remain similar, adjust message text
            expect(mockLogger.debug).toHaveBeenCalledTimes(3);
            expect(mockLogger.debug).toHaveBeenNthCalledWith(1, 'MODIFY_DOM_ELEMENT: Handler executing with params:', params);
            expect(mockLogger.debug).toHaveBeenNthCalledWith(
                2,
                'MODIFY_DOM_ELEMENT: Mutation attempt result for selector "#test": Found 1, Modified 1, Failed/Unchanged 0.'
            );
            expect(mockLogger.debug).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining('Modified property "data-val" on 1 element(s) matching selector "#test" with value:'),
                value
            );
        });
    });

    // *** CHANGE: Update test name slightly ***
    test('execute() should log warning if domMutationService.mutate returns zero found elements', () => {
        const params = {selector: '.non-existent', property: 'display', value: 'none'};
        // Scenario where 0 found
        const resultZeroFound = {count: 0, modified: 0, failed: 0};
        // *** CHANGE: Mock the new service ***
        mockDomMutationService.mutate.mockReturnValue(resultZeroFound);
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.error.mockClear();

        handler.execute(params, executionContext);

        // *** CHANGE: Check the new mock ***
        expect(mockDomMutationService.mutate).toHaveBeenCalledWith('.non-existent', 'display', 'none');
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Warning expected for 0 found
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `MODIFY_DOM_ELEMENT: No elements found or modified for selector ".non-existent".`
        );
        // Log checks remain similar, adjust message text
        expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Initial + Result
        expect(mockLogger.debug).toHaveBeenNthCalledWith(1, 'MODIFY_DOM_ELEMENT: Handler executing with params:', params);
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector ".non-existent": Found 0, Modified 0, Failed/Unchanged 0.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    // --- Test Case 3: Mutate Returns Failures ---
    // *** CHANGE: Update test name slightly ***
    test('execute() should log error if domMutationService.mutate returns failures/unchanged', () => {
        const params = {
            selector: '.multiple',
            property: 'dataset.value',
            value: 123,
        };
        // Scenario: 5 found, 3 modified successfully, 2 failed/unchanged
        const mutationResultWithFailures = {
            count: 5,
            modified: 3,
            failed: 2, // Represents failed OR unchanged
        };
        // *** CHANGE: Mock the new service ***
        mockDomMutationService.mutate.mockReturnValue(mutationResultWithFailures);
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();

        handler.execute(params, executionContext);

        // *** CHANGE: Check the new mock ***
        expect(mockDomMutationService.mutate).toHaveBeenCalledTimes(1);

        // Check logs: Initial, Result, Success (for modified > 0), Error (for failed > 0)
        expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Initial + Result + Success
        expect(mockLogger.debug).toHaveBeenNthCalledWith(1, 'MODIFY_DOM_ELEMENT: Handler executing with params:', params);
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            'MODIFY_DOM_ELEMENT: Mutation attempt result for selector ".multiple": Found 5, Modified 3, Failed/Unchanged 2.' // Uses correct counts
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('Modified property "dataset.value" on 3 element(s) matching selector ".multiple" with value:'), // Uses 'modified' count
            123
        );

        // Expect an ERROR log detailing the failures/unchanged
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            // Uses 'failed' and 'count' from handler's log message
            `MODIFY_DOM_ELEMENT: Failed/Unchanged property "dataset.value" on 2 out of 5 element(s) matching selector ".multiple". 3 succeeded.`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn if errors are logged
    });

    // *** CHANGE: Update test name slightly ***
    test('execute() should log error if domMutationService.mutate throws', () => {
        const params = {
            selector: '#throws',
            property: 'innerHTML',
            value: '<p>Error</p>',
        };
        const error = new Error('DOM mutation failed');
        // *** CHANGE: Mock the new service to throw ***
        mockDomMutationService.mutate.mockImplementation(() => {
            throw error;
        });
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();


        handler.execute(params, executionContext);

        // *** CHANGE: Check the new mock ***
        expect(mockDomMutationService.mutate).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith( // Message from the code
            // *** CHANGE: Update source reference in message ***
            `MODIFY_DOM_ELEMENT: Error during DOM mutation via DomMutationService for selector "#throws":`,
            error
        );
        // Ensure success/warning logs weren't called
        expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only initial debug log
        expect(mockLogger.debug).toHaveBeenCalledWith('MODIFY_DOM_ELEMENT: Handler executing with params:', params);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });
});

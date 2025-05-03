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
        mockDomRenderer = createMockDomRenderer();
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
        // ****** CORRECTION: Removed assertions for private fields ******
        // Cannot directly access private #logger and #domRenderer
        // Their correct injection is implicitly tested by other tests using the handler
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
        const expectedResult = {modifiedCount: 1, failures: []};
        mockDomRenderer.mutate.mockReturnValue(expectedResult);

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
        expect(mockDomRenderer.mutate).toHaveBeenCalledWith(
            '#my-element',
            'textContent',
            'New Text'
        );

        // Assert logs
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params
        );
        // Handler now uses modifiedCount, so this should pass if modifiedCount > 0
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('Modified property "textContent" on 1 element(s)'),
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
        const expectedResult = {modifiedCount: 1, failures: []};
        mockDomRenderer.mutate.mockReturnValue(expectedResult);

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledWith(
            '#padded-id',
            'data-trimmed',
            'Trimmed Value'
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params // Original params are logged first
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('Modified property "data-trimmed" on 1 element(s) matching selector "#padded-id"'),
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
        const expectedResult = {modifiedCount: 1, failures: []};
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
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            'MODIFY_DOM_ELEMENT: Handler executing with params:',
            params
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('Modified property "className" on 1 element(s)'),
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
            mockLogger.debug.mockClear();

            const result = handler.execute(invalidParams, executionContext);

            expect(result).toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('MODIFY_DOM_ELEMENT: Invalid or incomplete parameters.'),
                {params: invalidParams}
            );
            expect(mockDomRenderer.mutate).not.toHaveBeenCalled();
            // ****** CORRECTION: Removed assertion checking against debug log ******
            // The initial debug log IS expected, even before validation fails.
        });
    });


    test('execute() should allow null/false/0 as valid values', () => {
        const validValues = [null, false, 0, ''];
        validValues.forEach((value, index) => {
            const params = {selector: '#test', property: 'data-val', value};
            const expectedResult = {modifiedCount: 1, failures: []};
            mockDomRenderer.mutate.mockReturnValue(expectedResult);
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockDomRenderer.mutate.mockClear();

            handler.execute(params, executionContext);

            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn if modifiedCount > 0
            expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);
            expect(mockDomRenderer.mutate).toHaveBeenCalledWith('#test', 'data-val', value);

            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Initial + Success
            expect(mockLogger.debug).toHaveBeenNthCalledWith(1, expect.any(String), params);
            expect(mockLogger.debug).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('Modified property "data-val" on 1 element(s)'),
                value
            );
        });
    });

    test('execute() should log warning if domRenderer.mutate returns zero modified elements', () => {
        const params = {selector: '.non-existent', property: 'display', value: 'none'};
        const resultZeroMods = {modifiedCount: 0, failures: []}; // Correct mock result
        mockDomRenderer.mutate.mockReturnValue(resultZeroMods);
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.error.mockClear();

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledWith('.non-existent', 'display', 'none');
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith( // Message from the code
            `MODIFY_DOM_ELEMENT: No elements found or modified for selector ".non-existent".`
        );
        // Ensure success log didn't happen
        expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only the initial debug log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.any(String), params);
        expect(mockLogger.error).not.toHaveBeenCalled(); // Should not error
    });


    // --- Test Case 3: Mutate Returns Failures ---
    test('execute() should log error if domRenderer.mutate returns failures', () => {
        const params = {
            selector: '.multiple',
            property: 'dataset.value',
            value: 123,
        };
        const mutationResultWithFailures = {
            modifiedCount: 3, // Assume 3 were targeted/modified
            failures: [     // But 2 failed
                {selector: '.multiple:nth-child(2)', error: 'Invalid state'},
                {selector: '.multiple:nth-child(4)', error: 'Could not apply'}
            ]
        };
        mockDomRenderer.mutate.mockReturnValue(mutationResultWithFailures);
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();

        handler.execute(params, executionContext);

        expect(mockDomRenderer.mutate).toHaveBeenCalledTimes(1);

        // Check for the success log (HANDLER LOGS THIS IF modifiedCount > 0, REGARDLESS OF FAILURES)
        expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Initial + success count log
        expect(mockLogger.debug).toHaveBeenNthCalledWith(1, expect.any(String), params);
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('Modified property "dataset.value" on 3 element(s)'), // Uses modifiedCount
            123
        );

        // Expect an ERROR log detailing the failures
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith( // Message from the code
            `MODIFY_DOM_ELEMENT: Failed to modify property "dataset.value" on 2 element(s) matching selector ".multiple".`, // Uses failures.length
            mutationResultWithFailures.failures // Logs the failures array
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
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.any(String), params);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });
});
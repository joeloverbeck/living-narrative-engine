// src/tests/actions/actionExecutionUtils.test.js

// --- Mock Dependencies ---
// Mock the entire entityFinderService module
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// Mock the messages utility
jest.mock('../../utils/messages.js', () => {
    const originalMessagesModule = jest.requireActual('../../utils/messages.js'); // Get the real module
    return {
        // Mock getDisplayName as before
        getDisplayName: jest.fn((entity) => entity?.mockName || entity?.id || 'mock display name'),

        // Provide TARGET_MESSAGES, but specifically mock the function causing the error
        TARGET_MESSAGES: {
            ...originalMessagesModule.TARGET_MESSAGES, // Keep other real messages if needed

            // Override AMBIGUOUS_PROMPT with a mock function
            AMBIGUOUS_PROMPT: jest.fn((actionVerb, targetTypeName, matches) => {
                // You can optionally use the mocked getDisplayName logic here if you want
                // the mock's return value to be consistent with how you think it *should* format
                const mockDisplay = (entity) => entity?.mockName || entity?.id || 'mock display name'; // Simulate mock logic
                const names = matches.map(e => mockDisplay(e)).join(', ');
                // Return a predictable string for easier assertion
                return `MOCKED_AMBIGUOUS_PROMPT: Verb=${actionVerb}, Type=${targetTypeName}, Names=${names}`;
            }),
            // You might need to mock other messages called by handleActionWithTargetResolution
            // if they also rely on getDisplayName or other complex logic, e.g.:
            // NOT_FOUND_LOCATION: jest.fn((name) => `MOCKED_NOT_FOUND: ${name}`),
            // SCOPE_EMPTY_PERSONAL: jest.fn((verb) => `MOCKED_EMPTY_PERSONAL: ${verb}`),
            // SCOPE_EMPTY_GENERIC: jest.fn((verb, scope) => `MOCKED_EMPTY_GENERIC: ${verb} in ${scope}`),
            // INTERNAL_ERROR: 'MOCKED_INTERNAL_ERROR', // Can just be a string
        },
    };
});

jest.mock('../../services/entityFinderService.js', () => ({
    // Import the *real* ResolutionStatus constants for use in tests
    ResolutionStatus: jest.requireActual('../../services/entityFinderService.js').ResolutionStatus,
    // Mock the resolveTargetEntity function
    resolveTargetEntity: jest.fn(),
}));

// Mock the actionValidationUtils module
jest.mock('../../utils/actionValidationUtils.js', () => ({
    validateRequiredCommandPart: jest.fn(),
}));


// Mock console.error to prevent test output clutter and allow assertions
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {
});
// Mock console.warn (used by resolveTargetEntity mock setup, though not directly by handleAction...)
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {
});


// --- Import the function to test and real constants ---
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../../actions/actionExecutionUtils.js';
import {ResolutionStatus} from '../../services/entityFinderService.js'; // Get the real enum

// --- Import mocked functions for use in tests ---
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';

// --- Helper Types (Optional but good practice) ---
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../services/entityFinderService.js').TargetResolutionScope} TargetResolutionScope */
/** @typedef {import('../components/component.js').ComponentConstructor} ComponentConstructor */
/** @typedef {import('./actionExecutionUtils.js').HandleActionWithOptions} HandleActionWithOptions */

// --- Test Suite ---
describe('handleActionWithTargetResolution', () => {
    let mockContext;
    let mockOptions;
    let mockEntity;
    let mockDispatch;
    let mockOnFoundUnique;

    // --- Reset mocks and setup basic context/options before each test ---
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks(); // Clears call counts etc. but not implementations
        // If you need to reset implementations defined with jest.fn(), use mockReset
        // resolveTargetEntity.mockReset(); // Or do specific resets below if needed
        // validateRequiredCommandPart.mockReset();
        // getDisplayName.mockReset();

        mockDispatch = jest.fn();
        mockOnFoundUnique = jest.fn();

        // Basic mock context
        mockContext = {
            dispatch: mockDispatch,
            entityManager: {}, // Placeholder, not directly used by handleAction... but passed down
            playerEntity: {id: 'player1'}, // Needed for validation dispatch
            parsedCommand: {
                verb: 'testverb',
                directObjectPhrase: 'target name',
                indirectObjectPhrase: null,
            },
            // Add other context properties if needed by mocks or tested function
        };

        // Basic mock entity
        mockEntity = {
            id: 'target1',
            mockName: 'Mock Target', // Used by mock getDisplayName
            // Add mock components/methods if needed by onFoundUnique
            hasComponent: jest.fn(() => true), // Example mock method
            getComponent: jest.fn((comp) => { // Example mock method
                if (comp.name === 'NameComponent') return {value: 'Mock Target'};
                return null;
            }),
        };

        // Basic mock options
        mockOptions = {
            scope: 'location',
            commandPart: 'directObjectPhrase',
            actionVerb: 'test',
            onFoundUnique: mockOnFoundUnique,
            requiredComponents: [], // Example: [MockComponent1, MockComponent2]
            // failureMessages left undefined initially
        };

        // Default mock implementations
        validateRequiredCommandPart.mockReturnValue(true); // Assume validation passes by default
        resolveTargetEntity.mockReturnValue({ // Assume unique find by default
            status: ResolutionStatus.FOUND_UNIQUE,
            entity: mockEntity,
            candidates: null,
        });
        mockOnFoundUnique.mockResolvedValue({ // Assume callback succeeds by default
            success: true,
            messages: [{text: 'Callback success message', type: 'info'}],
            newState: { /* some state change */},
        });
        getDisplayName.mockImplementation((entity) => entity?.mockName || entity?.id || 'mock display name');
    });

    // --- Test Cases ---

    // 1. Initial Validation Failure
    test('should return failure if validateRequiredCommandPart returns false', async () => {
        validateRequiredCommandPart.mockReturnValue(false); // Setup failure

        const result = await handleActionWithTargetResolution(mockContext, mockOptions);

        expect(validateRequiredCommandPart).toHaveBeenCalledWith(mockContext, mockOptions.actionVerb, mockOptions.commandPart);
        expect(resolveTargetEntity).not.toHaveBeenCalled();
        expect(mockOnFoundUnique).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalledWith(expect.stringContaining('ui:message_display'), expect.anything()); // Validation util handles dispatch
        expect(result).toEqual({
            success: false,
            messages: expect.arrayContaining([
                expect.objectContaining({type: 'internal', text: expect.stringContaining('Validation failed')})
            ]),
            newState: undefined,
        });
    });

    test('should handle internal error if command part missing after validation (safety check)', async () => {
        // Simulate validation passing but context missing the data (unlikely but possible)
        mockContext.parsedCommand.directObjectPhrase = '';
        validateRequiredCommandPart.mockReturnValue(true); // Mock validation thinks it's ok

        const result = await handleActionWithTargetResolution(mockContext, mockOptions);

        expect(validateRequiredCommandPart).toHaveBeenCalled();
        expect(resolveTargetEntity).not.toHaveBeenCalled(); // Should fail before resolution
        expect(mockOnFoundUnique).not.toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.INTERNAL_ERROR,
            type: 'error'
        });
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining(`Command part '${mockOptions.commandPart}' was validated but is still missing/empty.`));
        expect(result).toEqual({
            success: false,
            messages: expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal_error',
                    text: expect.stringContaining('targetName missing after validation')
                })
            ]),
            newState: undefined,
        });
    });

    // 2. Successful Path (FOUND_UNIQUE)
    test('should call resolveTargetEntity and onFoundUnique on successful validation and resolution', async () => {
        const targetName = mockContext.parsedCommand.directObjectPhrase;

        const result = await handleActionWithTargetResolution(mockContext, mockOptions);

        expect(validateRequiredCommandPart).toHaveBeenCalledTimes(1);
        expect(resolveTargetEntity).toHaveBeenCalledTimes(1);
        expect(resolveTargetEntity).toHaveBeenCalledWith(mockContext, {
            scope: mockOptions.scope,
            requiredComponents: mockOptions.requiredComponents,
            actionVerb: mockOptions.actionVerb,
            targetName: targetName,
            // Custom filter not provided in default options
        });
        expect(mockOnFoundUnique).toHaveBeenCalledTimes(1);
        // Check arguments passed to onFoundUnique: context, entity, and *initial* messages array
        expect(mockOnFoundUnique).toHaveBeenCalledWith(
            mockContext,
            mockEntity,
            expect.arrayContaining([ // Check the initial messages passed to the callback
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining(`Action: ${mockOptions.actionVerb}`)
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining(`Target resolution status: ${ResolutionStatus.FOUND_UNIQUE}`)
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining(`Target resolved uniquely: ${getDisplayName(mockEntity)}`)
                })
            ])
        );

        // Check final result combines messages and includes callback result properties
        expect(result.success).toBe(true);
        expect(result.newState).toEqual({ /* some state change */});
        expect(result.messages).toEqual(expect.arrayContaining([
            // Internal messages from handleAction...
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Action: ${mockOptions.actionVerb}`)
            }),
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Target resolution status: ${ResolutionStatus.FOUND_UNIQUE}`)
            }),
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Target resolved uniquely: ${getDisplayName(mockEntity)}`)
            }),
            // Message from the mock callback
            expect.objectContaining({text: 'Callback success message', type: 'info'})
        ]));
        expect(result.messages.length).toBe(4); // Ensure no extra messages snuck in
        expect(mockDispatch).not.toHaveBeenCalledWith(expect.stringContaining('ui:message_display'), expect.anything()); // No failure messages dispatched
    });

    test('should return callback result even if success is false', async () => {
        const callbackFailureResult = {
            success: false,
            messages: [{text: 'Callback decided failure', type: 'warning'}],
            newState: undefined
        };
        mockOnFoundUnique.mockResolvedValue(callbackFailureResult);

        const result = await handleActionWithTargetResolution(mockContext, mockOptions);

        expect(mockOnFoundUnique).toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.newState).toBeUndefined();
        expect(result.messages).toEqual(expect.arrayContaining([
            // Internal messages
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Action: ${mockOptions.actionVerb}`)
            }),
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Target resolution status: ${ResolutionStatus.FOUND_UNIQUE}`)
            }),
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Target resolved uniquely: ${getDisplayName(mockEntity)}`)
            }),
            // Callback message
            expect.objectContaining({text: 'Callback decided failure', type: 'warning'})
        ]));
        expect(result.messages.length).toBe(4);
    });

    // 3. Error Handling in onFoundUnique
    test('should handle errors thrown by onFoundUnique', async () => {
        const callbackError = new Error('Something went wrong in the callback!');
        mockOnFoundUnique.mockRejectedValue(callbackError); // Simulate callback throwing

        const result = await handleActionWithTargetResolution(mockContext, mockOptions);

        expect(mockOnFoundUnique).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.INTERNAL_ERROR,
            type: 'error'
        });
        expect(mockConsoleError).toHaveBeenCalledWith(
            expect.stringContaining(`Error executing onFoundUnique callback for action '${mockOptions.actionVerb}'`),
            callbackError // Check that the original error was logged
        );
        expect(result.success).toBe(false);
        expect(result.newState).toBeUndefined();
        expect(result.messages).toEqual(expect.arrayContaining([
            // Internal messages BEFORE callback call
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Action: ${mockOptions.actionVerb}`)
            }),
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Target resolution status: ${ResolutionStatus.FOUND_UNIQUE}`)
            }),
            expect.objectContaining({
                type: 'internal',
                text: expect.stringContaining(`Target resolved uniquely: ${getDisplayName(mockEntity)}`)
            }),
            // Internal ERROR message from catch block
            expect.objectContaining({
                type: 'internal_error',
                text: `Internal Error during onFoundUnique: ${callbackError.message}`,
                details: callbackError
            })
        ]));
        expect(result.messages.length).toBe(4); // Initial internal + error internal
    });


    // 4. Handling Resolution Failures (NOT_FOUND, AMBIGUOUS, etc.)

    describe('Resolution Failure Handling', () => {
        const targetName = 'target name'; // Defined in beforeEach mockContext

        test('should handle NOT_FOUND with default message (location scope)', async () => {
            resolveTargetEntity.mockReturnValue({status: ResolutionStatus.NOT_FOUND, entity: null, candidates: null});
            mockOptions.scope = 'location'; // Ensure scope matches expected default

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(resolveTargetEntity).toHaveBeenCalled();
            expect(mockOnFoundUnique).not.toHaveBeenCalled();
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.NOT_FOUND_LOCATION(targetName), // Default for location
                type: 'info'
            });
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining(`Action: ${mockOptions.actionVerb}`)
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: `Target resolution status: ${ResolutionStatus.NOT_FOUND}`
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: `Resolution Failed: NOT_FOUND. User message: "${TARGET_MESSAGES.NOT_FOUND_LOCATION(targetName)}"`
                })
            ]));
        });

        test('should handle NOT_FOUND with custom string message', async () => {
            resolveTargetEntity.mockReturnValue({status: ResolutionStatus.NOT_FOUND, entity: null, candidates: null});
            mockOptions.failureMessages = {notFound: 'Custom not found message.'};

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'Custom not found message.',
                type: 'info'
            });
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: `Resolution Failed: NOT_FOUND. User message: "Custom not found message."`
                })
            ]));
        });

        test('should handle NOT_FOUND with custom function message', async () => {
            resolveTargetEntity.mockReturnValue({status: ResolutionStatus.NOT_FOUND, entity: null, candidates: null});
            const customMsgFn = jest.fn((name) => `Custom function: Cannot find ${name}`);
            mockOptions.failureMessages = {notFound: customMsgFn};

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(customMsgFn).toHaveBeenCalledWith(targetName);
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: `Custom function: Cannot find ${targetName}`,
                type: 'info'
            });
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: `Resolution Failed: NOT_FOUND. User message: "Custom function: Cannot find ${targetName}"`
                })
            ]));
        });

        test('should handle AMBIGUOUS with default message', async () => {
            const candidates = [{id: 'c1', mockName: 'Candidate 1'}, {id: 'c2', mockName: 'Candidate 2'}];
            resolveTargetEntity.mockReturnValue({status: ResolutionStatus.AMBIGUOUS, entity: null, candidates});
            const targetName = mockContext.parsedCommand.directObjectPhrase; // Get target name

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(resolveTargetEntity).toHaveBeenCalled();
            expect(mockOnFoundUnique).not.toHaveBeenCalled();

            // *** FIX: Calculate the expected message based on the ACTUAL mocked function's return format ***
            const expectedMockedNames = candidates.map(c => c.mockName || c.id).join(', '); // Uses mockName first, like the mock
            // Align this string EXACTLY with the format returned by your jest.fn() mock for AMBIGUOUS_PROMPT
            const expectedUserMessage = `MOCKED_AMBIGUOUS_PROMPT: Verb=${mockOptions.actionVerb}, Type=${targetName}, Names=${expectedMockedNames}`;

            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedUserMessage, // Check against the CORRECT mocked message format
                type: 'warning'
            });
            // *** END FIX ***

            expect(result.success).toBe(false);
            // Check internal messages - This assertion should already use the updated expectedUserMessage
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining(`Action: ${mockOptions.actionVerb}`)
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: `Target resolution status: ${ResolutionStatus.AMBIGUOUS}`
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining(`Resolution Failed: AMBIGUOUS. Candidates: c1, c2. User message: "${expectedUserMessage}"`) // Should be correct now
                })
            ]));
            expect(result.messages.length).toBe(3);

            // Verify the mocked AMBIGUOUS_PROMPT function was called
            expect(TARGET_MESSAGES.AMBIGUOUS_PROMPT).toHaveBeenCalledWith(mockOptions.actionVerb, targetName, candidates);
        });

        test('should handle AMBIGUOUS with custom function message', async () => {
            const candidates = [{id: 'c1', mockName: 'Candidate 1'}];
            resolveTargetEntity.mockReturnValue({status: ResolutionStatus.AMBIGUOUS, entity: null, candidates});
            const targetName = mockContext.parsedCommand.directObjectPhrase; // Get target name
            const customMsgFn = jest.fn((verb, name, matches) => `Custom Ambiguous: ${verb} ${name}? Options: ${matches.map(m => m.id).join('/')}`);
            mockOptions.failureMessages = {ambiguous: customMsgFn};

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(customMsgFn).toHaveBeenCalledWith(mockOptions.actionVerb, targetName, candidates);
            const expectedUserMessage = `Custom Ambiguous: ${mockOptions.actionVerb} ${targetName}? Options: c1`;
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedUserMessage,
                type: 'warning'
            });
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                // The other internal messages (Action, Status) should also be present
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining(`Action: ${mockOptions.actionVerb}`) // Example check
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: `Target resolution status: ${ResolutionStatus.AMBIGUOUS}`
                }),
                // *** FIX START ***
                expect.objectContaining({
                    type: 'internal',
                    // Update stringContaining to include the Candidates part
                    text: expect.stringContaining(`Resolution Failed: AMBIGUOUS. Candidates: c1. User message: "${expectedUserMessage}"`)
                })
                // *** FIX END ***
            ]));
            // Ensure all expected messages are present
            expect(result.messages.length).toBe(3); // Action, Status, Failure details
        });

        test('should handle FILTER_EMPTY with default message (personal scope)', async () => {
            resolveTargetEntity.mockReturnValue({
                status: ResolutionStatus.FILTER_EMPTY,
                entity: null,
                candidates: null
            });
            mockOptions.scope = 'inventory'; // Personal scope

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(resolveTargetEntity).toHaveBeenCalled();
            expect(mockOnFoundUnique).not.toHaveBeenCalled();
            const expectedMsg = TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL(mockOptions.actionVerb);
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedMsg,
                type: 'info'
            });
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: `Target resolution status: ${ResolutionStatus.FILTER_EMPTY}`
                }),
                expect.objectContaining({
                    type: 'internal',
                    text: `Resolution Failed: FILTER_EMPTY for scope '${mockOptions.scope}'. User message: "${expectedMsg}"`
                })
            ]));
        });

        test('should handle FILTER_EMPTY with default message (generic scope)', async () => {
            resolveTargetEntity.mockReturnValue({
                status: ResolutionStatus.FILTER_EMPTY,
                entity: null,
                candidates: null
            });
            mockOptions.scope = 'location'; // Generic scope

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            const expectedMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(mockOptions.actionVerb, mockOptions.scope);
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedMsg,
                type: 'info'
            });
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: `Resolution Failed: FILTER_EMPTY for scope '${mockOptions.scope}'. User message: "${expectedMsg}"`
                })
            ]));
        });

        test('should handle FILTER_EMPTY with custom function message', async () => {
            resolveTargetEntity.mockReturnValue({
                status: ResolutionStatus.FILTER_EMPTY,
                entity: null,
                candidates: null
            });
            const customMsgFn = jest.fn((verb, scope) => `Custom Empty: Cannot ${verb} anything in ${scope}`);
            mockOptions.failureMessages = {filterEmpty: customMsgFn};
            mockOptions.scope = 'nearby';

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(customMsgFn).toHaveBeenCalledWith(mockOptions.actionVerb, mockOptions.scope);
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: `Custom Empty: Cannot ${mockOptions.actionVerb} anything in ${mockOptions.scope}`,
                type: 'info'
            });
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: `Resolution Failed: FILTER_EMPTY for scope '${mockOptions.scope}'. User message: "Custom Empty: Cannot ${mockOptions.actionVerb} anything in ${mockOptions.scope}"`
                })
            ]));
        });

        test('should handle INVALID_INPUT with default message', async () => {
            resolveTargetEntity.mockReturnValue({
                status: ResolutionStatus.INVALID_INPUT,
                entity: null,
                candidates: null
            });

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(resolveTargetEntity).toHaveBeenCalled();
            expect(mockOnFoundUnique).not.toHaveBeenCalled();
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.INTERNAL_ERROR,
                type: 'error'
            });
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining(`resolveTargetEntity returned INVALID_INPUT for action '${mockOptions.actionVerb}'`));
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: `Target resolution status: ${ResolutionStatus.INVALID_INPUT}`
                }),
                expect.objectContaining({
                    type: 'internal_error',
                    text: `Resolution Failed: INVALID_INPUT. User message: "${TARGET_MESSAGES.INTERNAL_ERROR}"`
                })
            ]));
        });

        test('should handle INVALID_INPUT with custom string message', async () => {
            resolveTargetEntity.mockReturnValue({
                status: ResolutionStatus.INVALID_INPUT,
                entity: null,
                candidates: null
            });
            mockOptions.failureMessages = {invalidInput: 'Custom invalid input message.'};

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'Custom invalid input message.',
                type: 'error'
            });
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining(`resolveTargetEntity returned INVALID_INPUT for action '${mockOptions.actionVerb}'`));
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal_error',
                    text: `Resolution Failed: INVALID_INPUT. User message: "Custom invalid input message."`
                })
            ]));
        });

        test('should handle unexpected resolution status', async () => {
            const unexpectedStatus = 'UNKNOWN_STATUS';
            // Force the mock to return something unexpected
            resolveTargetEntity.mockReturnValue({status: unexpectedStatus, entity: null, candidates: null});

            const result = await handleActionWithTargetResolution(mockContext, mockOptions);

            expect(resolveTargetEntity).toHaveBeenCalled();
            expect(mockOnFoundUnique).not.toHaveBeenCalled();
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.INTERNAL_ERROR,
                type: 'error'
            });
            expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining(`Unhandled resolution status from resolveTargetEntity: ${unexpectedStatus}`));
            expect(result.success).toBe(false);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({type: 'internal', text: `Target resolution status: ${unexpectedStatus}`}),
                expect.objectContaining({
                    type: 'internal_error',
                    text: `Resolution Failed: Unexpected status '${unexpectedStatus}'.`
                })
            ]));
        });
    }); // End Resolution Failure Handling describe block
});

// --- NEW Test Suite for dispatchEventWithCatch ---
describe('dispatchEventWithCatch', () => {
    let mockContext;
    let mockMessages;
    let mockLogDetails;
    let mockDispatch;
    const testEventName = 'test:event';
    const testPayload = {data: 'payload'};

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        mockDispatch = jest.fn(); // Mock the dispatch function
        mockContext = {
            dispatch: mockDispatch,
            // Add other context properties if needed by your tests
        };
        mockMessages = []; // Start with an empty messages array for each test
        mockLogDetails = {
            success: `Successfully dispatched ${testEventName}`,
            errorUser: 'Something went wrong processing your request.',
            errorInternal: `Failed to dispatch ${testEventName}.`
        };
    });

    // --- Success Case ---
    test('should call context.dispatch, add success message, and return { success: true } on success', () => {
        const result = dispatchEventWithCatch(mockContext, testEventName, testPayload, mockMessages, mockLogDetails);

        // Check dispatch call
        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(mockDispatch).toHaveBeenCalledWith(testEventName, testPayload);

        // Check messages array mutation (AC)
        expect(mockMessages).toHaveLength(1);
        expect(mockMessages[0]).toEqual({
            text: mockLogDetails.success,
            type: 'internal'
        });

        // Check return value (AC)
        expect(result).toEqual({success: true});

        // Ensure no error messages were dispatched or logged
        expect(mockDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.anything());
        expect(mockConsoleError).not.toHaveBeenCalled();
    });

    // --- Failure Case ---
    test('should catch error, dispatch UI error, log console error, add internal error message, and return { success: false } on failure', () => {
        const dispatchError = new Error('Dispatch failed!');
        mockDispatch.mockImplementation((eventName, payload) => {
            // Only throw error for the primary event, not for the ui:message_display
            if (eventName === testEventName) {
                throw dispatchError;
            }
        });

        const result = dispatchEventWithCatch(mockContext, testEventName, testPayload, mockMessages, mockLogDetails);

        // Check primary dispatch attempt (was called and threw)
        expect(mockDispatch).toHaveBeenCalledWith(testEventName, testPayload);

        // Check UI message dispatch (AC)
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: mockLogDetails.errorUser, // Static string in this test
            type: 'error'
        });
        // Ensure dispatch was called exactly twice (attempt + ui message)
        expect(mockDispatch).toHaveBeenCalledTimes(2);

        // Check console error logging (AC)
        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        expect(mockConsoleError).toHaveBeenCalledWith(
            expect.stringContaining(`Error dispatching event '${testEventName}'`),
            dispatchError // Check the original error was logged
        );

        // Check messages array mutation (AC)
        expect(mockMessages).toHaveLength(1);
        expect(mockMessages[0]).toEqual({
            text: `${mockLogDetails.errorInternal} Error: ${dispatchError.message}`,
            type: 'error',
            details: dispatchError
        });

        // Check return value (AC)
        expect(result).toEqual({success: false});
    });

    // --- Failure Case with Functional Error Message ---
    test('should call errorUser function and use its result for UI message on failure', () => {
        const dispatchError = new Error('Specific failure type');
        mockDispatch.mockImplementation((eventName) => {
            if (eventName === testEventName) throw dispatchError;
        });

        const mockErrorUserFn = jest.fn((err) => `User error due to: ${err.message}`);
        mockLogDetails.errorUser = mockErrorUserFn; // Use the mock function

        const result = dispatchEventWithCatch(mockContext, testEventName, testPayload, mockMessages, mockLogDetails);

        // Check that the errorUser function was called with the error
        expect(mockErrorUserFn).toHaveBeenCalledTimes(1);
        expect(mockErrorUserFn).toHaveBeenCalledWith(dispatchError);

        // Check UI message dispatch used the function's return value
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: `User error due to: ${dispatchError.message}`,
            type: 'error'
        });

        // Other checks remain similar
        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        expect(mockMessages).toHaveLength(1);
        expect(mockMessages[0].text).toContain(mockLogDetails.errorInternal);
        expect(result).toEqual({success: false});
    });

    // --- Edge Case: context.dispatch is missing ---
    test('should handle missing context.dispatch gracefully', () => {
        mockContext.dispatch = undefined; // Simulate missing dispatch

        const result = dispatchEventWithCatch(mockContext, testEventName, testPayload, mockMessages, mockLogDetails);

        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('context.dispatch is missing'));
        expect(mockMessages).toHaveLength(1);
        expect(mockMessages[0]).toEqual({
            text: expect.stringContaining('Internal Error: context.dispatch is missing'),
            type: 'internal_error'
        });
        expect(result).toEqual({success: false});
    });

    // --- Edge Case: ui:message_display dispatch also fails ---
    test('should still log console error and return false if ui:message_display fails', () => {
        const primaryError = new Error('Primary dispatch failed!');
        const uiError = new Error('UI dispatch failed!');
        mockDispatch.mockImplementation((eventName, payload) => {
            if (eventName === testEventName) {
                throw primaryError;
            } else if (eventName === 'ui:message_display') {
                throw uiError; // Simulate failure of the error display itself
            }
        });

        const result = dispatchEventWithCatch(mockContext, testEventName, testPayload, mockMessages, mockLogDetails);

        // Check primary dispatch attempt
        expect(mockDispatch).toHaveBeenCalledWith(testEventName, testPayload);
        // Check UI message dispatch attempt
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', expect.anything());

        // Check console error logging (should log both errors)
        expect(mockConsoleError).toHaveBeenCalledTimes(2);
        // Log for primary error
        expect(mockConsoleError).toHaveBeenCalledWith(
            expect.stringContaining(`Error dispatching event '${testEventName}'`),
            primaryError
        );
        // Log for UI error
        expect(mockConsoleError).toHaveBeenCalledWith(
            expect.stringContaining(`CRITICAL - Failed to dispatch ui:message_display`),
            uiError
        );

        // Check messages array mutation (only the internal error for the primary failure)
        expect(mockMessages).toHaveLength(1);
        expect(mockMessages[0].text).toContain(mockLogDetails.errorInternal);
        expect(mockMessages[0].details).toBe(primaryError);

        // Check return value
        expect(result).toEqual({success: false});
    });

}); // End describe('dispatchEventWithCatch')
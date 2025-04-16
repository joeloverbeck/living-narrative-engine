// src/tests/actions/handlers/openActionHandler.test.js

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// --- Function Under Test ---
import { executeOpen } from '../../../actions/handlers/openActionHandler.js'; // Adjust path

// --- Mocked Dependencies ---
import * as actionExecutionUtils from '../../../actions/actionExecutionUtils.js';
import * as messagesUtils from '../../../utils/messages.js';
import OpenableComponent from '../../../components/openableComponent.js'; // Adjust path
import Entity from '../../../entities/entity.js'; // Adjust path - Assuming a basic Entity class/mock exists
import { NameComponent } from '../../../components/nameComponent.js'; // Needed for getDisplayName mock setup

// Mock the entire modules containing the dependencies
jest.mock('../../../actions/actionExecutionUtils.js');
jest.mock('../../../utils/messages.js');
// Mock the component class directly if needed for specific checks, otherwise module mock might suffice
// jest.mock('../../../components/openableComponent.js');
jest.mock('../../../entities/entity.js'); // Mock the Entity class itself if it has complex constructor logic

// --- Mock Implementations & Test Setup ---

// Provide mock implementations for the mocked functions
const mockHandleActionWithTargetResolution = actionExecutionUtils.handleActionWithTargetResolution;
const mockDispatchEventWithCatch = actionExecutionUtils.dispatchEventWithCatch;
const mockGetDisplayName = messagesUtils.getDisplayName;

// Mock TARGET_MESSAGES object
// Ensure all keys used by executeOpen and its callbacks are present
messagesUtils.TARGET_MESSAGES = {
    INTERNAL_ERROR: "Mock Internal Error.",
    NOT_FOUND_OPENABLE: jest.fn((name) => `Mock: Cannot find openable '${name}'.`),
    FILTER_EMPTY_OPENABLE: jest.fn((verb, scope) => `Mock: Nothing ${scope} to ${verb}.`),
    // Add any other potentially used messages if needed, e.g., AMBIGUOUS_PROMPT though default is likely used
    AMBIGUOUS_PROMPT: jest.fn((verb, name, candidates) => `Mock: Which '${name}' to ${verb}?`),
};

// Helper to create mock entities
const createMockEntity = (id, name = 'Mock Entity') => {
    const entity = new Entity(id); // Use the (mocked) Entity constructor
    entity.id = id; // Ensure ID is set even if constructor is mocked simply

    // Mock essential methods used directly or indirectly by executeOpen/onFoundUnique
    entity.getComponent = jest.fn((ComponentClass) => {
        if (ComponentClass === NameComponent || ComponentClass.name === 'NameComponent') {
            // Simulate having a NameComponent for getDisplayName
            return { value: name };
        }
        // Simulate having OpenableComponent if needed for mock resolution logic
        if (ComponentClass === OpenableComponent || ComponentClass.name === 'OpenableComponent') {
            return new OpenableComponent({ isOpen: false }); // Return an instance
        }
        return undefined;
    });
    // Mock hasComponent if required by handleActionWithTargetResolution mock logic
    entity.hasComponent = jest.fn((ComponentClass) => {
        return (ComponentClass === NameComponent || ComponentClass.name === 'NameComponent' ||
            ComponentClass === OpenableComponent || ComponentClass.name === 'OpenableComponent');
    });
    return entity;
};


// Helper to create mock ActionContext
const createMockContext = (directObjectPhrase = 'door') => {
    const mockPlayer = createMockEntity('player1', 'Player');
    const mockDispatch = jest.fn();
    return {
        playerEntity: mockPlayer,
        currentLocation: createMockEntity('loc1', 'Room'),
        parsedCommand: {
            actionId: 'core:open',
            directObjectPhrase: directObjectPhrase,
            preposition: null,
            indirectObjectPhrase: null,
            originalInput: `open ${directObjectPhrase}`,
            error: null,
        },
        dataManager: {}, // Mock if needed
        entityManager: { // Mock if needed by dependencies (like getDisplayName potentially)
            getEntityInstance: jest.fn(id => createMockEntity(id)) // Simple mock
        },
        dispatch: mockDispatch,
        eventBus: { dispatch: mockDispatch }, // Include if ActionContext structure requires it
    };
};

// --- Test Suite ---

describe('executeOpen', () => {
    let mockContext;
    let mockTargetEntity;

    // --- Variables to control mock behavior ---
    let simulateResolutionStatus; // 'FOUND_UNIQUE', 'NOT_FOUND', 'AMBIGUOUS', 'FILTER_EMPTY', 'INVALID_INPUT'
    let simulateDispatchSuccess; // true or false

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Create entities needed for tests
        mockTargetEntity = createMockEntity('targetDoor', 'Old Door');

        // Create a default context
        mockContext = createMockContext('Old Door');

        // --- Configure Mock Behavior ---
        // Default successful behavior
        simulateResolutionStatus = 'FOUND_UNIQUE';
        simulateDispatchSuccess = true;

        // Default mock return for getDisplayName
        mockGetDisplayName.mockReturnValue('Mock Target Display Name');

        // Default mock return for dispatchEventWithCatch
        mockDispatchEventWithCatch.mockImplementation(() => {
            return { success: simulateDispatchSuccess };
        });

        // *** The core mock for handleActionWithTargetResolution ***
        mockHandleActionWithTargetResolution.mockImplementation(async (context, options) => {
            // Capture options for verification later (optional but good practice)
            // const capturedOptions = options;

            switch (simulateResolutionStatus) {
                case 'FOUND_UNIQUE': {
                    // Simulate finding the unique target
                    const target = mockTargetEntity; // Use the predefined mock target
                    const mockMessagesArray = []; // Simulate internal messages array

                    // *** CRITICAL: Invoke the actual onFoundUnique callback provided in options ***
                    console.log(">>> MOCK handleAction: About to call options.onFoundUnique"); // <--- Add log
                    const callbackResult = await options.onFoundUnique(context, target, mockMessagesArray);
                    console.log(">>> MOCK handleAction: Returned from options.onFoundUnique"); // <--- Add log

                    // Return a result mimicking the utility's success case
                    return {
                        // Result success depends on the callback's success (which depends on dispatchEventWithCatch)
                        success: callbackResult.success,
                        // Combine internal messages (if any simulated) with callback messages
                        messages: mockMessagesArray.concat(callbackResult.messages || []),
                        newState: callbackResult.newState, // Pass through newState if callback provides it
                    };
                }
                case 'NOT_FOUND':
                    return { success: false, messages: [{ text: 'Mock: Target not found', type: 'internal' }], newState: undefined };
                case 'AMBIGUOUS':
                    return { success: false, messages: [{ text: 'Mock: Target ambiguous', type: 'internal' }], newState: undefined };
                case 'FILTER_EMPTY':
                    return { success: false, messages: [{ text: 'Mock: Filter empty', type: 'internal' }], newState: undefined };
                case 'INVALID_INPUT': // e.g., Validation failed internally
                    return { success: false, messages: [{ text: 'Mock: Invalid input/validation failed', type: 'internal' }], newState: undefined };
                default:
                    throw new Error(`Unhandled simulateResolutionStatus in mock: ${simulateResolutionStatus}`);
            }
        });
    }); // End beforeEach

    // --- Test Cases ---

    describe('7.2. Failure Path: dispatchEventWithCatch Fails within onFoundUnique', () => {
        it('should return success: false when event dispatch fails', async () => {
            // Arrange
            simulateResolutionStatus = 'FOUND_UNIQUE'; // Resolution succeeds
            simulateDispatchSuccess = false; // Dispatch fails

            // Act
            const result = await executeOpen(mockContext);

            // Assert
            // 1. Verify handleActionWithTargetResolution still called correctly
            expect(mockHandleActionWithTargetResolution).toHaveBeenCalledTimes(1);
            const passedOptions = mockHandleActionWithTargetResolution.mock.calls[0][1];
            expect(passedOptions.onFoundUnique).toBeInstanceOf(Function); // Ensure callback was passed

            // 2. Verify onFoundUnique internals were still attempted
            expect(mockGetDisplayName).toHaveBeenCalledWith(mockTargetEntity);
            expect(mockDispatchEventWithCatch).toHaveBeenCalledTimes(1); // Dispatch was attempted

            // 3. Verify overall result reflects the dispatch failure
            expect(result.success).toBe(false);
            expect(result.messages).toBeDefined();
            expect(result.newState).toBeUndefined();
        });
    });

    describe('7.3. Failure Path: handleActionWithTargetResolution Fails (Not Found)', () => {
        it('should return failure without calling onFoundUnique when target is not found', async () => {
            // Arrange
            simulateResolutionStatus = 'NOT_FOUND';

            // Act
            const result = await executeOpen(mockContext);

            // Assert
            // 1. Verify handleActionWithTargetResolution called
            expect(mockHandleActionWithTargetResolution).toHaveBeenCalledTimes(1);
            expect(mockHandleActionWithTargetResolution).toHaveBeenCalledWith(mockContext, expect.objectContaining({
                actionVerb: 'open',
                commandPart: 'directObjectPhrase',
                // ... other options
            }));

            // 2. Verify onFoundUnique dependencies were NOT called
            expect(mockGetDisplayName).not.toHaveBeenCalled();
            expect(mockDispatchEventWithCatch).not.toHaveBeenCalled();

            // 3. Verify overall result reflects the resolution failure
            expect(result.success).toBe(false);
            expect(result.messages).toEqual([{ text: 'Mock: Target not found', type: 'internal' }]); // Matches mock failure message
            expect(result.newState).toBeUndefined();
        });
    });

    describe('7.4. Failure Path: handleActionWithTargetResolution Fails (Ambiguous)', () => {
        it('should return failure without calling onFoundUnique when target is ambiguous', async () => {
            // Arrange
            simulateResolutionStatus = 'AMBIGUOUS';

            // Act
            const result = await executeOpen(mockContext);

            // Assert
            expect(mockHandleActionWithTargetResolution).toHaveBeenCalledTimes(1);
            expect(mockGetDisplayName).not.toHaveBeenCalled();
            expect(mockDispatchEventWithCatch).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.messages).toEqual([{ text: 'Mock: Target ambiguous', type: 'internal' }]);
            expect(result.newState).toBeUndefined();
        });
    });

    describe('7.5. Failure Path: handleActionWithTargetResolution Fails (Filter Empty)', () => {
        it('should return failure without calling onFoundUnique when filter results in empty set', async () => {
            // Arrange
            simulateResolutionStatus = 'FILTER_EMPTY';

            // Act
            const result = await executeOpen(mockContext);

            // Assert
            expect(mockHandleActionWithTargetResolution).toHaveBeenCalledTimes(1);
            expect(mockGetDisplayName).not.toHaveBeenCalled();
            expect(mockDispatchEventWithCatch).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.messages).toEqual([{ text: 'Mock: Filter empty', type: 'internal' }]);
            expect(result.newState).toBeUndefined();
        });
    });

    describe('7.6. Edge Case: Missing directObjectPhrase in Command', () => {
        it('should rely on handleActionWithTargetResolution to handle missing input and return failure', async () => {
            // Arrange
            mockContext = createMockContext(null); // Set directObjectPhrase to null
            simulateResolutionStatus = 'INVALID_INPUT'; // Simulate validation failure inside the utility

            // Act
            const result = await executeOpen(mockContext);

            // Assert
            // 1. Verify handleActionWithTargetResolution was still called (it handles the validation)
            expect(mockHandleActionWithTargetResolution).toHaveBeenCalledTimes(1);
            expect(mockHandleActionWithTargetResolution).toHaveBeenCalledWith(mockContext, expect.any(Object)); // Options still passed

            // 2. Verify onFoundUnique dependencies were NOT called
            expect(mockGetDisplayName).not.toHaveBeenCalled();
            expect(mockDispatchEventWithCatch).not.toHaveBeenCalled();

            // 3. Verify overall result reflects the (simulated) validation failure
            expect(result.success).toBe(false);
            expect(result.messages).toEqual([{ text: 'Mock: Invalid input/validation failed', type: 'internal' }]);
            expect(result.newState).toBeUndefined();
        });
    });

}); // End describe('executeOpen')
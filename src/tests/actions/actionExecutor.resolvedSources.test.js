// src/actions/actionExecutor.resolvedSources.test.js

import {beforeEach, describe, expect, jest, test} from "@jest/globals";

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js';

import {ResolutionStatus} from '../../services/targetResolutionService.js'; // Import enum

// Import types for JSDoc
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/actionValidationService.js').ActionTargetContext} ActionTargetContext */

// Mock dependencies
const mockGameDataRepository = {
    getAction: jest.fn(),
};
const mockTargetResolutionService = {
    resolveActionTarget: jest.fn(),
};
const mockActionValidationService = {
    isValid: jest.fn(),
    // Add static methods if needed for ActionTargetContext mocks if they were static factories
};
const mockEventBus = {
    dispatch: jest.fn(),
};

// Mock logger
/** @type {ILogger} */
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock components (Keep relevant ones if needed, e.g., NameComponent for getDisplayName mock)
class MockNameComponent {
    constructor(value) {
        this.value = value;
    }
}


// Mock getDisplayName - ActionExecutor imports it directly
// We need to mock the module './utils/messages.js' if using ES modules
// Or ensure it's injectable/mockable. Assuming module mocking:
// Import the actual getDisplayName to mock its module
import {getDisplayName as originalGetDisplayName} from '../../utils/messages.js';
import PayloadValueResolverService from "../../services/payloadValueResolverService.js";

jest.mock('../../utils/messages.js', () => ({
    // Use jest.fn().mockImplementation for more control if needed,
    // but this simple mock covers the fallback logic described
    getDisplayName: jest.fn((entity) => {
        if (!entity) return 'mock unknown';
        // Simulate getting NameComponent.value or falling back to ID
        const nameComp = entity.getComponent(MockNameComponent);
        return nameComp?.value ?? entity.id ?? 'mock unknown';
    }),
    // Keep other exports if the module has them and they're needed elsewhere
    TARGET_MESSAGES: {}, // Mock other exports as needed
}));

// Explicitly type the mock after mocking the module
/** @type {jest.MockedFunction<typeof originalGetDisplayName>} */
const mockGetDisplayName = jest.requireMock('../../utils/messages.js').getDisplayName;

// Factory function remains the same
const payloadValueResolverService = (logger = mockLogger) => {
    return new PayloadValueResolverService({logger});
}

// Corrected helper to create the executor
const createExecutor = (logger = mockLogger) => {
    // <<< --- FIX: Create an INSTANCE of the service first --- >>>
    const resolverServiceInstance = payloadValueResolverService(logger);

    return new ActionExecutor({
        gameDataRepository: mockGameDataRepository,
        targetResolutionService: mockTargetResolutionService,
        actionValidationService: mockActionValidationService,
        eventBus: mockEventBus,
        logger: logger,
        payloadValueResolverService: resolverServiceInstance
    });
};

// Helper to create baseline mock objects
const createMockActionContext = (overrides = {}) => {
    // Base player entity setup used across tests unless overridden
    const player = new Entity('player1');

    const location = new Entity('room1');
    location.mockName = 'The Room'; // Used for context.* tests later

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: player,
        currentLocation: location,
        entityManager: {
            componentRegistry: {
                // Mock getComponent for name/ID resolution if needed, but not essential for resolved.*
                get: jest.fn((name) => {
                    if (name === 'NameComponent') return MockNameComponent;
                    return undefined;
                }),
            },
            getEntityInstance: jest.fn((id) => {
                if (id === 'player1') return player;
                if (id === 'room1') return location;
                // For resolved.* tests, we usually don't need to resolve entities here,
                // as the data comes from resolutionResult or context directly.
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: {
            actionId: 'test:action',
            directObjectPhrase: null, // Default, override as needed
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'do test action',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch, // Ensure dispatch function is available
        ...overrides, // Apply specific overrides for the test case
    };

    // --- Fix: Ensure parsedCommand exists even if overridden ---
    if (overrides.parsedCommand === null) {
        baseContext.parsedCommand = null;
    } else if (overrides.parsedCommand) {
        baseContext.parsedCommand = {
            ...baseContext.parsedCommand,
            ...overrides.parsedCommand
        };
    }
    // --- End Fix ---

    return baseContext;
};

/**
 * @param {ResolutionStatus} status
 * @param {object} overrides
 * @returns {TargetResolutionResult}
 */
const createMockResolutionResult = (status, overrides = {}) => {
    // Default successful resolution for 'none' domain to reach validation/dispatch
    const baseResult = {
        status: status,
        targetType: 'none',
        targetId: null,
        targetEntity: null,
        targetConnectionEntity: null, // Mock this in tests as needed
        candidateIds: [],
        details: null, // Mock this in tests as needed
        error: null,
        ...overrides,
    };
    return baseResult;
};

/**
 * @param {object} overrides
 * @returns {ActionDefinition}
 */
const createMockActionDefinition = (overrides = {}) => {
    /** @type {ActionDefinition} */
    const baseDefinition = {
        id: 'test:action',
        target_domain: 'direction', // Default to direction for resolved.* tests, can override
        template: 'do the test action {direction}',
        dispatch_event: { // Assume event dispatch for indirect testing
            eventName: 'test:event_dispatched',
            payload: {}, // Payload will be set per test case
        },
        ...overrides, // Apply specific overrides for the test case
    };
    return baseDefinition;
};


// --- Test Suite ---

describe('ActionExecutor', () => {
    let executor;
    let mockContext; // Will be reset in beforeEach
    let mockActionDef; // Default action definition

    beforeEach(() => {
        jest.clearAllMocks();
        executor = createExecutor(mockLogger);
        mockContext = createMockActionContext(); // Create default context for each test
        mockActionDef = createMockActionDefinition(); // Create default action def

        // --- Default Mocks for Successful Execution Path ---\n        // Assume target resolution and validation succeed by default to isolate #getValueFromSource testing\n        // IMPORTANT: Individual tests for resolved.* will override resolutionResult as needed
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
            createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'direction'}) // Default to direction type
        );
        mockActionValidationService.isValid.mockReturnValue(true);
        // mockGameDataRepository.getAction will be mocked per test with specific dispatch_event payloads
    });

    // Note: We are testing #getValueFromSource indirectly via executeAction's event payload construction
    describe('#getValueFromSource (via executeAction)', () => {

        // --- NEW TESTS FOR SUB-TASK 2.1.5.4 ---
        describe('resolved. Sources', () => {
            const payloadKey = 'resolvedValue';

            // --- resolved.direction ---
            describe('resolved.direction', () => {
                const sourceString = 'resolved.direction';

                test('should return directObjectPhrase when targetType is "direction" and phrase exists', async () => {
                    const direction = 'north';
                    // Provide the required phrase
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: direction}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction'
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_dir_ok',
                        dispatch_event: {
                            eventName: 'test:event_resolved_dir_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: direction})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should log warn and return undefined if targetType is not "direction"', async () => {
                    const direction = 'north'; // Phrase exists but type is wrong
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: direction}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'entity', // Wrong type
                        targetId: 'someEntity',
                        targetEntity: new Entity('someEntity')
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_dir_wrong_type',
                        dispatch_event: {
                            eventName: 'test:event_resolved_dir_wrong_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'resolved.direction' source '${sourceString}' for action '${actionDef.id}'. Target type is 'entity', not 'direction'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                // --- Test case adjusted ---
                test('should log error and return failure when targetType is "direction" but directObjectPhrase is null', async () => {
                    // Context has null directObjectPhrase by default
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: null} // Explicitly null
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction'
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_dir_null_phrase',
                        dispatch_event: {
                            eventName: 'test:event_resolved_dir_null_phrase',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    // Execute the action
                    const result = await executor.executeAction(actionDef.id, mockContext);

                    // Assertions: Check for the specific error during context construction
                    expect(result.success).toBe(false);
                    expect(result.messages).toEqual(expect.arrayContaining([
                        expect.objectContaining({
                            text: "An internal error occurred while processing the command.",
                            type: 'error'
                        })
                    ]));
                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Helper #buildValidationTargetContext: Error constructing ActionTargetContext for action \'${actionDef.id}\':`),
                        expect.any(Error) // Check that an Error object was logged
                    );
                    // Check the error message itself
                    const loggedError = mockLogger.error.mock.calls[0][1]; // Get the second argument of the first call
                    expect(loggedError.message).toContain("Target type is 'direction' but direction name missing from parsed command.");

                    // Should not reach event dispatch or value source logic
                    expect(mockEventBus.dispatch).not.toHaveBeenCalled();
                    expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected here
                });
            });

            // --- resolved.connection.id ---
            describe('resolved.connection.id', () => {
                const sourceString = 'resolved.connection.id';

                test('should return targetConnectionEntity.id when targetType is "direction" and connection entity exists', async () => {
                    const connectionId = 'conn_entity_123';
                    const mockConnectionEntity = new Entity(connectionId);
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        targetConnectionEntity: mockConnectionEntity,
                        targetId: 'should_be_ignored' // Target ID should be ignored if entity present
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_id_entity',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_id_entity',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: connectionId})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return resolutionResult.targetId when targetType is "direction" and connection entity is null but targetId exists', async () => {
                    const fallbackId = 'conn_fallback_id_456';
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'south'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        targetConnectionEntity: null, // No entity
                        targetId: fallbackId // Fallback ID
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_id_fallback',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_id_fallback',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: fallbackId})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return undefined when targetType is "direction" but connection entity and targetId are null', async () => {
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'east'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        targetConnectionEntity: null, // No entity
                        targetId: null // No fallback ID
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_id_missing',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_id_missing',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    // No warning expected, just returns undefined
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn and return undefined if targetType is not "direction"', async () => {
                    // Provide a phrase, although it won't be used due to wrong type
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'irrelevant'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'entity', // Wrong type
                        targetId: 'someEntity',
                        targetEntity: new Entity('someEntity')
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_id_wrong_type',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_id_wrong_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'resolved.connection.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'entity', not 'direction'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });
            });

            // --- resolved.connection.targetLocationId ---
            describe('resolved.connection.targetLocationId', () => {
                const sourceString = 'resolved.connection.targetLocationId';

                test('should return targetLocationId from details when targetType is "direction" and details exist', async () => {
                    const locationId = 'loc_exit_hallway';
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: {targetLocationId: locationId, blockerEntityId: null} // Details present
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_loc_ok',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_loc_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: locationId})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return undefined when targetType is "direction" but details object is empty', async () => {
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'south'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: {} // Empty details
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_loc_empty_details',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_loc_empty_details',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should return undefined when targetType is "direction" but details is null', async () => {
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'east'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: null // Null details
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_loc_null_details',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_loc_null_details',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn and return undefined if targetType is not "direction"', async () => {
                    // Provide a phrase, although it won't be used due to wrong type
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'irrelevant'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'entity', // Wrong type
                        targetId: 'someEntity',
                        targetEntity: new Entity('someEntity'),
                        details: {targetLocationId: 'irrelevant'} // Add detail to check it's ignored
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_loc_wrong_type',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_loc_wrong_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'resolved.connection.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'entity', not 'direction'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });
            });

            // --- resolved.connection.blockerEntityId ---
            describe('resolved.connection.blockerEntityId', () => {
                const sourceString = 'resolved.connection.blockerEntityId';

                test('should return blockerEntityId string from details when targetType is "direction" and details exist', async () => {
                    const blockerId = 'blocker_goblin_guard';
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: {targetLocationId: 'loc_exit', blockerEntityId: blockerId} // Details present
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_blocker_ok',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_blocker_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: blockerId})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return null when targetType is "direction" and blockerEntityId in details is explicitly null', async () => {
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'south'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: {targetLocationId: 'loc_exit', blockerEntityId: null} // Explicitly null
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_blocker_null_val',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_blocker_null_val',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    // Should dispatch with the value set to null
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: null})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).not.toHaveBeenCalledWith( // Should not say "omitting"
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined`)
                    );
                });

                test('should return undefined when targetType is "direction" but blockerEntityId is missing from details', async () => {
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'east'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: {targetLocationId: 'loc_exit'} // Missing blockerEntityId
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_blocker_missing_key',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_blocker_missing_key',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should return undefined when targetType is "direction" but details is empty or null', async () => {
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'west'}
                    });
                    const resolutionResultNull = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: null
                    });
                    const resolutionResultEmpty = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction',
                        details: {}
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_blocker_no_details',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_blocker_no_details',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    // Test with null details
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResultNull);
                    await executor.executeAction(actionDef.id, mockContext);
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});

                    jest.clearAllMocks(); // Clear mocks between checks

                    // Test with empty details
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResultEmpty);
                    await executor.executeAction(actionDef.id, mockContext);
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn and return undefined if targetType is not "direction"', async () => {
                    // Provide a phrase, although it won't be used due to wrong type
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'irrelevant'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'entity', // Wrong type
                        targetId: 'someEntity',
                        targetEntity: new Entity('someEntity'),
                        details: {blockerEntityId: 'irrelevant_blocker'} // Add detail to check it's ignored
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_blocker_wrong_type',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_blocker_wrong_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'resolved.connection.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'entity', not 'direction'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });
            });

            // --- Malformed resolved.* Strings ---
            describe('Malformed resolved.* Strings', () => {

                test('should log warn for "resolved.connection.foo" (unknown connection field) and omit field', async () => {
                    const sourceString = 'resolved.connection.foo';
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction', // Ensure correct type for check to proceed
                        details: {}
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_unknown',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_unknown',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'resolved.connection' field 'foo' in source '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "resolved.foo" (unknown resolved field) and omit field', async () => {
                    const sourceString = 'resolved.foo';
                    // --- Fix: Add directObjectPhrase (although type doesn't strictly matter for this error) ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction' // Arbitrary type, doesn't matter here
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_unknown_field',
                        dispatch_event: {
                            eventName: 'test:event_resolved_unknown_field',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'resolved' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "resolved." (incomplete string) and omit field', async () => {
                    // "resolved." splits into ['resolved', ''] - should trigger the length < 2 check
                    const sourceString = 'resolved.';
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction'
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_dot',
                        dispatch_event: {
                            eventName: 'test:event_resolved_dot',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    // This now triggers the general "Unhandled 'resolved'" warning because length >= 2
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'resolved' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "resolved" (incomplete string) and omit field', async () => {
                    const sourceString = 'resolved'; // Too short
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction'
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_short',
                        dispatch_event: {
                            eventName: 'test:event_resolved_short',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Malformed 'resolved' source string '${sourceString}' for action '${actionDef.id}'. Requires at least 'resolved.<field>'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "resolved.connection" (incomplete connection string) and omit field', async () => {
                    const sourceString = 'resolved.connection'; // Too short
                    // --- Fix: Add directObjectPhrase ---
                    mockContext = createMockActionContext({
                        parsedCommand: {directObjectPhrase: 'north'}
                    });
                    const resolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                        targetType: 'direction', // Ensure correct type
                        details: {}
                    });
                    const actionDef = createMockActionDefinition({
                        id: 'test:resolved_conn_short',
                        dispatch_event: {
                            eventName: 'test:event_resolved_conn_short',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(resolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    // Should trigger the general "Unhandled 'resolved' format" warning
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'resolved' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

            });

        }); // End resolved. Sources

    }); // end describe #getValueFromSource (via executeAction)

}); // end describe ActionExecutor
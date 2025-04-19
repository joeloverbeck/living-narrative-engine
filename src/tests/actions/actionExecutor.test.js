// src/actions/actionExecutor.test.js

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

// Mock components
class MockComponentA {
    constructor() {
        this.value = 'ComponentA_Value';
        this.numericValue = 123;
    }
}

class MockComponentB {
    constructor() {
        this.otherValue = 100;
        this.boolValue = false;
    }
}

class MockNameComponent {
    constructor(value) {
        this.value = value;
    }
}

class MockStatsComponent {
    constructor() {
        this.strength = 10;
        this.agility = 5;
    }
}

// --- NEW MOCK COMPONENT FOR TARGET TESTS ---
class MockHealthComponent {
    constructor(current, max) {
        this.current = current;
        this.max = max;
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


// Helper to create a basic ActionExecutor instance
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
    // Note: We don't add MockNameComponent by default to test fallback logic easily
    player.addComponent(new MockComponentA()); // Add ComponentA by default

    const location = new Entity('room1');
    location.mockName = 'The Room'; // Used for context.* tests later

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: player,
        currentLocation: location,
        entityManager: {
            componentRegistry: {
                get: jest.fn((name) => {
                    // Return mock classes based on string name
                    if (name === 'ComponentA') return MockComponentA;
                    if (name === 'ComponentB') return MockComponentB;
                    if (name === 'NameComponent') return MockNameComponent;
                    if (name === 'StatsComponent') return MockStatsComponent;
                    if (name === 'HealthComponent') return MockHealthComponent; // <-- Added
                    // Return undefined for unknown component names
                    return undefined;
                }),
            },
            getEntityInstance: jest.fn((id) => {
                if (id === 'player1') return player;
                if (id === 'room1') return location;
                // Add mock entity resolution if target tests need it later
                // For target tests, we'll rely on resolutionResult.targetEntity directly,
                // so this mock doesn't need complex target resolution for now.
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: {
            actionId: 'test:action',
            directObjectPhrase: null, // Assume 'none' target domain default
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'do test action',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockEventBus.dispatch, // Ensure dispatch function is available if needed by handlers (though likely not used directly now)
        ...overrides, // Apply specific overrides for the test case
    };
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
        targetConnectionEntity: null,
        candidateIds: [],
        details: null,
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
        target_domain: 'none', // Default to none, requires no target resolution success beyond 'none'
        template: 'do the test action',
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

    beforeEach(() => {
        jest.clearAllMocks();
        executor = createExecutor(mockLogger);
        mockContext = createMockActionContext(); // Create default context for each test

        // --- Default Mocks for Successful Execution Path ---
        // Assume target resolution and validation succeed by default to isolate #getValueFromSource testing
        // NOTE: Tests for specific prefixes will override resolutionResult as needed
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
            createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
        );
        mockActionValidationService.isValid.mockReturnValue(true);
        // mockGameDataRepository.getAction will be mocked per test with specific dispatch_event payloads
    });

    // Note: We are testing #getValueFromSource indirectly via executeAction's event payload construction
    describe('#getValueFromSource (via executeAction)', () => {

        // Tests for invalid source strings (already implemented in previous task)
        describe('Invalid sourceString Inputs', () => {
            // ... tests for null, undefined, empty string ...
            test('should log error and omit payload field if sourceString is null', async () => {
                const sourceString = null;
                const actionDef = createMockActionDefinition({
                    id: 'test:invalid_null',
                    dispatch_event: {
                        eventName: 'test:event_null',
                        payload: {keyForNull: sourceString}
                    }
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);
                // Override default resolution to ensure 'none' type doesn't interfere
                mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                    createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                );

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Invalid or empty sourceString provided for action '${actionDef.id}'`),
                    expect.objectContaining({sourceString: null})
                );
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key 'keyForNull' resolved to undefined from source 'null'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            test('should log error and omit payload field if sourceString is undefined', async () => {
                const sourceString = undefined;
                const actionDef = createMockActionDefinition({
                    id: 'test:invalid_undefined',
                    dispatch_event: {
                        eventName: 'test:event_undefined',
                        payload: {keyForUndefined: sourceString}
                    }
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);
                // Override default resolution to ensure 'none' type doesn't interfere
                mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                    createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                );

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Invalid or empty sourceString provided for action '${actionDef.id}'`),
                    expect.objectContaining({sourceString: undefined})
                );
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key 'keyForUndefined' resolved to undefined from source 'undefined'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            test('should log error and omit payload field if sourceString is an empty string', async () => {
                const sourceString = '';
                const actionDef = createMockActionDefinition({
                    id: 'test:invalid_empty',
                    dispatch_event: {
                        eventName: 'test:event_empty',
                        payload: {keyForEmpty: sourceString}
                    }
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);
                // Override default resolution to ensure 'none' type doesn't interfere
                mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                    createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                );

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Invalid or empty sourceString provided for action '${actionDef.id}'`),
                    expect.objectContaining({sourceString: ''})
                );
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key 'keyForEmpty' resolved to undefined from source ''. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });
        });

        // Tests for malformed prefixes (partially implemented in previous task)
        describe('Malformed Prefixes/Strings', () => {
            // ... tests for 'foo.bar', 'literal.boolean.', 'resolved.connection.' ...
            test('should log error for unknown prefix and omit field', async () => {
                const sourceString = 'foo.bar';
                const actionDef = createMockActionDefinition({
                    id: 'test:malformed_unknown',
                    dispatch_event: {
                        eventName: 'test:event_unknown',
                        payload: {keyUnknown: sourceString}
                    }
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);
                // Override default resolution to ensure 'none' type doesn't interfere
                mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                    createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                );

                await executor.executeAction(actionDef.id, mockContext);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Unknown source prefix 'foo' in source string '${sourceString}' for action '${actionDef.id}'.`)
                );
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key 'keyUnknown' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            test('should log warn for incomplete "actor." string and omit field', async () => {
                // This test was previously failing because 'actor.' splits to ['actor', '']
                // The code correctly handles parts.length < 2 check first.
                // Let's test a different malformed actor string instead as per the new ticket.
                const sourceString = 'actor'; // String too short
                const actionDef = createMockActionDefinition({
                    id: 'test:malformed_actor_short',
                    dispatch_event: {
                        eventName: 'test:event_malformed_actor_short',
                        payload: {keyActorShort: sourceString}
                    }
                });
                mockGameDataRepository.getAction.mockReturnValue(actionDef);
                // Override default resolution to ensure 'none' type doesn't interfere
                mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                    createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                );

                await executor.executeAction(actionDef.id, mockContext);

                // Check warn log for the specific malformed message
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Malformed 'actor' source string '${sourceString}' for action '${actionDef.id}'. Requires at least 'actor.<field>'.`)
                );
                expect(mockLogger.error).not.toHaveBeenCalled(); // Should be warn

                // Check debug log for omitting
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Payload key 'keyActorShort' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                );

                // Check event dispatch payload
                expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
            });

            // NOTE: Malformed target tests are now in actionExecutor.targetSources.test.js
        });

        // NOTE: actor. Sources tests are now in actionExecutor.actorSources.test.js

        // NOTE: target. Sources tests are now in actionExecutor.targetSources.test.js

        // Add describe blocks for other prefixes (resolved, context, parsed, literal) in subsequent tickets

    }); // end describe #getValueFromSource (via executeAction)

}); // end describe ActionExecutor
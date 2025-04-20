// src/actions/actionExecutor.actorSources.test.js

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
const mockValidatedDispatcher = {
    // Mock the method used by ActionExecutor.
    // .mockResolvedValue(true) assumes successful dispatch by default for most tests.
    // You can override this in specific tests if needed.
    dispatchValidated: jest.fn().mockResolvedValue(true),
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
        eventBus: mockEventBus, // Keep if still needed elsewhere or by dispatcher internally
        logger: logger,
        payloadValueResolverService: resolverServiceInstance,
        validatedDispatcher: mockValidatedDispatcher // <<< --- ADD THIS LINE --- >>>
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
        dispatch: mockValidatedDispatcher.dispatchValidated, // Ensure dispatch function is available if needed by handlers (though likely not used directly now)
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

        // --- Tests for actor. Sources (from previous ticket) ---
        describe('actor. Sources', () => {

            // --- actor.id ---
            describe('actor.id', () => {
                const sourceString = 'actor.id';
                const payloadKey = 'actorId';

                test('should return the correct actor entity ID', async () => {
                    const actorId = 'playerTestId';
                    const context = createMockActionContext({playerEntity: new Entity(actorId)});
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_id_ok',
                        dispatch_event: {eventName: 'test:event_actor_id_ok', payload: {[payloadKey]: sourceString}}
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: actorId}) // Check payload has the correct ID
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                });

                test('should log error and return undefined if playerEntity is null', async () => {
                    const context = createMockActionContext({playerEntity: null}); // Null player
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_id_null_player',
                        dispatch_event: {
                            eventName: 'test:event_actor_id_null_player',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Payload should be empty
                    );
                });

                test('should log error and return undefined if playerEntity is undefined', async () => {
                    const context = createMockActionContext({playerEntity: undefined}); // Undefined player
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_id_undef_player',
                        dispatch_event: {
                            eventName: 'test:event_actor_id_undef_player',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Payload should be empty
                    );
                });
            });

            // --- actor.name ---
            describe('actor.name', () => {
                const sourceString = 'actor.name';
                const payloadKey = 'actorName';

                test('should return name from NameComponent if present', async () => {
                    const actorName = 'SpecificPlayerName';
                    const actorId = 'playerWithName';
                    const player = new Entity(actorId);
                    player.addComponent(new MockNameComponent(actorName)); // Add NameComponent
                    const context = createMockActionContext({playerEntity: player});
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_name_comp',
                        dispatch_event: {eventName: 'test:event_actor_name_comp', payload: {[payloadKey]: sourceString}}
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    // Configure the mock getDisplayName to use the component value
                    // (Note: The mock setup in beforeEach already does this)

                    await executor.executeAction(actionDef.id, context);

                    expect(mockGetDisplayName).toHaveBeenCalledWith(player);
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: actorName})
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                });

                test('should return actor ID if NameComponent is absent', async () => {
                    // Default mockContext uses player 'player1' without MockNameComponent
                    const context = createMockActionContext(); // Use default context
                    const expectedFallbackName = context.playerEntity.id; // 'player1'
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_name_fallback',
                        dispatch_event: {
                            eventName: 'test:event_actor_name_fallback',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    // Ensure getDisplayName mock is called and uses fallback logic
                    // (The mock setup in beforeEach already handles this)

                    await executor.executeAction(actionDef.id, context);

                    expect(mockGetDisplayName).toHaveBeenCalledWith(context.playerEntity);
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: expectedFallbackName})
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                });

                test('should log error and return undefined if playerEntity is null', async () => {
                    const context = createMockActionContext({playerEntity: null});
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_name_null_player',
                        dispatch_event: {
                            eventName: 'test:event_actor_name_null_player',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should log error and return undefined if playerEntity is undefined', async () => {
                    const context = createMockActionContext({playerEntity: undefined});
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_name_undef_player',
                        dispatch_event: {
                            eventName: 'test:event_actor_name_undef_player',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });
            });

            // --- actor.component.<CompName>.<prop> ---
            describe('actor.component.<CompName>.<prop>', () => {
                const compName = 'ComponentA';
                const propName = 'value';
                const sourceString = `actor.component.${compName}.${propName}`;
                const payloadKey = 'compValue';

                test('should return correct property value if component and property exist', async () => {
                    // Default mockContext.playerEntity has MockComponentA with value 'ComponentA_Value'
                    const context = createMockActionContext();
                    const expectedValue = context.playerEntity.getComponent(MockComponentA).value;
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_comp_prop_ok',
                        dispatch_event: {
                            eventName: 'test:event_actor_comp_prop_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: expectedValue})
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                });

                test('should log warn and return undefined if property does not exist on component', async () => {
                    const missingPropName = 'nonExistentProperty';
                    const sourceStringMissing = `actor.component.${compName}.${missingPropName}`;
                    const context = createMockActionContext(); // Has ComponentA
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_comp_prop_missing',
                        dispatch_event: {
                            eventName: 'test:event_actor_comp_prop_missing',
                            payload: {[payloadKey]: sourceStringMissing}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Property '${missingPropName}' not found on component '${compName}' for source '${sourceStringMissing}' on actor ${context.playerEntity.id}`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should return undefined if component instance is not present on actor', async () => {
                    const missingCompName = 'ComponentB'; // Player doesn't have ComponentB by default
                    const sourceStringMissingComp = `actor.component.${missingCompName}.otherValue`;
                    const context = createMockActionContext();
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_comp_inst_missing',
                        dispatch_event: {
                            eventName: 'test:event_actor_comp_inst_missing',
                            payload: {[payloadKey]: sourceStringMissingComp}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    // No specific log expected for missing component instance, returns undefined gracefully
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should log warn and return undefined if component class is not found in registry', async () => {
                    const unknownCompName = 'UnknownComponent';
                    const sourceStringUnknownComp = `actor.component.${unknownCompName}.someProp`;
                    const context = createMockActionContext();
                    // Ensure the registry mock returns undefined for UnknownComponent
                    context.entityManager.componentRegistry.get.mockImplementation((name) => {
                        if (name === 'ComponentA') return MockComponentA;
                        // --- Add other known components here if context factory changes ---
                        // if (name === 'ComponentB') return MockComponentB;
                        // if (name === 'NameComponent') return MockNameComponent;
                        // if (name === 'StatsComponent') return MockStatsComponent;
                        // if (name === 'HealthComponent') return MockHealthComponent;
                        return undefined; // Explicitly return undefined for others
                    });

                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_comp_class_missing',
                        dispatch_event: {
                            eventName: 'test:event_actor_comp_class_missing',
                            payload: {[payloadKey]: sourceStringUnknownComp}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(context.entityManager.componentRegistry.get).toHaveBeenCalledWith(unknownCompName);
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Could not find component class '${unknownCompName}' in registry for source '${sourceStringUnknownComp}'`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should log error and return undefined if playerEntity is null', async () => {
                    const context = createMockActionContext({playerEntity: null});
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_comp_null_player',
                        dispatch_event: {
                            eventName: 'test:event_actor_comp_null_player',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should log error and return undefined if playerEntity is undefined', async () => {
                    const context = createMockActionContext({playerEntity: undefined});
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_comp_undef_player',
                        dispatch_event: {
                            eventName: 'test:event_actor_comp_undef_player',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });
            });

            // --- Malformed actor.* Strings ---
            describe('Malformed actor.* Strings', () => {

                test('should log warn for "actor.component.CompName" (missing property) and omit field', async () => {
                    const sourceString = 'actor.component.StatsComponent'; // Missing property part
                    const payloadKey = 'malformedComp';
                    const context = createMockActionContext();
                    context.playerEntity.addComponent(new MockStatsComponent()); // Ensure component exists
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_comp_missing_prop',
                        dispatch_event: {
                            eventName: 'test:event_actor_comp_missing_prop',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'actor' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should log warn for "actor.foo" (unknown field) and omit field', async () => {
                    const sourceString = 'actor.foo'; // Unknown field 'foo'
                    const payloadKey = 'malformedField';
                    const context = createMockActionContext();
                    const actionDef = createMockActionDefinition({
                        id: 'test:actor_unknown_field',
                        dispatch_event: {
                            eventName: 'test:event_actor_unknown_field',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override default resolution to ensure 'none' type doesn't interfere
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, context);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'actor' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });
            });

        }); // End actor. Sources

    }); // end describe #getValueFromSource (via executeAction)

}); // end describe ActionExecutor
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

// Helper to map mock component classes to their intended string IDs
// (Adjust these IDs if they differ in your actual component registration)
const mockComponentTypeIds = {
    [MockComponentA.name]: 'ComponentA', // e.g., 'ComponentA'
    [MockComponentB.name]: 'ComponentB', // e.g., 'ComponentB'
    [MockNameComponent.name]: 'NameComponent', // e.g., 'NameComponent'
    [MockStatsComponent.name]: 'StatsComponent', // e.g., 'StatsComponent'
    [MockHealthComponent.name]: 'HealthComponent', // e.g., 'HealthComponent'
};


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
        // Simulate getting NameComponent data OR falling back to ID
        // NOTE: Assumes Entity has getComponentData(stringId) based on Entity.js provided
        const nameCompData = entity.getComponentData(mockComponentTypeIds.MockNameComponent);
        return nameCompData?.value ?? entity.id ?? 'mock unknown';
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

    // --- FIX: Call addComponent correctly ---
    // Provide the string type ID FIRST, then the data/instance.
    const componentAInstance = new MockComponentA();
    player.addComponent(mockComponentTypeIds.MockComponentA, componentAInstance); // Corrected call

    const location = new Entity('room1');
    // Optional: Add NameComponent to location for testing context.* sources later
    // location.addComponent(mockComponentTypeIds.MockNameComponent, new MockNameComponent('The Room'));


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
            // Note: The provided Entity.js has getComponentData(stringId), not getComponent(Class).
            // The test code's direct calls like player.getComponent(MockComponentA)
            // might not align with the Entity.js implementation and could cause
            // issues if not mocked appropriately or if Entity.js isn't updated.
            // The mock for getDisplayName was updated to use getComponentData.
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
        dispatch: mockValidatedDispatcher.dispatchValidated, // Ensure dispatch function is available if needed by operationHandlers (though likely not used directly now)
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
                    // Create a new player entity for this specific test context
                    const testPlayer = new Entity(actorId);
                    // Add necessary components using the corrected method if needed for other parts of the test
                    testPlayer.addComponent(mockComponentTypeIds.MockComponentA, new MockComponentA()); // Example component

                    const context = createMockActionContext({playerEntity: testPlayer}); // Use the specific player

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

                    // Error should be logged by the PayloadValueResolverService when it tries to access actor
                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    // Dispatch should still happen, but the field resolved to undefined and is omitted
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Payload should be empty as the source resolved to undefined
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

                    // Error should be logged by the PayloadValueResolverService
                    expect(mockLogger.error).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'actor.*' source '${sourceString}' for action '${actionDef.id}'. Actor entity not found in context.`)
                    );
                    // Dispatch should still happen, but the field resolved to undefined and is omitted
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
                    // --- FIX: Use correct addComponent call ---
                    player.addComponent(mockComponentTypeIds.MockNameComponent, new MockNameComponent(actorName)); // Corrected call
                    player.addComponent(mockComponentTypeIds.MockComponentA, new MockComponentA()); // Add default component A if needed

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

                    // Configure the mock getDisplayName (already set up globally based on getComponentData)

                    await executor.executeAction(actionDef.id, context);

                    // Check that getDisplayName was called by the resolver service
                    expect(mockGetDisplayName).toHaveBeenCalledWith(player);
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: actorName})
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                });

                test('should return actor ID if NameComponent is absent', async () => {
                    // Default mockContext uses player 'player1' without MockNameComponent added by default
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

                    // Ensure getDisplayName mock is called and uses fallback logic (global mock handles this)

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
                const compName = 'ComponentA'; // Matches mockComponentTypeIds.MockComponentA
                const propName = 'value';
                const sourceString = `actor.component.${compName}.${propName}`;
                const payloadKey = 'compValue';

                test('should return correct property value if component and property exist', async () => {
                    // Default mockContext.playerEntity has MockComponentA added correctly in the helper now
                    const context = createMockActionContext();
                    // Retrieve the instance added in the helper to get expected value
                    const componentAInstance = context.playerEntity.getComponentData(mockComponentTypeIds.MockComponentA);
                    const expectedValue = componentAInstance.value; // 'ComponentA_Value'

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
                        expect.stringContaining(`Property '${missingPropName}' not found`) &&
                        expect.stringContaining(`component data for ID '${compName}'`) && // or just 'ComponentA'
                        expect.stringContaining(`source '${sourceStringMissing}'`) &&
                        expect.stringContaining(`actor ${context.playerEntity.id}`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Field omitted because value resolved to undefined
                    );
                });

                test('should return undefined if component instance is not present on actor', async () => {
                    const missingCompName = mockComponentTypeIds.MockComponentB; // Player doesn't have ComponentB by default
                    const sourceStringMissingComp = `actor.component.${missingCompName}.otherValue`;
                    const context = createMockActionContext(); // Does not have ComponentB
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

                    // No specific log expected just for missing component instance, returns undefined gracefully
                    expect(mockLogger.warn).toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Field omitted
                    );
                });

                // NOTE: This test depends on the componentRegistry mock setup
                test('should log warn and return undefined if component class is not found in registry', async () => {
                    const unknownCompName = 'UnknownComponent'; // This name is not in the registry mock
                    const sourceStringUnknownComp = `actor.component.${unknownCompName}.someProp`;
                    const context = createMockActionContext();
                    // Ensure the registry mock returns undefined for UnknownComponent (already handled by default mock)

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
                    // The warning is now logged by PayloadValueResolverService
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Could not find component class '${unknownCompName}' in registry for source '${sourceStringUnknownComp}'`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Field omitted
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
                    const compName = mockComponentTypeIds.MockStatsComponent; // Component exists
                    const sourceString = `actor.component.${compName}`; // Missing property part
                    const payloadKey = 'malformedComp';
                    const context = createMockActionContext();
                    // --- FIX: Add component correctly for the test premise ---
                    context.playerEntity.addComponent(mockComponentTypeIds.MockStatsComponent, new MockStatsComponent()); // Corrected call

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

                    // This specific warning is now logged by PayloadValueResolverService
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Invalid 'actor.component.*' source string format '${sourceString}'. Expected 'actor.component.<ComponentName>.<propertyName>'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Field omitted
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

                    // This warning is now logged by PayloadValueResolverService
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'actor' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {} // Field omitted
                    );
                });
            });

        }); // End actor. Sources

    }); // end describe #getValueFromSource (via executeAction)

}); // end describe ActionExecutor
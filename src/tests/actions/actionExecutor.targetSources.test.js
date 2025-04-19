// src/actions/actionExecutor.targetSources.test.js

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
        // IMPORTANT: The beforeEach within 'target. Sources' overrides this for target-specific tests.
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
            createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
        );
        mockActionValidationService.isValid.mockReturnValue(true);
        // mockGameDataRepository.getAction will be mocked per test with specific dispatch_event payloads
    });

    // Note: We are testing #getValueFromSource indirectly via executeAction's event payload construction
    describe('#getValueFromSource (via executeAction)', () => {

        // --- NEW TESTS FOR SUB-TASK 2.1.5.3 ---
        describe('target. Sources', () => {
            const payloadKey = 'targetValue';
            let mockTargetEntity;
            let mockResolutionResult;

            beforeEach(() => {
                // Default setup for successful target entity resolution
                mockTargetEntity = new Entity('target1');
                mockResolutionResult = createMockResolutionResult(
                    ResolutionStatus.FOUND_UNIQUE,
                    {
                        targetType: 'entity',
                        targetId: mockTargetEntity.id,
                        targetEntity: mockTargetEntity,
                    }
                );
                // Override the default resolution mock for these tests
                mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);
            });

            // --- target.id ---
            describe('target.id', () => {
                const sourceString = 'target.id';

                test('should return the correct target entity ID when target resolved', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_id_ok',
                        dispatch_event: {eventName: 'test:event_target_id_ok', payload: {[payloadKey]: sourceString}}
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: mockTargetEntity.id})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should log warn and return undefined if targetType is not "entity" (e.g., "direction")', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_id_wrong_type',
                        dispatch_event: {
                            eventName: 'test:event_target_id_wrong_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    // --- FIX START ---
                    // Provide the required direction name in the context for this test
                    mockContext.parsedCommand.directObjectPhrase = 'north';
                    // --- FIX END ---

                    // Override resolution result for this test
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                            targetType: 'direction',
                            targetId: 'north' // Can still be the direction name or related ID
                        })
                    );

                    await executor.executeAction(actionDef.id, mockContext); // Use the modified context

                    // Assertions should now pass
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'direction', not 'entity'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn and return undefined if targetType is "none"', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_id_none_type',
                        dispatch_event: {
                            eventName: 'test:event_target_id_none_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override resolution result for this test
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {targetType: 'none'})
                    );

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'none', not 'entity'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });


                test('should log warn and return undefined if targetType is "entity" but targetEntity is null', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_id_missing_entity',
                        dispatch_event: {
                            eventName: 'test:event_target_id_missing_entity',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Override resolution result for this test
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                            targetType: 'entity',
                            targetId: 'someIdButEntityMissing',
                            targetEntity: null // Entity is missing
                        })
                    );

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target entity not found in resolutionResult despite type 'entity'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });
            });

            // --- target.name ---
            describe('target.name', () => {
                const sourceString = 'target.name';

                test('should return name from NameComponent if present on target', async () => {
                    const targetName = 'SpecificTargetName';
                    mockTargetEntity.addComponent(new MockNameComponent(targetName));
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_name_comp',
                        dispatch_event: {
                            eventName: 'test:event_target_name_comp',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Resolution already mocked in beforeEach for target. Sources

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockGetDisplayName).toHaveBeenCalledWith(mockTargetEntity);
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: targetName})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return target ID if NameComponent is absent on target', async () => {
                    // mockTargetEntity has no NameComponent by default
                    const expectedFallbackName = mockTargetEntity.id; // 'target1'
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_name_fallback',
                        dispatch_event: {
                            eventName: 'test:event_target_name_fallback',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Resolution already mocked in beforeEach for target. Sources

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockGetDisplayName).toHaveBeenCalledWith(mockTargetEntity);
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: expectedFallbackName})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should log warn and return undefined if targetType is not "entity"', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_name_wrong_type',
                        dispatch_event: {
                            eventName: 'test:event_target_name_wrong_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    mockContext.parsedCommand.directObjectPhrase = 'north'; // <--- This was the previous fix

                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                            targetType: 'direction',
                            targetId: 'north'
                        })
                    );

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'direction', not 'entity'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                    expect(mockGetDisplayName).not.toHaveBeenCalledWith(expect.anything()); // Should not attempt to get name
                });

                test('should log warn and return undefined if targetEntity is null', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_name_missing_entity',
                        dispatch_event: {
                            eventName: 'test:event_target_name_missing_entity',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                            targetType: 'entity',
                            targetId: 'someIdButEntityMissing',
                            targetEntity: null
                        })
                    );

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target entity not found in resolutionResult despite type 'entity'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                    expect(mockGetDisplayName).not.toHaveBeenCalledWith(expect.anything()); // Should not attempt to get name
                });
            });

            // --- target.component.<CompName>.<prop> ---
            describe('target.component.<CompName>.<prop>', () => {
                const compName = 'HealthComponent';
                const propName = 'current';
                const sourceString = `target.component.${compName}.${propName}`;
                const expectedValue = 50;

                beforeEach(() => {
                    // Add HealthComponent to default mockTargetEntity
                    mockTargetEntity.addComponent(new MockHealthComponent(expectedValue, 100));
                    // Refresh resolution result mock with updated target entity
                    mockResolutionResult = createMockResolutionResult(
                        ResolutionStatus.FOUND_UNIQUE,
                        {
                            targetType: 'entity',
                            targetId: mockTargetEntity.id,
                            targetEntity: mockTargetEntity,
                        }
                    );
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);
                });

                test('should return correct property value if target, component and property exist', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_comp_prop_ok',
                        dispatch_event: {
                            eventName: 'test:event_target_comp_prop_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: expectedValue})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should log warn and return undefined if property does not exist on target component', async () => {
                    const missingPropName = 'nonExistentProp';
                    const sourceStringMissing = `target.component.${compName}.${missingPropName}`;
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_comp_prop_missing',
                        dispatch_event: {
                            eventName: 'test:event_target_comp_prop_missing',
                            payload: {[payloadKey]: sourceStringMissing}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Property '${missingPropName}' not found on component '${compName}' for source '${sourceStringMissing}' on target ${mockTargetEntity.id}`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceStringMissing}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should return undefined if component instance is not present on target', async () => {
                    const missingCompName = 'StatsComponent'; // Target doesn't have this by default
                    const sourceStringMissingComp = `target.component.${missingCompName}.strength`;
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_comp_inst_missing',
                        dispatch_event: {
                            eventName: 'test:event_target_comp_inst_missing',
                            payload: {[payloadKey]: sourceStringMissingComp}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    await executor.executeAction(actionDef.id, mockContext);

                    // No specific log expected, returns undefined gracefully
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceStringMissingComp}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should log warn and return undefined if component class is not found in registry', async () => {
                    const unknownCompName = 'UnknownTargetComp';
                    const sourceStringUnknownComp = `target.component.${unknownCompName}.value`;
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_comp_class_missing',
                        dispatch_event: {
                            eventName: 'test:event_target_comp_class_missing',
                            payload: {[payloadKey]: sourceStringUnknownComp}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Ensure registry mock returns undefined
                    mockContext.entityManager.componentRegistry.get.mockImplementation((name) => {
                        if (name === 'HealthComponent') return MockHealthComponent;
                        return undefined;
                    });

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockContext.entityManager.componentRegistry.get).toHaveBeenCalledWith(unknownCompName);
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Could not find component class '${unknownCompName}' in registry for source '${sourceStringUnknownComp}'`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceStringUnknownComp}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                        actionDef.dispatch_event.eventName,
                        {}
                    );
                });

                test('should log warn and return undefined if targetType is not "entity"', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_comp_wrong_type',
                        dispatch_event: {
                            eventName: 'test:event_target_comp_wrong_type',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);

                    mockContext.parsedCommand.directObjectPhrase = 'north'; // <--- This was the previous fix

                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                            targetType: 'direction',
                            targetId: 'north'
                        })
                    );

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'direction', not 'entity'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn and return undefined if targetEntity is null', async () => {
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_comp_missing_entity',
                        dispatch_event: {
                            eventName: 'test:event_target_comp_missing_entity',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
                        createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
                            targetType: 'entity',
                            targetId: 'someIdButEntityMissing',
                            targetEntity: null
                        })
                    );

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target entity not found in resolutionResult despite type 'entity'.`)
                    );
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });
            });


            // --- Malformed target.* Strings ---
            describe('Malformed target.* Strings', () => {
                test('should log warn for "target." (incomplete string) and omit field', async () => {
                    // NOTE: "target." splits into ['target', ''] - the code handles parts.length < 2 check
                    const sourceString = 'target.';
                    const actionDef = createMockActionDefinition({
                        id: 'test:malformed_target_dot',
                        dispatch_event: {
                            eventName: 'test:event_malformed_target_dot',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    // Ensure valid entity target for the check to proceed
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    // Expect a warning about the unhandled format
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'target' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "target.component.CompName" (missing property) and omit field', async () => {
                    const sourceString = 'target.component.HealthComponent'; // Missing property part
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_comp_missing_prop',
                        dispatch_event: {
                            eventName: 'test:event_target_comp_missing_prop',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetEntity.addComponent(new MockHealthComponent(50, 100)); // Ensure component exists on target
                    // Need to update the mockResolutionResult *within this test* because the beforeEach for the parent describe runs first
                    const updatedResolutionResult = createMockResolutionResult(
                        ResolutionStatus.FOUND_UNIQUE,
                        {
                            targetType: 'entity',
                            targetId: mockTargetEntity.id,
                            targetEntity: mockTargetEntity,
                        }
                    );
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(updatedResolutionResult);

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'target' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "target.foo" (unknown field) and omit field', async () => {
                    const sourceString = 'target.foo'; // Unknown field 'foo'
                    const actionDef = createMockActionDefinition({
                        id: 'test:target_unknown_field',
                        dispatch_event: {
                            eventName: 'test:event_target_unknown_field',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult); // Use default successful target

                    await executor.executeAction(actionDef.id, mockContext);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'target' source string format '${sourceString}' for action '${actionDef.id}'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key '${payloadKey}' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "target" (incomplete string) and omit field', async () => {
                    const sourceString = 'target'; // String too short
                    const actionDef = createMockActionDefinition({
                        id: 'test:malformed_target_short',
                        dispatch_event: {
                            eventName: 'test:event_malformed_target_short',
                            payload: {keyTargetShort: sourceString}
                        }
                    });
                    mockGameDataRepository.getAction.mockReturnValue(actionDef);
                    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult); // Use default successful target

                    await executor.executeAction(actionDef.id, mockContext);

                    // Check warn log for the specific malformed message
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Malformed 'target' source string '${sourceString}' for action '${actionDef.id}'. Requires at least 'target.<field>'.`)
                    );
                    expect(mockLogger.error).not.toHaveBeenCalled(); // Should be warn

                    // Check debug log for omitting
                    expect(mockLogger.debug).toHaveBeenCalledWith(
                        expect.stringContaining(`Payload key 'keyTargetShort' resolved to undefined from source '${sourceString}'. Omitting from payload.`)
                    );

                    // Check event dispatch payload
                    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
                    expect(mockEventBus.dispatch).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
                });
            });

        }); // End target. Sources

    }); // end describe #getValueFromSource (via executeAction)

}); // end describe ActionExecutor
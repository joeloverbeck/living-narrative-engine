// src/actions/actionExecutor.contextParsedSources.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

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
    getActionDefinition: jest.fn(),
};
const mockTargetResolutionService = {
    resolveActionTarget: jest.fn(),
};
const mockActionValidationService = {
    isValid: jest.fn(),
};
const mockEventBus = {
    dispatch: jest.fn(),
};
const mockvalidatedEventDispatcher = {
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
class MockNameComponent {
    constructor(value) {
        this.value = value;
    }
}

// Mock getDisplayName
// Import the actual getDisplayName to mock its module
import {getDisplayName as originalGetDisplayName} from '../../utils/messages.js';
import PayloadValueResolverService from '../../services/payloadValueResolverService.js';

jest.mock('../../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => {
        if (!entity) return 'mock unknown';
        const nameCompData = entity.getComponentData('NameComponent'); // Use getComponentData with string ID
        return nameCompData?.value ?? entity.id ?? 'mock unknown'; // Access .value from the data object
    }),
    TARGET_MESSAGES: {}, // Mock other exports as needed
}));

// Explicitly type the mock after mocking the module
/** @type {jest.MockedFunction<typeof originalGetDisplayName>} */
const mockGetDisplayName = jest.requireMock('../../utils/messages.js').getDisplayName;


// Factory function remains the same
const payloadValueResolverService = (logger = mockLogger) => {
    return new PayloadValueResolverService({logger});
};

// Corrected helper to create the executor
const createExecutor = (logger = mockLogger) => {
    const resolverServiceInstance = payloadValueResolverService(logger);

    return new ActionExecutor({
        gameDataRepository: mockGameDataRepository,
        targetResolutionService: mockTargetResolutionService,
        actionValidationService: mockActionValidationService,
        eventBus: mockEventBus, // Keep if still needed elsewhere or by dispatcher internally
        logger: logger,
        payloadValueResolverService: resolverServiceInstance,
        validatedEventDispatcher: mockvalidatedEventDispatcher // <<< --- ADD THIS LINE --- >>>
    });
};

// Helper to create baseline mock objects
/**
 * Creates a mock ActionContext.
 * @param {object} [overrides] - Properties to override in the default context.
 * @param {Entity | null} [overrides.currentLocation] - Override currentLocation.
 * @param {object | null} [overrides.parsedCommand] - Override parsedCommand.
 * @returns {ActionContext}
 */
const createMockActionContext = (overrides = {}) => {
    const player = new Entity('player1');
    const location = new Entity('loc_default_room'); // Default location

    /** @type {ActionContext} */
    const baseContext = {
        playerEntity: player,
        currentLocation: location,
        entityManager: { // Simplified mock
            componentRegistry: {
                get: jest.fn((name) => {
                    if (name === 'NameComponent') return MockNameComponent;
                    return undefined;
                }),
            },
            getEntityInstance: jest.fn((id) => {
                if (id === player.id) return player;
                if (id === location.id) return location;
                if (overrides.currentLocation && id === overrides.currentLocation.id) {
                    return overrides.currentLocation;
                }
                return undefined;
            }),
        },
        eventBus: mockEventBus,
        parsedCommand: { // Default parsed command
            actionId: 'test:context_parsed',
            directObjectPhrase: null,
            indirectObjectPhrase: null,
            preposition: null,
            originalInput: 'test context parsed action',
            error: null,
        },
        gameDataRepository: mockGameDataRepository,
        dispatch: mockvalidatedEventDispatcher.dispatchValidated,
        ...overrides, // Apply specific overrides for the test case
    };

    // Handle specific null overrides correctly
    if (overrides.hasOwnProperty('currentLocation') && overrides.currentLocation === null) {
        baseContext.currentLocation = null;
    }
    if (overrides.hasOwnProperty('parsedCommand') && overrides.parsedCommand === null) {
        baseContext.parsedCommand = null;
    } else if (overrides.parsedCommand) {
        // Merge if parsedCommand override is an object
        baseContext.parsedCommand = {...baseContext.parsedCommand, ...overrides.parsedCommand};
    }


    return baseContext;
};

/**
 * @param {ResolutionStatus} status
 * @param {object} [overrides]
 * @returns {TargetResolutionResult}
 */
const createMockResolutionResult = (status, overrides = {}) => {
    const baseResult = {
        status: status,
        targetType: 'none', // Default, doesn't affect context/parsed tests directly
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
 * @param {object} [overrides]
 * @returns {ActionDefinition}
 */
const createMockActionDefinition = (overrides = {}) => {
    /** @type {ActionDefinition} */
    const baseDefinition = {
        id: 'test:context_parsed_action',
        target_domain: 'none', // Doesn't matter for these tests
        template: 'test context parsed action',
        dispatch_event: {
            eventName: 'test:event_context_parsed',
            payload: {}, // Set per test case
        },
        ...overrides,
    };
    return baseDefinition;
};


// --- Test Suite ---

describe('ActionExecutor', () => {
    let executor;
    let mockContext;
    let mockResolutionResult;
    let mockActionDef;

    beforeEach(() => {
        jest.clearAllMocks();
        executor = createExecutor(mockLogger);
        // Use default context/resolution/actionDef, override in tests as needed
        mockContext = createMockActionContext();
        mockResolutionResult = createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE); // Default success
        mockActionDef = createMockActionDefinition();

        // Default mocks for successful execution path (resolution/validation pass)
        mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);
        mockActionValidationService.isValid.mockReturnValue(true);
        mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef); // Default action def
    });

    describe('#getValueFromSource (via executeAction) - context. and parsed. Prefixes', () => {
        const payloadKey = 'testValue';

        // --- context. Sources ---
        describe('context. Sources', () => {

            // --- context.currentLocation.id ---
            describe('context.currentLocation.id', () => {
                const sourceString = 'context.currentLocation.id';

                test('should return the correct location ID when currentLocation exists', async () => {
                    const locationId = 'loc_test_chamber';
                    const location = new Entity(locationId);
                    mockContext = createMockActionContext({currentLocation: location});
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_loc_id_ok',
                        dispatch_event: {
                            eventName: 'test:event_context_loc_id_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        mockActionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: locationId})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should log warn and return undefined if currentLocation is null', async () => {
                    mockContext = createMockActionContext({currentLocation: null}); // Null location
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_loc_id_null',
                        dispatch_event: {
                            eventName: 'test:event_context_loc_id_null',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'context.currentLocation.*' source '${sourceString}' for action '${mockActionDef.id}'. Current location not found in context.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });
            });

            // --- context.currentLocation.name ---
            describe('context.currentLocation.name', () => {
                const sourceString = 'context.currentLocation.name';

                test('should return name from NameComponent if present on location', async () => {
                    const locationId = 'loc_grand_hall';
                    const locationName = 'Grand Hall';
                    const location = new Entity(locationId);

                    // --- CORRECTED LINE ---
                    // Pass the string ID "NameComponent" and the data object
                    // Using a plain object here is more idiomatic for how Entity stores raw data
                    location.addComponent('NameComponent', {value: locationName});

                    // --- ALTERNATIVE (Also works if MockNameComponent instance is needed elsewhere) ---
                    // const nameCompData = new MockNameComponent(locationName);
                    // location.addComponent('NameComponent', nameCompData);


                    mockContext = createMockActionContext({currentLocation: location});
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_loc_name_comp',
                        dispatch_event: {
                            eventName: 'test:event_context_loc_name_comp',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    // Ensure the mock getDisplayName is called correctly
                    expect(mockGetDisplayName).toHaveBeenCalledWith(location);
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        mockActionDef.dispatch_event.eventName,
                        // The mock getDisplayName correctly extracts '.value'
                        expect.objectContaining({[payloadKey]: locationName})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return location ID if NameComponent is absent on location', async () => {
                    const locationId = 'loc_storage_closet';
                    const location = new Entity(locationId); // No NameComponent
                    mockContext = createMockActionContext({currentLocation: location});
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_loc_name_fallback',
                        dispatch_event: {
                            eventName: 'test:event_context_loc_name_fallback',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockGetDisplayName).toHaveBeenCalledWith(location);
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        mockActionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: locationId}) // Fallback to ID
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should log warn and return undefined if currentLocation is null', async () => {
                    mockContext = createMockActionContext({currentLocation: null}); // Null location
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_loc_name_null',
                        dispatch_event: {
                            eventName: 'test:event_context_loc_name_null',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'context.currentLocation.*' source '${sourceString}' for action '${mockActionDef.id}'. Current location not found in context.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                    expect(mockGetDisplayName).not.toHaveBeenCalled(); // Should not attempt display name
                });
            });

            // --- Malformed/Unhandled context. Strings ---
            describe('Malformed context. Strings', () => {
                test('should log warn for "context.currentLocation.foo" (unknown field) and omit field', async () => {
                    const sourceString = 'context.currentLocation.foo';
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_loc_unknown_field',
                        dispatch_event: {
                            eventName: 'test:event_context_loc_unknown_field',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'context.currentLocation' field 'foo' in source '${sourceString}' for action '${mockActionDef.id}'.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "context.foo" (unknown top-level field) and omit field', async () => {
                    const sourceString = 'context.foo';
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_unknown_field',
                        dispatch_event: {
                            eventName: 'test:event_context_unknown_field',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'context' field 'foo' in source '${sourceString}' for action '${mockActionDef.id}'.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "context." (incomplete string) and omit field', async () => {
                    const sourceString = 'context.';
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_dot',
                        dispatch_event: {
                            eventName: 'test:event_context_dot',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);
                    // Splits into ['context', ''] which has length 2, but '' is unhandled
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'context' field '' in source '${sourceString}' for action '${mockActionDef.id}'.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "context" (too short string) and omit field', async () => {
                    const sourceString = 'context';
                    mockActionDef = createMockActionDefinition({
                        id: 'test:context_short',
                        dispatch_event: {
                            eventName: 'test:event_context_short',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Malformed 'context' source string '${sourceString}' for action '${mockActionDef.id}'. Requires at least 'context.<field>'.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });
            });
        }); // End context. Sources

        // --- parsed. Sources ---
        describe('parsed. Sources', () => {

            // --- parsed.directObjectPhrase ---
            describe('parsed.directObjectPhrase', () => {
                const sourceString = 'parsed.directObjectPhrase';

                test('should return the phrase when parsedCommand and phrase exist', async () => {
                    const phrase = 'red key';
                    mockContext = createMockActionContext({parsedCommand: {directObjectPhrase: phrase}});
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_do_ok',
                        dispatch_event: {
                            eventName: 'test:event_parsed_do_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        mockActionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: phrase})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return undefined if phrase is null', async () => {
                    mockContext = createMockActionContext({parsedCommand: {directObjectPhrase: null}}); // Explicitly null
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_do_null',
                        dispatch_event: {
                            eventName: 'test:event_parsed_do_null',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    // Returns undefined, omit from payload
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });

                test('should log warn and return undefined if parsedCommand is null', async () => {
                    mockContext = createMockActionContext({parsedCommand: null}); // Null command object
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_do_null_cmd',
                        dispatch_event: {
                            eventName: 'test:event_parsed_do_null_cmd',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'parsed.*' source '${sourceString}' for action '${mockActionDef.id}'. Parsed command not found in context.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });
            });

            // --- parsed.indirectObjectPhrase ---
            describe('parsed.indirectObjectPhrase', () => {
                const sourceString = 'parsed.indirectObjectPhrase';

                test('should return the phrase when parsedCommand and phrase exist', async () => {
                    const phrase = 'rusty chest';
                    mockContext = createMockActionContext({parsedCommand: {indirectObjectPhrase: phrase}});
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_ido_ok',
                        dispatch_event: {
                            eventName: 'test:event_parsed_ido_ok',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                        mockActionDef.dispatch_event.eventName,
                        expect.objectContaining({[payloadKey]: phrase})
                    );
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                });

                test('should return undefined if phrase is null', async () => {
                    mockContext = createMockActionContext({parsedCommand: {indirectObjectPhrase: null}}); // Explicitly null
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_ido_null',
                        dispatch_event: {
                            eventName: 'test:event_parsed_ido_null',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    // Returns undefined, omit from payload
                    expect(mockLogger.warn).not.toHaveBeenCalled();
                    expect(mockLogger.error).not.toHaveBeenCalled();
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });

                test('should log warn and return undefined if parsedCommand is null', async () => {
                    mockContext = createMockActionContext({parsedCommand: null}); // Null command object
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_ido_null_cmd',
                        dispatch_event: {
                            eventName: 'test:event_parsed_ido_null_cmd',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Cannot resolve 'parsed.*' source '${sourceString}' for action '${mockActionDef.id}'. Parsed command not found in context.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });
            });

            // --- Malformed/Unhandled parsed. Strings ---
            describe('Malformed parsed. Strings', () => {
                test('should log warn for "parsed.foo" (unknown field) and omit field', async () => {
                    const sourceString = 'parsed.foo';
                    // Need a non-null parsedCommand for the check to proceed past the null check
                    mockContext = createMockActionContext({parsedCommand: {directObjectPhrase: 'test'}});
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_unknown_field',
                        dispatch_event: {
                            eventName: 'test:event_parsed_unknown_field',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'parsed' field 'foo' in source '${sourceString}' for action '${mockActionDef.id}'.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "parsed." (incomplete string) and omit field', async () => {
                    const sourceString = 'parsed.';
                    // Need a non-null parsedCommand for the check to proceed past the null check
                    mockContext = createMockActionContext({parsedCommand: {directObjectPhrase: 'test'}});
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_dot',
                        dispatch_event: {
                            eventName: 'test:event_parsed_dot',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);
                    // Splits into ['parsed', ''] which has length 2, but '' is unhandled
                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Unhandled 'parsed' field '' in source '${sourceString}' for action '${mockActionDef.id}'.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });

                test('should log warn for "parsed" (too short string) and omit field', async () => {
                    const sourceString = 'parsed';
                    mockActionDef = createMockActionDefinition({
                        id: 'test:parsed_short',
                        dispatch_event: {
                            eventName: 'test:event_parsed_short',
                            payload: {[payloadKey]: sourceString}
                        }
                    });
                    mockGameDataRepository.getActionDefinition.mockReturnValue(mockActionDef);

                    await executor.executeAction(mockActionDef.id, mockContext, mockResolutionResult);

                    expect(mockLogger.warn).toHaveBeenCalledWith(
                        expect.stringContaining(`Malformed 'parsed' source string '${sourceString}' for action '${mockActionDef.id}'. Requires at least 'parsed.<field>'.`)
                    );
                    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(mockActionDef.dispatch_event.eventName, {});
                });
            });

        }); // End parsed. Sources

    }); // end describe #getValueFromSource (via executeAction) - context. and parsed. Prefixes

}); // end describe ActionExecutor
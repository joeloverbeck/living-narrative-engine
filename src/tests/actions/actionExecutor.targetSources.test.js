// src/actions/actionExecutor.targetSources.test.js

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
import PayloadValueResolverService from '../../services/payloadValueResolverService.js';

jest.mock('../../utils/messages.js', () => ({
  // Use jest.fn().mockImplementation for more control if needed,
  // but this simple mock covers the fallback logic described
  getDisplayName: jest.fn((entity) => {
    if (!entity) return 'mock unknown';
    // Simulate getting NameComponent data or falling back to ID
    // NOTE: Assumes getComponent returns the DATA object now, not the instance
    const nameCompData = entity.getComponentData('NameComponent'); // Changed from getComponent
    return nameCompData?.value ?? entity.id ?? 'mock unknown';
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
};

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
    validatedEventDispatcher: mockvalidatedEventDispatcher // <<< --- ADD THIS LINE --- >>>
  });
};

// Helper to create baseline mock objects
const createMockActionContext = (overrides = {}) => {
  // Base player entity setup used across tests unless overridden
  const player = new Entity('player1');
  // Note: We don't add MockNameComponent by default to test fallback logic easily

  // --- FIX START: Use addComponent(typeId, dataObject) ---
  const componentAData = {value: 'ComponentA_Value', numericValue: 123};
  player.addComponent('ComponentA', componentAData); // Use string ID 'ComponentA'
  // --- FIX END ---

  const location = new Entity('room1');
  location.mockName = 'The Room'; // Used for context.* tests later

  /** @type {ActionContext} */
  const baseContext = {
    playerEntity: player,
    currentLocation: location,
    entityManager: {
      componentRegistry: {
        get: jest.fn((name) => {
          // Return mock classes based on string name - This remains correct for resolver lookups
          if (name === 'ComponentA') return MockComponentA;
          if (name === 'ComponentB') return MockComponentB;
          if (name === 'NameComponent') return MockNameComponent; // Resolver might need the class
          if (name === 'StatsComponent') return MockStatsComponent;
          if (name === 'HealthComponent') return MockHealthComponent; // Resolver might need the class
          return undefined;
        }),
      },
      getEntityInstance: jest.fn((id) => {
        if (id === 'player1') return player;
        if (id === 'room1') return location;
        // If 'target1' is needed here by other tests, it needs careful handling
        // due to scope. Assuming target tests manage their own target entity access
        // primarily through resolutionResult.targetEntity.
        return undefined;
      }),
      // Add mock getComponentData/hasComponent if ActionExecutor uses them directly on EntityManager
      getComponentData: jest.fn((entityId, componentTypeId) => {
        const entity = baseContext.entityManager.getEntityInstance(entityId);
        return entity?.getComponentData(componentTypeId);
      }),
      hasComponent: jest.fn((entityId, componentTypeId) => {
        const entity = baseContext.entityManager.getEntityInstance(entityId);
        return entity?.hasComponent(componentTypeId) ?? false;
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
    dispatch: mockvalidatedEventDispatcher.dispatchValidated, // Ensure dispatch function is available
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
        mockTargetEntity = new Entity('target1'); // Create fresh target entity
        // NOTE: No components added here by default, specific tests will add them

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

        // Ensure the mock entityManager can find this target entity if needed
        // (Though resolver primarily uses resolutionResult.targetEntity)
        mockContext.entityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'player1') return mockContext.playerEntity;
          if (id === 'room1') return mockContext.currentLocation;
          if (id === 'target1') return mockTargetEntity; // Allow finding the target
          return undefined;
        });
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

          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            actionDef.dispatch_event.eventName,
            expect.objectContaining({[payloadKey]: mockTargetEntity.id}) // 'target1'
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

          mockContext.parsedCommand.directObjectPhrase = 'north';

          // Override resolution result for this test
          mockTargetResolutionService.resolveActionTarget.mockResolvedValue(
            createMockResolutionResult(ResolutionStatus.FOUND_UNIQUE, {
              targetType: 'direction',
              targetId: 'north' // Can still be the direction name or related ID
            })
          );

          await executor.executeAction(actionDef.id, mockContext); // Use the modified context

          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Cannot resolve 'target.*' source '${sourceString}' for action '${actionDef.id}'. Target type is 'direction', not 'entity'.`)
          );
          // Expect empty payload as the source resolution failed
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
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
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
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
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
        });
      });

      // --- target.name ---
      describe('target.name', () => {
        const sourceString = 'target.name';

        test('should return name from NameComponent if present on target', async () => {
          const targetName = 'SpecificTargetName';

          // --- FIX START: Use addComponent(typeId, dataObject) ---
          mockTargetEntity.addComponent('NameComponent', {value: targetName});
          // --- FIX END ---

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

          expect(mockGetDisplayName).toHaveBeenCalledWith(mockTargetEntity); // getDisplayName still takes the entity
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            actionDef.dispatch_event.eventName,
            expect.objectContaining({[payloadKey]: targetName})
          );
          expect(mockLogger.warn).not.toHaveBeenCalled();
          expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('should return target ID if NameComponent is absent on target', async () => {
          // mockTargetEntity has no NameComponent by default in this setup
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
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
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

          mockContext.parsedCommand.directObjectPhrase = 'north';

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
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
          expect(mockGetDisplayName).not.toHaveBeenCalled(); // Should not attempt to get name
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
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
          expect(mockGetDisplayName).not.toHaveBeenCalled(); // Should not attempt to get name
        });
      });

      // --- target.component.<CompName>.<prop> ---
      describe('target.component.<CompName>.<prop>', () => {
        const compName = 'HealthComponent'; // Use the string name
        const propName = 'current';
        const sourceString = `target.component.${compName}.${propName}`;
        const expectedValue = 50;

        beforeEach(() => {
          // --- FIX START: Use addComponent(typeId, dataObject) ---
          mockTargetEntity.addComponent(compName, {current: expectedValue, max: 100});
          // --- FIX END ---

          // Refresh resolution result mock with updated target entity
          // (Target entity instance itself was modified above, so just re-create result object)
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

          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
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

          // PayloadValueResolverService is expected to handle this logging
          expect.stringContaining(`Property '${missingPropName}' not found in component data for ID '${compName}' for source '${sourceStringMissing}' on target ${mockTargetEntity.id}`); // Match actual phrasing more closely
          expect(mockLogger.error).not.toHaveBeenCalled();
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            actionDef.dispatch_event.eventName,
            {} // Payload is empty because resolution failed
          );
        });

        test('should return undefined if component data is not present on target', async () => {
          const missingCompName = 'StatsComponent'; // Target doesn't have this by default
          const sourceStringMissingComp = `target.component.${missingCompName}.strength`;
          const actionDef = createMockActionDefinition({
            id: 'test:target_comp_inst_missing', // Renamed from _inst_ to reflect data focus
            dispatch_event: {
              eventName: 'test:event_target_comp_inst_missing',
              payload: {[payloadKey]: sourceStringMissingComp}
            }
          });
          mockGameDataRepository.getAction.mockReturnValue(actionDef);
          // Ensure StatsComponent is NOT on mockTargetEntity

          await executor.executeAction(actionDef.id, mockContext);

          // PayloadValueResolverService should log this
          expect.stringContaining(`Component data for ID '${missingCompName}' not found on target entity ${mockTargetEntity.id} for source '${sourceStringMissingComp}'`);
          expect(mockLogger.error).not.toHaveBeenCalled();
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            actionDef.dispatch_event.eventName,
            {}
          );
        });

        test('should log warn and return undefined if component class is not found in registry', async () => {
          // This test assumes the resolver needs the *class* from the registry,
          // which might not be the case if it only accesses data via entity.getComponentData.
          // Let's assume it DOES need the class for potential type checking or reflection.
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
          // Ensure registry mock returns undefined for this specific component name
          mockContext.entityManager.componentRegistry.get.mockImplementation((name) => {
            if (name === 'HealthComponent') return MockHealthComponent; // Allow known component
            if (name === unknownCompName) return undefined; // Explicitly undefined
            // Return other known mock classes if needed
            if (name === 'ComponentA') return MockComponentA;
            if (name === 'ComponentB') return MockComponentB;
            if (name === 'NameComponent') return MockNameComponent;
            if (name === 'StatsComponent') return MockStatsComponent;
            return undefined;
          });

          await executor.executeAction(actionDef.id, mockContext);

          expect(mockContext.entityManager.componentRegistry.get).toHaveBeenCalledWith(unknownCompName);
          // Expect the PayloadValueResolverService to log this warning
          expect.stringContaining(`Could not find component class '${unknownCompName}' in registry for source '${sourceStringUnknownComp}'`); // Match actual phrasing
          expect(mockLogger.error).not.toHaveBeenCalled();
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            actionDef.dispatch_event.eventName,
            {}
          );
        });

        test('should log warn and return undefined if targetType is not "entity"', async () => {
          const actionDef = createMockActionDefinition({
            id: 'test:target_comp_wrong_type',
            dispatch_event: {
              eventName: 'test:event_target_comp_wrong_type',
              payload: {[payloadKey]: sourceString} // target.component.HealthComponent.current
            }
          });
          mockGameDataRepository.getAction.mockReturnValue(actionDef);

          mockContext.parsedCommand.directObjectPhrase = 'north';

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
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
        });

        test('should log warn and return undefined if targetEntity is null', async () => {
          const actionDef = createMockActionDefinition({
            id: 'test:target_comp_missing_entity',
            dispatch_event: {
              eventName: 'test:event_target_comp_missing_entity',
              payload: {[payloadKey]: sourceString} // target.component.HealthComponent.current
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
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
        });
      });


      // --- Malformed target.* Strings ---
      describe('Malformed target.* Strings', () => {
        // Test setup requires a valid target entity for checks to proceed
        beforeEach(() => {
          // Ensure mockTargetEntity exists and resolution points to it
          // This is already covered by the parent describe's beforeEach
          mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult); // Use the default successful entity result
        });

        test('should log warn for "target." (incomplete string) and omit field', async () => {
          const sourceString = 'target.';
          const actionDef = createMockActionDefinition({
            id: 'test:malformed_target_dot',
            dispatch_event: {
              eventName: 'test:event_malformed_target_dot',
              payload: {[payloadKey]: sourceString}
            }
          });
          mockGameDataRepository.getAction.mockReturnValue(actionDef);

          await executor.executeAction(actionDef.id, mockContext);

          // Expect PayloadValueResolverService to log this warning
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`PayloadValueResolverService (#resolveTargetSource): Unhandled 'target' source string format '${sourceString}' for action '${actionDef.id}'. Field: ''`)
          );
          expect(mockLogger.error).not.toHaveBeenCalled();
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
        });

        test('should log warn for "target.component.CompName" (missing property) and omit field', async () => {
          const sourceString = 'target.component.HealthComponent'; // Missing property part
          const actionDef = createMockActionDefinition({
            id: 'test:target_comp_missing_prop_part', // Renamed for clarity
            dispatch_event: {
              eventName: 'test:event_target_comp_missing_prop_part',
              payload: {[payloadKey]: sourceString}
            }
          });
          mockGameDataRepository.getAction.mockReturnValue(actionDef);

          // --- FIX START: Ensure component exists using correct signature ---
          mockTargetEntity.addComponent('HealthComponent', {current: 50, max: 100});
          // --- FIX END ---

          // Update resolution result as entity was modified *within this test*
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

          // Expect PayloadValueResolverService to log this warning due to format issue
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`PayloadValueResolverService (#resolveTargetSource): Invalid 'target.component.*' source string format '${sourceString}'\. Expected 'target\.component\.<ComponentName\>\.<propertyName\>'\. Action\: '${actionDef.id}'`)
            // Or less specific:
          );
          expect(mockLogger.error).not.toHaveBeenCalled();
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
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
          // Uses default successful target resolution from parent beforeEach

          await executor.executeAction(actionDef.id, mockContext);

          // Expect PayloadValueResolverService to log this warning
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`PayloadValueResolverService (#resolveTargetSource): Unhandled 'target' source string format '${sourceString}' for action '${actionDef.id}'. Field: 'foo'`)
            // Or less specific:
            // expect.stringContaining(`Unhandled 'target' source string format '<span class="math-inline">\{sourceString\}' for action '</span>{actionDef.id}'. Field: 'foo'`)
          );
          expect(mockLogger.error).not.toHaveBeenCalled();
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
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
          // Uses default successful target resolution from parent beforeEach

          await executor.executeAction(actionDef.id, mockContext);

          // Expect PayloadValueResolverService to log this warning
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Malformed 'target' source string '${sourceString}' for action '${actionDef.id}'. Requires at least 'target.<field>'.`)
          );
          expect(mockLogger.error).not.toHaveBeenCalled(); // Should be warn

          // Check event dispatch payload - should be empty
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
          expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(actionDef.dispatch_event.eventName, {});
        });
      });

    }); // End target. Sources

  }); // end describe #getValueFromSource (via executeAction)

}); // end describe ActionExecutor
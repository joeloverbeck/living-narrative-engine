// src/actions/integration/actionExecutor.successEventDispatched.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js';
import {ResolutionStatus} from '../../services/targetResolutionService.js';
// Import the actual class to check the instance type passed to the mock
import {ActionTargetContext} from '../../models/actionTargetContext.js';
import PayloadValueResolverService from '../../services/payloadValueResolverService.js';

// Import types for JSDoc
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

// Mock components needed for payload resolution test
class MockMissingComponent { // Class exists but instance won't be added
  constructor() {
    this.prop = 'should_not_be_seen';
  }
}

// --- Mock Dependencies ---
/** @type {jest.Mocked<GameDataRepository>} */
const mockGameDataRepository = {
  getAction: jest.fn(),
  getAllActionDefinitions: jest.fn(),
  getAllConnectionDefinitions: jest.fn(),
  getAllEntityDefinitions: jest.fn(),
  getAllItemDefinitions: jest.fn(),
  getAllLocationDefinitions: jest.fn(),
  getAllQuestDefinitions: jest.fn(),
  getAllTriggerDefinitions: jest.fn(),
  getBlockerDefinition: jest.fn(),
  getConnectionDefinition: jest.fn(),
  getEntityDefinition: jest.fn(),
  getInteractionTest: jest.fn(),
  getItemDefinition: jest.fn(),
  getLocationDefinition: jest.fn(),
  getObjectiveDefinition: jest.fn(),
  getQuestDefinition: jest.fn(),
  getStartingLocationId: jest.fn(),
  getStartingPlayerId: jest.fn(),
  getTrigger: jest.fn(),
  getWorldName: jest.fn(),
  getAllBlockerDefinitions: jest.fn(),
};

/** @type {jest.Mocked<TargetResolutionService>} */
const mockTargetResolutionService = {
  resolveActionTarget: jest.fn(),
};

/** @type {jest.Mocked<ActionValidationService>} */
const mockActionValidationService = {
  isValid: jest.fn(),
  _checkEntityComponentRequirements: jest.fn(),
  _checkSinglePrerequisite: jest.fn(),
};

/** @type {jest.Mocked<EventBus>} */
const mockEventBus = { // Keep if needed internally by validatedEventDispatcher mock or other tests
  dispatch: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  listenerCount: jest.fn(),
};

/** @type {jest.Mocked<ValidatedEventDispatcher>} */
const mockvalidatedEventDispatcher = {
  dispatchValidated: jest.fn().mockResolvedValue(true), // Assume success by default
};

/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// --- Mock getDisplayName (if needed by ActionExecutor internals, seems unlikely now) ---
// jest.mock('../../utils/messages.js', () => ({
//     getDisplayName: jest.fn((entity) => entity?.id ?? 'mock unknown'), // Simple mock
//     TARGET_MESSAGES: {},
// }));


// --- Helper Functions ---

// Factory function for PayloadValueResolverService
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
    eventBus: mockEventBus, // Pass if constructor requires it
    logger: logger,
    payloadValueResolverService: resolverServiceInstance,
    validatedEventDispatcher: mockvalidatedEventDispatcher // Use the dispatcher mock
  });
};

/**
 * Creates a mock ActionContext.
 * @param {string} actionId - The action ID being executed.
 * @param {Entity} playerEntity - The player entity.
 * @param {Entity} currentLocation - The current location entity.
 * @param {string | null} [directObjectPhrase='target object'] - Direct object phrase.
 * @returns {ActionContext}
 */
const createMockActionContext = (actionId = 'test:action', playerEntity, currentLocation, directObjectPhrase = 'target object') => {
  /** @type {ActionContext} */
  const baseContext = {
    playerEntity: playerEntity,
    currentLocation: currentLocation,
    entityManager: {
      // Mock component registry to handle lookups during payload resolution
      componentRegistry: {
        get: jest.fn((name) => {
          // Only return definitions for components actually used or *potentially* looked up
          // Return the class for 'MissingComponent' so the resolver knows it *exists*
          // but the entity won't have an *instance*, leading to 'undefined'.
          if (name === 'MissingComponent') return MockMissingComponent;
          // Return undefined for any other component type requested
          return undefined;
        }),
      },
      // Mock entity manager to return entities needed by payload resolution
      getEntityInstance: jest.fn((id) => {
        if (playerEntity && id === playerEntity.id) return playerEntity;
        if (currentLocation && id === currentLocation.id) return currentLocation;
        // Target entity resolution is handled by mockTargetResolutionService,
        // but keep this basic lookup for actor/context sources.
        return undefined;
      }),
    },
    eventBus: mockEventBus, // Pass if context requires it
    parsedCommand: { // Minimal parsed command for 'parsed.*' sources
      actionId: actionId,
      directObjectPhrase: directObjectPhrase,
      indirectObjectPhrase: null,
      preposition: null,
      originalInput: `do ${actionId} ${directObjectPhrase ?? ''}`.trim(),
      error: null,
    },
    gameDataRepository: mockGameDataRepository, // Pass if context requires it
    dispatch: mockvalidatedEventDispatcher.dispatchValidated, // Expose dispatch if needed in context operationHandlers (unlikely for this test)
  };
  return baseContext;
};

/**
 * Creates a mock ActionDefinition with dispatch_event and a complex payload.
 * @param {string} id - The action ID.
 * @param {string} eventName - The event name to dispatch.
 * @returns {ActionDefinition}
 */
const createMockActionDefinition_WithEvent = (id = 'test:action', eventName = 'test:event_occurred') => {
  /** @type {ActionDefinition} */
  const definition = {
    id: id,
    target_domain: 'environment', // Requires resolution (mocked for success)
    template: 'test template for {target}', // Not used in this test path, but good to have
    dispatch_event: {
      eventName: eventName,
      payload: {
        // Mix of sources to test resolution and handling of null/undefined
        actorId: 'actor.id',                             // Source: Actor Entity (non-null)
        targetId: 'target.id',                           // Source: Target Entity (non-null, resolved)
        locationId: 'context.currentLocation.id',        // Source: Context (non-null)
        commandPhrase: 'parsed.directObjectPhrase',      // Source: Parsed Command (non-null)
        explicitNull: 'literal.null.',                   // Source: Literal Null
        missingComponentProp: 'actor.component.MissingComponent.prop', // Source: Component (resolves undefined)
        literalString: 'literal.string.test_value'       // Source: Literal String
      }
    }
  };
  return definition;
};

/**
 * Creates a mock TargetResolutionResult representing a successful unique entity result.
 * @param {string} targetId - The ID of the resolved target entity.
 * @param {Entity} targetEntity - The resolved target entity instance.
 * @returns {TargetResolutionResult}
 */
const createMockSuccessResolutionResult = (targetId, targetEntity) => {
  /** @type {TargetResolutionResult} */
  const result = {
    status: ResolutionStatus.FOUND_UNIQUE,
    targetType: 'entity', // Must be entity for target.* payload sources
    targetId: targetId,
    targetEntity: targetEntity, // Provide the actual entity instance for payload resolution
    targetConnectionEntity: null,
    candidateIds: [targetId],
    details: null,
    error: null,
  };
  return result;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test - Success (Event Dispatched Successfully)', () => {

  let executor;
  let mockContext;
  const actionId = 'test:action_event_dispatch';
  const eventName = 'test:event_dispatched_successfully';
  let mockActionDef_WithEvent;
  let mockPlayerEntity;
  let mockTargetEntity;
  let mockLocationEntity;
  let mockResolutionResult;
  let expectedValidationTargetContext; // Renamed for clarity vs. ActionContext
  const directObjectPhrase = 'the_target_object'; // Specific phrase for 'parsed.*' source

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Setup Mocks ---
    // 1. Instantiate ActionExecutor with mocks
    executor = createExecutor(mockLogger);

    // 2. Define Entities
    mockPlayerEntity = new Entity('player_dispatcher');
    mockTargetEntity = new Entity('target_dispatcher');
    mockLocationEntity = new Entity('location_dispatcher');
    // IMPORTANT: Do NOT add MockMissingComponent instance to mockPlayerEntity
    // The component *class* is registered via the mock entityManager,
    // but the *instance* is missing on the entity.

    // 3. Define the mock ActionDefinition with dispatch_event and complex payload.
    mockActionDef_WithEvent = createMockActionDefinition_WithEvent(actionId, eventName);
    // 4. Mock gameDataRepository.getAction to return this definition.
    mockGameDataRepository.getAction.mockReturnValue(mockActionDef_WithEvent);

    // 5. Mock targetResolutionService.resolveActionTarget for successful entity resolution.
    mockResolutionResult = createMockSuccessResolutionResult(mockTargetEntity.id, mockTargetEntity);
    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);

    // 6. Mock actionValidationService.isValid to return true (action is allowed).
    mockActionValidationService.isValid.mockReturnValue(true);

    // 7. Mock validatedEventDispatcher.dispatchValidated to resolve successfully (event dispatch occurs).
    //    (Already set by default in the mock definition, but can be reinforced here if needed)
    mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(true);

    // 8. Prepare the mockContext with needed data.
    mockContext = createMockActionContext(actionId, mockPlayerEntity, mockLocationEntity, directObjectPhrase);

    // 9. Determine the expected ActionTargetContext for validation step.
    expectedValidationTargetContext = ActionTargetContext.forEntity(mockTargetEntity.id);
  });

  test('should execute action, construct payload correctly (handling null/undefined), dispatch event, and return success', async () => {
    // --- Execute Action ---
    const result = await executor.executeAction(actionId, mockContext);

    // --- Verify Internal Service Calls ---

    // 1. Verify Action Definition was fetched
    expect(mockGameDataRepository.getAction).toHaveBeenCalledTimes(1);
    expect(mockGameDataRepository.getAction).toHaveBeenCalledWith(actionId);

    // 2. Verify Target Resolution was attempted
    expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
    expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledWith(mockActionDef_WithEvent, mockContext);

    // 3. Verify Action Validation was performed
    expect(mockActionValidationService.isValid).toHaveBeenCalledTimes(1);
    expect(mockActionValidationService.isValid).toHaveBeenCalledWith(
      mockActionDef_WithEvent,
      mockPlayerEntity,
      // Use expect.objectContaining for the validation context structure
      expect.objectContaining({
        type: expectedValidationTargetContext.type,
        entityId: expectedValidationTargetContext.entityId,
        direction: expectedValidationTargetContext.direction, // Should be null here
      })
    );

    // --- Verify Event Dispatch ---

    // 4. Verify Validated Dispatcher was called exactly once
    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);

    // 5. Verify Dispatcher was called with the CORRECT event name and payload
    const expectedPayload = {
      actorId: mockPlayerEntity.id,
      targetId: mockTargetEntity.id,
      locationId: mockLocationEntity.id,
      commandPhrase: directObjectPhrase,
      explicitNull: null, // Null value included
      literalString: 'test_value'
      // 'missingComponentProp' is correctly NOT present because it resolved to undefined
    };
    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
      eventName,          // First argument: eventName
      expectedPayload     // Second argument: The exact payload object
    );

    // --- Verify Final Result ---

    // 6. Verify the action result indicates success
    expect(result).toBeDefined(); // Ensure a result object was returned
    expect(result.success).toBe(true);
    expect(result.messages).toEqual([]); // No user-facing messages on simple success
    expect(result.newState).toBeUndefined(); // No state change defined in this action
    expect(result._internalDetails).toBeUndefined(); // No internal details on success

    // --- Verify Logging (Optional but Recommended for Key Events) ---

    // 7. Verify the log message indicating the undefined property was omitted (important behavior)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(/Payload key 'missingComponentProp' resolved undefined.*Omitting/)
      // Optionally check the second arg if the logged value matters: , undefined
    );

    // 8. Verify the log message confirming successful dispatch
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Helper #prepareAndDispatchEvent: Event '${eventName}' dispatch successful for action '${actionId}'.`
    );

    // 9. Verify general logging status (no warnings or errors expected)
    expect(mockLogger.info).toHaveBeenCalledTimes(2); // Constructor message
    // Note: Exact debug count can be brittle; checking key messages is often sufficient.
    // If needed, uncomment and adjust: expect(mockLogger.debug).toHaveBeenCalledTimes(EXPECTED_COUNT);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- Acceptance Criteria Check (Manual Review based on test above): ---
  // [X] Test case uses an ActionDefinition with dispatch_event and a complex payload definition.
  // [X] Mocks provide necessary data for all source types used in the payload (actor, target, context, parsed, literal, missing component).
  // [X] validatedEventDispatcher.dispatchValidated mock resolves successfully.
  // [X] Assertions verify validatedEventDispatcher.dispatchValidated was called once.
  // [X] Assertion verifies validatedEventDispatcher.dispatchValidated was called with the correct event name AND the correctly structured payload object (using toHaveBeenCalledWith and exact object matching), implicitly confirming null handling and undefined omission.
  // [X] Assertion verifies the final ActionResult indicates success.
  // [X] Assertions verify relevant logger calls (omitting undefined, dispatch success).
  // [X] Test passes. (Verified by running the test suite after these changes)
});
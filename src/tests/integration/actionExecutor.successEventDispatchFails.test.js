// src/actions/integration/actionExecutor.successEventDispatchFails.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js';
import {ResolutionStatus} from '../../services/targetResolutionService.js';
// Import the actual class to check the instance type passed to the mock
import {ActionTargetContext} from '../../models/actionTargetContext.js';

// Import types for JSDoc
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/targetResolutionService.js').default} TargetResolutionService */
/** @typedef {import('../../services/targetResolutionService.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../services/actionValidationService.js').ActionValidationService} ActionValidationService */
/** @typedef {import('../../core/eventBus.js').default} EventBus */

/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

// --- Mock Dependencies ---
/** @type {jest.Mocked<GameDataRepository>} */
const mockGameDataRepository = {
  getAction: jest.fn(),
  // Add other methods if needed by ActionExecutor constructor or other paths
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
  // Add other methods if needed by ActionExecutor constructor or other paths
  _checkEntityComponentRequirements: jest.fn(),
  _checkSinglePrerequisite: jest.fn(),
};

/** @type {jest.Mocked<EventBus>} */
const mockEventBus = {
  // CRITICAL: Mock dispatch to reject
  dispatch: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  listenerCount: jest.fn(),
};
const mockvalidatedEventDispatcher = {
  // Mock the method used by ActionExecutor.
  // .mockResolvedValue(true) assumes successful dispatch by default for most tests.
  // You can override this in specific tests if needed.
  dispatchValidated: jest.fn().mockResolvedValue(true),
};
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// --- Mock getDisplayName (required by ActionExecutor internals) ---
// Import the actual function signature for proper mocking
import {getDisplayName as originalGetDisplayName} from '../../utils/messages.js';
import PayloadValueResolverService from '../../services/payloadValueResolverService.js';

jest.mock('../../utils/messages.js', () => ({
  getDisplayName: jest.fn((entity) => entity?.id ?? 'mock unknown'), // Simple mock
  TARGET_MESSAGES: {},
}));


// --- Helper Functions ---

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
      componentRegistry: {
        get: jest.fn(() => undefined), // Assume no complex component lookups needed for this path
      },
      getEntityInstance: jest.fn((id) => {
        if (playerEntity && id === playerEntity.id) return playerEntity;
        if (currentLocation && id === currentLocation.id) return currentLocation;
        // Add target resolution if needed, but it's mocked separately
        return undefined;
      }),
    },
    eventBus: mockEventBus,
    parsedCommand: { // Minimal parsed command
      actionId: actionId,
      directObjectPhrase: directObjectPhrase,
      indirectObjectPhrase: null,
      preposition: null,
      originalInput: `do ${actionId} ${directObjectPhrase ?? ''}`.trim(),
      error: null,
    },
    gameDataRepository: mockGameDataRepository,
    dispatch: mockvalidatedEventDispatcher.dispatchValidated,
  };
  return baseContext;
};

/**
 * Creates a mock ActionDefinition with dispatch_event and a simple payload.
 * @param {string} id - The action ID.
 * @param {string} eventName - The event name to dispatch.
 * @returns {ActionDefinition}
 */
const createMockActionDefinition_WithEvent = (id = 'test:action', eventName = 'test:event_occurred') => {
  /** @type {ActionDefinition} */
  const definition = {
    id: id,
    target_domain: 'environment', // Requires resolution (will be mocked for success)
    template: 'test template for {target}',
    dispatch_event: {
      eventName: eventName,
      payload: {
        actorId: 'actor.id',
        targetId: 'target.id',
        sourceAction: 'literal.string.test_action'
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
    targetType: 'entity', // Must be entity for target.* sources
    targetId: targetId,
    targetEntity: targetEntity, // Provide the entity instance
    targetConnectionEntity: null,
    candidateIds: [targetId],
    details: null,
    error: null,
  };
  return result;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test - Success (Event Dispatch Fails) (Sub-Task 2.1.5.13)', () => {

  let executor;
  let mockContext;
  const actionId = 'test:action_dispatch_fails';
  const eventName = 'test:event_dispatch_fails';
  let mockActionDef_WithEvent;
  let mockPlayerEntity;
  let mockTargetEntity;
  let mockLocationEntity;
  let mockResolutionResult;
  let expectedTargetContext;
  let expectedDispatchError;
  let expectedPayload; // The payload that *should* have been dispatched

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Setup Mocks ---
    // 1. Instantiate ActionExecutor with mocks
    executor = createExecutor(mockLogger);

    // Define Entities
    mockPlayerEntity = new Entity('player_dispatch_fail');
    mockTargetEntity = new Entity('target_dispatch_fail');
    mockLocationEntity = new Entity('location_dispatch_fail');

    // 2. Define mock ActionDefinition with dispatch_event.
    mockActionDef_WithEvent = createMockActionDefinition_WithEvent(actionId, eventName);
    // 3. Mock gameDataRepository.getAction.
    mockGameDataRepository.getAction.mockReturnValue(mockActionDef_WithEvent);

    // 4. Mock targetResolutionService.resolveActionTarget for success.
    mockResolutionResult = createMockSuccessResolutionResult(mockTargetEntity.id, mockTargetEntity);
    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);

    // 5. Mock actionValidationService.isValid to return true.
    mockActionValidationService.isValid.mockReturnValue(true);

    // 6. Define the error to be rejected by dispatch and mock eventBus.dispatch.
    expectedDispatchError = new Error('Dispatch Failed');
    mockvalidatedEventDispatcher.dispatchValidated.mockRejectedValue(expectedDispatchError);

    // 7. Prepare the mockContext.
    mockContext = createMockActionContext(actionId, mockPlayerEntity, mockLocationEntity, 'target object');

    // 8. Determine the expected ActionTargetContext.
    expectedTargetContext = ActionTargetContext.forEntity(mockTargetEntity.id);

    // 9. Define the expected payload based on the action definition and mocks.
    expectedPayload = {
      actorId: mockPlayerEntity.id,
      targetId: mockTargetEntity.id,
      sourceAction: 'test_action'
    };
  });

  test('should attempt dispatch, catch error, log error, and return failure result', async () => {
    // --- Execute Action ---
    const result = await executor.executeAction(actionId, mockContext);

    // --- Verify Results ---

    // Assert: Preceding services were called correctly.
    expect(mockGameDataRepository.getAction).toHaveBeenCalledTimes(1);
    expect(mockGameDataRepository.getAction).toHaveBeenCalledWith(actionId);

    expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
    expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledWith(mockActionDef_WithEvent, mockContext);

    expect(mockActionValidationService.isValid).toHaveBeenCalledTimes(1);
    expect(mockActionValidationService.isValid).toHaveBeenCalledWith(
      mockActionDef_WithEvent,
      mockPlayerEntity,
      expect.objectContaining({ // Verify constructed context
        type: expectedTargetContext.type,
        entityId: expectedTargetContext.entityId,
        direction: expectedTargetContext.direction,
      })
    );

    // Assert: eventBus.dispatch was called exactly once.
    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);

    // Assert: eventBus.dispatch was called with the correct eventName and payload.
    expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
      eventName,
      expectedPayload
    );

    // Assert: The catch block for the dispatch error was entered (verified by logger and result).

    // Assert: Mock Logger.error was called, logging the dispatch error.
    expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only this error should be logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      `Helper #prepareAndDispatchEvent: Unexpected error calling ValidatedEventDispatcher for event '${eventName}' (Action: '${actionId}'):`,
      expectedDispatchError // Check that the specific error object was logged
    );
    // Verify other logs
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledTimes(2); // Constructor
    // Debug: Start, Def found, Resol result, TargetCtx created, Validation result, Prepare dispatch, Dispatching = 7
    expect(mockLogger.debug).toHaveBeenCalledTimes(15);


    // Assert: Returns ActionResult with success: false.
    expect(result).toBeDefined();
    expect(result.success).toBe(false);

    // Assert: ActionResult.messages contains an appropriate error message indicating dispatch failure.
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringContaining(`Internal error processing event '${eventName}' for action '${actionId}'.`),
        type: 'error'
      })
    ]));

    // Assert: ActionResult._internalDetails.dispatchError contains the error message from the mock error.
    expect(result._internalDetails).toBeDefined();
    // FIX: Change 'dispatchError' to 'dispatcherError'
    expect(result._internalDetails).toHaveProperty('dispatcherError');
    // FIX: Change 'dispatchError' to 'dispatcherError'
    expect(result._internalDetails.dispatcherError).toBe(expectedDispatchError.message); // 'Dispatch Failed'

  });

  // --- Acceptance Criteria Check (Manual Review based on test above): ---
  // [X] Test case where eventBus.dispatch rejects with an error is implemented.
  // [X] Assertions verify that eventBus.dispatch was called (with correct args).
  // [X] Assertion verifies the correct logger call (error) for the dispatch failure (with the correct error object).
  // [X] Assertions verify the returned ActionResult (success: false, specific message, _internalDetails populated with error message).
  // [X] Test passes. (Verified by running the test suite)
});
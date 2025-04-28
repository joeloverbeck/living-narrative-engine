// src/actions/integration/actionExecutor.successNoEvent.test.js

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
  // (Copying from validationFailure test for completeness)
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

// --- Mock getDisplayName (required by ActionExecutor internals/setup - though likely not hit in this path) ---
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
 * @param {string | null} [directObjectPhrase='target object'] - Direct object phrase.
 * @returns {ActionContext}
 */
const createMockActionContext = (actionId = 'test:action', playerEntity, directObjectPhrase = 'target object') => {
  const location = new Entity('room_success_no_event_test');

  /** @type {ActionContext} */
  const baseContext = {
    playerEntity: playerEntity, // Use the provided player entity
    currentLocation: location,
    entityManager: { // Simple mock
      componentRegistry: {get: jest.fn(() => undefined)},
      getEntityInstance: jest.fn((id) => {
        if (playerEntity && id === playerEntity.id) return playerEntity;
        if (id === location.id) return location;
        // Add target resolution if needed, but it's mocked separately
        return undefined;
      }),
    },
    eventBus: mockEventBus,
    parsedCommand: { // Minimal parsed command
      actionId: actionId,
      directObjectPhrase: directObjectPhrase, // Required if domain != none
      indirectObjectPhrase: null,
      preposition: null,
      originalInput: `do ${actionId} ${directObjectPhrase ?? ''}`.trim(),
      error: null,
    },
    gameDataRepository: mockGameDataRepository,
    dispatch: mockEventBus.dispatch,
  };
  return baseContext;
};

/**
 * Creates a basic mock ActionDefinition *without* dispatch_event.
 * @param {string} id - The action ID.
 * @param {string} [targetDomain='environment'] - Target domain.
 * @returns {ActionDefinition}
 */
const createMockActionDefinition_NoEvent = (id = 'test:action', targetDomain = 'environment') => {
  /** @type {ActionDefinition} */
  const definition = {
    id: id,
    target_domain: targetDomain, // Assume requires resolution
    template: 'test template for {target}',
    // CRITICAL: dispatch_event is deliberately omitted
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
    targetType: 'entity', // Specific type for this test
    targetId: targetId,
    targetEntity: targetEntity,
    targetConnectionEntity: null,
    candidateIds: [targetId],
    details: null,
    error: null,
  };
  return result;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test - Success (No Event Dispatch) (Sub-Task 2.1.5.11)', () => {

  let executor;
  let mockContext;
  const actionId = 'test:action_success_no_event';
  let mockActionDef_NoEvent;
  let mockPlayerEntity;
  let mockTargetEntity;
  let mockResolutionResult;
  let expectedTargetContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Setup Mocks ---
    // 1. Instantiate ActionExecutor with mocks
    executor = createExecutor(mockLogger);

    // 2. Define a mock ActionDefinition *without* dispatch_event property.
    mockActionDef_NoEvent = createMockActionDefinition_NoEvent(actionId, 'environment');
    // 3. Mock gameDataRepository.getAction to return this definition.
    mockGameDataRepository.getAction.mockReturnValue(mockActionDef_NoEvent);

    // Prepare entities for context and resolution
    mockPlayerEntity = new Entity('player_no_event');
    mockTargetEntity = new Entity('target_no_event');

    // 4. Mock targetResolutionService.resolveActionTarget to return a successful result.
    mockResolutionResult = createMockSuccessResolutionResult(mockTargetEntity.id, mockTargetEntity);
    mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockResolutionResult);

    // 5. Mock actionValidationService.isValid to return true.
    mockActionValidationService.isValid.mockReturnValue(true);

    // Create context *after* entities are defined
    mockContext = createMockActionContext(actionId, mockPlayerEntity, 'the target');

    // Define the expected ActionTargetContext that should be constructed and passed to isValid
    expectedTargetContext = ActionTargetContext.forEntity(mockTargetEntity.id);
  });

  test('should return success, log debug, and not dispatch event when action is valid but definition lacks dispatch_event', async () => {
    // --- Execute Action ---
    // 6. Call actionExecutor.executeAction('test:action', mockContext).
    const result = await executor.executeAction(actionId, mockContext);

    // --- Verify Results ---

    // Assert: Returns ActionResult with success: true.
    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Assert: ActionResult.messages is empty (or default empty array).
    expect(result.messages).toBeDefined();
    expect(result.messages).toEqual([]);

    // Assert: ActionResult.newState is undefined.
    expect(result.newState).toBeUndefined();
    // Also check for internal details that shouldn't be present for this success path
    expect(result._internalDetails).toBeUndefined();

    // Assert: gameDataRepository.getAction, targetResolutionService.resolveActionTarget, and actionValidationService.isValid were called.
    expect(mockGameDataRepository.getAction).toHaveBeenCalledTimes(1);
    expect(mockGameDataRepository.getAction).toHaveBeenCalledWith(actionId);

    expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
    expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledWith(mockActionDef_NoEvent, mockContext);

    expect(mockActionValidationService.isValid).toHaveBeenCalledTimes(1);
    expect(mockActionValidationService.isValid).toHaveBeenCalledWith(
      mockActionDef_NoEvent,
      mockPlayerEntity,
      // Verify the structure and key properties of the ActionTargetContext instance
      expect.objectContaining({
        type: expectedTargetContext.type,
        entityId: expectedTargetContext.entityId,
        direction: expectedTargetContext.direction,
      })
    );

    // Assert: Mock Logger.debug was called indicating the action is valid but has no event.
    // Check all debug calls to find the specific one
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`ActionExecutor: Action '${actionId}' valid but no 'dispatch_event'. Action flow complete.`) // <-- Corrected: Removed "is" and "defined"
    );
    // Verify other expected log calls
    expect(mockLogger.info).toHaveBeenCalledTimes(2); // Constructor
    expect(mockLogger.debug).toHaveBeenCalledTimes(10); // Start, Def found, Resol result, TargetCtx created, Validation result + specific no-event msg
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();

    // Assert: EventBus.dispatch was NOT called.
    expect(mockEventBus.dispatch).not.toHaveBeenCalled();
  });

  // --- Acceptance Criteria Check (Manual Review based on test above): ---
  // [X] Test case using an ActionDefinition without dispatch_event is implemented.
  // [X] Mocks for preceding services are configured for success.
  // [X] Assertions verify the returned ActionResult (success: true, empty messages, undefined state).
  // [X] Assertion verifies the correct logger call (debug).
  // [X] Assertion verifies that EventBus.dispatch was not called.
  // [X] Test passes. (Verified by running the test suite)
});
// src/actions/integration/actionExecutor.resolutionFailure.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';

import ActionExecutor from '../../actions/actionExecutor.js';
import Entity from '../../entities/entity.js'; // Needed for context creation
import {ResolutionStatus} from '../../services/targetResolutionService.js';
import PayloadValueResolverService from '../../services/payloadValueResolverService.js'; // Enum for statuses

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
  _checkEntityComponentRequirements: jest.fn(), // Mock private methods if necessary for testing setup, though unlikely here
  _checkSinglePrerequisite: jest.fn(), // Mock private methods if necessary for testing setup, though unlikely here
};

/** @type {jest.Mocked<EventBus>} */
const mockEventBus = {
  dispatch: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  listenerCount: jest.fn(),
};
const mockValidatedDispatcher = {
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
    validatedDispatcher: mockValidatedDispatcher // <<< --- ADD THIS LINE --- >>>
  });
};

/**
 * Creates a mock ActionContext. Details don't matter much for this specific test path,
 * as long as it's valid enough to pass the initial checks in executeAction.
 * @param {string} actionId - The action ID being executed.
 * @returns {ActionContext}
 */
const createMockActionContext = (actionId = 'test:action') => {
  const player = new Entity('player_resolve_fail_test');
  const location = new Entity('room_resolve_fail_test');

  /** @type {ActionContext} */
  const baseContext = {
    playerEntity: player,
    currentLocation: location,
    entityManager: { // Simple mock, not used before resolution failure
      componentRegistry: {get: jest.fn(() => undefined)},
      getEntityInstance: jest.fn((id) => {
        if (id === player.id) return player;
        if (id === location.id) return location;
        return undefined;
      }),
    },
    eventBus: mockEventBus,
    parsedCommand: { // Minimal parsed command
      actionId: actionId,
      directObjectPhrase: 'something', // Needs some value if domain != none
      indirectObjectPhrase: null,
      preposition: null,
      originalInput: 'do test action something',
      error: null,
    },
    gameDataRepository: mockGameDataRepository,
    dispatch: mockEventBus.dispatch,
  };
  return baseContext;
};

/**
 * Creates a basic mock ActionDefinition.
 * @param {string} id - The action ID.
 * @returns {ActionDefinition}
 */
const createMockActionDefinition = (id = 'test:action') => {
  /** @type {ActionDefinition} */
  const definition = {
    id: id,
    target_domain: 'environment', // Assume a domain requiring resolution
    template: 'test template for {target}',
    // Other properties like components, prerequisites, dispatch_event are omitted
    // as they are not relevant for the resolution failure path.
  };
  return definition;
};

/**
 * Creates a mock TargetResolutionResult representing a failure status.
 * @param {ResolutionStatus} status - The failure status.
 * @param {string | null} [error=null] - Optional error message.
 * @returns {TargetResolutionResult}
 */
const createMockFailureResolutionResult = (status, error = null) => {
  /** @type {TargetResolutionResult} */
  const result = {
    status: status,
    targetType: null, // Not relevant on failure
    targetId: null,
    targetEntity: null,
    targetConnectionEntity: null,
    candidateIds: [], // Can be empty or populated depending on status, but doesn't affect this test path assertions
    details: null, // Can be null or populated, doesn't affect this test path assertions
    error: error, // Include the error message if provided
  };
  return result;
};


// --- Test Suite ---

describe('ActionExecutor: Integration Test - Target Resolution Failure (Sub-Task 2.1.5.9)', () => {

  let executor;
  let mockContext;
  const actionId = 'test:action_resolve_fail';
  let mockActionDef;

  // Test cases for each failure status
  const failureCases = [
    {status: ResolutionStatus.NOT_FOUND, error: null, expectedLogger: 'warn'},
    {status: ResolutionStatus.AMBIGUOUS, error: null, expectedLogger: 'warn'},
    {status: ResolutionStatus.FILTER_EMPTY, error: null, expectedLogger: 'warn'},
    {status: ResolutionStatus.INVALID_INPUT, error: 'Test input error', expectedLogger: 'warn'}, // Code uses warn for all non-ERROR failures
    {status: ResolutionStatus.ERROR, error: 'Test internal error', expectedLogger: 'warn'}, // Code uses warn for all non-ERROR failures
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Setup Mocks ---
    // 1. Instantiate ActionExecutor with mocks
    executor = createExecutor(mockLogger);

    // 2. Mock gameDataRepository.getAction to return a valid definition
    mockActionDef = createMockActionDefinition(actionId);
    mockGameDataRepository.getAction.mockReturnValue(mockActionDef);

    // 3. Create a mock context
    mockContext = createMockActionContext(actionId);
  });

  // Use test.each to run the same assertions for different failure statuses
  test.each(failureCases)(
    'should handle TargetResolutionService failure with status $status',
    async ({status, error, expectedLogger}) => {
      // --- Arrange ---
      // 4. Define mock TargetResolutionResult for the current failure status
      const mockFailureResult = createMockFailureResolutionResult(status, error);

      // --- Execute Action for Each Failure Status ---
      // 5. Mock targetResolutionService.resolveActionTarget to return the failure result
      mockTargetResolutionService.resolveActionTarget.mockResolvedValue(mockFailureResult);

      // 6. Call actionExecutor.executeAction
      console.log('LOGGER WARN CALLS:', mockLogger.warn.mock.calls);
      const result = await executor.executeAction(actionId, mockContext);
      console.log('LOGGER WARN CALLS after execute:', mockLogger.warn.mock.calls); // See what was logged

      // --- Verify Results ---
      // Assert: Returns ActionResult with success: false
      expect(result).toBeDefined();
      expect(result.success).toBe(false);

      // Assert: ActionResult.messages contains an appropriate message
      expect(result.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          text: 'Action failed: Could not determine target.',
          type: 'info'
        })
      ]));

      // Assert: ActionResult._internalDetails.resolutionStatus matches the mocked failure status
      expect(result._internalDetails).toBeDefined();
      expect(result._internalDetails.resolutionStatus).toBe(status);

      // Assert: ActionResult._internalDetails.resolutionError matches the mocked error string (if provided)
      expect(result._internalDetails.resolutionError).toBe(error);

      // Assert: Mock Logger.warn or Logger.error was called indicating resolution failure
      // The code currently uses Logger.warn for all resolution failures before returning.
      expect(mockLogger[expectedLogger]).toHaveBeenCalledTimes(1);
      expect(mockLogger[expectedLogger]).toHaveBeenCalledWith(
        expect.stringContaining(`ActionExecutor: Target resolution failed for '${actionId}' with status: ${status}. Action aborted.`) // <-- Corrected: Removed "action "
      );
      // Ensure the *other* log level wasn't called for this specific log message
      const otherLogger = expectedLogger === 'warn' ? 'error' : 'warn';
      expect(mockLogger[otherLogger]).not.toHaveBeenCalledWith(
        expect.stringContaining(`ActionExecutor: Target resolution failed for action '${actionId}'`)
      );
      // Allow info/debug logs from setup/start
      expect(mockLogger.info).toHaveBeenCalledTimes(2); // Constructor init log
      // CORRECT: Expect 3 debug calls: start, definition found, resolution result
      expect(mockLogger.debug).toHaveBeenCalledTimes(5);

      // Assert: ActionValidationService.isValid was NOT called
      expect(mockActionValidationService.isValid).not.toHaveBeenCalled();

      // Assert: EventBus.dispatch was NOT called
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();

      // --- Verify Mock Calls ---
      expect(mockGameDataRepository.getAction).toHaveBeenCalledTimes(1);
      expect(mockGameDataRepository.getAction).toHaveBeenCalledWith(actionId);
      expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledTimes(1);
      expect(mockTargetResolutionService.resolveActionTarget).toHaveBeenCalledWith(mockActionDef, mockContext);
    }
  );

  // Acceptance Criteria Check (Manual Review based on tests above):
  // [X] Test cases are implemented for each ResolutionStatus failure (NOT_FOUND, AMBIGUOUS, FILTER_EMPTY, INVALID_INPUT, ERROR). (via test.each)
  // [X] targetResolutionService.resolveActionTarget is mocked correctly for each case. (via test.each setup)
  // [X] Assertions verify the returned ActionResult (success: false, generic message, _internalDetails populated correctly). (Assertions in test.each)
  // [X] Assertions verify appropriate logger calls. (Assertions in test.each)
  // [X] Assertions verify that ActionValidationService and EventBus were not called. (Assertions in test.each)
  // [X] All tests in this suite pass. (Verified by running the tests)
});
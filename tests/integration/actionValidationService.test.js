// src/tests/integration/actionValidationService.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals';

// --- System Under Test (SUT) ---
import {ActionValidationService} from '../../src/services/actionValidationService.js'; // Adjust path if needed

// --- Mock Dependencies ---
import {PrerequisiteEvaluationService} from '../../src/services/prerequisiteEvaluationService.js'; // Import PES
import Entity from '../../src/entities/entity.js'; // Needed for test inputs
import {ActionTargetContext} from '../../src/models/actionTargetContext.js';
import {createMockPrerequisiteEvaluationService} from '../testUtils.js'; // Needed for test inputs

// --- Mock Modules ---
jest.mock('../../src/services/prerequisiteEvaluationService.js'); // Mock PES module

// --- Type Imports ---
/** @typedef {import('../../src/types/actionDefinition.js').ActionDefinition} ActionDefinition */
// REMOVED: JsonLogicEvaluationContext is no longer directly verified in these tests
// /** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */


// --- Mock Instances ---

// Mock EntityManager
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  // Add other methods if ActionValidationService directly uses them (currently doesn't seem likely for the tested paths)
};

// Mock ILogger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock DomainContextCompatibilityChecker
const mockDomainChecker = {
  check: jest.fn(),
};

// REMOVED: Mock createActionValidationContextFunction (No longer injected into AVS)
// /** @type {jest.Mock<(actionDef: ActionDefinition, actor: Entity, target: ActionTargetContext, manager: EntityManager, logger: ILogger) => JsonLogicEvaluationContext>} */
// const mockContextCreatorFn = jest.fn();

// Mock PrerequisiteEvaluationService Instance (using mocked constructor)
const MockPrerequisiteEvaluationService = PrerequisiteEvaluationService; // Alias for clarity
/** @type {jest.Mocked<PrerequisiteEvaluationService>} */
let mockPesInstance;


// --- Test Suite ---

describe('Integration Test: ActionValidationService - Prerequisite Validation Step (with PES)', () => {

  /** @type {ActionValidationService} */
  let service;
  /** @type {Entity} */
  let mockActorEntity;
  /** @type {ActionTargetContext} */
  let mockTargetContext;
  /** @type {ActionDefinition} */
  let mockActionDefWithPrereqs;
  /** @type {ActionDefinition} */
  let mockActionDefWithoutPrereqs;
  // REMOVED: mockEvaluationContext is no longer directly relevant for AVS tests
  // /** @type {JsonLogicEvaluationContext} */
  // let mockEvaluationContext;

  // --- Test Setup ---
  beforeEach(() => {
    // AC: Reset mocks before each test
    jest.clearAllMocks();

    // AC: Instantiate mocked PrerequisiteEvaluationService
    // Provide minimal dummy dependencies if PES constructor needs them
    // Note: We don't need to provide real dependencies to the *mocked* PES constructor here,
    // unless the mock implementation itself uses them (which it shouldn't for basic mocking).
    mockPesInstance = createMockPrerequisiteEvaluationService();

    // AC2: Instantiate ActionValidationService with mocked dependencies (PES replaces JLES)
    // REMOVED: createActionValidationContextFunction injection
    service = new ActionValidationService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      domainContextCompatibilityChecker: mockDomainChecker,
      prerequisiteEvaluationService: mockPesInstance, // ADDED mocked PES
      // createActionValidationContextFunction: mockContextCreatorFn // REMOVED
    });

    // Define Mock Data (Same as before)
    mockActorEntity = new Entity('player-1');
    mockTargetContext = ActionTargetContext.forEntity('target-1');

    mockActionDefWithPrereqs = {
      id: 'core:test_action_with_prereqs',
      commandVerb: 'testprereq',
      target_domain: 'entity', // Ensure compatible with target context
      template: 'test {target}',
      prerequisites: [
        {logic: {var: 'actor.components.health.current'}, failure_message: 'Needs health'},
        {logic: {'==': [{var: 'target.id'}, 'target-1']}}
      ],
    };

    mockActionDefWithoutPrereqs = {
      id: 'core:test_action_no_prereqs',
      commandVerb: 'testnoprereq',
      target_domain: 'none',
      template: 'test',
      prerequisites: [], // Empty array
    };

    // REMOVED: mockEvaluationContext definition (no longer needed here)
    // mockEvaluationContext = { ... };

    // --- Default Mock Behaviors ---
    mockDomainChecker.check.mockReturnValue(true);
    // REMOVED: mockContextCreatorFn.mockReturnValue(mockEvaluationContext);
    // Default PES behavior (can be overridden per test) - Assume passes
    mockPesInstance.evaluate.mockReturnValue(true);
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'player-1') return mockActorEntity;
      if (id === 'target-1') return new Entity('target-1');
      return undefined;
    });

  });

  // --- Test Cases ---

  // REMOVED: Test Context Creator Call (No longer relevant for AVS)
  // test('should call createActionValidationContextFn with correct args when prerequisites exist', () => { ... });

  // AC3: Prerequisite Check - PES Called with Correct Arguments
  test('AC3: should call PrerequisiteEvaluationService.evaluate with correct args when prerequisites exist', () => {
    // Arrange
    // Using mockActionDefWithPrereqs, mockActorEntity, mockTargetContext from beforeEach
    const expectedPrerequisites = mockActionDefWithPrereqs.prerequisites;
    mockPesInstance.evaluate.mockReturnValue(true); // Assume PES passes

    // Act
    service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

    // Assert
    // REMOVED: Verification of context creator call
    // expect(mockContextCreatorFn).toHaveBeenCalledTimes(1);
    // expect(mockContextCreatorFn).toHaveReturnedWith(expectedEvalCtx);

    // AC3: Verify PES was called once with the correct new signature
    expect(mockPesInstance.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPesInstance.evaluate).toHaveBeenCalledWith(
      expectedPrerequisites,          // The prerequisites array AVS collected
      mockActionDefWithPrereqs,       // The action definition object AVS has
      mockActorEntity,                // The actor entity AVS has
      mockTargetContext               // The target context AVS has
    );
  });

  // Prerequisite Check - Passes based on PES mock
  test('should return true when prerequisites exist and PES mock returns true', () => {
    // Arrange
    // Using mockActionDefWithPrereqs from beforeEach
    mockPesInstance.evaluate.mockReturnValueOnce(true); // Explicitly mock PES to return true
    const expectedPrerequisites = mockActionDefWithPrereqs.prerequisites;

    // Act
    const result = service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

    // Assert
    expect(result).toBe(true); // Outcome based on PES mock
    // Verify the collaborators were involved
    expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
    // REMOVED: Context creator check
    // expect(mockContextCreatorFn).toHaveBeenCalledTimes(1);
    expect(mockPesInstance.evaluate).toHaveBeenCalledTimes(1); // AC3: PES was called
    // AC3: Verify PES signature
    expect(mockPesInstance.evaluate).toHaveBeenCalledWith(
      expectedPrerequisites,
      mockActionDefWithPrereqs,
      mockActorEntity,
      mockTargetContext
    );
  });

  // Prerequisite Check - Fails based on PES mock
  test('should return false when PES mock returns false', () => {
    // Arrange
    // Using mockActionDefWithPrereqs from beforeEach
    const expectedPrerequisites = mockActionDefWithPrereqs.prerequisites;
    mockPesInstance.evaluate.mockReturnValueOnce(false); // AC: Make PES evaluation fail

    // Act
    const result = service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

    // Assert
    expect(result).toBe(false); // Outcome based on PES mock

    // Verify collaborators were still called correctly *before* the failure return
    expect(mockDomainChecker.check).toHaveBeenCalledTimes(1); // Domain checked first
    // REMOVED: Context creator check
    // expect(mockContextCreatorFn).toHaveBeenCalledTimes(1);
    // expect(mockContextCreatorFn).toHaveBeenCalledWith(...);
    expect(mockPesInstance.evaluate).toHaveBeenCalledTimes(1); // AC3: PES was called
    // AC3: Verify PES signature
    expect(mockPesInstance.evaluate).toHaveBeenCalledWith(
      expectedPrerequisites,
      mockActionDefWithPrereqs,
      mockActorEntity,
      mockTargetContext
    );
  });

  // AC4: No Prerequisites - PES NOT Called
  test('AC4: should return true and NOT call PES if action has no prerequisites property', () => {
    // Arrange
    const actionDefMissingPrereqs = {...mockActionDefWithoutPrereqs};
    delete actionDefMissingPrereqs.prerequisites; // Remove the property entirely
    mockDomainChecker.check.mockReturnValue(true); // Ensure domain check passes

    // Act
    const result = service.isValid(actionDefMissingPrereqs, mockActorEntity, ActionTargetContext.noTarget());

    // Assert
    expect(result).toBe(true); // Should pass assuming domain check passes

    // AC4: Assert PES NOT called
    // REMOVED: Context creator check
    // expect(mockContextCreatorFn).not.toHaveBeenCalled();
    expect(mockPesInstance.evaluate).not.toHaveBeenCalled(); // AC4: PES not called

    // Verify domain check *was* still called
    expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
  });

  test('AC4: should return true and NOT call PES if prerequisites is an empty array', () => {
    // Arrange
    // Using mockActionDefWithoutPrereqs from beforeEach (which has prerequisites: [])
    mockActionDefWithoutPrereqs.target_domain = 'none'; // Ensure domain match for noTarget
    mockDomainChecker.check.mockReturnValue(true);

    // Act
    const result = service.isValid(mockActionDefWithoutPrereqs, mockActorEntity, ActionTargetContext.noTarget());

    // Assert
    expect(result).toBe(true);
    // REMOVED: Context creator check
    // expect(mockContextCreatorFn).not.toHaveBeenCalled();
    expect(mockPesInstance.evaluate).not.toHaveBeenCalled(); // AC4: PES not called
    expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
  });


  test('AC4: should return true and NOT call PES if prerequisites is not an array (logs warning)', () => {
    // Arrange
    const actionDefInvalidPrereqs = {
      ...mockActionDefWithPrereqs,
      prerequisites: {logic: 'this is not an array'} // Set to non-array
    };
    // @ts-ignore - Intentionally invalid for test
    mockDomainChecker.check.mockReturnValue(true);

    // Act
    // @ts-ignore - Intentionally invalid for test
    const result = service.isValid(actionDefInvalidPrereqs, mockActorEntity, mockTargetContext);

    // Assert
    expect(result).toBe(true); // Passes, but skips evaluation

    // REMOVED: Context creator check
    // expect(mockContextCreatorFn).not.toHaveBeenCalled();

    // PES is NOT called because effective prerequisite list is empty
    expect(mockPesInstance.evaluate).not.toHaveBeenCalled(); // AC4: PES not called

    // Verify domain check and warning log
    expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("property, but it's not an array"));
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });


  // REMOVED: Test for context creator throwing error (no longer AVS responsibility)
  // test('should return false and log error if createActionValidationContextFn throws, does NOT call PES', () => { ... });

  // Optional: Test edge case where target entity resolution fails
  // AVS only warns, PES might fail later, but AVS itself proceeds. AVS Test should verify PES is still called.
  test('should WARN but still call PES if target entity cannot be resolved', () => {
    // Arrange
    const actionRequiresTarget = {...mockActionDefWithPrereqs}; // Uses target
    const targetId = 'nonexistent-target';
    const specificMockTargetContext = ActionTargetContext.forEntity(targetId); // Use a separate var
    actionRequiresTarget.target_domain = 'entity'; // Ensure domain allows entity target
    mockDomainChecker.check.mockReturnValue(true); // Domain check passes

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === mockActorEntity.id) return mockActorEntity;
      if (id === targetId) return undefined; // Target not found
      return undefined;
    });

    // REMOVED: Mocking context creation within this test is no longer needed
    // const mockContextWithNullTarget = { ...mockEvaluationContext, target: { id: targetId, components: null } };
    // mockContextCreatorFn.mockReturnValue(mockContextWithNullTarget);

    // IMPORTANT: Configure PES mock behaviour (assume it passes for this test of AVS flow)
    mockPesInstance.evaluate.mockReturnValueOnce(true);
    const expectedPrerequisites = actionRequiresTarget.prerequisites;
    // const expectedActionId = actionRequiresTarget.id; // No longer passed directly


    // Act
    const result = service.isValid(actionRequiresTarget, mockActorEntity, specificMockTargetContext);

    // Assert
    // 1. Check the final result (TRUE because PES mock returned true)
    expect(result).toBe(true);

    // 2. Verify expected calls
    expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1); // Only called for target

    // 3. Verify the specific WARNING log
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Validation Check [${actionRequiresTarget.id}]: Target entity '${targetId}' not found`)
    );
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalled();

    // 4. Verify that PES was called correctly even with missing target
    // REMOVED: Context creator checks
    // expect(mockContextCreatorFn).toHaveBeenCalledTimes(1);
    // expect(mockContextCreatorFn).toHaveReturnedWith(mockContextWithNullTarget);

    expect(mockPesInstance.evaluate).toHaveBeenCalledTimes(1); // PES *was* called
    // AC3: Verify PES args even when target entity was missing
    expect(mockPesInstance.evaluate).toHaveBeenCalledWith(
      expectedPrerequisites,
      actionRequiresTarget,       // Pass the definition
      mockActorEntity,            // Pass the actor
      specificMockTargetContext   // Pass the target context object
    );
  });

  // Added: Test case for when PES.evaluate itself throws an error
  test('should return false and log error if PrerequisiteEvaluationService.evaluate throws', () => {
    // Arrange
    const evaluationError = new Error('PES Failed Internally');
    mockPesInstance.evaluate.mockImplementation(() => {
      throw evaluationError;
    });
    const expectedPrerequisites = mockActionDefWithPrereqs.prerequisites;

    // Act
    const result = service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

    // Assert
    expect(result).toBe(false); // Service should return false on evaluation error

    // Verify collaborators up to the point of failure
    expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
    expect(mockPesInstance.evaluate).toHaveBeenCalledTimes(1); // AC3: PES was called
    // AC3: Verify PES signature
    expect(mockPesInstance.evaluate).toHaveBeenCalledWith(
      expectedPrerequisites,
      mockActionDefWithPrereqs,
      mockActorEntity,
      mockTargetContext
    );

    // Verify error was logged by AVS's general catch block
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Validation[${mockActionDefWithPrereqs.id}]: UNEXPECTED ERROR during validation process`),
      expect.objectContaining({error: evaluationError}) // Check the error object was included
    );
  });


}); // End describe ActionValidationService Integration Test

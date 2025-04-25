// src/tests/services/actionValidationService.actorComponents.test.js

/**
 * @jest-environment node
 */

import {afterAll, beforeAll, beforeEach, describe, expect, it, jest, test} from '@jest/globals';

// --- Service Under Test ---
import {ActionValidationService} from '../../services/actionValidationService.js';

// --- Models/Types ---
import {ActionTargetContext} from '../../models/actionTargetContext.js';
// Assuming Entity is a class or you have a way to create mock entities
// import { Entity } from '../../entities/entity.js'; // Optional: if needed for typing or complex mocks

// --- Dependencies to Mock ---
import {PrerequisiteEvaluationService} from '../../services/prerequisiteEvaluationService.js';
// NOTE: We do NOT mock ActionValidationContextBuilder or JsonLogicEvaluationService here,
// as AVS does not directly depend on them anymore.

// --- Mocks Needed ---
// Mock the PES service (which encapsulates context building and rule evaluation)
jest.mock('../../services/prerequisiteEvaluationService.js');

// --- Test Suite ---
describe('ActionValidationService: Orchestration Logic', () => {

  // --- Mock Variables ---
  let mockEntityManager;
  let mockLogger;
  let mockDomainContextCompatibilityChecker;
  let mockPrerequisiteEvaluationService; // Mock for the delegated service
  let actionValidationService; // Service instance under test

  // --- Mock Entity Helper ---
  // (Keep the existing helper function as it's useful)
  const createMockEntity = (id, components = [], customProps = {}) => {
    const componentSet = new Set(components);
    const mockEntity = {
      id: id,
      hasComponent: jest.fn((componentId) => componentSet.has(componentId)),
      getComponent: jest.fn((componentId) => componentSet.has(componentId) ? {id: componentId} : undefined),
      // Mock the method expected by ActionValidationContextBuilder (used *inside* PES)
      // If the real entity has this, mock it; otherwise, omit or mock appropriately based on real Entity structure.
      getAllComponentsData: jest.fn(() => {
        const data = {};
        componentSet.forEach(compId => {
          data[compId] = {id: compId};
        });
        return data;
      }),
      name: `Mock Entity ${id}`,
      locationId: 'location1',
      level: 5, // Example property that might be used in rules
      ...customProps,
    };
    return mockEntity;
  };


  // --- Test Setup ---
  beforeEach(() => {
    // Clear previous mocks
    jest.clearAllMocks();

    // Basic Mocks
    mockLogger = {info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn()};
    const mockEntities = new Map();
    mockEntityManager = {
      getEntityInstance: jest.fn((id) => mockEntities.get(id)),
      _addEntity: (entity) => mockEntities.set(entity.id, entity),
    };
    mockDomainContextCompatibilityChecker = {check: jest.fn().mockReturnValue(true)};

    // --- Instantiate Mock PrerequisiteEvaluationService ---
    // Use the automatically mocked constructor from jest.mock
    mockPrerequisiteEvaluationService = new PrerequisiteEvaluationService();

    // --- CORRECTED MOCK SETUP ---
    // Ensure the 'evaluate' property exists and is a mock function.
    // Even if jest.mock created it, we might redefine it or ensure its properties.
    // It's safer to just assign our desired mock function directly.
    mockPrerequisiteEvaluationService.evaluate = jest.fn(); // Assign a fresh Jest mock function

    // *** MANUALLY set the 'length' property to satisfy the constructor's check ***
    Object.defineProperty(mockPrerequisiteEvaluationService.evaluate, 'length', {
      value: 4, // The expected number of arguments for the real evaluate method
      writable: false // Typically function lengths aren't writable
    });

    // Set the default mock behavior (can be overridden per test)
    mockPrerequisiteEvaluationService.evaluate.mockReturnValue(true);
    // --- END CORRECTION ---


    // --- Instantiate the Service Under Test ---
    // Now, the mock PES passed in will have an 'evaluate' function with .length === 4
    actionValidationService = new ActionValidationService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      domainContextCompatibilityChecker: mockDomainContextCompatibilityChecker,
      prerequisiteEvaluationService: mockPrerequisiteEvaluationService, // Inject the correctly prepared mock PES
    });
  });

  // --- Test Cases ---

  it('should return true when domain compatible, target exists (or not required), and prerequisites pass via PES', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    const target = createMockEntity('target1');
    mockEntityManager._addEntity(actor);
    mockEntityManager._addEntity(target);
    const prerequisites = [{logic: {'==': [1, 1]}}]; // Example prerequisites
    const actionDefinition = {
      id: 'action:success',
      target_domain: 'entity',
      prerequisites: prerequisites,
    };
    const targetContext = ActionTargetContext.forEntity('target1');

    // Configure Mocks (PES defaults to true, DCCC defaults to true)

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert
    expect(isValid).toBe(true);
    // Verify initial checks performed by AVS
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDefinition, targetContext);
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target1'); // Step 2 check

    // Verify delegation to PES
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    // Check that PES was called with the correct arguments
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledWith(
      prerequisites,      // The prerequisites array
      actionDefinition,   // The action definition
      actor,              // The actor entity
      targetContext       // The target context
    );

    // Verify logging indicates success path
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled(); // Assuming target exists
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`START Validation: action='${actionDefinition.id}'`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 1 PASSED'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 2 PASSED'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 3 PASSED'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Delegating prerequisite evaluation'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 4 PASSED')); // Because PES returned true
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefinition.id}'`));
  });

  it('should return false when domain/context compatibility check fails (Step 1)', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    const actionDefinition = {id: 'action:domainFail', target_domain: 'entity', prerequisites: []};
    const targetContext = ActionTargetContext.forDirection('north'); // Mismatched context
    mockDomainContextCompatibilityChecker.check.mockReturnValue(false); // Simulate failure

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert
    expect(isValid).toBe(false);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDefinition, targetContext);
    // Ensure subsequent steps (including PES delegation) were NOT called
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 FAILED'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Domain/Context)'));
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should return false for a "self" target domain when target context is a different entity (Step 1)', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    const otherEntity = createMockEntity('actor2'); // A different entity
    mockEntityManager._addEntity(actor);
    mockEntityManager._addEntity(otherEntity);
    const actionDefinition = {id: 'action:selfTargetFail', target_domain: 'self', prerequisites: []};
    const targetContext = ActionTargetContext.forEntity('actor2'); // Targeting the other entity
    // Assume DCCC.check passes the basic type check initially
    mockDomainContextCompatibilityChecker.check.mockReturnValue(true);

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert - Specific 'self mismatch' check in _checkDomainAndContext should fail it
    expect(isValid).toBe(false);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDefinition, targetContext);
    // Ensure subsequent steps were NOT called after the internal 'self' check failed
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("STEP 1 FAILED ('self' target mismatch)"));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Domain/Context)'));
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // AVS *does* still check for target existence (Step 2) and logs a warning,
  // but it proceeds to prerequisite evaluation regardless. The outcome depends on PES.
  it('should log a warning for missing target entity (Step 2) but proceed and pass if PES passes', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const prerequisites = [{logic: {'==': [1, 1]}}]; // Prereqs don't rely on target
    const actionDefinition = {
      id: 'action:targetMissingButPass',
      target_domain: 'entity',
      prerequisites: prerequisites,
    };
    const targetContext = ActionTargetContext.forEntity('target_missing'); // This entity doesn't exist
    // Mocks: DCCC passes, PES passes (default)

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert
    expect(isValid).toBe(true); // Validation passes because PES mock returned true
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target_missing'); // Step 2 attempted

    // Check for the warning log about missing target from AVS Step 2
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Target entity \'target_missing\' not found during validation')
    );

    // Verify delegation to PES occurred correctly
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledWith(
      prerequisites,
      actionDefinition,
      actor,
      targetContext
    );

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefinition.id}'`));
  });

  it('should return false when prerequisite evaluation fails via PES (Step 4)', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const prerequisites = [{logic: {'<': [{var: 'actor.level'}, 5]}, failure_message: 'Level too low'}];
    const actionDefinition = {
      id: 'action:prereqFail',
      target_domain: 'none',
      prerequisites: prerequisites,
    };
    const targetContext = ActionTargetContext.noTarget();
    // Configure Mocks: DCCC passes (default), PES fails
    mockPrerequisiteEvaluationService.evaluate.mockReturnValueOnce(false);

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert
    expect(isValid).toBe(false);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled(); // Step 1 called
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // No target entity ID in context
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1); // Step 4 called
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledWith(
      prerequisites,
      actionDefinition,
      actor,
      targetContext
    );

    // Check logging indicates failure during Step 4 processing
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Delegating prerequisite evaluation'));
    // Note: AVS doesn't log "STEP 4 FAILED" explicitly anymore, it logs the end result based on PES return
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Prerequisite Not Met or Error during evaluation)'));
    expect(mockLogger.error).not.toHaveBeenCalled();
    // The specific "Reason: Level too low" log would come from *within* PES, not AVS.
  });

  it('should return true and skip PES evaluation when there are no prerequisites defined (empty array)', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const actionDefinition = {id: 'action:noPrereqs', target_domain: 'none', prerequisites: []}; // Empty array
    const targetContext = ActionTargetContext.noTarget();
    // Mocks: DCCC passes (default)

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert
    expect(isValid).toBe(true);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled(); // Step 1
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // Step 2 (no target id)
    // Crucially, PES evaluate should NOT have been called
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();

    // Verify logging indicates skipping Step 4
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 3 PASSED (Prerequisites Collected: 0)'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 4 SKIPPED (No prerequisites to evaluate)'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefinition.id}'`));
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should return true and skip PES evaluation when prerequisites property is null or undefined', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const actionDefNull = {id: 'action:nullPrereqs', target_domain: 'none', prerequisites: null};
    const actionDefUndefined = {id: 'action:undefPrereqs', target_domain: 'none' /* prerequisites undefined */};
    const targetContext = ActionTargetContext.noTarget();

    // Act
    const isValidNull = actionValidationService.isValid(actionDefNull, actor, targetContext);
    const isValidUndefined = actionValidationService.isValid(actionDefUndefined, actor, targetContext);

    // Assert
    expect(isValidNull).toBe(true);
    expect(isValidUndefined).toBe(true);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledTimes(2); // Called for each validation
    // PES should not be called in either case
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();

    // Check logging for both calls indicates skipping Step 4
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`action='${actionDefNull.id}'`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 4 SKIPPED'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefNull.id}'`));

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`action='${actionDefUndefined.id}'`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 4 SKIPPED'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefUndefined.id}'`));
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should return false and log error if prerequisite evaluation (PES) throws an unexpected error', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const prerequisites = [{logic: {'==': [1, 1]}}];
    const actionDefinition = {id: 'action:pesError', target_domain: 'none', prerequisites: prerequisites};
    const targetContext = ActionTargetContext.noTarget();
    const evaluationError = new Error('PES exploded unexpectedly!');

    // Configure Mocks: DCCC passes, PES throws an error
    mockPrerequisiteEvaluationService.evaluate.mockImplementation(() => {
      throw evaluationError;
    });

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert
    expect(isValid).toBe(false); // Fails because the call to PES threw an error
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled(); // Step 1 still happens
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1); // Step 4 was attempted

    // Check for the specific UNEXPECTED ERROR log from AVS's catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      `Validation[${actionDefinition.id}]: UNEXPECTED ERROR during validation process for actor '${actor.id}': ${evaluationError.message}`,
      expect.objectContaining({error: evaluationError}) // Check the error object itself was logged
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: FAILED (Unexpected Error) for action '${actionDefinition.id}'`));
  });

  it('should return false and log error (then throw) if structural sanity check fails (Step 0)', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    const actionDefinition = {id: 'action:structuralFail'}; // Valid enough for this test
    const invalidTargetContext = {type: 'invalid'}; // Not an ActionTargetContext instance

    // Act & Assert
    expect(() => {
      actionValidationService.isValid(actionDefinition, actor, invalidTargetContext);
    }).toThrow('ActionValidationService.isValid: targetContext must be ActionTargetContext');

    // Assert logging indicates the structural failure before the throw
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Validation: STRUCTURAL ERROR: ActionValidationService.isValid: targetContext must be ActionTargetContext'),
      expect.any(Object) // Check that some context object was logged
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: FAILED (Structural Sanity - Throwing)'));

    // Ensure later steps were not reached
    expect(mockDomainContextCompatibilityChecker.check).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  // Test for invalid prerequisite format (Step 3 warning)
  it('should log warning and treat as empty if prerequisites property is not an array (Step 3)', () => {
    // Arrange
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const actionDefinition = {
      id: 'action:invalidPrereqs',
      target_domain: 'none',
      prerequisites: {invalid: 'not an array'} // Invalid format
    };
    const targetContext = ActionTargetContext.noTarget();

    // Act
    const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

    // Assert
    expect(isValid).toBe(true); // Should pass as if no prerequisites
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled(); // Step 1
    // PES should not be called because prerequisites are treated as empty
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();

    // Verify the warning log from Step 3 (_collectAndValidatePrerequisites)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Action '${actionDefinition.id}' has a 'prerequisites' property, but it's not an array`)
    );

    // Verify logging indicates skipping Step 4
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 3 PASSED (Prerequisites Collected: 0)')); // Collected 0 valid ones
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('→ STEP 4 SKIPPED'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefinition.id}'`));
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

});
